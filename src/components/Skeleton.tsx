import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  /** What the user is waiting for — "Loading your plans" not "Loading…". */
  label?: string;
  /**
   * Set once cloud bootstrap has failed outright (`useCloudBootstrapError()`)
   * — swaps the spinner for the error and a retry button rather than leaving
   * the user staring at "Loading…" with no way out.
   */
  error?: string | null;
  onRetry?: () => void;
};

/**
 * Full-screen loading placeholder for the gap between mount and a store's
 * first cloud snapshot landing. Gated on `useCloudReady()`, not on the
 * network — see FIREBASE_MIGRATION.md's "readiness gate and a skeleton"
 * section — so it clears from the local Firestore cache even offline.
 */
export function Skeleton({ label = "Loading…", error, onRetry }: Props) {
  const theme = useTheme();

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={[styles.problem, { color: theme.danger }]}>
          {error}
        </ThemedText>
        {onRetry && (
          <Pressable onPress={onRetry} hitSlop={8}>
            <ThemedText style={[styles.retry, { color: theme.primary }]}>
              Try again
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator size="large" color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  label: {
    fontSize: 14,
  },
  problem: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  retry: {
    fontSize: 14,
    fontWeight: "600",
  },
});
