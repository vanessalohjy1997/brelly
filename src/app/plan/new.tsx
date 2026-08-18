import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
import { SlotForm } from "@/components/itinerary/SlotForm";
import { ThemedView } from "@/components/themedView";
import { ToastHost } from "@/components/toast";
import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { useRoutineMaterializer } from "@/hooks/useRoutineMaterializer";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { toDateKey } from "@/utils/dateKeys";
import { describeRoutine } from "@/utils/describeRoutine";
import { toTimeOfDay } from "@/utils/routineOccurrences";
import { saveWithFeedback } from "@/utils/saveWithFeedback";

export default function NewSlotScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const addSlot = useItineraryStore((state) => state.addSlot);
  const addRoutine = useRoutineStore((state) => state.addRoutine);
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();
  const materializeRoutines = useRoutineMaterializer();
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = useUnsavedChangesGuard(dirty);

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton
        label="Cancel"
        onPress={() => confirmDiscard(() => router.back())}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <SlotForm
          submitLabel="Add plan"
          initialDate={date}
          onDirtyChange={setDirty}
          allowRepeat
          onSubmit={({ repeat, ...values }) => {
            const start = new Date(values.startTime);
            const planDate = toDateKey(start);

            // A repeat is stored as a rule and filled in a fortnight at a time
            // rather than written out here — see `planRoutineMaterialization`.
            // The materialiser covers the first day too, so there is no
            // `addSlot` on this branch and no risk of writing that day twice.
            const saved = saveWithFeedback(
              () => {
                if (repeat) {
                  addRoutine({
                    label: values.label,
                    location: values.location,
                    latitude: values.latitude,
                    longitude: values.longitude,
                    weekdays: repeat.weekdays,
                    startTime: toTimeOfDay(start),
                    endTime: toTimeOfDay(new Date(values.endTime)),
                    startDate: planDate,
                    endDate: repeat.endDate,
                    kind: values.kind,
                    notificationsMuted: values.notificationsMuted,
                  });
                  return null;
                }
                // The day the form ended up on, not the one this screen was
                // opened from — changing the start date in the form has to
                // land the plan on that day.
                return { date: planDate, slot: addSlot(planDate, values) };
              },
              {
                // Names the rule, not a count: "Added Office · Repeats Mon–Fri"
                // is the promise being made, and a number would be a lie about
                // a routine that has no end.
                success: repeat
                  ? `Added ${values.label} · ${describeRoutine(repeat)}`
                  : `Added ${values.label}`,
                failure: "Couldn't save that plan. Try again.",
              },
            );
            // Staying on the form is the point of the guard: dismissing on a
            // failed save would drop everything the user typed.
            if (!saved.ok) return;

            if (saved.value) {
              scheduleRainNotificationForSlot(
                saved.value.date,
                saved.value.slot,
              );
            } else {
              // Fills in the next fortnight straight away, so the Plans tab
              // shows the routine on the way back rather than after a relaunch.
              materializeRoutines();
            }
            router.back();
          }}
        />
      </SafeAreaView>
      {/* The success toast outlives this modal and finishes on the tab
          underneath; a failure has to be readable here, while it's open. */}
      <ToastHost />
    </ThemedView>
  );
}
