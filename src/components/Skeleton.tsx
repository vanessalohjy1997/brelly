import { ActivityIndicator, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  /** What the user is waiting for — "Loading your plans" not "Loading…". */
  label?: string;
};

/**
 * Full-screen loading placeholder for the gap between mount and a store's
 * first cloud snapshot landing. Gated on `useCloudReady()`, not on the
 * network — see FIREBASE_MIGRATION.md's "readiness gate and a skeleton"
 * section — so it clears from the local Firestore cache even offline.
 */
export function Skeleton({ label = "Loading…" }: Props) {
  const theme = useTheme();

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
  },
  label: {
    fontSize: 14,
  },
});
