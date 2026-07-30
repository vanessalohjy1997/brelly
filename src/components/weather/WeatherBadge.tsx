import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SlotForecast } from "@/services/weather";
import { formatTempRange } from "@/utils/formatTempRange";

type Props = {
  weather: SlotForecast | undefined;
  isLoading: boolean;
  onRetry?: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  "2hr": "Live",
  "24hr": "Today",
  "4day": "4-day",
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

  return (
    <ThemedView
      style={[styles.badge, { backgroundColor: colors.backgroundSelected }]}
    >
      <WeatherIcon forecast={weather.forecast} size={22} tintColor={colors.text} />
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
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.one,
    maxWidth: 140,
  },
  textContainer: {
    backgroundColor: "transparent",
    flexShrink: 1,
  },
  forecast: {
    fontSize: 11,
    fontWeight: "500",
    flexWrap: "wrap",
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  source: {
    fontSize: 10,
  },
});
