import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SortableItineraryList } from "@/components/itinerary/SortableItineraryList";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useItineraryStore } from "@/store/itineraryStore";

export default function TodayScreen() {
  const colors = useTheme();
  const getTodaysPlan = useItineraryStore((state) => state.getTodaysPlan);
  const reorderSlots = useItineraryStore((state) => state.reorderSlots);
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const todaysPlan = getTodaysPlan();

  const today = new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedView>
            <ThemedText type="title">Today</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {today}
            </ThemedText>
          </ThemedView>
          <Pressable
            style={[
              styles.addButton,
              { backgroundColor: colors.backgroundElement },
            ]}
            onPress={() => router.push("/plan/new")}
          >
            <ThemedText style={styles.addButtonText}>+ Add</ThemedText>
          </Pressable>
        </ThemedView>

        {/* Slot list or empty state */}
        {!todaysPlan || todaysPlan.slots.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>🌤️</ThemedText>
            <ThemedText type="subtitle">No plans yet</ThemedText>
            <ThemedText
              style={{ color: colors.textSecondary, textAlign: "center" }}
            >
              Add your plans for today and Brelly will show you the weather for
              each stop.
            </ThemedText>
            <Pressable
              style={[
                styles.emptyStateCta,
                { backgroundColor: colors.backgroundElement },
              ]}
              onPress={() => router.push("/plan/new")}
            >
              <ThemedText style={styles.addButtonText}>
                + Add a plan
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            <SortableItineraryList
              slots={todaysPlan.slots}
              onReorder={(slots) => reorderSlots(todaysPlan.date, slots)}
              onDeleteSlot={(slotId) => deleteSlot(todaysPlan.date, slotId)}
            />
          </ScrollView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  addButtonText: {
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.two,
  },
  emptyStateCta: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
