import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { UmbrellaVerdictIcon } from "@/components/weather/UmbrellaVerdictIcon";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UpcomingPeriodForecast } from "@/services/weather";
import { describeUmbrella } from "@/utils/describeUmbrella";
import { formatPeriodLabel } from "@/utils/formatPeriodLabel";
import { formatTempRange } from "@/utils/formatTempRange";

type Props = {
  forecasts: UpcomingPeriodForecast[];
  /** Island-wide UV, the sun half of the verdict. Only the soonest period
   *  claims it — a UV reading taken now says nothing about this evening. */
  uvIndex?: number | null;
};

/**
 * Weather nearby, shown as the hero of the "no plans" empty state — the most
 * useful thing on screen when there's nothing planned. The soonest period
 * gets the large treatment; any later ones in the window are compact rows.
 * Temperature is only shown on the hero because NEA reports one range for
 * the whole day, so repeating it per period would be noise.
 */
export function NearbyForecastPreview({ forecasts, uvIndex }: Props) {
  const theme = useTheme();

  if (forecasts.length === 0) return null;

  const [current, ...later] = forecasts;
  const verdict = describeUmbrella(current.forecast, uvIndex);
  const heroTint = verdict.themeColor ? theme[verdict.themeColor] : theme.text;

  return (
    <ThemedView
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Nearby
      </ThemedText>

      <ThemedView style={styles.hero}>
        {verdict.reason === "none" ? (
          <WeatherIcon
            forecast={current.forecast}
            size={44}
            tintColor={theme.text}
          />
        ) : (
          <UmbrellaVerdictIcon
            reason={verdict.reason}
            size={50}
            color={heroTint}
            haloColor={theme.backgroundElement}
            // Nothing beside it repeats the verdict here — the hero line is
            // NEA's wording, not the answer — so this icon has to speak.
            accessibilityLabel={verdict.label}
          />
        )}
        <ThemedView style={styles.heroText}>
          {/* The tint stays on the icon and never moves to this line: at
              20px it would need 4.5:1, and umbrellaSun is 3.62:1 on this
              surface — fine for a graphic, short of it for text. */}
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
          {/* The `border` token, not a surface colour standing in for one.
              This faked a divider out of `backgroundSelected` back when
              `border` was an alias for the same value and there was nothing to
              gain; both themes now give it a real hairline. */}
          <ThemedView
            style={[styles.divider, { backgroundColor: theme.border }]}
          />
          {later.map((period) => {
            // No UV here on purpose: the sun half of the verdict is a reading
            // taken now, which says nothing about a period later today.
            const wet = describeUmbrella(period.forecast, null).reason === "rain";
            return (
              <ThemedView key={period.start} style={styles.laterRow}>
                <ThemedText
                  style={[styles.laterLabel, { color: theme.textSecondary }]}
                >
                  {formatPeriodLabel(period.start)}
                </ThemedText>
                <ThemedView style={styles.laterForecast}>
                  {wet ? (
                    <UmbrellaVerdictIcon
                      reason="rain"
                      size={22}
                      color={theme.umbrellaRain}
                      haloColor={theme.backgroundElement}
                      accessibilityLabel="Umbrella — rain"
                    />
                  ) : (
                    <WeatherIcon
                      forecast={period.forecast}
                      size={18}
                      tintColor={theme.text}
                    />
                  )}
                  <ThemedText style={styles.laterForecastText} numberOfLines={1}>
                    {period.forecast}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            );
          })}
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
