import { router } from "expo-router";
import { Pressable, StyleSheet, useColorScheme } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherBadge } from "@/components/weather/WeatherBadge";
import { Colors, Spacing } from "@/constants/theme";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import type { ItinerarySlot } from "@/types/itinerary";

type Props = {
  slot: ItinerarySlot;
};

export function ItineraryCard({ slot }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  const { data: weather, isLoading } = useWeatherForSlot({
    region: slot.neaRegion,
    latitude: slot.latitude,
    longitude: slot.longitude,
    slotStartTime: slot.startTime,
  });

  const startTime = new Date(slot.startTime).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const endTime = new Date(slot.endTime).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <Pressable
      onPress={() => router.push(`/plan/${slot.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.backgroundElement },
        pressed && { backgroundColor: colors.backgroundSelected },
      ]}
    >
      {/* Time */}
      <ThemedText style={[styles.time, { color: colors.textSecondary }]}>
        {startTime} – {endTime}
      </ThemedText>

      {/* Location + weather row */}
      <ThemedView style={styles.row}>
        <ThemedView style={styles.locationContainer}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {slot.label}
          </ThemedText>
          <ThemedText style={{ color: colors.textSecondary }} numberOfLines={1}>
            {slot.location}
          </ThemedText>
        </ThemedView>

        <WeatherBadge weather={weather} isLoading={isLoading} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  time: {
    fontSize: 12,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  locationContainer: {
    flex: 1,
    backgroundColor: "transparent",
    gap: 2,
  },
});
