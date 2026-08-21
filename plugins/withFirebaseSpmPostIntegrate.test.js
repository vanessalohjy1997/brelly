jest.mock('expo/config-plugins', () => ({
  withDangerousMod: jest.fn(),
}));

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  patchPodfile,
  HOOKS,
  EMBED_PHASE_NAME,
  EMBED_ANCHOR,
  EMBED_SENTINEL,
} = require('./withFirebaseSpmPostIntegrate');

// The shape the Expo template generates, trimmed to what the anchor needs.
const PODFILE = `target 'brelly' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

// What `withFirebaseCoreSpmLink.js` appended before it was renamed and widened.
const PODFILE_PATCHED_BY_OLD_PLUGIN = `${PODFILE.trimEnd()}

# Added by plugins/withFirebaseCoreSpmLink.js — see that file for why.
post_integrate do |installer|
  if respond_to?(:rnfirebase_add_spm_core_to_app_target, true)
    rnfirebase_add_spm_core_to_app_target(installer)
  end
end
`;

describe('patchPodfile', () => {
  it('appends a post_integrate hook that re-runs every guarded RNFirebase step', () => {
    const patched = patchPodfile(PODFILE);

    expect(patched).toContain('post_integrate do |installer|');
    for (const hook of HOOKS) {
      expect(patched).toContain(`${hook}(installer)`);
    }
  });

  it('re-runs the three steps whose absence breaks a build, plus the verifier', () => {
    // Named individually rather than via HOOKS so dropping one from the list
    // fails here instead of silently shrinking what the plugin repairs.
    const patched = patchPodfile(PODFILE);

    // Without it the app crashes at launch with a dyld error.
    expect(patched).toContain('rnfirebase_add_spm_embed_phase(installer)');
    // Without it the build fails to link _OBJC_CLASS_$_FIRApp.
    expect(patched).toContain('rnfirebase_add_spm_core_to_app_target(installer)');
    // Without it a Release archive fails on a duplicate .signature file.
    expect(patched).toContain(
      'rnfirebase_fix_spm_archive_signature_collision(installer)',
    );
    // Carries the same guard as the step it checks, so it needs re-running too.
    expect(patched).toContain(
      'rnfirebase_verify_spm_embed_phase_applied!(installer)',
    );
  });

  it('adds the embed phase before the verifier that asserts it exists', () => {
    const patched = patchPodfile(PODFILE);

    expect(patched.indexOf('rnfirebase_add_spm_embed_phase(installer)')).
      toBeLessThan(
        patched.indexOf('rnfirebase_verify_spm_embed_phase_applied!(installer)'),
      );
  });

  it('guards each call so a Podfile without RNFirebase loaded still installs', () => {
    const patched = patchPodfile(PODFILE);

    for (const hook of HOOKS) {
      expect(patched).toContain(`respond_to?(:${hook}, true)`);
    }
  });

  it('puts the hook at top level, outside the target block', () => {
    const lines = patchPodfile(PODFILE).split('\n');

    const hookLine = lines.findIndex((l) => l.startsWith('post_integrate do'));
    const targetEnd = lines.findIndex((l) => l === 'end');

    expect(hookLine).toBeGreaterThan(targetEnd);
  });

  it('is idempotent, so a re-prebuild does not stack the hook', () => {
    const once = patchPodfile(PODFILE);

    expect(patchPodfile(once)).toBe(once);
  });

  it('upgrades a Podfile left behind by the old plugin instead of stacking a second hook', () => {
    const patched = patchPodfile(PODFILE_PATCHED_BY_OLD_PLUGIN);

    expect(patched.match(/post_integrate do \|installer\|/g)).toHaveLength(1);
    expect(patched).not.toContain('withFirebaseCoreSpmLink');
    expect(patched).toContain(
      'rnfirebase_fix_spm_archive_signature_collision(installer)',
    );
    expect(patched).toBe(patchPodfile(PODFILE));
  });

  it('leaves the original Podfile body untouched', () => {
    expect(patchPodfile(PODFILE)).toContain(
      "target 'brelly' do\n  use_expo_modules!",
    );
  });

  it('does not eat a sibling plugin’s block that follows its own', () => {
    // `withExpoUiReactHeaderFix.js` appends to this same Podfile, and plugin
    // order in app.json decides who lands last. Re-patching must upgrade only
    // this plugin's block — swallowing the other one silently brings back
    // `'React/RCTSurfaceTouchHandler.h' file not found`.
    const sibling = [
      '# Added by plugins/withExpoUiReactHeaderFix.js — see that file for why.',
      'post_install do |installer|',
      "  puts 'expo-ui header fix'",
      'end',
      '',
    ].join('\n');
    const both = `${patchPodfile(PODFILE).trimEnd()}\n\n${sibling}`;

    const repatched = patchPodfile(both);

    expect(repatched).toContain('withExpoUiReactHeaderFix');
    expect(repatched).toContain("puts 'expo-ui header fix'");
    expect(repatched.match(/post_integrate do \|installer\|/g)).toHaveLength(1);
  });

  it('throws when the anchor is gone rather than silently doing nothing', () => {
    expect(() => patchPodfile("target 'brelly' do\n")).toThrow(
      /no top-level `end`/,
    );
  });
});

// `firebase_spm.rb` is Ruby that only ever runs inside `pod install`, so the
// guard cannot be exercised through the plugin. These pull the real upstream
// script out of node_modules, splice the real guard into it the same way the
// generated Podfile does, and run the result — which is the only way to check
// what actually lands in `Frameworks/`.

const FIREBASE_SPM_RB = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-firebase',
  'app',
  'firebase_spm.rb',
);

const readFirebaseSpm = () => fs.readFileSync(FIREBASE_SPM_RB, 'utf8');

// `<<~` heredocs in both files are written at four spaces and dedented by Ruby.
const dedent = (block) =>
  block
    .split('\n')
    .map((line) => line.slice(4))
    .join('\n');

const guardBody = () =>
  dedent(
    patchPodfile(PODFILE).match(
      /embed_guard = <<~'GUARD'\n([\s\S]*?)\n {2}GUARD\n/,
    )[1],
  );

const splicedEmbedScript = () => {
  const upstream = dedent(
    readFirebaseSpm().match(
      /def rnfirebase_spm_embed_script\n {2}<<~'SCRIPT'\n([\s\S]*?)\n {2}SCRIPT\n/,
    )[1],
  );

  return upstream.replace(EMBED_ANCHOR, () => `${EMBED_ANCHOR}\n${guardBody()}`);
};

// A 32-byte mach_header_64 with filetype MH_DYLIB — enough for `file` to call
// it a dynamically linked shared library, which is all the guard looks at.
const machODylib = () => {
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0); // MH_MAGIC_64
  header.writeUInt32LE(0x0100000c, 4); // CPU_TYPE_ARM64
  header.writeUInt32LE(6, 12); // MH_DYLIB
  return header;
};

const AR_ARCHIVE = Buffer.from('!<arch>\n');

const describeBinary = (file) =>
  execFileSync('/usr/bin/file', ['-b', file], { encoding: 'utf8' }).trim();

/**
 * Lays each entry out as `<name>.framework` under an archive-style
 * `UninstalledProducts` folder, runs the spliced embed phase over it, and
 * returns what ended up in the app's `Frameworks/`. A `null` binary means the
 * framework has an Info.plist but no executable at all.
 */
const runEmbedPhase = (frameworks) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rnfb-embed-'));
  const source = path.join(root, 'UninstalledProducts', 'iphoneos');
  fs.mkdirSync(source, { recursive: true });

  for (const [name, binary] of Object.entries(frameworks)) {
    const bundle = path.join(source, `${name}.framework`);
    fs.mkdirSync(bundle);
    fs.writeFileSync(path.join(bundle, 'Info.plist'), '<plist/>');
    if (binary) {
      fs.writeFileSync(path.join(bundle, name), binary);
    }
  }

  const script = path.join(root, 'embed.sh');
  fs.writeFileSync(script, splicedEmbedScript());

  execFileSync('bash', [script], {
    stdio: 'pipe',
    env: {
      ...process.env,
      OBJROOT: root,
      PLATFORM_NAME: 'iphoneos',
      // Absent, so only the UninstalledProducts sweep — the archive path, and
      // the one that over-collects — does anything here.
      BUILT_PRODUCTS_DIR: path.join(root, 'absent'),
      TARGET_BUILD_DIR: root,
      FRAMEWORKS_FOLDER_PATH: 'Frameworks',
      EXPANDED_CODE_SIGN_IDENTITY: '',
    },
  });

  return fs.readdirSync(path.join(root, 'Frameworks')).sort();
};

describe('the dynamic-only embed guard', () => {
  it('still finds the upstream line it splices itself in after', () => {
    // The guard is anchored on a literal from `rnfirebase_spm_embed_script`.
    // When RNFirebase rewrites that script this fails here, at `yarn test`,
    // instead of on EAS as a rejected App Store build.
    expect(readFirebaseSpm()).toContain(EMBED_ANCHOR);
  });

  it('names the phase RNFirebase actually installs', () => {
    expect(readFirebaseSpm()).toContain(
      `RNFIREBASE_SPM_EMBED_PHASE_NAME = '${EMBED_PHASE_NAME}'`,
    );
  });

  it('rewrites that phase from the same post_integrate block as the hooks', () => {
    // A Podfile's second `post_integrate` silently replaces the first, so the
    // guard has to share a block with the hooks rather than append its own.
    const patched = patchPodfile(PODFILE);

    expect(patched.match(/post_integrate do \|installer\|/g)).toHaveLength(1);
    expect(patched).toContain(`phase.name == embed_phase_name`);
    expect(patched.indexOf('rnfirebase_add_spm_embed_phase(installer)')).
      toBeLessThan(patched.indexOf('embed_guard'));
  });

  it('leaves an already-guarded phase alone', () => {
    expect(patchPodfile(PODFILE)).toContain(
      `phase.shell_script.include?('${EMBED_SENTINEL}')`,
    );
  });

  it('splices into upstream’s script without breaking it', () => {
    const script = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'rnfb-syntax-')),
      'embed.sh',
    );
    fs.writeFileSync(script, splicedEmbedScript());

    expect(() =>
      execFileSync('bash', ['-n', script], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('reads a Mach-O dylib as dynamic on this host', () => {
    // Guards the fixture, not the plugin: the guard keys off `file -b` wording.
    // If this is the only failure below, update the fixture, not the guard.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rnfb-fixture-'));
    const dylib = path.join(dir, 'Sample');
    fs.writeFileSync(dylib, machODylib());

    expect(describeBinary(dylib)).toContain('dynamically linked shared library');
  });

  it('drops static frameworks and keeps dynamic ones', () => {
    // The whole point. A static `ar` archive under `Frameworks/` is what App
    // Store validation rejects as ITMS-90171, and the archive-time sweep finds
    // CocoaPods' static pod products alongside the Swift Package ones.
    expect(
      runEmbedPhase({
        FirebaseCore: machODylib(),
        ExpoCalendar: AR_ARCHIVE,
        Pods_brelly: AR_ARCHIVE,
      }),
    ).toEqual(['FirebaseCore.framework']);
  });

  it('embeds a framework it cannot identify rather than dropping it', () => {
    // Deliberate asymmetry: one spare framework is a validation warning, while
    // dropping one the app really links is a dyld crash at launch.
    expect(runEmbedPhase({ Mystery: null })).toEqual(['Mystery.framework']);
  });
});
