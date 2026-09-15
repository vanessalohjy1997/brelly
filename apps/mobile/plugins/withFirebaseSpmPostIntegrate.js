const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

/**
 * Re-runs RNFirebase's app-target `pod install` work from `post_integrate`, so
 * a freshly prebuilt `ios/` is correct on the first try.
 *
 * `node_modules/@react-native-firebase/app/firebase_spm.rb` does four things to
 * the *app's own* target, and every one of them is guarded on the target
 * already having a `[CP] Embed Pods Frameworks` build phase:
 *
 *   rnfirebase_add_spm_embed_phase                  (firebase_spm.rb:298)
 *   rnfirebase_verify_spm_embed_phase_applied!      (firebase_spm.rb:345)
 *   rnfirebase_add_spm_core_to_app_target           (firebase_spm.rb:696)
 *   rnfirebase_fix_spm_archive_signature_collision  (firebase_spm.rb:858)
 *
 * All four run from `post_install`, and CocoaPods only adds that phase while
 * "Integrating client project" — which runs *after* `post_install`. On a
 * freshly created `ios/` the phase therefore does not exist yet and all four
 * silently skip. A second `pod install` fixes it, because by then the phase is
 * there from the first run; `post_integrate` runs after integration, so the
 * guard passes on the first install and one prebuild is enough. RNFirebase's
 * own functions are reused rather than reimplemented, and each is idempotent,
 * so the ordinary path where they already ran is a no-op.
 *
 * Each omission fails differently, and all three were reached in order:
 *
 * - **Embed phase missing** — Firebase's Swift Package frameworks never get
 *   copied into the app bundle, and the app dies at launch with a
 *   missing-library dyld error. Note the safety net that exists precisely to
 *   catch this, `rnfirebase_verify_spm_embed_phase_applied!`, carries the same
 *   `[CP] Embed Pods Frameworks` guard as the function it checks — so on a
 *   fresh `ios/` it skips too and never fires. It is re-run here for the same
 *   reason as the rest, which is what finally makes it a real safety net.
 * - **FirebaseCore not linked into the app target** — `AppDelegate.swift` calls
 *   `FirebaseApp.configure()`, so the link is required, and without it the
 *   build dies with `Undefined symbols for architecture arm64: "_OBJC_CLASS_$_FIRApp",
 *   referenced from: in AppDelegate.o`.
 * - **Signature-collision phase missing** — a Release *archive* (so: not any
 *   local Debug build, only the thing you ship) fails in fastlane with
 *   `"openssl_grpc.xcframework-ios.signature" couldn't be copied to "Signatures"
 *   because an item with the same name already exists`. That is Xcode staging
 *   one SPM binary target's `.signature` file into two targets' build
 *   directories; the phase deletes the duplicates before the archive collects
 *   them. EAS build 4 is where this one surfaced.
 *
 * The last of those is why this runs on EAS and not just locally: EAS Build
 * prebuilds a fresh `ios/` on every run, so it gets the first-`pod install`
 * behaviour every time, while a local checkout has long since had its second
 * `pod install` and looks fine. Don't conclude from a working local build that
 * this plugin is unnecessary — check the generated project instead:
 * `grep -c 'name = "\[RNFB\]' ios/brelly.xcodeproj/project.pbxproj` returns 2,
 * the two phases below. Match on `name = ` rather than counting bare `[RNFB]`,
 * which returns 9 because each phase is referenced several times; and note the
 * third RNFB phase, `[CP-User] [RNFB] Core Configuration`, is CocoaPods' own
 * `script_phase` and lands with or without this plugin.
 *
 * It then does one thing RNFirebase does not: narrows the embed phase the first
 * hook just installed so it only ever copies *dynamic* frameworks.
 * `rnfirebase_spm_embed_script`'s second sweep reads
 * `${OBJROOT}/UninstalledProducts/${PLATFORM_NAME}`, which the Archive action
 * fills with every build product rather than only Swift Package ones, and
 * matches them with a bare `find -name "*.framework"`. CocoaPods' static pod
 * frameworks are in there too — 24 of them, `Pods_brelly.framework` included —
 * and a static `ar` archive under `Frameworks/` is rejected by App Store
 * validation as ITMS-90171. The guard is spliced in after one literal line of
 * upstream's script rather than replacing it, so a future RNFirebase fix
 * survives; `pod install` raises if that line ever moves, and a test greps
 * `firebase_spm.rb` for it so the break lands at `yarn test` instead.
 *
 * Only an archive reaches any of this. The sweep is inert in a Debug or
 * simulator build, and the EAS build itself succeeds either way — the rejection
 * arrives at `eas submit`. See NOTES.md round 22.
 *
 * Drop the four hooks once RNFirebase does its app-target work from
 * `post_integrate` itself; drop the guard once its embed sweep filters
 * non-dynamic frameworks on its own.
 */

// Anchored on the end of the `target ... do ... end` block, so `post_integrate`
// lands at Podfile top level where CocoaPods expects it.
const ANCHOR = /^end\s*$/m;

// Ordered as RNFirebase's own `post_install` runs them: the embed phase has to
// exist before the verifier that asserts it does.
const HOOKS = [
  'rnfirebase_add_spm_embed_phase',
  'rnfirebase_add_spm_core_to_app_target',
  'rnfirebase_fix_spm_archive_signature_collision',
  'rnfirebase_verify_spm_embed_phase_applied!',
];

const SENTINEL = 'Added by plugins/withFirebaseSpmPostIntegrate.js';

// The embed phase `rnfirebase_add_spm_embed_phase` installs, and the one line
// of `rnfirebase_spm_embed_script` the dynamic-only guard is spliced in after.
// Both are literals copied from `firebase_spm.rb`, so an upstream rewrite fails
// `pod install` loudly (and the test that greps for the anchor fails in CI)
// rather than leaving the guard silently unapplied.
const EMBED_PHASE_NAME = '[RNFB] Embed Firebase SPM Frameworks';
const EMBED_ANCHOR = 'framework_name="$(basename "${framework}")"';

// Marks an already-guarded script, so re-running is a no-op.
const EMBED_SENTINEL = 'BRELLY_EMBED_DYLIBS_ONLY';

// Matches this plugin's own previously-appended block, so re-running upgrades
// it in place rather than adding a second `post_integrate` (a Podfile's second
// one silently replaces the first, which would quietly undo all of this). The
// old `withFirebaseCoreSpmLink.js` name is matched too, so an `ios/` prebuilt
// before the rename is upgraded rather than duplicated.
//
// Bounded by the first `end` at column 0 rather than by end-of-file:
// `withExpoUiReactHeaderFix.js` appends a sibling block to this same Podfile,
// and a match that ran to EOF would delete it whenever the two ran in the other
// order — silently bringing back `'React/RCTSurfaceTouchHandler.h' file not
// found`. Every `end` inside our own block is indented, so the unindented one
// is always this block's terminator.
const PRIOR_BLOCK =
  /\n*# Added by plugins\/with(?:FirebaseCoreSpmLink|FirebaseSpmPostIntegrate)\.js[^\n]*\npost_integrate do \|installer\|\n[\s\S]*?\nend\n?/;

// `respond_to?` guards each call so a Podfile where RNFirebase's Ruby was never
// loaded — SPM disabled, or the package removed — still installs.
const PATCH = `
# ${SENTINEL} — see that file for why.
post_integrate do |installer|
${HOOKS.map(
  (hook) => `  if respond_to?(:${hook}, true)
    ${hook}(installer)
  end`,
).join('\n')}

  # ${EMBED_SENTINEL}: narrow the embed phase the first hook just installed so
  # it only ever copies dynamic frameworks — see
  # plugins/withFirebaseSpmPostIntegrate.js for what goes wrong without this.
  embed_phase_name = '${EMBED_PHASE_NAME}'
  embed_anchor = '${EMBED_ANCHOR}'
  embed_guard = <<~'GUARD'
    # ${EMBED_SENTINEL} — added by plugins/withFirebaseSpmPostIntegrate.js.
    # The sweep below runs over every archive-time build product, not just Swift
    # Package ones, so it also finds CocoaPods' static pod frameworks. A static
    # \`ar\` archive inside Frameworks/ is rejected by App Store validation as
    # ITMS-90171. Nothing needs it there: dyld cannot load an ar archive, and
    # its code is already linked into the app binary.
    framework_binary="\${framework}/$(basename "\${framework}" .framework)"
    if [ ! -f "\${framework_binary}" ]; then
      declared_binary="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "\${framework}/Info.plist" 2>/dev/null || true)"
      framework_binary="\${framework}/\${declared_binary}"
    fi
    # Unreadable or unidentifiable binaries fall through to the copy on purpose:
    # embedding one spare framework is a validation warning, while dropping one
    # the app really links is a dyld crash at launch.
    if [ -f "\${framework_binary}" ]; then
      case "$(/usr/bin/file -b "\${framework_binary}" 2>/dev/null || true)" in
        *"dynamically linked shared library"*) ;;
        *)
          echo "Skipping \${framework_name}: not a dynamic framework (ITMS-90171)"
          continue
          ;;
      esac
    fi
  GUARD

  installer.aggregate_targets.each do |aggregate_target|
    project = aggregate_target.user_project
    guarded = false

    project.native_targets.each do |target|
      next unless target.respond_to?(:shell_script_build_phases)

      target.shell_script_build_phases.each do |phase|
        next unless phase.name == embed_phase_name
        next if phase.shell_script.include?('${EMBED_SENTINEL}')

        unless phase.shell_script.include?(embed_anchor)
          raise Pod::Informative, <<~MSG
            withFirebaseSpmPostIntegrate: '#{embed_phase_name}' no longer
            contains the line the dynamic-only guard anchors on. RNFirebase
            rewrote rnfirebase_spm_embed_script — re-anchor EMBED_ANCHOR in
            plugins/withFirebaseSpmPostIntegrate.js, or drop the guard if the
            sweep now filters non-dynamic frameworks itself.
          MSG
        end

        phase.shell_script =
          phase.shell_script.sub(embed_anchor, "#{embed_anchor}\\n#{embed_guard}")
        guarded = true
      end
    end

    project.save if guarded
  end
end
`;

const patchPodfile = (contents) => {
  const stripped = contents.replace(PRIOR_BLOCK, '');

  if (!ANCHOR.test(stripped)) {
    throw new Error(
      'withFirebaseSpmPostIntegrate: no top-level `end` found in the Podfile. ' +
        'The Expo template changed — re-anchor the patch, or drop this plugin ' +
        'if RNFirebase now does its app-target work from `post_integrate`.',
    );
  }

  return `${stripped.trimEnd()}\n${PATCH}`;
};

const withFirebaseSpmPostIntegrate = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const podfile = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );

      fs.writeFileSync(podfile, patchPodfile(fs.readFileSync(podfile, 'utf8')));

      return config;
    },
  ]);

module.exports = withFirebaseSpmPostIntegrate;
module.exports.patchPodfile = patchPodfile;
module.exports.HOOKS = HOOKS;
module.exports.EMBED_PHASE_NAME = EMBED_PHASE_NAME;
module.exports.EMBED_ANCHOR = EMBED_ANCHOR;
module.exports.EMBED_SENTINEL = EMBED_SENTINEL;
