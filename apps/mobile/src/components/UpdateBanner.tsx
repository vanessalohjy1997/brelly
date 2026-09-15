import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { useTheme } from "@/hooks/useTheme";

/**
 * Offers the restart that turns a downloaded update into a running one.
 *
 * Renders nothing at all unless a bundle is actually staged, which is most of
 * the time — an "up to date" row belongs in Settings, not on the screen the
 * app opens to. Without this, `expo-updates`' default is a silent swap at some
 * later cold start, so a fix can sit on the device, fully downloaded, while
 * the user keeps looking at the bug it repairs.
 *
 * Outlined in `primary` rather than filled, and dismissible: it interrupts the
 * day's plans, which is what the screen is for, and nothing here is urgent —
 * the update lands on the next launch whether or not this is ever tapped.
 * Dismissal is deliberately session-only state with no store behind it, since
 * the next launch runs the update and the question stops existing.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const { status, restart } = useOtaUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (status !== "ready" || dismissed) return null;

  return (
    <ThemedView style={[styles.banner, { borderColor: theme.primary }]}>
      <ThemedText style={styles.title}>Update ready</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Restart Brelly to pick up the latest version. It only takes a moment.
      </ThemedText>
      <ThemedView style={styles.actions}>
        <Pressable
          onPress={restart}
          accessibilityRole="button"
          style={styles.action}
        >
          <ThemedText type="linkPrimary">Restart now</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          style={styles.action}
        >
          <ThemedText type="link" themeColor="textSecondary">
            Later
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  title: {
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.four,
    backgroundColor: "transparent",
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
  },
});
