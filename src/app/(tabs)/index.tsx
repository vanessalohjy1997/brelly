import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { OnboardingPermissionPrimer } from "@/components/OnboardingPermissionPrimer";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { LiveConditionsCard } from "@/components/weather/LiveConditionsCard";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import { NearbyWeatherPrompt } from "@/components/weather/NearbyWeatherPrompt";
import {
  BottomTabInset,
  HeaderHeight,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useLiveConditions } from "@/hooks/useLiveConditions";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useTheme } from "@/hooks/useTheme";
import { useUvIndex } from "@/hooks/useUvIndex";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useCloudBootstrapError, useCloudReady } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import { todayKey } from "@/utils/dateKeys";
import {
  findCurrentOrNextSlot,
  findPlanByDate,
  sortSlotsByStart,
} from "@/utils/planSelectors";
import { splitPlansByTime } from "@/utils/splitPlansByTime";

export default function TodayScreen() {
  const colors = useTheme();
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  // Subscribing to `plans` (not to a getter, whose identity never changes) is
  // what makes this screen re-render when a plan is added or edited.
  const plans = useItineraryStore((state) => state.plans);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const setHasSeenOnboarding = useSettingsStore((s) => s.setHasSeenOnboarding);
  const [onboardingStep, setOnboardingStep] = useState<
    "location" | "notification" | null
  >(null);
  const { request: requestNotification } = useNotificationPermission();

  // hasSeenOnboarding starts false and only reflects the real, previously
  // saved value once the Firestore settings snapshot lands (see
  // settingsStore.ts) — which happens after this component's first render.
  // Deciding on mount (a useState initializer) would catch that stale
  // default and show the primer on every launch, so this waits for `ready`
  // and decides exactly once, adjusting state during render rather than in
  // an effect (react.dev's pattern for state that depends on a value that
  // "arrives" later — avoids an extra committed frame with the wrong step).
  const [onboardingDecided, setOnboardingDecided] = useState(false);
  if (ready && !onboardingDecided) {
    setOnboardingDecided(true);
    if (!hasSeenOnboarding) {
      setOnboardingStep("location");
    }
  }

  const handleOnboardingAllow = useCallback(async () => {
    if (onboardingStep === "location") {
      await Location.requestForegroundPermissionsAsync();
      setOnboardingStep("notification");
    } else if (onboardingStep === "notification") {
      await requestNotification();
      setOnboardingStep(null);
      setHasSeenOnboarding(true);
    }
  }, [onboardingStep, requestNotification, setHasSeenOnboarding]);

  const handleOnboardingSkip = useCallback(() => {
    if (onboardingStep === "location") {
      setOnboardingStep("notification");
    } else {
      setOnboardingStep(null);
      setHasSeenOnboarding(true);
    }
  }, [onboardingStep, setHasSeenOnboarding]);

  const now = new Date();
  const todaysDate = todayKey(now);
  // Today, but only the part of it that hasn't happened yet. A stop drops off
  // this list the minute it ends and turns up in Past plans — the screen is
  // for what's ahead, and a finished stop's forecast is no longer a question.
  const { upcoming, past } = splitPlansByTime(plans, now);
  const todaysPlan = findPlanByDate(upcoming, todaysDate);
  const hasSlotsToday = !!todaysPlan;
  // Told apart from "nothing planned" in the empty state below: a day whose
  // stops have all finished is a different situation from an empty one, and
  // saying so is what stops the archive from looking like data loss.
  const dayIsDone = !hasSlotsToday && !!findPlanByDate(past, todaysDate);
  const {
    isAvailable: hasWeatherNearby,
    forecasts: nearbyForecasts,
    coords: nearbyCoords,
    permission: locationPermission,
    requestPermission: requestLocation,
  } = useNearbyForecast(!hasSlotsToday);

  // With plans, the live readings are anchored to the stop the user is at (or
  // heading to) — no location permission needed, since every slot carries its
  // own coordinates. Without plans, they follow the device, reusing the
  // permission the empty state already asks for.
  const focusSlot = todaysPlan
    ? findCurrentOrNextSlot(todaysPlan.slots, now)
    : undefined;
  const conditionsPoint = focusSlot
    ? { latitude: focusSlot.latitude, longitude: focusSlot.longitude }
    : nearbyCoords;

  const { data: liveConditions } = useLiveConditions(
    conditionsPoint?.latitude ?? null,
    conditionsPoint?.longitude ?? null,
  );
  // No region, no permission gate — NEA publishes one island-wide UV
  // figure, so this resolves even with no plans and no location.
  const { data: uvIndex } = useUvIndex();
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
          <ThemedView style={styles.headerActions}>
            {/* Settings used to be reachable only from the Plans header, which
                is not where anyone spends their time — the app opens here. */}
            <Pressable
              style={[
                styles.addButton,
                { backgroundColor: colors.backgroundElement },
              ]}
              onPress={() => router.push("/settings")}
              hitSlop={8}
              accessibilityLabel="Settings"
            >
              <Icon
                name={{ ios: "gearshape.fill", android: "settings" }}
                size={18}
                tintColor={colors.text}
              />
            </Pressable>
            <Pressable
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/plan/new")}
              accessibilityRole="button"
            >
              <ThemedText
                style={[styles.addButtonText, { color: colors.onPrimary }]}
              >
                + Add
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        {!ready ? (
          <Skeleton
            label="Loading your plans…"
            error={bootstrapError}
            onRetry={retryCloudBootstrap}
          />
        ) : onboardingStep ? (
          <ThemedView style={styles.emptyState}>
            <OnboardingPermissionPrimer
              kind={onboardingStep}
              onAllow={handleOnboardingAllow}
              onSkip={handleOnboardingSkip}
            />
          </ThemedView>
        ) : !hasSlotsToday ? (
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
            {hasWeatherNearby ? (
              <>
                <NearbyForecastPreview
                  forecasts={nearbyForecasts}
                  uvIndex={uvIndex?.value}
                />
                <LiveConditionsCard
                  conditions={liveConditions}
                  uvIndex={uvIndex}
                />
              </>
            ) : (
              <>
                <NearbyWeatherPrompt
                  permission={locationPermission}
                  onRequest={requestLocation}
                />
                {/* UV needs no location, so it stands on its own here. */}
                <LiveConditionsCard conditions={null} uvIndex={uvIndex} />
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
              <ThemedText type="subtitle">
                {dayIsDone ? "Nothing left today" : "No plans yet"}
              </ThemedText>
              <ThemedText
                style={{ color: colors.textSecondary, textAlign: "center" }}
              >
                {dayIsDone
                  ? "Every stop today has finished. You'll find them in History."
                  : "Add a stop and Brelly will show the weather for it."}
              </ThemedText>
              <Pressable
                style={[
                  styles.emptyStateCta,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => router.push("/plan/new")}
                accessibilityRole="button"
              >
                <ThemedText
                  style={[styles.addButtonText, { color: colors.onPrimary }]}
                >
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
              uvIndex={uvIndex}
            />
            {/* Start time first, always — a day is read as a timeline, and
                the drag-to-reorder this replaces produced an order that
                contradicted the clock and the Plans tab both. */}
            {sortSlotsByStart(todaysPlan.slots).map((slot) => (
              <ItineraryCard
                key={slot.id}
                slot={slot}
                // The same slot the live readings above are anchored to, so
                // the outlined card and the "Right now" figures are talking
                // about one place rather than two.
                emphasis={slot.id === focusSlot?.id}
                onDelete={() => deleteWithUndo(todaysPlan.date, slot)}
              />
            ))}
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
