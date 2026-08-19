import { ScrollView, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { UmbrellaVerdictIcon } from "@/components/weather/UmbrellaVerdictIcon";
import { WeatherBadge } from "@/components/weather/WeatherBadge";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SlotForecast } from "@/services/weather";
import { describeUmbrella } from "@/utils/describeUmbrella";

/**
 * TEMPORARY — visual QA only, for the icon watermark that replaced the
 * verdict pill + inline icon (see ItineraryCard.tsx/WeatherBadge.tsx). No
 * store, no network, no dependency on real plans or a working forecast API —
 * just a hand-built card shell fed four forecasts so every verdict (rain /
 * sun / rain+sun / clear) renders regardless of what plans exist or whether
 * the real weather calls are succeeding. Delete this file once you've had a
 * look.
 */
const MOCKS: { label: string; weather: SlotForecast; uvIndex?: number }[] = [
  {
    label: "Rain",
    weather: {
      forecast: "Thundery Showers",
      source: "24hr",
      temperature: { low: 24, high: 30 },
      updatedAt: new Date().toISOString(),
    },
  },
  {
    label: "Sun (high UV)",
    weather: {
      forecast: "Fair (Day)",
      source: "24hr",
      temperature: { low: 28, high: 34 },
      updatedAt: new Date().toISOString(),
    },
    uvIndex: 9,
  },
  {
    label: "Rain + sun",
    weather: {
      forecast: "Passing Showers",
      source: "24hr",
      temperature: { low: 25, high: 29 },
      updatedAt: new Date().toISOString(),
    },
    uvIndex: 10,
  },
  {
    label: "Clear",
    weather: {
      forecast: "Partly Cloudy (Day)",
      source: "24hr",
      temperature: { low: 26, high: 32 },
      updatedAt: new Date().toISOString(),
    },
    uvIndex: 4,
  },
];

export default function DevWeatherPreview() {
  const colors = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Weather watermark preview</ThemedText>
        {MOCKS.map((mock) => {
          const verdict = describeUmbrella(mock.weather.forecast, mock.uvIndex);
          const accent = verdict.themeColor ? colors[verdict.themeColor] : null;

          return (
            <ThemedView key={mock.label} style={styles.row}>
              <ThemedText type="smallBold">{mock.label}</ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {accent && (
                  <ThemedView style={[styles.accentBar, { backgroundColor: accent }]} />
                )}
                {verdict.reason !== "none" && (
                  <ThemedView style={styles.watermark} pointerEvents="none">
                    <UmbrellaVerdictIcon
                      reason={verdict.reason}
                      size={IconSize.watermark}
                      color={accent ?? colors.text}
                    />
                  </ThemedView>
                )}
                <ThemedView style={styles.cardBody}>
                  {/* A fake label/location line, purely so this mini card is
                      as tall as a real ItineraryCard — the watermark bleeds
                      off a much shorter box otherwise and mostly clips away. */}
                  <ThemedText style={styles.fakeLabel} numberOfLines={1}>
                    {mock.label} stop
                  </ThemedText>
                  <WeatherBadge
                    weather={mock.weather}
                    isLoading={false}
                    uvIndex={mock.uvIndex}
                  />
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  row: { gap: Spacing.two, backgroundColor: "transparent" },
  card: {
    flexDirection: "row",
    borderRadius: Spacing.two,
    overflow: "hidden",
  },
  accentBar: { width: 4, alignSelf: "stretch" },
  cardBody: {
    flex: 1,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    gap: 2,
    // Without this, ThemedView's default `type` fills it with an opaque
    // `theme.background` — which, since this is the last (topmost-painted)
    // child and spans the same area the watermark sits under, painted
    // straight over it.
    backgroundColor: "transparent",
  },
  fakeLabel: { fontWeight: "600" },
  watermark: {
    position: "absolute",
    right: -8,
    bottom: -28,
    width: IconSize.watermark,
    height: IconSize.watermark,
    opacity: 0.14,
    backgroundColor: "transparent",
  },
});
