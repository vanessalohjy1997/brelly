import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  /** "location" or "notification" — decides the copy and icon. */
  kind: "location" | "notification";
  onAllow: () => void;
  onSkip: () => void;
};

const COPY = {
  location: {
    title: "Know where you are",
    body: "Brelly uses your location to show nearby weather and prefill your stop's coordinates. You can always type a place instead.",
    icon: { ios: "location.fill" as const, android: "my_location" as const },
  },
  notification: {
    title: "Get rain alerts",
    body: "Brelly sends a heads-up before a stop that looks wet — so you remember the umbrella, not after you leave.",
    icon: { ios: "bell.fill" as const, android: "notifications" as const },
  },
};

export function OnboardingPermissionPrimer({ kind, onAllow, onSkip }: Props) {
  const theme = useTheme();
  const { title, body, icon } = COPY[kind];

  return (
    <ThemedView style={styles.container}>
      <Icon name={icon} size={48} tintColor={theme.primary} />
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        {body}
      </ThemedText>
      <Pressable
        onPress={onAllow}
        style={[styles.button, { backgroundColor: theme.primary }]}
        accessibilityRole="button"
      >
        <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>
          Allow
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onSkip}
        style={styles.skipButton}
        accessibilityRole="button"
      >
        <ThemedText themeColor="textSecondary">Not now</ThemedText>
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
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
  skipButton: {
    paddingVertical: Spacing.two,
  },
});
