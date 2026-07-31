import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AirQuality } from "@/hooks/useAirQuality";
import type { LiveConditions } from "@/types/weather";
import { describePsi } from "@/utils/describePsi";
import { describeUv } from "@/utils/describeUv";
import { formatRelativeTimestamp } from "@/utils/formatRelativeTimestamp";
import { formatWindSpeedKnots } from "@/utils/formatWind";

type Props = {
  conditions: LiveConditions | null | undefined;
  airQuality: AirQuality | undefined;
};

/**
 * What sensors are measuring right now, as opposed to what NEA forecasts —
 * the difference between "showers expected this afternoon" and "it is raining
 * on you". Renders nothing at all when no reading came back, rather than a
 * card full of dashes.
 */
export function LiveConditionsCard({ conditions, airQuality }: Props) {
  const theme = useTheme();

  const readings = buildReadings(conditions, airQuality);
  if (readings.length === 0) return null;

  const observedAgo = formatRelativeTimestamp(conditions?.observedAt);

  return (
    <ThemedView
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedView style={styles.headingRow}>
        <ThemedText style={[styles.heading, { color: theme.textSecondary }]}>
          Right now
        </ThemedText>
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

type Reading = { label: string; value: string };

/**
 * Split out so the "which readings are worth showing" decision — the part
 * with actual rules in it — can be tested without rendering.
 */
export function buildReadings(
  conditions: LiveConditions | null | undefined,
  airQuality: AirQuality | undefined,
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

  if (airQuality?.psi != null) {
    readings.push({
      label: `PSI ${airQuality.psi}`,
      value: describePsi(airQuality.psi).label,
    });
  }
  if (airQuality?.uvIndex != null) {
    readings.push({
      label: `UV ${airQuality.uvIndex}`,
      value: describeUv(airQuality.uvIndex).label,
    });
  }

  return readings;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
