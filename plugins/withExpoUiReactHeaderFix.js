const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

/**
 * Gives the `ExpoUI` pod the React VFS overlay it needs to compile.
 *
 * `@expo/ui`'s `ExpoUITouchHandlerHelper.mm` does `#import
 * <React/RCTSurfaceTouchHandler.h>`. That header belongs to React-RCTFabric,
 * and because `RCT_USE_PREBUILT_RNCORE=1` React ships as a prebuilt
 * `React.xcframework` whose headers sit under `React_Core/`,
 * `React_RCTFabric/` and friends rather than under `React/`. Clang resolves
 * `React` as a *framework* and stops there — it never falls back to the `-I`
 * header search paths, which do contain the header:
 *
 *   note: did not find header 'RCTSurfaceTouchHandler.h' in framework 'React'
 *
 * `ios/Pods/React-Core-prebuilt/React-VFS.yaml` is what maps the header back
 * into place — it overlays a virtual `React/` directory onto
 * `React.xcframework/Headers`, so the overlay is only useful alongside an
 * `-isystem` for that directory. Both flags are needed; the overlay alone
 * still fails. Pods opt into the overlay through React Native's
 * `add_rncore_dependency`, and into the `-isystem` through Expo's
 * `inject_isystem_flags`.
 * `ExpoUI.podspec` declares `s.dependency 'React-RCTFabric'` but never calls
 * it, so `ExpoUI` is the only Expo pod that imports a React Objective-C
 * header without the overlay — its xcconfig has no `OTHER_CFLAGS` line at
 * all. This is an upstream `@expo/ui` bug; the file is present in 57.0.7 too,
 * so there is no patch release to move to.
 *
 * The flags are set on the target rather than in the xcconfig because
 * target-level build settings win over the base configuration regardless of
 * what else edits it during `post_install`. Drop this plugin once
 * `ExpoUI.podspec` calls `add_rncore_dependency`.
 */

// Matches the whole `react_native_post_install(...)` call, so the patch lands
// at the end of `post_install` — after anything that rewrites pod xcconfigs.
const ANCHOR = /^([ \t]*)react_native_post_install\([\s\S]*?^\1\)\n/m;

const MARKER = 'React-VFS.yaml';

const PATCH = `
    # Added by plugins/withExpoUiReactHeaderFix.js — see that file for why.
    expo_ui_target = installer.pods_project.targets.find { |t| t.name == 'ExpoUI' }
    if expo_ui_target
      react_headers = '$(PODS_ROOT)/React-Core-prebuilt/React.xcframework/Headers'
      react_flags = "-ivfsoverlay $(PODS_ROOT)/React-Core-prebuilt/${MARKER} -isystem #{react_headers}"
      expo_ui_target.build_configurations.each do |config|
        ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS'].each do |key|
          current = config.build_settings[key] || '$(inherited)'
          current = current.join(' ') if current.is_a?(Array)
          next if current.include?('${MARKER}')
          config.build_settings[key] = "#{current} #{react_flags}"
        end
      end
    end
`;

const patchPodfile = (contents) => {
  if (contents.includes(MARKER)) {
    return contents;
  }

  if (!ANCHOR.test(contents)) {
    throw new Error(
      'withExpoUiReactHeaderFix: no `react_native_post_install(...)` call found ' +
        'in the Podfile. The Expo template changed — re-anchor the patch, or ' +
        'drop this plugin if `@expo/ui` now calls `add_rncore_dependency`.',
    );
  }

  return contents.replace(ANCHOR, (call) => call + PATCH);
};

const withExpoUiReactHeaderFix = (config) =>
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

module.exports = withExpoUiReactHeaderFix;
module.exports.patchPodfile = patchPodfile;
