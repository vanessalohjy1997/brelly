import { router, Stack } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemePreference } from "@/utils/resolveColorScheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText type="linkPrimary">Done</ThemedText>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
          Appearance
        </ThemedText>
        <ThemedView
          type="backgroundElement"
          style={styles.optionGroup}
        >
          {OPTIONS.map((option) => {
            const selected = option.value === themePreference;
            return (
              <Pressable
                key={option.value}
                onPress={() => setThemePreference(option.value)}
                style={[
                  styles.option,
                  selected && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText style={selected && styles.optionSelectedText}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  optionGroup: {
    borderRadius: Spacing.two,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  optionSelectedText: {
    fontWeight: "700",
  },
});
