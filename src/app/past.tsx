import { useState } from "react";
import { SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import {
  PlanSearchField,
  SearchThreshold,
} from "@/components/itinerary/PlanSearchField";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useTheme } from "@/hooks/useTheme";
import { useItineraryStore } from "@/store/itineraryStore";
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
 * A pushed screen rather than a tab: this is a place you go to look something
 * up, not one of the two things the app is for.
 */
export default function PastPlansScreen() {
  const theme = useTheme();
  const plans = useItineraryStore((state) => state.plans);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const [query, setQuery] = useState("");

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
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        {hasPast && showSearch && (
          <ThemedView style={styles.searchRow}>
            <PlanSearchField
              value={query}
              onChange={setQuery}
              placeholder="Search past plans"
            />
          </ThemedView>
        )}

        {!hasPast ? (
          <ThemedView style={styles.emptyState}>
            <Icon
              name={{ ios: "clock.arrow.circlepath", android: "history" }}
              size={48}
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
              size={48}
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
  searchRow: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionHeader: {
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    // No tab bar under this screen, so the list only owes the safe area —
    // `BottomTabInset` here would leave a permanent gap at the end.
    paddingBottom: Spacing.three,
  },
});
