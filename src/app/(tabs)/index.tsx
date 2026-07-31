import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { SortableItineraryList } from "@/components/itinerary/SortableItineraryList";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { LiveConditionsCard } from "@/components/weather/LiveConditionsCard";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import {
  BottomTabInset,
  HeaderHeight,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useLiveConditions } from "@/hooks/useLiveConditions";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useTheme } from "@/hooks/useTheme";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { cancelAndDeleteSlot } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { todayKey } from "@/utils/dateKeys";
import { findCurrentOrNextSlot, findPlanByDate } from "@/utils/planSelectors";

export default function TodayScreen() {
  const colors = useTheme();
  // Subscribing to `plans` (not to a getter, whose identity never changes) is
  // what makes this screen re-render when a plan is added or edited.
  const plans = useItineraryStore((state) => state.plans);
  const reorderSlots = useItineraryStore((state) => state.reorderSlots);
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const todaysPlan = findPlanByDate(plans, todayKey());
  const hasSlotsToday = !!todaysPlan && todaysPlan.slots.length > 0;
  const {
    isAvailable: hasWeatherNearby,
    forecasts: nearbyForecasts,
    region: nearbyRegion,
    coords: nearbyCoords,
  } = useNearbyForecast(!hasSlotsToday);

  // With plans, the live readings are anchored to the stop the user is at (or
  // heading to) — no location permission needed, since every slot carries its
  // own coordinates. Without plans, they follow the device, reusing the
  // permission the empty state already asks for.
  const focusSlot = todaysPlan
    ? findCurrentOrNextSlot(todaysPlan.slots, new Date())
    : undefined;
  const conditionsPoint = focusSlot
    ? { latitude: focusSlot.latitude, longitude: focusSlot.longitude }
    : nearbyCoords;
  const conditionsRegion = focusSlot ? focusSlot.neaRegion : nearbyRegion;

  const { data: liveConditions } = useLiveConditions(
    conditionsPoint?.latitude ?? null,
    conditionsPoint?.longitude ?? null,
  );
  const { data: airQuality } = useAirQuality(conditionsRegion);
  const { isRefreshing, refresh } = useWeatherRefresh();

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
        {!hasSlotsToday ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor={colors.textSecondary}
              />
            }
          >
            {hasWeatherNearby && (
              <>
                <NearbyForecastPreview forecasts={nearbyForecasts} />
                <LiveConditionsCard
                  conditions={liveConditions}
                  airQuality={airQuality}
                />
              </>
            )}
            <ThemedView style={styles.emptyState}>
              {/* Without a forecast card above, the empty state needs its own
                  visual anchor; with one, this icon is just repetition. */}
              {!hasWeatherNearby && (
                <Icon
                  name={{ ios: "cloud.sun.fill", android: "partly_cloudy_day" }}
                  size={48}
                  tintColor={colors.textSecondary}
                  style={styles.emptyIcon}
                />
              )}
              <ThemedText type="subtitle">No plans yet</ThemedText>
              <ThemedText
                style={{ color: colors.textSecondary, textAlign: "center" }}
              >
                Add a stop and Brelly will show the weather for it.
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
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor={colors.textSecondary}
              />
            }
          >
            <LiveConditionsCard
              conditions={liveConditions}
              airQuality={airQuality}
            />
            <SortableItineraryList
              slots={todaysPlan.slots}
              onReorder={(slots) => reorderSlots(todaysPlan.date, slots)}
              onDeleteSlot={(slot) =>
                cancelAndDeleteSlot(deleteSlot, todaysPlan.date, slot)
              }
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
    height: HeaderHeight,
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
  emptyScroll: {
    flexGrow: 1,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
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
  list: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
