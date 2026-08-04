import { useCallback } from "react";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { cancelAndDeleteSlot } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { saveWithFeedback, type SaveResult } from "@/utils/saveWithFeedback";

/**
 * Deletes a stop and offers it back for as long as the toast is up.
 *
 * Every delete in the app goes through here — the swipe action on all three
 * lists and the button on the edit screen — which is what makes an undo
 * possible at all: there is one place that knows what was removed and one
 * place that can put it back.
 *
 * It replaces the confirmation dialog the edit screen used to show. The
 * friction was backwards: the gesture you can trigger by accident (swipe) had
 * no confirmation and the deliberate button had an `Alert`. An undo is both
 * faster than a dialog — nothing to dismiss on the way to the thing you meant
 * to do — and safer, because it also covers the accidental swipe, which no
 * amount of confirming on the *other* path ever could.
 */
export function useDeleteSlotWithUndo() {
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const restoreSlot = useItineraryStore((state) => state.restoreSlot);
  const addException = useRoutineStore((state) => state.addException);
  const removeException = useRoutineStore((state) => state.removeException);
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

  return useCallback(
    (date: string, slot: ItinerarySlot): SaveResult<void> =>
      saveWithFeedback(
        () => {
          cancelAndDeleteSlot(deleteSlot, date, slot);
          // A stop a routine filled in has to be remembered as *deleted*, not
          // merely absent: the next top-up reads an empty day as "not
          // materialised yet" and would put it straight back, undoing the
          // delete without anyone asking. Deleting one day of a routine is
          // exactly the "this day only" choice, so it is taken as one.
          if (slot.routineId) addException(slot.routineId, date);
        },
        {
          success: `Deleted ${slot.label}`,
          failure: "Couldn't delete that plan. Try again.",
          successAction: {
            label: "Undo",
            onPress: () => {
              const restored = saveWithFeedback(
                () => {
                  // Lifted before the stop goes back, so the day is wanted
                  // again by the time anything reads the routine.
                  if (slot.routineId) removeException(slot.routineId, date);
                  return restoreSlot(date, {
                    ...slot,
                    // The delete cancelled the scheduled alert, so the id on
                    // the slot now refers to a notification that no longer
                    // exists. Carrying it back would leave the slot looking
                    // scheduled forever: the foreground resync reads "has an
                    // alert" and leaves it alone, and no alert would ever fire.
                    notificationId: undefined,
                    notificationLeadMinutes: undefined,
                  });
                },
                {
                  success: `Restored ${slot.label}`,
                  failure: "Couldn't restore that plan.",
                },
              );
              if (!restored.ok) return;

              // Fire-and-forget, like every other scheduling call — and it
              // re-reads the forecast rather than trusting the one the original
              // alert was scheduled against, which may be hours old by now.
              scheduleRainNotificationForSlot(date, restored.value);
            },
          },
        },
      ),
    [
      deleteSlot,
      restoreSlot,
      addException,
      removeException,
      scheduleRainNotificationForSlot,
    ],
  );
}
