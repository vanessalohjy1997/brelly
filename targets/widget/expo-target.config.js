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
  // `cardBackground` is the app's `backgroundElement` — the violet fill a plan
  // card sits on — so the home-screen widget reads as the same surface.
  //
  // The keys are `light` / `dark`: that is what `@bacons/apple-targets` v5
  // reads (`DynamicColor` in its types, and `with-widget.js` reads
  // `color.light` / `color.dark`). Its JSDoc `@example` still shows the old
  // `color` / `darkColor` names — those write an empty colorset, which renders
  // as the widget's default white. See NOTES round 30.
  colors: {
    umbrellaRain: { light: "#2E6FB5", dark: "#7FB3E8" },
    umbrellaSun: { light: "#B2650A", dark: "#F0B45C" },
    cardBackground: { light: "#ECE7F5", dark: "#332C44" },
  },
});
