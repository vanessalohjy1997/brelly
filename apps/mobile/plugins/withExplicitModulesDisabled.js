const { withXcodeProject } = require('expo/config-plugins');

/**
 * Turns Xcode 26's explicit modules off for *every* build configuration in the
 * app project, including the project-level ones.
 *
 * `@react-native-firebase` 26 resolves `firebase-ios-sdk` through SPM, and
 * Firebase's internal SPM targets (`FirebaseCoreInternal`,
 * `FirebaseSharedSwift`) are not exposed as public products, so Xcode 26's
 * dependency scanner refuses to build them:
 *
 *   'FirebaseCore' is missing a dependency on 'FirebaseCoreInternal' because
 *   dependency scan of 'FIRHeartbeatLogger.m' discovered a dependency on
 *   'FirebaseCoreInternal'
 *
 * Two things already try to prevent this and neither is enough on its own.
 * React Native's `react_native_post_install` sets `SWIFT_ENABLE_EXPLICIT_MODULES`
 * — but only the Swift half. RNFirebase's `rnfirebase_apply_spm_build_settings`
 * sets both halves — but only walks `project.native_targets`, so it never
 * touches the project-level configurations. Swift Package targets inherit from
 * the *project*, which leaves `CLANG_ENABLE_EXPLICIT_MODULES` on there, and the
 * failing scan above is a Clang scan.
 *
 * Setting both on every configuration closes the gap. It does not disable SPM;
 * it only forces implicit module discovery (the Xcode 16 default) uniformly
 * across the app, CocoaPods and SPM build boundary.
 */
const withExplicitModulesDisabled = (config) =>
  withXcodeProject(config, (config) => {
    const configurations =
      config.modResults.pbxXCBuildConfigurationSection();

    for (const entry of Object.values(configurations)) {
      // The section is interleaved with `<uuid>_comment` string entries.
      if (typeof entry !== 'object' || !entry?.buildSettings) {
        continue;
      }

      entry.buildSettings.CLANG_ENABLE_EXPLICIT_MODULES = 'NO';
      entry.buildSettings.SWIFT_ENABLE_EXPLICIT_MODULES = 'NO';
    }

    return config;
  });

module.exports = withExplicitModulesDisabled;
