import { ActivityIndicator, StyleSheet, useColorScheme } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Colors, Spacing } from "@/constants/theme";

type Props = {
  weather:
    | { forecast: string; source: "2hr" | "24hr" | "4day" | "unavailable" }
    | undefined;
  isLoading: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  "2hr": "Live",
  "24hr": "Today",
  "4day": "4-day",
  unavailable: "",
};

export function WeatherBadge({ weather, isLoading }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  if (isLoading) {
    return <ActivityIndicator size="small" />;
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
        <ThemedText style={[styles.source, { color: colors.textSecondary }]}>
          {SOURCE_LABEL[weather.source]}
        </ThemedText>
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
  source: {
    fontSize: 10,
  },
});
