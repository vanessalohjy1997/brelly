import { Linking, Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { IconSize, Spacing } from "@/constants/theme";
import type { PermissionState } from "@/hooks/useNearbyForecast";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  permission: PermissionState;
  onRequest: () => void;
};

/**
 * Asks for location *before* the OS dialog does, and gives a way back after a
 * refusal.
 *
 * The prompt used to fire from a mount effect, so the system sheet appeared
 * with no explanation and a "Don't Allow" removed nearby weather permanently
 * — iOS won't show the dialog twice, so nothing in the app could recover it.
 * Explaining first is what makes the grant an informed one; deep-linking to
 * Settings is what makes a refusal reversible.
 */
export function NearbyWeatherPrompt({ permission, onRequest }: Props) {
  const theme = useTheme();

  if (permission === "granted" || permission === "checking") return null;

  const denied = permission === "denied";
  const unavailable = permission === "unavailable";

  return (
    <ThemedView
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
    >
      <Icon
        name={{ ios: "location.circle.fill", android: "my_location" }}
        size={IconSize.lead}
        tintColor={theme.primary}
      />
      <ThemedView style={styles.text}>
        <ThemedText style={styles.title}>
          {unavailable ? "Couldn't find you" : "Weather where you are"}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          {denied
            ? "Location is off for Brelly, so we can't show the forecast near you. You can turn it back on in Settings."
            : unavailable
              ? "Location is on, but no position came back. Moving somewhere with a clearer view of the sky usually fixes it."
              : "See the next few hours for your area. Brelly only reads your location while you have it open."}
        </ThemedText>
      </ThemedView>
      <Pressable
        onPress={denied ? () => Linking.openSettings() : onRequest}
        style={[styles.button, { backgroundColor: theme.primary }]}
        accessibilityRole="button"
      >
        <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>
          {denied
            ? "Open Settings"
            : unavailable
              ? "Try again"
              : "Show weather near me"}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: "center",
  },
  text: {
    gap: Spacing.one,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  button: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
    minHeight: 44,
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
});
