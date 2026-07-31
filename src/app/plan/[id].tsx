import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
import { CopyToDateAction } from "@/components/itinerary/CopyToDateAction";
import { SlotForm } from "@/components/itinerary/SlotForm";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { Spacing } from "@/constants/theme";
import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { cancelAndDeleteSlot, cancelNotification } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { toDateKey } from "@/utils/dateKeys";
import { findSlotById } from "@/utils/planSelectors";
import { retargetSlotDate } from "@/utils/retargetSlotDate";

export default function EditSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Select the (stable) plans array and do the lookup here — selecting the
  // result of a lookup instead returns a new object every render, which
  // zustand reads as an endless stream of store changes.
  const plans = useItineraryStore((state) => state.plans);
  const found = useMemo(() => findSlotById(plans, id), [plans, id]);
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const addSlot = useItineraryStore((state) => state.addSlot);
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

  if (!found) {
    return (
      <ThemedView style={styles.missing}>
        <ThemedText>This plan no longer exists.</ThemedText>
      </ThemedView>
    );
  }

  const { date, slot } = found;

  const handleDuplicate = (targetDate: Date) => {
    const targetDateString = toDateKey(targetDate);
    const newSlot = addSlot(targetDateString, {
      label: slot.label,
      location: slot.location,
      latitude: slot.latitude,
      longitude: slot.longitude,
      startTime: retargetSlotDate(slot.startTime, targetDateString),
      endTime: retargetSlotDate(slot.endTime, targetDateString),
    });
    scheduleRainNotificationForSlot(targetDateString, newSlot);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete plan",
      `Remove "${slot.label}" from your itinerary?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            cancelAndDeleteSlot(deleteSlot, date, slot);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton label="Cancel" onPress={() => router.back()} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <SlotForm
          submitLabel="Save changes"
          initialValues={{
            label: slot.label,
            location: slot.location,
            latitude: slot.latitude,
            longitude: slot.longitude,
            startTime: slot.startTime,
            endTime: slot.endTime,
            notificationsMuted: slot.notificationsMuted,
          }}
          onSubmit={(values) => {
            if (slot.notificationId) {
              cancelNotification(slot.notificationId);
            }
            updateSlot(date, slot.id, { ...values, notificationId: undefined });
            // Editing the start date re-files the slot under that day, so the
            // notification has to be scheduled against the new day, not the
            // one this screen was opened from.
            scheduleRainNotificationForSlot(
              toDateKey(new Date(values.startTime)),
              {
                ...slot,
                ...values,
                neaRegion: getRegionFromCoordinates(
                  values.latitude,
                  values.longitude,
                ),
                notificationId: undefined,
              },
            );
            router.back();
          }}
          onDelete={handleDelete}
        >
          <CopyToDateAction onDuplicate={handleDuplicate} />
        </SlotForm>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
});
