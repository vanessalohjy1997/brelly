import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { WeatherBadge } from "@/components/weather/WeatherBadge";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import type { ItinerarySlot } from "@/types/itinerary";

const DELETE_ACTION_WIDTH = 88;

type Props = {
  slot: ItinerarySlot;
  onDelete: () => void;
};

function DeleteAction({
  translation,
  onDelete,
}: {
  translation: SharedValue<number>;
  onDelete: () => void;
}) {
  const colors = useTheme();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + DELETE_ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.deleteAction, style]}>
      <Pressable
        onPress={onDelete}
        style={[styles.deleteButton, { backgroundColor: colors.danger }]}
      >
        <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export function ItineraryCard({ slot, onDelete }: Props) {
  const colors = useTheme();

  const { data: weather, isLoading, refetch } = useWeatherForSlot({
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
    <Swipeable
      renderRightActions={(_progress, translation) => (
        <DeleteAction translation={translation} onDelete={onDelete} />
      )}
      rightThreshold={DELETE_ACTION_WIDTH / 2}
    >
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

        {/* Location + weather row. The weather is the reason the app exists,
            so it gets the larger share of the row; the plan itself only needs
            enough room to be recognisable. */}
        <ThemedView style={styles.row}>
          <ThemedView style={styles.locationContainer}>
            <ThemedText type="default" style={styles.label} numberOfLines={2}>
              {slot.label}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: colors.textSecondary }}
              numberOfLines={1}
            >
              {slot.location}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.weatherContainer}>
            <WeatherBadge
              weather={weather}
              isLoading={isLoading}
              onRetry={() => refetch()}
            />
          </ThemedView>
        </ThemedView>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
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
    flex: 2,
    backgroundColor: "transparent",
    gap: 2,
  },
  label: {
    fontWeight: "600",
  },
  weatherContainer: {
    flex: 3,
    backgroundColor: "transparent",
    alignItems: "flex-end",
  },
  deleteAction: {
    width: DELETE_ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
    width: DELETE_ACTION_WIDTH - Spacing.two,
    height: "100%",
  },
  deleteButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
