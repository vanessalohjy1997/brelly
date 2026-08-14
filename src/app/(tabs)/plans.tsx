import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import {
  PlanSearchField,
  SearchThreshold,
} from "@/components/itinerary/PlanSearchField";
import { WeekStrip } from "@/components/itinerary/WeekStrip";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import { NearbyWeatherPrompt } from "@/components/weather/NearbyWeatherPrompt";
import {
  BottomTabInset,
  HeaderHeight,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useTheme } from "@/hooks/useTheme";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useCloudBootstrapError, useCloudReady } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { todayKey } from "@/utils/dateKeys";
import { detectScheduleConflicts } from "@/utils/detectScheduleConflicts";
import { countSlots, filterPlans } from "@/utils/filterPlans";
import { formatPlanDate } from "@/utils/formatPlanDate";
import { sortSlotsByStart } from "@/utils/planSelectors";
import { splitPlansByTime } from "@/utils/splitPlansByTime";

function toSections(
  plans: { date: string; slots: ItinerarySlot[] }[],
  today: string,
) {
  return plans.map((plan) => ({
    title: formatPlanDate(plan.date, today),
    date: plan.date,
    // Chronological, like everywhere else. Installs that predate the removal
    // of drag-to-reorder still have a hand-dragged order persisted.
    data: sortSlotsByStart(plan.slots),
  }));
}

export default function PlansScreen() {
  const theme = useTheme();
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  const plans = useItineraryStore((state) => state.plans);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const { isRefreshing, refresh } = useWeatherRefresh();
  const [query, setQuery] = useState("");

  const today = todayKey();
  // Only what's still ahead renders here. Finished stops are not deleted —
  // they move to the History tab, so this list stops growing forever and
  // reads as "what's coming".
  const { upcoming, past } = splitPlansByTime(plans, new Date());

  const matching = filterPlans(upcoming, query);
  const sections = toSections(matching, today);

  const allUpcomingSlots = useMemo(
    () => upcoming.flatMap((p) => p.slots),
    [upcoming],
  );
  const conflicts = useMemo(
    () => detectScheduleConflicts(allUpcomingSlots),
    [allUpcomingSlots],
  );

  const hasUpcoming = upcoming.length > 0;
  const hasPast = past.length > 0;
  // The field earns its space once the list is past a screen or two — and then
  // stays while a query is live, so narrowing the list to two results can't
  // pull out from under the control that narrowed it.
  const showSearch =
    countSlots(upcoming) >= SearchThreshold || query.length > 0;
  const hasMatches = sections.length > 0;
  const {
    isAvailable: hasWeatherNearby,
    forecasts: nearbyForecasts,
    permission: locationPermission,
    requestPermission: requestLocation,
  } = useNearbyForecast(!hasUpcoming);

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
              onPress={() => router.push("/routines")}
              hitSlop={8}
              accessibilityLabel="Routines"
            >
              <Icon
                name={{ ios: "repeat", android: "repeat" }}
                size={18}
                tintColor={theme.text}
              />
            </Pressable>
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push("/plan/new")}
              accessibilityRole="button"
            >
              <ThemedText
                style={[styles.addButtonText, { color: theme.onPrimary }]}
              >
                + Add
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        {hasUpcoming && showSearch && (
          <ThemedView style={styles.searchRow}>
            <PlanSearchField
              value={query}
              onChange={setQuery}
              placeholder="Search plans"
            />
          </ThemedView>
        )}

        {!ready ? (
          <Skeleton
            label="Loading your plans…"
            error={bootstrapError}
            onRetry={retryCloudBootstrap}
          />
        ) : !hasUpcoming ? (
          <>
            {hasWeatherNearby ? (
              <NearbyForecastPreview forecasts={nearbyForecasts} />
            ) : (
              <NearbyWeatherPrompt
                permission={locationPermission}
                onRequest={requestLocation}
              />
            )}
            <ThemedView style={styles.emptyState}>
              {/* Without a forecast card above, the empty state needs its own
                  visual anchor; with one, this icon is just repetition. */}
              {!hasWeatherNearby && (
                <Icon
                  name={{ ios: "calendar", android: "calendar_month" }}
                  size={48}
                  tintColor={theme.textSecondary}
                  style={styles.emptyIcon}
                />
              )}
              {/* "Nothing planned" would be untrue for someone whose plans
                  have all simply happened — they're in History, one tab
                  away. */}
              <ThemedText type="subtitle">
                {hasPast ? "Nothing upcoming" : "Nothing planned"}
              </ThemedText>
              <ThemedText
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                {hasPast
                  ? "Everything you planned has been and gone. Add another, or look back through History."
                  : "Add a plan for today or a future day to see it here."}
              </ThemedText>
              <Pressable
                style={[
                  styles.emptyStateCta,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => router.push("/plan/new")}
                accessibilityRole="button"
              >
                <ThemedText
                  style={[styles.addButtonText, { color: theme.onPrimary }]}
                >
                  + Add a plan
                </ThemedText>
              </Pressable>
            </ThemedView>
          </>
        ) : !hasMatches ? (
          // Distinct from the empty states above on purpose: the user has
          // plans, they just aren't these. Saying "Nothing planned" here would
          // read as data loss for the length of a mistyped query.
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
              Nothing upcoming matches “{query.trim()}”. Finished stops are in
              History.
            </ThemedText>
            <Pressable
              style={[styles.emptyStateCta, { backgroundColor: theme.primary }]}
              onPress={() => setQuery("")}
              accessibilityRole="button"
            >
              <ThemedText
                style={[styles.addButtonText, { color: theme.onPrimary }]}
              >
                Clear search
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(slot: ItinerarySlot) => slot.id}
            ListHeaderComponent={
              <>
                <WeekStrip plans={upcoming} />
                {conflicts.map((c, i) => (
                  <ThemedView
                    key={`conflict-${i}`}
                    style={[
                      styles.conflictBanner,
                      { borderColor: theme.umbrellaSun },
                    ]}
                  >
                    <Icon
                      name={{
                        ios: "exclamationmark.triangle.fill",
                        android: "warning",
                      }}
                      size={14}
                      tintColor={theme.umbrellaSun}
                    />
                    <ThemedText style={styles.conflictText}>
                      {c.detail}
                    </ThemedText>
                  </ThemedView>
                ))}
              </>
            }
            renderItem={({ item, section }) => (
              <ItineraryCard
                slot={item}
                onDelete={() => deleteWithUndo(section.date, item)}
              />
            )}
            renderSectionHeader={({ section }) => (
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">{section.title}</ThemedText>
                {/* `/plan/new?date=` has been wired up since the form was
                    written and nothing ever passed it, so adding to next
                    Saturday meant opening the form and hand-scrolling a
                    datetime picker to a day already named on this screen. */}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/plan/new",
                      params: { date: section.date },
                    })
                  }
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a plan on ${section.title}`}
                >
                  <Icon
                    name={{ ios: "plus", android: "add" }}
                    size={16}
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              </ThemedView>
            )}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor={theme.textSecondary}
              />
            }
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
  headerActions: {
    flexDirection: "row",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
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
  emptyIcon: {
    marginBottom: Spacing.two,
  },
  emptyStateCta: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  searchRow: {
    paddingBottom: Spacing.two,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  conflictText: {
    fontSize: 12,
    flex: 1,
  },
});
