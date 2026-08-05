import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useTheme } from "@/hooks/useTheme";

export default function AppTabs() {
  const colors = useTheme();

  return (
    // The selected tab is the app's `primary` violet on both platforms — the
    // same colour every other action in the app uses. Unselected tabs sit on
    // `textSecondary` rather than a faded `text`, so the pair reads as a
    // deliberate contrast and both clear AA on `background`.
    <NativeTabs
      backgroundColor={colors.background}
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
    </NativeTabs>
  );
}
