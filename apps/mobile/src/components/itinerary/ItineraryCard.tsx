import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { UmbrellaVerdictIcon } from "@/components/weather/UmbrellaVerdictIcon";
import {
  ForecastTimestamp,
  WeatherBadge,
} from "@/components/weather/WeatherBadge";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useUvIndex } from "@/hooks/useUvIndex";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import {
  describeSlotTiming,
  describeUmbrella,
  resolveSlotKind,
  resolveSlotProvider,
  type ItinerarySlot,
} from "@brelly/core";

const ACTION_WIDTH = 88;

type Props = {
  slot: ItinerarySlot;
  onDelete: () => void;
  /**
   * Turns this stop's rain alert off, or back on. Omitted on the archive,
   * where there is no future alert left to mute — the swipe reveals Delete
   * alone there.
   *
   * A callback rather than the hook itself, for the same reason `onDelete` is
   * one: the card knows the stop but not which day it is filed under, and the
   * seam that has to cancel and re-schedule an alert needs both.
   */
  onToggleMute?: () => void;
  /**
   * The stop has already ended — set on the Past plans archive. It drops
   * everything about the weather: the forecast request, the badge, the icon
   * watermark and the accent bar. There is no forecast for a time that has
   * passed, and a column of "No forecast" would say nothing eight times over.
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

/**
 * What the left swipe reveals: Mute, then Delete.
 *
 * One transform on the row rather than one per button — the translation the
 * gesture reports is the row's own offset, so each action would otherwise have
 * to know how much of the panel sits to its right.
 *
 * Mute is the inner one. It is the reversible action of the two, so it takes
 * the shorter swipe, and Delete keeps the far edge it has always had — muscle
 * memory for a destructive action should not move because a second one was
 * added beside it.
 *
 * Both actions close the row before they run, and neither waits to hear how it
 * went. Delete used to get away with leaving it open because the card always
 * went with it; now that a routine's stop can raise a day/series prompt and be
 * cancelled, the panel would be left standing over a stop nothing happened to —
 * and the next tap on that card is swallowed closing the row rather than
 * opening the stop.
 */
function RightActions({
  translation,
  onDelete,
  onToggleMute,
  muted,
  close,
}: {
  translation: SharedValue<number>;
  onDelete: () => void;
  onToggleMute?: () => void;
  muted: boolean;
  close: () => void;
}) {
  const colors = useTheme();
  const width = onToggleMute ? ACTION_WIDTH * 2 : ACTION_WIDTH;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + width }],
  }));

  return (
    <Animated.View style={[styles.actions, style]}>
      {onToggleMute && (
        <View style={styles.action}>
          <Pressable
            onPress={() => {
              close();
              onToggleMute();
            }}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            // Opens with the visible word. An accessible name that doesn't
            // contain the label on the button is a Voice Control dead end —
            // "tap Mute" matches nothing — and it made the rotor announce this
            // action under a different name from the one below it.
            accessibilityLabel={
              muted ? "Unmute — turn rain alerts on" : "Mute — turn rain alerts off"
            }
          >
            <ThemedText
              style={[styles.actionText, { color: colors.onPrimary }]}
            >
              {muted ? "Unmute" : "Mute"}
            </ThemedText>
          </Pressable>
        </View>
      )}
      <View style={styles.action}>
        <Pressable
          onPress={() => {
            close();
            onDelete();
          }}
          style={[styles.actionButton, { backgroundColor: colors.danger }]}
          accessibilityRole="button"
          accessibilityLabel="Delete plan"
        >
          {/* `onDanger`, not a hardcoded white: the dark theme's danger is the
              lighter of the two, so white on it is 2.34:1. */}
          <ThemedText style={[styles.actionText, { color: colors.onDanger }]}>
            Delete
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ItineraryCard({
  slot,
  onDelete,
  onToggleMute,
  past = false,
  emphasis = false,
}: Props) {
  const colors = useTheme();
  const muted = !!slot.notificationsMuted;
  // Nothing on an archived card can be muted — see `onToggleMute` — and a
  // screen that offers no handler gets no button either.
  const toggleMute = past ? undefined : onToggleMute;

  const {
    data: weather,
    isLoading,
    refetch,
  } = useWeatherForSlot({
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

  // The icon watermark and the bar on the card's edge are the two things
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
      renderRightActions={(_progress, translation, swipeableMethods) => (
        <RightActions
          translation={translation}
          onDelete={onDelete}
          onToggleMute={toggleMute}
          muted={muted}
          close={swipeableMethods.close}
        />
      )}
      // No `rightThreshold`: the library's default is half the *measured*
      // panel, which is the only version that can be right on both lists. The
      // explicit half-an-action this used to pass stayed 44 when the panel grew
      // to two actions, so a quarter-length nudge on Today or Plans latched the
      // whole thing open while the same nudge on History did not.
    >
      <Pressable
        onPress={() => router.push(`/plan/${slot.id}`)}
        // The swipe is a gesture VoiceOver doesn't pass through, so every
        // action behind it has to be nameable here too — in the same order the
        // panel puts them in. The rotor opens on the first entry, so leading
        // with Delete would put the destructive action under the first swipe
        // up, which is the opposite of what the panel's own ordering says.
        accessibilityActions={[
          ...(toggleMute
            ? [{ name: "toggle-mute", label: muted ? "Unmute" : "Mute" }]
            : []),
          { name: "delete", label: "Delete" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "delete") onDelete();
          if (e.nativeEvent.actionName === "toggle-mute") toggleMute?.();
        }}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.backgroundElement },
          emphasis && { borderWidth: 1, borderColor: colors.primary },
          pressed && { backgroundColor: colors.backgroundSelected },
        ]}
      >
        {accent && (
          <ThemedView style={[styles.accentBar, { backgroundColor: accent }]} />
        )}

        {/* The verdict as a picture before it's a sentence: a large, faint
            umbrella-and-marks bleeding off the card's own rounded corner,
            clipped by `card`'s `overflow: "hidden"`. Rendered before `body`
            so the card's real content paints on top of it. A clear stop (or
            no forecast at all) gets no watermark — the same restraint the
            corner pill used to apply to itself. */}
        {verdict && verdict.reason !== "none" && (
          <ThemedView style={styles.watermark} pointerEvents="none">
            <UmbrellaVerdictIcon
              reason={verdict.reason}
              size={IconSize.watermark}
              color={accent ?? colors.text}
            />
          </ThemedView>
        )}

        {/* One column, each row the full width of the card. The old
            side-by-side split gave the weather 50% of a phone screen, which
            was too narrow for a verdict and too narrow for the readings —
            so both wrapped into stacks of fragments. Stacked, the hierarchy
            can be carried by size: what this stop is, then whether you need
            an umbrella for it, then the numbers behind that. */}
        <ThemedView style={styles.body}>
          {/* When this stop is, and whether it will warn you. The verdict
              itself now lives in the icon watermark on the card, rather
              than a pill here. */}
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
                  cost the label the width. */}
              {resolveSlotKind(slot.kind) === "indoor" && (
                <Icon
                  name={{ ios: "building.2.fill", android: "apartment" }}
                  size={IconSize.metadata}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Indoor stop"
                />
              )}
              {/* Otherwise the only way to find out which stops are muted is to
                  open every one of them. */}
              {slot.notificationsMuted && (
                <Icon
                  name={{
                    ios: "bell.slash.fill",
                    android: "notifications_off",
                  }}
                  size={IconSize.metadata}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Rain alerts off for this stop"
                />
              )}
              {/* Says the stop came from a routine, which is what makes the
                  scope prompt — raised by this card's own swipe as well as by
                  the edit screen — expected rather than a surprise, and what
                  distinguishes the four identical rows down the week from four
                  you happened to type twice. */}
              {slot.routineId && (
                <Icon
                  name={{ ios: "repeat", android: "repeat" }}
                  size={IconSize.metadata}
                  tintColor={colors.textSecondary}
                  accessibilityLabel="Repeating stop"
                />
              )}
            </ThemedView>

            {/* The reading's age, right-aligned against the plan's own
                time rather than buried beside the temperature below — this
                is the corner a glance checks to see if the forecast is
                stale, and every reading with an age puts it here whichever
                API answered. Null on a past or errored one — see
                `ForecastTimestamp`. */}
            {!past && <ForecastTimestamp weather={weather} />}
          </ThemedView>

          {/* The weather badge sits beside the label/location column now,
              rather than stacked below it — the second column the location
              gives up by wrapping to two lines instead of one is exactly
              what the badge needed, and the card ends up shorter for it. */}
          <ThemedView style={styles.labelRow}>
            <ThemedView style={styles.labelColumn}>
              <ThemedText type="default" style={styles.label} numberOfLines={1}>
                {slot.label}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: colors.textSecondary }}
                numberOfLines={2}
              >
                {slot.location}
              </ThemedText>
            </ThemedView>

            {!past && (
              <ThemedView style={styles.weatherColumn}>
                <WeatherBadge
                  weather={weather}
                  isLoading={isLoading}
                  uvIndex={uvIndex}
                  onRetry={() => refetch()}
                />
              </ThemedView>
            )}
          </ThemedView>
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
  watermark: {
    position: "absolute",
    // A rain drop / sun mark sits close to the icon's own right edge (see
    // `UmbrellaVerdictIcon`), so a large horizontal overhang slices straight
    // through one of them — the bottom edge can bleed further because the
    // umbrella canopy there is a single unbroken shape.
    right: 8,
    bottom: -20,
    opacity: 0.14,
    backgroundColor: "transparent",
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
  labelRow: {
    flexDirection: "row",
    // Top-aligned, not centred: the label's own line has to land beside the
    // forecast's, and the location's beside the temperature's, and centring
    // the two columns as blocks only does that by accident when the location
    // happens to wrap to exactly as many lines as the badge has rows.
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.four,
    backgroundColor: "transparent",
  },
  labelColumn: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
    backgroundColor: "transparent",
  },
  // Sized to content and capped rather than left to grow — otherwise a long
  // forecast word ("Thundery Showers") claims width from the label column
  // instead of truncating in its own.
  weatherColumn: {
    alignSelf: "flex-start",
    flexShrink: 1,
    maxWidth: "40%",
    backgroundColor: "transparent",
  },
  actions: {
    flexDirection: "row",
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH - Spacing.two,
    height: "100%",
  },
  actionText: {
    fontWeight: "600",
  },
});
