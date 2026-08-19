import { useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import {
  PlanSearchField,
  SearchThreshold,
} from "@/components/itinerary/PlanSearchField";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import {
  BottomTabInset,
  HeaderHeight,
  IconSize,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useTheme } from "@/hooks/useTheme";
import { useCloudBootstrapError, useCloudReady } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { showToast } from "@/store/toastStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { todayKey } from "@/utils/dateKeys";
import { countSlots, filterPlans } from "@/utils/filterPlans";
import { formatPlanDate } from "@/utils/formatPlanDate";
import { splitPlansByTime } from "@/utils/splitPlansByTime";

/**
 * Where a stop goes once it's over.
 *
 * Nothing is deleted when a plan passes — it moves here, and the Plans tab is
 * left showing only what's still ahead. The two lists are the two halves of
 * one `splitPlansByTime` call, so a stop is in exactly one of them and the
 * boundary can't drift between the screens.
 *
 * A tab of its own, not a button buried in Plans: this is one of the three
 * things the app is for, not a place you have to know exists.
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  const plans = useItineraryStore((state) => state.plans);
  const deletePlan = useItineraryStore((state) => state.deletePlan);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const [query, setQuery] = useState("");

  const handlePrune = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = todayKey(thirtyDaysAgo);
    const toPrune = past.filter((p) => p.date < cutoff);
    if (toPrune.length === 0) {
      showToast("Nothing older than 30 days", "success");
      return;
    }
    Alert.alert(
      "Clear old plans?",
      `Delete ${toPrune.length} day${toPrune.length === 1 ? "" : "s"} older than 30 days. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            for (const plan of toPrune) deletePlan(plan.date);
            showToast(
              `Cleared ${toPrune.length} old day${toPrune.length === 1 ? "" : "s"}`,
              "success",
            );
          },
        },
      ],
    );
  };

  const today = todayKey();
  const { past } = splitPlansByTime(plans, new Date());

  const matching = filterPlans(past, query);
  const sections = matching.map((plan) => ({
    title: formatPlanDate(plan.date, today),
    date: plan.date,
    data: plan.slots,
  }));

  const hasPast = past.length > 0;
  // This is the list that grows without bound — nothing is ever deleted from
  // it — so it is the one that most needs a way in other than scrolling.
  const showSearch = countSlots(past) >= SearchThreshold || query.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">History</ThemedText>
        </ThemedView>

        {hasPast && (
          <ThemedView style={styles.topRow}>
            {showSearch && (
              <ThemedView style={styles.searchField}>
                <PlanSearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search past plans"
                />
              </ThemedView>
            )}
            <Pressable
              onPress={handlePrune}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear plans older than 30 days"
              style={[
                styles.pruneButton,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <Icon
                name={{ ios: "trash", android: "delete_sweep" }}
                size={IconSize.inline}
                tintColor={theme.textSecondary}
              />
              <ThemedText themeColor="textSecondary" style={styles.pruneText}>
                Clear older
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {!ready ? (
          <Skeleton
            label="Loading your history…"
            error={bootstrapError}
            onRetry={retryCloudBootstrap}
          />
        ) : !hasPast ? (
          <ThemedView style={styles.emptyState}>
            <Icon
              name={{ ios: "clock.arrow.circlepath", android: "history" }}
              size={IconSize.hero}
              tintColor={theme.textSecondary}
              style={styles.emptyIcon}
            />
            <ThemedText type="subtitle">Nothing here yet</ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Stops move here once they have finished, so nothing you plan is
              ever lost.
            </ThemedText>
          </ThemedView>
        ) : sections.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <Icon
              name={{ ios: "magnifyingglass", android: "search" }}
              size={IconSize.hero}
              tintColor={theme.textSecondary}
              style={styles.emptyIcon}
            />
            <ThemedText type="subtitle">No matches</ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Nothing here matches “{query.trim()}”.
            </ThemedText>
          </ThemedView>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(slot: ItinerarySlot) => slot.id}
            renderItem={({ item, section }) => (
              <ItineraryCard
                slot={item}
                past
                onDelete={() => deleteWithUndo(section.date, item)}
              />
            )}
            renderSectionHeader={({ section }) => (
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">{section.title}</ThemedText>
              </ThemedView>
            )}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
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
    height: HeaderHeight,
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  searchField: {
    flex: 1,
  },
  pruneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  pruneText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },
  list: {
    gap: Spacing.one,
    // A tab bar sits under this screen now, same as Today and Plans.
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
