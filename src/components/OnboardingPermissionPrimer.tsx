import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { openAppSettings } from "@/services/appSettings";

/**
 * The permission states this screen distinguishes — the union of what
 * `deviceLocationStore` and `useNotificationPermission` report, so either can
 * be passed straight in.
 */
export type PrimerPermission =
  | "checking"
  | "unprompted"
  | "granted"
  | "denied"
  | "unavailable";

type Props = {
  /** "location" or "notification" — decides the copy and icon. */
  kind: "location" | "notification";
  /**
   * What the OS currently says. `denied` has no prompt left, so the primary
   * action opens system Settings instead of firing a request that resolves
   * instantly to nothing.
   */
  permission: PrimerPermission;
  onAllow: () => void;
  onSkip: () => void;
};

/**
 * Copy rules, both of which came out of an App Store review rejection:
 *
 * - It says what the app does *without* the permission first, and that
 *   skipping costs nothing. Neither is a softener — device location genuinely
 *   only prefills a field and fills an empty day, because every forecast comes
 *   from the place attached to the stop.
 * - Neither button argues for an answer. "Continue" moves to the OS dialog
 *   where the actual decision is made; "Not now" moves on without one. See the
 *   button styles below — they carry the same visual weight for the same
 *   reason.
 */
const COPY = {
  location: {
    title: "Location is optional",
    body: "Brelly forecasts the places on your plans, so it works fine without this. Sharing your location only saves you typing when you add a stop, and shows nearby weather when a day is empty. Skipping costs you nothing.",
    deniedBody:
      "Location is off for Brelly, and iOS won't ask again — it can only be changed in system Settings. Nothing here needs it: your plans are forecast from the place attached to each stop either way.",
    icon: { ios: "location.fill" as const, android: "my_location" as const },
  },
  notification: {
    title: "Get rain alerts",
    body: "Brelly sends a heads-up before a stop that looks wet — so you remember the umbrella, not after you leave. You can plan and check the weather without alerts.",
    deniedBody:
      "Notifications are off for Brelly, and iOS won't ask again — they can only be switched back on in system Settings. Everything else works without them.",
    icon: { ios: "bell.fill" as const, android: "notifications" as const },
  },
};

export function OnboardingPermissionPrimer({
  kind,
  permission,
  onAllow,
  onSkip,
}: Props) {
  const theme = useTheme();
  const { title, body, deniedBody, icon } = COPY[kind];
  const denied = permission === "denied";

  return (
    <ThemedView style={styles.container}>
      <Icon name={icon} size={IconSize.hero} tintColor={theme.primary} />
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        {denied ? deniedBody : body}
      </ThemedText>
      <Pressable
        onPress={denied ? () => void openAppSettings() : onAllow}
        style={[styles.button, { borderColor: theme.border }]}
        accessibilityRole="button"
      >
        <ThemedText style={styles.buttonText}>
          {denied ? "Open Settings" : "Continue"}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onSkip}
        style={[styles.button, { borderColor: theme.border }]}
        accessibilityRole="button"
      >
        <ThemedText style={styles.buttonText}>Not now</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    lineHeight: 20,
  },
  // Both actions share this style on purpose. The primary used to be a filled
  // `primary` block over a bare text link, which put the app's whole visual
  // weight behind one of two answers on a screen sitting in front of an OS
  // permission dialog — the thing App Review flagged. Same outline, same size,
  // same text colour: the screen presents two choices and pushes neither.
  button: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    minWidth: 200,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
});
