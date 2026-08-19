import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { UmbrellaVerdictIcon } from "@/components/weather/UmbrellaVerdictIcon";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UvIndex } from "@/hooks/useUvIndex";
import type { LiveConditions } from "@/types/weather";
import { describeUmbrella } from "@/utils/describeUmbrella";
import { describeUv } from "@/utils/describeUv";
import { formatRelativeTimestamp } from "@/utils/formatRelativeTimestamp";
import { formatWindSpeedKnots } from "@/utils/formatWind";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 19;

type Props = {
  conditions: LiveConditions | null | undefined;
  uvIndex: UvIndex | undefined;
};

/**
 * What sensors are measuring right now, as opposed to what NEA forecasts —
 * the difference between "showers expected this afternoon" and "it is raining
 * on you". Renders nothing at all when no reading came back, rather than a
 * card full of dashes.
 */
export function LiveConditionsCard({ conditions, uvIndex }: Props) {
  const theme = useTheme();

  const readings = buildReadings(conditions, uvIndex);
  if (readings.length === 0) return null;

  const observedAgo = formatRelativeTimestamp(conditions?.observedAt);
  const liveForecast = deriveLiveForecastText(conditions);

  // Same umbrella question the plan cards answer, asked of the live reading
  // instead of a forecast — see the watermark on `ItineraryCard`.
  const verdict = describeUmbrella(liveForecast ?? undefined, uvIndex?.value);
  const accent = verdict.themeColor ? theme[verdict.themeColor] : null;

  return (
    <ThemedView
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
    >
      {/* Decorative — nothing else on this card spells the verdict out as a
          sentence, so the icon carries it via `accessibilityLabel` instead. */}
      {verdict.reason !== "none" && (
        <ThemedView style={styles.watermark} pointerEvents="none">
          <UmbrellaVerdictIcon
            reason={verdict.reason}
            size={IconSize.watermark}
            color={accent ?? theme.text}
            accessibilityLabel={verdict.label}
          />
        </ThemedView>
      )}

      <ThemedView style={styles.headingRow}>
        <ThemedView style={styles.headingLeft}>
          {liveForecast && (
            <WeatherIcon
              forecast={liveForecast}
              size={IconSize.control}
              tintColor={theme.textSecondary}
            />
          )}
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Right now
          </ThemedText>
        </ThemedView>
        {conditions?.stationName && (
          <ThemedText
            style={[styles.station, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {conditions.stationName}
            {observedAgo ? ` · ${observedAgo}` : ""}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.readings}>
        {readings.map((reading) => (
          <ThemedView key={reading.label} style={styles.reading}>
            <ThemedText style={styles.value} numberOfLines={1}>
              {reading.value}
            </ThemedText>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              {reading.label}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

/**
 * A live rain reading is the one signal this card has that a forecast
 * doesn't — sensor rainfall right now beats a forecast's "chance of showers".
 * Reused as `WeatherIcon`'s `forecast` prop, so the string has to stay in its
 * vocabulary (`forecastToSymbol` matches on "rain"/"fair"/"(night)").
 * Returns null rather than guessing when there's no rainfall reading at all.
 */
export function deriveLiveForecastText(
  conditions: LiveConditions | null | undefined,
  now: Date = new Date(),
): string | null {
  if (conditions?.rainfallMm === undefined) return null;
  if (conditions.rainfallMm > 0) return "Rain";

  const hour = now.getHours();
  const isDaytime = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
  return isDaytime ? "Fair (Day)" : "Fair (Night)";
}

type Reading = { label: string; value: string };

/**
 * Split out so the "which readings are worth showing" decision — the part
 * with actual rules in it — can be tested without rendering.
 */
export function buildReadings(
  conditions: LiveConditions | null | undefined,
  uvIndex: UvIndex | undefined,
): Reading[] {
  const readings: Reading[] = [];

  if (conditions?.rainfallMm !== undefined) {
    readings.push({
      label: "Rain",
      // The sensor reports a 5-minute accumulation, so a bare "0 mm" is
      // noise where "None" is an answer.
      value: conditions.rainfallMm > 0 ? `${conditions.rainfallMm} mm` : "None",
    });
  }
  if (conditions?.temperatureC !== undefined) {
    readings.push({
      label: "Temp",
      value: `${Math.round(conditions.temperatureC)}°C`,
    });
  }
  if (conditions?.humidityPercent !== undefined) {
    readings.push({
      label: "Humidity",
      value: `${Math.round(conditions.humidityPercent)}%`,
    });
  }

  const wind = formatWindSpeedKnots(conditions?.windSpeedKn);
  if (wind) readings.push({ label: "Wind", value: wind });

  // The five-band WHO scale is a readout, not a verdict — the umbrella
  // decision on a stop card is binary (see `describeUmbrella`). Colour never
  // carries the band on its own: the label rides alongside, because the WHO
  // palette runs green→red, the axis red-green colour blindness collapses.
  if (uvIndex?.value != null) {
    readings.push({
      label: `UV ${uvIndex.value}`,
      value: describeUv(uvIndex.value).label,
    });
  }

  return readings;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    // So the watermark's bleed is clipped to the card's own rounded corner
    // instead of poking past it.
    overflow: "hidden",
  },
  watermark: {
    position: "absolute",
    right: 8,
    bottom: -20,
    opacity: 0.14,
    backgroundColor: "transparent",
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  headingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  station: {
    fontSize: 11,
    flexShrink: 1,
    textAlign: "right",
  },
  readings: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    backgroundColor: "transparent",
  },
  reading: {
    gap: 2,
    backgroundColor: "transparent",
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  label: {
    fontSize: 11,
  },
});
