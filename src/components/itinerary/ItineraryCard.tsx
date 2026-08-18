import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { VerdictPill } from "@/components/weather/VerdictPill";
import { WeatherBadge } from "@/components/weather/WeatherBadge";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useUvIndex } from "@/hooks/useUvIndex";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import type { ItinerarySlot } from "@/types/itinerary";
import { describeSlotTiming } from "@/utils/describeSlotTiming";
import { describeUmbrella } from "@/utils/describeUmbrella";
import { resolveSlotKind } from "@/utils/slotKind";
import { resolveSlotProvider } from "@/utils/weatherProvider";

const DELETE_ACTION_WIDTH = 88;

type Props = {
  slot: ItinerarySlot;
  onDelete: () => void;
  /**
   * The stop has already ended — set on the Past plans archive. It drops
   * everything about the weather: the forecast request, the badge, the pill
   * and the accent bar. There is no forecast for a time that has passed, and
   * a column of "No forecast" would say nothing eight times over.
   *
   * Deliberately *not* a dimmed or greyed variant. Every card in the archive
   * is past, so dimming separates it from nothing and only costs contrast —
   * the screen it lives on is what says these are over.
   */
  past?: boolean;
  /**
   * This is the stop the screen was opened for — the one happening now, or
   * failing that the next one to start. Only Today sets it, and only ever on
   * one card: it is an answer to "where am I supposed to be", and an answer
   * given on every row is not an answer.
   *
   * It draws an outline rather than a fill. The card's background already
   * carries the pressed state and the accent bar already carries the weather
   * verdict, so a third surface colour here would be competing with both for
   * the same 4pt of edge.
   */
  emphasis?: boolean;
};

function DeleteAction({
  translation,
  onDelete,
}: {
  translation: SharedValue<number>;
  onDelete: () => void;
}) {
  const colors = useTheme();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + DELETE_ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.deleteAction, style]}>
      <Pressable
        onPress={onDelete}
        style={[styles.deleteButton, { backgroundColor: colors.danger }]}
        accessibilityRole="button"
        accessibilityLabel="Delete plan"
      >
        {/* `onDanger`, not a hardcoded white: the dark theme's danger is the
            lighter of the two, so white on it is 2.34:1. */}
        <ThemedText style={[styles.deleteButtonText, { color: colors.onDanger }]}>
          Delete
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export function ItineraryCard({
  slot,
  onDelete,
  past = false,
  emphasis = false,
}: Props) {
  const colors = useTheme();

  const { data: weather, isLoading, refetch } = useWeatherForSlot({
    provider: resolveSlotProvider(slot.provider),
    region: slot.neaRegion,
    latitude: slot.latitude,
    longitude: slot.longitude,
    slotStartTime: slot.startTime,
    enabled: !past,
  });
  // Island-wide and cached for an hour, so every card on screen shares one
  // request — the second half of the umbrella verdict for an NEA slot. An
  // Open-Meteo slot gets its own UV inline in `weather.uvIndex` instead (see
  // below), since NEA's figure is Singapore-only and meaningless overseas.
  const { data: uv } = useUvIndex();
  const uvIndex = weather?.uvIndex ?? uv?.value;

  const startTime = new Date(slot.startTime).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const endTime = new Date(slot.endTime).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // "in 40 min" ahead of "02:00 PM – 03:00 PM": the clock time answers *when*
  // and leaves *how soon* to the reader, which on Today is the only question.
  // Nothing here is scheduled to re-render on a timer — the countdown is
  // recomputed whenever the screen renders, which covers every way back onto
  // it, and a per-card ticker would wake the whole list once a minute to move
  // a number no one is watching.
  //
  // Suppressed on an archived card: "in 40 min" for something that happened
  // last Tuesday is the one thing worse than saying nothing.
  const timing = past
    ? { relative: null, isNow: false }
    : describeSlotTiming(slot.startTime, slot.endTime, new Date());

  // The pill in the corner and the bar on the card's edge are the two things
  // readable while scrolling a day at speed, and both carry this. A
  // placeholder forecast ("error", "unavailable") is not a verdict — see the
  // guards in `WeatherBadge` — so it earns neither.
  const hasForecast =
    !past &&
    !!weather &&
    weather.source !== "error" &&
    weather.source !== "unavailable";
  const verdict = hasForecast
    ? describeUmbrella(weather.forecast, uvIndex)
    : null;
  const accent = verdict?.themeColor ? colors[verdict.themeColor] : null;

  return (
    <Swipeable
      renderRightActions={(_progress, translation) => (
        <DeleteAction translation={translation} onDelete={onDelete} />
      )}
      rightThreshold={DELETE_ACTION_WIDTH / 2}
    >
      <Pressable
        onPress={() => router.push(`/plan/${slot.id}`)}
        accessibilityActions={[{ name: "delete", label: "Delete" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "delete") onDelete();
        }}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.backgroundElement },
          emphasis && { borderWidth: 1, borderColor: colors.primary },
          pressed && { backgroundColor: colors.backgroundSelected },
        ]}
      >
        {accent && <ThemedView style={[styles.accentBar, { backgroundColor: accent }]} />}

        {/* One column, each row the full width of the card. The old
            side-by-side split gave the weather 50% of a phone screen, which
            was too narrow for a verdict and too narrow for the readings —
            so both wrapped into stacks of fragments. Stacked, the hierarchy
            can be carried by size: what this stop is, then whether you need
            an umbrella for it, then the numbers behind that. */}
        <ThemedView style={styles.body}>
          {/* Time and whether this stop will warn you on the left; the
              verdict as a pill on the right, where a column of cards puts
              every status in the same place to scan down. */}
          <ThemedView style={styles.topRow}>
            <ThemedView style={styles.timeRow}>
              {timing.relative && (
                <ThemedText
                  style={[
                    styles.time,
                    styles.relativeTime,
                    // "Now" is the only one of these that is a state rather
                    // than a countdown, so it takes the accent the emphasised
                    // card is already outlined in.
                    { color: timing.isNow ? colors.primary : colors.text },
                  ]}
                >
                  {timing.relative}
                </ThemedText>
              )}
              <ThemedText
                style={[styles.time, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {startTime} – {endTime}
              </ThemedText>
              {/* Only indoor is marked. Outdoor is the default and most of the
                  list, so a glyph on every row would carry no information and
                  cost the label the width. The verdict pill stays either way —
                  you still have to get there. */}
              {resolveSlotKind(slot.kind) === "indoor" && (
                <Icon
                  name={{ ios: "building.2.fill", android: "apartment" }}
                  size={12}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Indoor stop"
                />
              )}
              {/* Otherwise the only way to find out which stops are muted is to
                  open every one of them. */}
              {slot.notificationsMuted && (
                <Icon
                  name={{ ios: "bell.slash.fill", android: "notifications_off" }}
                  size={12}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Rain alerts off for this stop"
                />
              )}
              {/* Says the stop came from a routine, which is what makes the
                  scope prompt on the edit screen expected rather than a
                  surprise — and what distinguishes the four identical rows
                  down the week from four you happened to type twice. */}
              {slot.routineId && (
                <Icon
                  name={{ ios: "repeat", android: "repeat" }}
                  size={12}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Repeating stop"
                />
              )}
            </ThemedView>
            {verdict && <VerdictPill verdict={verdict} />}
          </ThemedView>

          <ThemedText type="default" style={styles.label} numberOfLines={1}>
            {slot.label}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: colors.textSecondary }}
            numberOfLines={1}
          >
            {slot.location}
          </ThemedText>

          {!past && (
            <WeatherBadge
              weather={weather}
              isLoading={isLoading}
              uvIndex={uvIndex}
              onRetry={() => refetch()}
            />
          )}
        </ThemedView>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    flexDirection: "row",
    // So the bar reaches the rounded corners instead of poking past them.
    overflow: "hidden",
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  body: {
    flex: 1,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    gap: 2,
    backgroundColor: "transparent",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    flexShrink: 1,
    backgroundColor: "transparent",
  },
  time: {
    fontSize: 12,
    fontWeight: "500",
  },
  relativeTime: {
    fontWeight: "700",
  },
  label: {
    fontWeight: "600",
  },
  deleteAction: {
    width: DELETE_ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    width: DELETE_ACTION_WIDTH - Spacing.two,
    height: "100%",
  },
  deleteButtonText: {
    fontWeight: "600",
  },
});
