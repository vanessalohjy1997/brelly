import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UpcomingPeriodForecast } from "@/services/weather";
import { formatPeriodLabel } from "@/utils/formatPeriodLabel";
import { formatTempRange } from "@/utils/formatTempRange";

type Props = {
  forecasts: UpcomingPeriodForecast[];
};

/**
 * Weather nearby, shown as the hero of the "no plans" empty state — the most
 * useful thing on screen when there's nothing planned. The soonest period
 * gets the large treatment; any later ones in the window are compact rows.
 * Temperature is only shown on the hero because NEA reports one range for
 * the whole day, so repeating it per period would be noise.
 */
export function NearbyForecastPreview({ forecasts }: Props) {
  const theme = useTheme();

  if (forecasts.length === 0) return null;

  const [current, ...later] = forecasts;

  return (
    <ThemedView
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText style={[styles.heading, { color: theme.textSecondary }]}>
        Nearby
      </ThemedText>

      <ThemedView style={styles.hero}>
        <WeatherIcon
          forecast={current.forecast}
          size={44}
          tintColor={theme.text}
        />
        <ThemedView style={styles.heroText}>
          <ThemedText style={styles.heroForecast} numberOfLines={2}>
            {current.forecast}
          </ThemedText>
          <ThemedText style={[styles.heroMeta, { color: theme.textSecondary }]}>
            {formatPeriodLabel(current.start)} ·{" "}
            {formatTempRange(current.temperature)}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      {later.length > 0 && (
        <ThemedView style={styles.later}>
          <ThemedView
            style={[
              styles.divider,
              { backgroundColor: theme.backgroundSelected },
            ]}
          />
          {later.map((period) => (
            <ThemedView key={period.start} style={styles.laterRow}>
              <ThemedText
                style={[styles.laterLabel, { color: theme.textSecondary }]}
              >
                {formatPeriodLabel(period.start)}
              </ThemedText>
              <ThemedView style={styles.laterForecast}>
                <WeatherIcon
                  forecast={period.forecast}
                  size={18}
                  tintColor={theme.text}
                />
                <ThemedText style={styles.laterForecastText} numberOfLines={1}>
                  {period.forecast}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: "transparent",
  },
  heroText: {
    flexShrink: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
  heroForecast: {
    fontSize: 20,
    fontWeight: "600",
  },
  heroMeta: {
    fontSize: 13,
  },
  later: {
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: 1,
  },
  laterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  laterLabel: {
    fontSize: 13,
  },
  laterForecast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    flexShrink: 1,
    backgroundColor: "transparent",
  },
  laterForecastText: {
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
});
