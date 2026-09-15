import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useTheme } from "@/hooks/useTheme";

export default function AppTabs() {
  const colors = useTheme();

  return (
    // The selected tab is the app's `primary` violet on both platforms — the
    // same colour every other action in the app uses. Unselected tabs sit on
    // `textSecondary` rather than a faded `text`, so the pair reads as a
    // deliberate contrast and both clear AA on `background`.
    //
    // The bar is made opaque so a scrolling list doesn't bleed through it and
    // cost the icons their contrast. This is a two-part fix: on iOS 26 the
    // system draws the bar as translucent Liquid Glass and these props are
    // no-ops, so the whole app is opted out of the redesign with
    // `UIDesignRequiresCompatibility` in app.json — and *that* is what makes
    // `blurEffect`, `shadowColor` and `disableTransparentOnScrollEdge` take
    // effect here (they apply to the iOS 18-style bar only). Without the flag
    // these do nothing; without these the flagged bar still keeps iOS 18's
    // default translucent blur. `shadowColor` is the hairline that separates
    // the now-opaque bar from the page it shares a colour with.
    <NativeTabs
      backgroundColor={colors.background}
      blurEffect="none"
      disableTransparentOnScrollEdge
      shadowColor={colors.border}
      tintColor={colors.primary}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.primary },
      }}
      indicatorColor={colors.backgroundSelected}
      rippleColor={colors.backgroundSelected}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/home.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="plans">
        <NativeTabs.Trigger.Label>Plans</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/explore.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
