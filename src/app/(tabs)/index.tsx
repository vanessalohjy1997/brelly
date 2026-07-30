import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useItineraryStore } from "@/store/itineraryStore";

export default function TodayScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const getTodaysPlan = useItineraryStore((state) => state.getTodaysPlan);
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
          </ThemedView>
        ) : (
          <FlatList
            data={todaysPlan.slots}
            keyExtractor={(slot) => slot.id}
            renderItem={({ item }) => <ItineraryCard slot={item} />}
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
  list: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
