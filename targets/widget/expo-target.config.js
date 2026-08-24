/**
 * WidgetKit target for the next-stop weather glance.
 *
 * `@bacons/apple-targets` discovers this directory during `expo prebuild`
 * because it holds an `expo-target.config.js`, and generates a native widget
 * extension target from it — the Xcode target, its `Info.plist`, its
 * entitlements, and the asset catalog for the colours below. None of that is
 * reachable from `app.json` alone, which is why the widget is the one backlog
 * item that could not be built without a native target (see PLAN.md / NOTES.md).
 *
 * The App Group here MUST match the app's own entitlement in `app.json`
 * (`ios.entitlements`) and `WIDGET_APP_GROUP` in
 * `src/services/widgetBridge.ts` — the app writes the glance into that shared
 * container and the widget reads it back. `appleTeamId` is intentionally
 * omitted: it defaults to the main app target's team, which EAS resolves from
 * the project credentials, and a hardcoded placeholder would be forwarded to
 * signing verbatim (see the App Store Connect note in NOTES.md).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "widget",
  name: "BrellyWidget",
  displayName: "Brelly",
  icon: "../../assets/icon/light-hook.png",
  // Matches the app's own iOS minimum (see the SwiftUICore note in NOTES.md).
  // `accessoryRectangular`/`accessoryInline` (the lock-screen families) need
  // iOS 16; the `containerBackground` on iOS 17 is guarded in Swift.
  deploymentTarget: "16.4",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.sg.brelly.app"],
  },
  // The umbrella pair from `src/constants/theme.ts`, generated as light/dark
  // colour assets so the home-screen widget reads the same in both themes.
  // Referenced from Swift as `Color("umbrellaRain")` / `Color("umbrellaSun")`.
  colors: {
    umbrellaRain: { color: "#2E6FB5", darkColor: "#7FB3E8" },
    umbrellaSun: { color: "#B2650A", darkColor: "#F0B45C" },
  },
});
