import { FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useCloudBootstrapError, useCloudReady } from "@/store/cloudSyncStore";
import { useRoutineStore } from "@/store/routineStore";
import type { Routine } from "@/types/routine";
import { describeRoutine } from "@/utils/describeRoutine";
import { resolveSlotKind, SLOT_KIND_LABELS } from "@/utils/slotKind";

function RoutineRow({ routine }: { routine: Routine }) {
  const repeat = describeRoutine(routine);
  const kind = resolveSlotKind(routine.kind);

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.row}
      accessibilityRole="summary"
    >
      <ThemedView style={styles.rowBody}>
        <ThemedText style={styles.label} numberOfLines={1}>
          {routine.label}
        </ThemedText>
        <ThemedText
          themeColor="textSecondary"
          style={styles.hint}
          numberOfLines={1}
        >
          {routine.location}
        </ThemedText>
        {repeat && (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {repeat}
          </ThemedText>
        )}
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          {routine.startTime} – {routine.endTime}
          {kind === "indoor" ? ` · ${SLOT_KIND_LABELS.indoor}` : ""}
          {routine.notificationsMuted ? " · Alerts off" : ""}
        </ThemedText>
      </ThemedView>
      {routine.exceptions.length > 0 && (
        <ThemedText themeColor="textSecondary" style={styles.exceptions}>
          {routine.exceptions.length} skipped
        </ThemedText>
      )}
    </ThemedView>
  );
}

export default function RoutinesScreen() {
  const theme = useTheme();
  const routines = useRoutineStore((state) => state.routines);
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        {!ready ? (
          <Skeleton
            label="Loading your routines…"
            error={bootstrapError}
            onRetry={retryCloudBootstrap}
          />
        ) : routines.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <Icon
              name={{ ios: "repeat", android: "repeat" }}
              size={48}
              tintColor={theme.textSecondary}
              style={styles.emptyIcon}
            />
            <ThemedText type="subtitle">No routines</ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Add a repeating plan and it will appear here.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RoutineRow routine={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emptyIcon: {
    marginBottom: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  row: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
  label: {
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
  },
  exceptions: {
    fontSize: 12,
  },
});
