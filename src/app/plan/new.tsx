import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
import { SlotForm } from "@/components/itinerary/SlotForm";
import { ThemedView } from "@/components/themedView";
import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { useItineraryStore } from "@/store/itineraryStore";
import { toDateKey } from "@/utils/dateKeys";

export default function NewSlotScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const addSlot = useItineraryStore((state) => state.addSlot);
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton label="Cancel" onPress={() => router.back()} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <SlotForm
          submitLabel="Add plan"
          initialDate={date}
          onSubmit={(values) => {
            // The day the form ended up on, not the one this screen was opened
            // from — changing the start date in the form has to land the plan
            // on that day.
            const planDate = toDateKey(new Date(values.startTime));
            const newSlot = addSlot(planDate, values);
            scheduleRainNotificationForSlot(planDate, newSlot);
            router.back();
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
