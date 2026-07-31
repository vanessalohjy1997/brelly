import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
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

// Whole-hour choices only. A free-text time field needs validation and a
// keyboard; these cover the times anyone actually picks for a morning digest.
const DIGEST_TIMES = ["06:30", "07:30", "08:30"];
const QUIET_START_TIMES = ["21:00", "22:00", "23:00"];
const QUIET_END_TIMES = ["06:00", "07:00", "08:00"];

export default function SettingsScreen() {
  const theme = useTheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  const rainAlertsEnabled = useSettingsStore((state) => state.rainAlertsEnabled);
  const setRainAlertsEnabled = useSettingsStore(
    (state) => state.setRainAlertsEnabled,
  );
  const quietHours = useSettingsStore((state) => state.quietHours);
  const setQuietHours = useSettingsStore((state) => state.setQuietHours);
  const digest = useSettingsStore((state) => state.digest);
  const setDigest = useSettingsStore((state) => state.setDigest);

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton label="Done" onPress={() => router.back()} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Appearance
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.optionGroup}>
            {OPTIONS.map((option) => {
              const selected = option.value === themePreference;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setThemePreference(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
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

          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Notifications
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.optionGroup}>
            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Rain alerts</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  45 minutes before a stop that looks wet
                </ThemedText>
              </ThemedView>
              <Switch
                value={rainAlertsEnabled}
                onValueChange={setRainAlertsEnabled}
                accessibilityLabel="Rain alerts"
              />
            </ThemedView>

            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Daily digest</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  One summary of the day&apos;s stops each morning
                </ThemedText>
              </ThemedView>
              <Switch
                value={digest.enabled}
                onValueChange={(enabled) => setDigest({ enabled })}
                accessibilityLabel="Daily digest"
              />
            </ThemedView>

            {digest.enabled && (
              <ThemedView style={styles.subSetting}>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  Send at
                </ThemedText>
                <ChoiceRow
                  values={DIGEST_TIMES}
                  selected={digest.time}
                  onSelect={(time) => setDigest({ time })}
                />
              </ThemedView>
            )}

            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Quiet hours</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  Alerts that would land in this window aren&apos;t sent
                </ThemedText>
              </ThemedView>
              <Switch
                value={quietHours.enabled}
                onValueChange={(enabled) => setQuietHours({ enabled })}
                accessibilityLabel="Quiet hours"
              />
            </ThemedView>

            {quietHours.enabled && (
              <>
                <ThemedView style={styles.subSetting}>
                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    From
                  </ThemedText>
                  <ChoiceRow
                    values={QUIET_START_TIMES}
                    selected={quietHours.start}
                    onSelect={(start) => setQuietHours({ start })}
                  />
                </ThemedView>
                <ThemedView style={styles.subSetting}>
                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    Until
                  </ThemedText>
                  <ChoiceRow
                    values={QUIET_END_TIMES}
                    selected={quietHours.end}
                    onSelect={(end) => setQuietHours({ end })}
                  />
                </ThemedView>
              </>
            )}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChoiceRow({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.choiceRow}>
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.choice,
              {
                backgroundColor: isSelected
                  ? theme.backgroundSelected
                  : theme.background,
              },
            ]}
          >
            <ThemedText style={isSelected && styles.optionSelectedText}>
              {value}
            </ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: Spacing.two,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: "transparent",
  },
  switchLabel: {
    flexShrink: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
  hint: {
    fontSize: 12,
  },
  subSetting: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  choiceRow: {
    flexDirection: "row",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  choice: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
});
