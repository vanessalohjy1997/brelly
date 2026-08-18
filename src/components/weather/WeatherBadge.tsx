import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { UmbrellaVerdictIcon } from "@/components/weather/UmbrellaVerdictIcon";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
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
  const accent = verdict.themeColor ? colors[verdict.themeColor] : colors.text;

  // A cached reading's age is measured from when it was stored, not from
  // NEA's issue time — that's the number that tells you how stale the app's
  // view of the world is.
  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);
  const freshness = describeFreshness(weather.source, age);

  return (
    <ThemedView style={styles.badge}>
      {/* The answer as a picture before it is a sentence: an umbrella with
          rain falling on it, or under a sun. A clear stop gets no umbrella at
          all — the plain sky icon is the cue that nothing is needed. */}
      {verdict.reason === "none" ? (
        <WeatherIcon forecast={weather.forecast} size={34} tintColor={accent} />
      ) : (
        <UmbrellaVerdictIcon
          reason={verdict.reason}
          size={42}
          color={accent}
          // The badge sits directly on the card now, so the halo that keeps
          // the marks legible is the card's own surface.
          haloColor={colors.backgroundElement}
        />
      )}
      <ThemedView style={styles.textContainer}>
        {/* The verdict itself is the pill in the card's corner now, so what
            is left here is the weather behind it: NEA's own wording leads,
            then the numbers and how stale they are. Wind is gone — it never
            fed the umbrella question, and it was the reading that pushed this
            line into wrapping. */}
        <ThemedText style={styles.forecast} numberOfLines={1}>
          {weather.forecast}
        </ThemedText>
        <ThemedView style={styles.metaRow}>
          {weather.temperature && (
            <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
              {formatTempRange(weather.temperature)}
            </ThemedText>
          )}
          {freshness && (
            <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
              {freshness}
            </ThemedText>
          )}
        </ThemedView>
      </ThemedView>
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
  if (source === "4day" || source === "openMeteoDaily") return `Outlook · ${age}`;
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
  textContainer: {
    backgroundColor: "transparent",
    flex: 1,
    gap: 1,
  },
  forecast: {
    fontSize: 15,
    lineHeight: 20,
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
    lineHeight: 16,
  },
  // An error should not look like a reading — the old badge rendered both as
  // 12pt secondary text, so a failed card read as data at a glance.
  problem: {
    fontSize: 13,
    fontWeight: "600",
  },
});
