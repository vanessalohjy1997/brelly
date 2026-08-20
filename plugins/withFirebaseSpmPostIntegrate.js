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
 * Drop this plugin once RNFirebase does its app-target work from
 * `post_integrate` itself.
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
