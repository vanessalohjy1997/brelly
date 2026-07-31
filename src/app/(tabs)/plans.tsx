import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import {
  BottomTabInset,
  HeaderHeight,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useTheme } from "@/hooks/useTheme";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { cancelAndDeleteSlot } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { toDateKey, todayKey } from "@/utils/dateKeys";
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
  const { isRefreshing, refresh } = useWeatherRefresh();

  const today = todayKey();
  const { upcoming, past } = splitPlansByDate(plans, today);

  const sections = showPast
    ? [...toSections(upcoming), ...toSections(past)]
    : toSections(upcoming);

  const hasAnyPlans = upcoming.length > 0 || past.length > 0;
  const { isAvailable: hasWeatherNearby, forecasts: nearbyForecasts } =
    useNearbyForecast(!hasAnyPlans);

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
              accessibilityLabel="Settings"
            >
              <Icon
                name={{ ios: "gearshape.fill", android: "settings" }}
                size={18}
                tintColor={theme.text}
              />
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
          <>
            {hasWeatherNearby && (
              <NearbyForecastPreview forecasts={nearbyForecasts} />
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
          </>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(slot: ItinerarySlot) => slot.id}
            renderItem={({ item, section }) => (
              <ItineraryCard
                slot={item}
                onDelete={() => cancelAndDeleteSlot(deleteSlot, section.date, item)}
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

function formatSectionDate(date: string): string {
  const today = todayKey();
  const tomorrow = toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

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
