const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

/**
 * Re-runs RNFirebase's app-target SPM linking after CocoaPods has integrated
 * the client project, so a freshly prebuilt `ios/` links on the first try.
 *
 * `AppDelegate.swift` calls `FirebaseApp.configure()`, which needs
 * `FirebaseCore` linked into the app target itself — RNFirebase does that in
 * `rnfirebase_add_spm_core_to_app_target`, adding an SPM product dependency
 * for it. That function skips any target without a `[CP] Embed Pods
 * Frameworks` build phase, and CocoaPods only adds that phase while
 * "Integrating client project" — which runs *after* `post_install`. On a
 * freshly created `ios/` the phase therefore does not exist yet, the linking
 * is skipped, and the build dies at link time:
 *
 *   Undefined symbols for architecture arm64:
 *     "_OBJC_CLASS_$_FIRApp", referenced from: in AppDelegate.o
 *
 * A second `pod install` fixes it, because by then the phase is there from
 * the first run — which is exactly the chicken-and-egg this plugin removes.
 * `post_integrate` runs after integration, so the guard passes on the first
 * install. RNFirebase's own function is reused rather than reimplemented, and
 * it is idempotent, so the ordinary path where it already ran is a no-op.
 *
 * Drop this plugin once RNFirebase does its app-target linking from
 * `post_integrate` itself.
 */

// Anchored on the end of the `target ... do ... end` block, so `post_integrate`
// lands at Podfile top level where CocoaPods expects it.
const ANCHOR = /^end\s*$/m;

const MARKER = 'rnfirebase_add_spm_core_to_app_target';

const PATCH = `
# Added by plugins/withFirebaseCoreSpmLink.js — see that file for why.
post_integrate do |installer|
  if respond_to?(:${MARKER}, true)
    ${MARKER}(installer)
  end
end
`;

const patchPodfile = (contents) => {
  if (contents.includes(MARKER)) {
    return contents;
  }

  if (!ANCHOR.test(contents)) {
    throw new Error(
      'withFirebaseCoreSpmLink: no top-level `end` found in the Podfile. The ' +
        'Expo template changed — re-anchor the patch, or drop this plugin if ' +
        'RNFirebase now links FirebaseCore from `post_integrate`.',
    );
  }

  return `${contents.trimEnd()}\n${PATCH}`;
};

const withFirebaseCoreSpmLink = (config) =>
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

module.exports = withFirebaseCoreSpmLink;
module.exports.patchPodfile = patchPodfile;
