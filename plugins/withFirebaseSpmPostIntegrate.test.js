jest.mock('expo/config-plugins', () => ({
  withDangerousMod: jest.fn(),
}));

const { patchPodfile, HOOKS } = require('./withFirebaseSpmPostIntegrate');

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
