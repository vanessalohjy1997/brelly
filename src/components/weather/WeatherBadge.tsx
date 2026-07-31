import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SlotForecast } from "@/services/weather";
import { formatRelativeTimestamp } from "@/utils/formatRelativeTimestamp";
import { formatTempRange } from "@/utils/formatTempRange";
import { formatWind } from "@/utils/formatWind";

type Props = {
  weather: SlotForecast | undefined;
  isLoading: boolean;
  onRetry?: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  "2hr": "Live",
  "24hr": "Today",
  "4day": "4-day",
  cached: "Offline",
};

export function WeatherBadge({ weather, isLoading, onRetry }: Props) {
  const colors = useTheme();

  if (isLoading) {
    return <ActivityIndicator size="small" />;
  }

  // "unavailable" means NEA has no forecast for this date/time yet — nothing
  // to retry. "error" means the request itself failed (network/API), so a
  // retry can plausibly succeed — worth a tap target when one is provided.
  if (weather?.source === "error") {
    return (
      <Pressable onPress={onRetry} disabled={!onRetry} hitSlop={8}>
        <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
          {onRetry ? "Couldn't load forecast · Retry" : "Couldn't load forecast"}
        </ThemedText>
      </Pressable>
    );
  }

  if (!weather || weather.source === "unavailable") {
    return (
      <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
        No forecast
      </ThemedText>
    );
  }

  const wind = formatWind(weather.wind);
  // A cached reading's age is measured from when it was stored, not from
  // NEA's issue time — that's the number that tells you how stale the app's
  // view of the world is.
  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);

  return (
    <ThemedView
      style={[styles.badge, { backgroundColor: colors.backgroundSelected }]}
    >
      <WeatherIcon forecast={weather.forecast} size={34} tintColor={colors.text} />
      <ThemedView style={styles.textContainer}>
        <ThemedText style={styles.forecast} numberOfLines={2}>
          {weather.forecast}
        </ThemedText>
        <ThemedView style={styles.metaRow}>
          <ThemedText style={[styles.source, { color: colors.textSecondary }]}>
            {SOURCE_LABEL[weather.source]}
          </ThemedText>
          {weather.temperature && (
            <ThemedText style={[styles.source, { color: colors.textSecondary }]}>
              {formatTempRange(weather.temperature)}
            </ThemedText>
          )}
          {wind && (
            <ThemedText style={[styles.source, { color: colors.textSecondary }]}>
              {wind}
            </ThemedText>
          )}
        </ThemedView>
        {age && (
          <ThemedText style={[styles.age, { color: colors.textSecondary }]}>
            {/* The tiers age very differently — a 2hr nowcast is minutes old,
                the 4-day outlook is issued once each morning. */}
            Updated {age}
          </ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  badge: {
    // Stretch to whatever width the parent gives it — the forecast is the
    // headline of every card, so it takes the space rather than hugging text.
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  textContainer: {
    backgroundColor: "transparent",
    flexShrink: 1,
    gap: 2,
  },
  forecast: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
    flexWrap: "wrap",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  source: {
    fontSize: 12,
    lineHeight: 16,
  },
  age: {
    fontSize: 11,
    lineHeight: 15,
  },
});
