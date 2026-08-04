import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { ToastHost } from "@/components/toast";
import { Spacing } from "@/constants/theme";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useTheme } from "@/hooks/useTheme";
import { IMPORT_HORIZON_DAYS } from "@/services/calendar";
import {
  countScheduledNotifications,
  sendTestNotification,
} from "@/services/notifications";
import { showToast } from "@/store/toastStore";
import {
  RAIN_LEAD_MINUTES,
  useSettingsStore,
  type RainLeadMinutes,
} from "@/store/settingsStore";
import { formatLeadTime, formatLeadTimeShort } from "@/utils/formatLeadTime";
import type { ThemePreference } from "@/utils/resolveColorScheme";
import { saveWithFeedback } from "@/utils/saveWithFeedback";

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
  const rainLeadMinutes = useSettingsStore((state) => state.rainLeadMinutes);
  const setRainLeadMinutes = useSettingsStore(
    (state) => state.setRainLeadMinutes,
  );
  const quietHours = useSettingsStore((state) => state.quietHours);
  const setQuietHours = useSettingsStore((state) => state.setQuietHours);
  const digest = useSettingsStore((state) => state.digest);
  const setDigest = useSettingsStore((state) => state.setDigest);

  const { status: permission, request: requestPermission } =
    useNotificationPermission();
  const {
    exportUpcoming,
    importUpcoming,
    isExporting,
    isImporting,
    hasUpcoming,
  } = useCalendarSync();
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);

  // Re-counted whenever a setting changes, since most of them change the
  // answer — switching rain alerts off cancels the queue on the next sync, and
  // a "3 alerts waiting" left frozen underneath would be a lie.
  useEffect(() => {
    let cancelled = false;
    countScheduledNotifications()
      .then((count) => {
        if (!cancelled) setScheduledCount(count);
      })
      .catch(() => {
        if (!cancelled) setScheduledCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [rainAlertsEnabled, rainLeadMinutes, quietHours, digest, permission]);

  // Nothing here has a Save button — every control writes straight through —
  // so a toast is the only thing that confirms a change was taken, and the
  // only thing that says so when the write doesn't land.
  const save = (action: () => void, success: string): void => {
    saveWithFeedback(action, {
      success,
      failure: "Couldn't save that setting. Try again.",
    });
  };

  const handleTestNotification = async () => {
    const sent = await sendTestNotification();
    showToast(
      sent
        ? "Test alert on its way"
        : "Notifications are off for Brelly, so nothing was sent",
      sent ? "success" : "error",
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton label="Done" onPress={() => router.back()} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Appearance
          </ThemedText>
          <ThemedView
            type="backgroundElement"
            style={styles.optionGroup}
            accessibilityRole="radiogroup"
            accessibilityLabel="Appearance"
          >
            {OPTIONS.map((option) => {
              const selected = option.value === themePreference;
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    save(
                      () => setThemePreference(option.value),
                      `Appearance set to ${option.label}`,
                    )
                  }
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
            {/* Every switch below writes to our own store, which the OS knows
                nothing about. Without this banner, turning rain alerts on with
                the system permission denied showed a switch in the on position
                and delivered nothing, indefinitely. */}
            {permission === "denied" && (
              <ThemedView
                style={[styles.banner, { borderColor: theme.danger }]}
              >
                <ThemedText style={styles.bannerTitle}>
                  Notifications are off for Brelly
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  iOS won&apos;t ask again, so nothing here can be delivered
                  until it is switched back on in system settings.
                </ThemedText>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  accessibilityRole="button"
                  style={styles.bannerAction}
                >
                  <ThemedText type="linkPrimary">Open Settings</ThemedText>
                </Pressable>
              </ThemedView>
            )}
            {permission === "unprompted" && (
              <ThemedView
                style={[styles.banner, { borderColor: theme.border }]}
              >
                <ThemedText style={styles.bannerTitle}>
                  Alerts need your permission
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  Brelly only sends the alerts you switch on below.
                </ThemedText>
                <Pressable
                  onPress={() => requestPermission()}
                  accessibilityRole="button"
                  style={styles.bannerAction}
                >
                  <ThemedText type="linkPrimary">Allow notifications</ThemedText>
                </Pressable>
              </ThemedView>
            )}

            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Rain alerts</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  {formatLeadTime(rainLeadMinutes)} before a stop that looks wet
                </ThemedText>
              </ThemedView>
              <Switch
                value={rainAlertsEnabled}
                onValueChange={(enabled) =>
                  save(
                    () => setRainAlertsEnabled(enabled),
                    enabled ? "Rain alerts on" : "Rain alerts off",
                  )
                }
                accessibilityLabel="Rain alerts"
              />
            </ThemedView>

            {rainAlertsEnabled && (
              <ThemedView style={styles.subSetting}>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  Warn me
                </ThemedText>
                {/* Sun deliberately has no equivalent: shade is a preference
                    and anyone outdoors can already see it, so UV never
                    notifies at all. It only colours the card. */}
                <ChoiceRow
                  values={RAIN_LEAD_MINUTES.map(String)}
                  labels={RAIN_LEAD_MINUTES.map(formatLeadTimeShort)}
                  selected={String(rainLeadMinutes)}
                  onSelect={(value) =>
                    save(
                      () => setRainLeadMinutes(Number(value) as RainLeadMinutes),
                      `Warning ${formatLeadTime(Number(value) as RainLeadMinutes)} ahead`,
                    )
                  }
                  accessibilityLabel="Rain alert lead time"
                />
              </ThemedView>
            )}

            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Daily digest</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  One summary of the day&apos;s stops each morning
                </ThemedText>
              </ThemedView>
              <Switch
                value={digest.enabled}
                onValueChange={(enabled) =>
                  save(
                    () => setDigest({ enabled }),
                    enabled ? "Daily digest on" : "Daily digest off",
                  )
                }
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
                  onSelect={(time) =>
                    save(() => setDigest({ time }), `Digest at ${time}`)
                  }
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
                onValueChange={(enabled) =>
                  save(
                    () => setQuietHours({ enabled }),
                    enabled ? "Quiet hours on" : "Quiet hours off",
                  )
                }
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
                    onSelect={(start) =>
                      save(
                        () => setQuietHours({ start }),
                        `Quiet from ${start}`,
                      )
                    }
                  />
                </ThemedView>
                <ThemedView style={styles.subSetting}>
                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    Until
                  </ThemedText>
                  <ChoiceRow
                    values={QUIET_END_TIMES}
                    selected={quietHours.end}
                    onSelect={(end) =>
                      save(() => setQuietHours({ end }), `Quiet until ${end}`)
                    }
                  />
                </ThemedView>
              </>
            )}
          </ThemedView>

          {/* The whole value of an alert is firing at the right moment, days
              after it was set up. Until now the only way to find out whether
              that worked was to plan something and wait for rain. */}
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Check your alerts
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.optionGroup}>
            <ThemedView style={styles.switchRow}>
              <ThemedView style={styles.switchLabel}>
                <ThemedText>Scheduled right now</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  {/* "Rain alerts: on" says what the app intends; this says
                      what the OS has actually queued. They come apart for good
                      reasons — nothing upcoming looks wet, everything is
                      muted — and the gap is invisible without a number. */}
                  {scheduledCount === null
                    ? "Counting…"
                    : scheduledCount === 1
                      ? "1 alert waiting to be delivered"
                      : `${scheduledCount} alerts waiting to be delivered`}
                </ThemedText>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.subSetting}>
              <Pressable
                onPress={handleTestNotification}
                accessibilityRole="button"
                style={[styles.testButton, { backgroundColor: theme.background }]}
              >
                <ThemedText style={styles.testButtonText}>
                  Send a test alert
                </ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Arrives in a few seconds. Lock your phone to see it the way a
                real alert arrives.
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Calendar
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.optionGroup}>
            {/* Two one-shot copies rather than a background sync. A sync needs
                a shared identity for every event and a rule for what happens
                when both sides changed; "I pressed the button" needs neither
                and is far easier to be right about. */}
            <ThemedView style={styles.subSetting}>
              <Pressable
                onPress={exportUpcoming}
                disabled={isExporting || !hasUpcoming}
                accessibilityRole="button"
                accessibilityState={{ disabled: isExporting || !hasUpcoming }}
                style={[
                  styles.testButton,
                  { backgroundColor: theme.background },
                  (isExporting || !hasUpcoming) && styles.disabled,
                ]}
              >
                <ThemedText style={styles.testButtonText}>
                  {isExporting ? "Adding…" : "Add my plans to the calendar"}
                </ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                {hasUpcoming
                  ? "Copies everything still ahead. It's a copy, not a sync — later edits stay here."
                  : "Nothing upcoming to add yet."}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.subSetting}>
              <Pressable
                onPress={importUpcoming}
                disabled={isImporting}
                accessibilityRole="button"
                accessibilityState={{ disabled: isImporting }}
                style={[
                  styles.testButton,
                  { backgroundColor: theme.background },
                  isImporting && styles.disabled,
                ]}
              >
                <ThemedText style={styles.testButtonText}>
                  {isImporting ? "Importing…" : "Import from the calendar"}
                </ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                {/* Both limits are real and worth stating up front: an all-day
                    event has no start time to pick a forecast tier from, and a
                    stop with no coordinates can never show one. */}
                Brings in the next {IMPORT_HORIZON_DAYS} days. Events need a
                time and a place — all-day entries are skipped.
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
      {/* Every control here commits without leaving the modal, so the
          confirmation has to be visible from inside it — a host at the root
          would be behind this screen on iOS. */}
      <ToastHost />
    </ThemedView>
  );
}

function ChoiceRow({
  values,
  labels,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  values: string[];
  /** Display text per value, when it differs from the value itself. */
  labels?: string[];
  selected: string;
  onSelect: (value: string) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    // Without the group role, assistive tech announces these as unrelated
    // buttons rather than one choice among several.
    <ThemedView
      style={styles.choiceRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((value, index) => {
        const isSelected = value === selected;
        const label = labels?.[index] ?? value;
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
              {label}
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
  // Outlined rather than filled: it sits at the top of a group of controls it
  // is explaining, and a solid red panel there reads as an error in the
  // settings rather than a fact about the OS.
  banner: {
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  bannerTitle: {
    fontWeight: "600",
  },
  bannerAction: {
    minHeight: 32,
    justifyContent: "center",
  },
  testButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  testButtonText: {
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
