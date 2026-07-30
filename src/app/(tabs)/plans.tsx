import { router } from "expo-router";
import { useState } from "react";
import { Pressable, SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useItineraryStore } from "@/store/itineraryStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { splitPlansByDate } from "@/utils/splitPlansByDate";

function toSections(plans: { date: string; slots: ItinerarySlot[] }[]) {
  return plans.map((plan) => ({
    title: formatSectionDate(plan.date),
    date: plan.date,
    data: plan.slots,
  }));
}

export default function PlansScreen() {
  const theme = useTheme();
  const plans = useItineraryStore((state) => state.plans);
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const { upcoming, past } = splitPlansByDate(plans, today);

  const sections = showPast
    ? [...toSections(upcoming), ...toSections(past)]
    : toSections(upcoming);

  const hasAnyPlans = upcoming.length > 0 || past.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Plans</ThemedText>
          <ThemedView style={styles.headerActions}>
            <Pressable
              style={[
                styles.addButton,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={() => router.push("/settings")}
              hitSlop={8}
            >
              <ThemedText style={styles.addButtonText}>⚙︎</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.addButton,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={() => router.push("/plan/new")}
            >
              <ThemedText style={styles.addButtonText}>+ Add</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        {!hasAnyPlans ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>🗓️</ThemedText>
            <ThemedText type="subtitle">Nothing planned</ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Add a plan for today or a future day to see it here.
            </ThemedText>
            <Pressable
              style={[
                styles.emptyStateCta,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={() => router.push("/plan/new")}
            >
              <ThemedText style={styles.addButtonText}>
                + Add a plan
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(slot: ItinerarySlot) => slot.id}
            renderItem={({ item, section }) => (
              <ItineraryCard
                slot={item}
                onDelete={() => deleteSlot(section.date, item.id)}
              />
            )}
            renderSectionHeader={({ section }) => (
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">{section.title}</ThemedText>
              </ThemedView>
            )}
            ListHeaderComponent={
              upcoming.length === 0 ? (
                <ThemedText
                  style={{ color: theme.textSecondary, paddingBottom: Spacing.two }}
                >
                  Nothing upcoming.
                </ThemedText>
              ) : null
            }
            ListFooterComponent={
              past.length > 0 ? (
                <Pressable
                  onPress={() => setShowPast((current) => !current)}
                  style={styles.pastToggle}
                >
                  <ThemedText themeColor="textSecondary">
                    {showPast
                      ? "Hide past plans"
                      : `Show ${past.length} past plan${past.length === 1 ? "" : "s"}`}
                  </ThemedText>
                </Pressable>
              ) : null
            }
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function formatSectionDate(date: string): string {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";

  return new Date(date).toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
  headerActions: {
    flexDirection: "row",
    gap: Spacing.two,
    backgroundColor: "transparent",
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
  sectionHeader: {
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },
  pastToggle: {
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
