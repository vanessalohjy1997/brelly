import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
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

  // A cached reading's age is measured from when it was stored, not from
  // NEA's issue time — that's the number that tells you how stale the app's
  // view of the world is.
  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);
  const freshness = describeFreshness(weather.source, age);
  // "Updated" is the one freshness word with a common enough icon (a clock)
  // to stand in for it — "Offline · saved" and "Outlook ·" aren't, so those
  // stay spelled out. The full sentence still reaches screen readers via
  // `accessibilityLabel` below; this only swaps the on-screen word.
  const isUpdatedFreshness = freshness?.startsWith("Updated ") ?? false;

  // The pill used to carry this: "the pill is the short form; a screen
  // reader gets the whole sentence, which is no longer written anywhere else
  // on the card" (its own comment, before it was removed). With the pill
  // gone, this field is the only thing left to say it — so it groups itself
  // into one accessible node with the full sentence, the same way the pill
  // did, rather than losing the sentence along with it. The verdict's colour
  // itself now lives in `ItineraryCard`'s icon watermark, not here.
  const accessibilityLabel = [
    verdict.label,
    weather.forecast,
    weather.temperature && formatTempRange(weather.temperature),
    freshness,
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
      <ThemedView style={styles.metaRow}>
        {weather.temperature && (
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
            {formatTempRange(weather.temperature)}
          </ThemedText>
        )}
        {/* A live reading's age moved to the card's top corner, next to the
            plan's own time — see `ForecastTimestamp` below. Offline and
            outlook readings stay here spelled out: they aren't "updated
            just now", so the corner clock would be the wrong claim. */}
        {freshness && !isUpdatedFreshness && (
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
            {freshness}
          </ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

/**
 * The "Updated 4m ago" clock, split out so `ItineraryCard` can place it in
 * the card's top-right corner, aligned with the plan's own time, instead of
 * buried beside the temperature. Only a live reading's age qualifies — see
 * `describeFreshness`; a cached or outlook reading renders its own spelled-out
 * line inside `WeatherBadge` instead, since "just now" would misstate how
 * fresh that reading actually is.
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

  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);
  const freshness = describeFreshness(weather.source, age);
  const isUpdatedFreshness = freshness?.startsWith("Updated ") ?? false;

  if (!freshness || !isUpdatedFreshness) return null;

  return (
    <ThemedView style={styles.freshnessRow}>
      <Icon
        name={{ ios: "clock", android: "schedule" }}
        size={11}
        tintColor={colors.textSecondary}
      />
      <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
        {age}
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
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  meta: {
    fontSize: 12,
    lineHeight: 20,
  },
  freshnessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "transparent",
  },
  // An error should not look like a reading — the old badge rendered both as
  // 12pt secondary text, so a failed card read as data at a glance.
  problem: {
    fontSize: 13,
    fontWeight: "600",
  },
});
