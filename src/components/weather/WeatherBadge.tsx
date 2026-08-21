import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SlotForecast } from "@/services/weather";
import { describeUmbrella } from "@/utils/describeUmbrella";
import { formatRelativeTimestamp } from "@/utils/formatRelativeTimestamp";
import { formatTempRange } from "@/utils/formatTempRange";

type Props = {
  weather: SlotForecast | undefined;
  isLoading: boolean;
  /** Island-wide UV index, the second half of the umbrella verdict. */
  uvIndex?: number | null;
  onRetry?: () => void;
};

export function WeatherBadge({ weather, isLoading, uvIndex, onRetry }: Props) {
  const colors = useTheme();

  // A skeleton at the badge's real height rather than a bare spinner a
  // fraction of its size — otherwise every card resizes when data lands.
  if (isLoading) {
    return (
      <ThemedView style={styles.badge} accessibilityLabel="Loading forecast">
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
          Checking the sky…
        </ThemedText>
      </ThemedView>
    );
  }

  // "unavailable" means NEA has no forecast for this date/time yet — nothing
  // to retry. "error" means the request itself failed (network/API), so a
  // retry can plausibly succeed — worth a tap target when one is provided.
  if (weather?.source === "error") {
    return (
      <Pressable onPress={onRetry} disabled={!onRetry} hitSlop={8}>
        <ThemedView style={styles.badge}>
          <ThemedText style={[styles.problem, { color: colors.danger }]}>
            {onRetry ? "Couldn't load · Retry" : "Couldn't load"}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  if (!weather || weather.source === "unavailable") {
    return (
      <ThemedView style={styles.badge}>
        <ThemedText style={[styles.problem, { color: colors.textSecondary }]}>
          No forecast
        </ThemedText>
      </ThemedView>
    );
  }

  const verdict = describeUmbrella(weather.forecast, uvIndex);

  // The pill used to carry this: "the pill is the short form; a screen
  // reader gets the whole sentence, which is no longer written anywhere else
  // on the card" (its own comment, before it was removed). With the pill
  // gone, this field is the only thing left to say it — so it groups itself
  // into one accessible node with the full sentence, the same way the pill
  // did, rather than losing the sentence along with it. The verdict's colour
  // itself now lives in `ItineraryCard`'s icon watermark, not here.
  //
  // Freshness is no longer part of the sentence: every reading's age now
  // renders in the card's corner, and `ForecastTimestamp` speaks its own.
  const accessibilityLabel = [
    verdict.label,
    weather.forecast,
    weather.temperature && formatTempRange(weather.temperature),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <ThemedView
      style={styles.field}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      {/* NEA's own wording leads, then the numbers and how stale they are.
          Wind is gone — it never fed the umbrella question, and it was the
          reading that pushed this line into wrapping. */}
      <ThemedText style={styles.forecast} numberOfLines={1}>
        {weather.forecast}
      </ThemedText>
      {/* Every reading's age now lives in the card's top corner next to the
          plan's own time — see `ForecastTimestamp` below. Splitting it by
          tier, with a live reading in the corner and an outlook or offline
          one spelled out down here, put the same fact in two different
          places depending on which API answered; a column of cards then had
          no one line to scan for staleness. */}
      {weather.temperature && (
        <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
          {formatTempRange(weather.temperature)}
        </ThemedText>
      )}
    </ThemedView>
  );
}

/**
 * The freshness clock, split out so `ItineraryCard` can place it in the
 * card's top-right corner, aligned with the plan's own time, instead of
 * buried beside the temperature.
 *
 * Every reading that has an age renders here, whichever tier answered. It
 * used to take only the live "Updated 4m ago" case and leave the outlook and
 * offline ones spelled out inside `WeatherBadge` — but which tier answers is
 * decided by geography (NEA switches to its 4-day outlook a day out,
 * Open-Meteo stays hourly for a week), so the same plan put its timestamp in
 * two different places depending on where it was. Down a column of cards
 * there was no single line to check for staleness.
 *
 * The clock icon stands in for the word "Updated" only. "Outlook" and
 * "Offline" say something the clock cannot — how far the reading is being
 * stretched, and that it came off disk — so those stay spelled out beside
 * the icon rather than being reduced to a bare age.
 */
export function ForecastTimestamp({
  weather,
}: {
  weather: SlotForecast | undefined;
}) {
  const colors = useTheme();

  if (
    !weather ||
    weather.source === "error" ||
    weather.source === "unavailable"
  ) {
    return null;
  }

  // A cached reading's age is measured from when it was stored, not from
  // NEA's issue time — that's the number that tells you how stale the app's
  // view of the world is.
  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);
  const freshness = describeFreshness(weather.source, age);

  if (!freshness) return null;

  const isUpdatedFreshness = freshness.startsWith("Updated ");

  return (
    <ThemedView
      style={styles.freshnessRow}
      accessible
      accessibilityRole="text"
      accessibilityLabel={freshness}
    >
      <Icon
        name={{ ios: "clock", android: "schedule" }}
        size={IconSize.metadata}
        tintColor={colors.textSecondary}
      />
      <ThemedText
        style={[styles.meta, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {isUpdatedFreshness ? age : freshness}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * One plain-language freshness note instead of two competing ones. The old
 * badge showed an API-tier label ("2hr" as "Live", "4day" as "4-day") next to
 * "Updated 12m ago" — the tier is an implementation detail, and the two
 * together read as metadata about the app rather than about the weather.
 *
 * Split out so the wording can be checked without rendering.
 */
export function describeFreshness(
  source: SlotForecast["source"],
  age: string | null,
): string | null {
  if (source === "cached") return age ? `Offline · saved ${age}` : "Offline";
  if (!age) return null;
  // A 2hr nowcast is minutes old; the 4-day/openMeteoDaily outlook is a
  // lower-confidence, longer-range reading. Saying which one you're looking
  // at matters more than its age.
  if (source === "4day" || source === "openMeteoDaily")
    return `Outlook · ${age}`;
  return `Updated ${age}`;
}

const styles = StyleSheet.create({
  badge: {
    // No surface of its own any more. Nesting a filled card inside the plan
    // card left the verdict a third of the width and stacked every reading
    // into its own wrapped line; on the card directly it gets the full width
    // and the hierarchy can be carried by size and colour instead.
    backgroundColor: "transparent",
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.two,
    minHeight: 44,
  },
  field: {
    backgroundColor: "transparent",
    alignSelf: "stretch",
    // Top-aligned, and its two rows' line-heights (below) match `label` and
    // `location` in `ItineraryCard` exactly — so the forecast sits level
    // with the label above it, and the temperature level with the location,
    // rather than this block floating centred against a taller neighbour.
    justifyContent: "flex-start",
    gap: Spacing.half,
    minHeight: 44,
  },
  forecast: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "right",
  },
  meta: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
  },
  freshnessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    // "Outlook · 1h ago" is longer than the bare age this row used to hold,
    // so it claims its width from the time row beside it (which shrinks and
    // truncates) rather than wrapping onto a second line.
    flexShrink: 0,
    backgroundColor: "transparent",
  },
  // An error should not look like a reading — the old badge rendered both as
  // 12pt secondary text, so a failed card read as data at a glance.
  problem: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
});
