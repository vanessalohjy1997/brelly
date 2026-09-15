import { useCallback } from "react";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { useRoutineMaterializer } from "@/hooks/useRoutineMaterializer";
import { cancelAndDeleteSlot } from "@/services/notifications";
import {
  describeRoutine,
  findSlotById,
  routineForSlot,
  saveWithFeedback,
  stripNotificationHandles,
  useItineraryStore,
  useRoutineStore,
  type ItinerarySlot,
  type SaveResult,
} from "@brelly/core";
import { askEditScope } from "@/utils/askEditScope";
import { hapticDelete } from "@/utils/haptics";

/**
 * A delete that was asked about and answered, or `null` because the question
 * was dismissed — see `askEditScope`. Only a routine's stop raises the
 * question, so `null` is only ever possible for one.
 */
export type DeleteResult = SaveResult<void> | null;

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
 *
 * A routine's stop is the one exception, and not for confirmation's sake:
 * "delete this" is genuinely two different deletes, and no undo can guess
 * which was meant. The scope prompt used to live in the edit screen, so the
 * swipe on a list quietly took the this-day reading without asking; it is
 * here now, so both paths ask the same question and the answer means the same
 * thing whichever one raised it.
 */
export function useDeleteSlotWithUndo(): (
  date: string,
  slot: ItinerarySlot,
) => Promise<DeleteResult> {
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);
  const restoreSlot = useItineraryStore((state) => state.restoreSlot);
  const routines = useRoutineStore((state) => state.routines);
  const deleteRoutine = useRoutineStore((state) => state.deleteRoutine);
  const restoreRoutine = useRoutineStore((state) => state.restoreRoutine);
  const addException = useRoutineStore((state) => state.addException);
  const removeException = useRoutineStore((state) => state.removeException);
  const materializeRoutines = useRoutineMaterializer();
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

  return useCallback(
    async (date: string, slot: ItinerarySlot): Promise<DeleteResult> => {
      // A stop that has already ended has no series reading, so it is never
      // asked about. The archive is a record of what happened; rule 1 of
      // `planRoutineMaterialization` never touches a day before today, so
      // there is no top-up that could put this one back and nothing about the
      // rule that deleting it could mean. Asking would offer "delete all
      // future days" from inside the archive — a live rule destroyed from the
      // one screen that is only supposed to hold history. It deletes the one
      // archived day, undoably, exactly as it did before the prompt moved here.
      const ended = new Date(slot.endTime).getTime() <= Date.now();
      const routine = ended
        ? undefined
        : routineForSlot(routines, slot.routineId);

      if (routine) {
        const scope = await askEditScope({
          title: `Delete ${slot.label}?`,
          message: `${describeRoutine(routine)}.`,
          dayLabel: "Delete this day",
          seriesLabel: "Delete all future days",
          destructive: true,
        });
        // Dismissed. Nothing is deleted and nothing is said about it — the
        // question going away is the whole answer.
        if (!scope) return null;

        if (scope === "series") {
          hapticDelete();
          // Only the *rule* is deleted. The days it already produced and that
          // have been and gone stay in the archive, because they happened.
          const removed = saveWithFeedback(() => deleteRoutine(routine.id), {
            success: `Deleted ${slot.label} and its repeats`,
            failure: "Couldn't delete that routine. Try again.",
            // This branch is one swipe and one mis-tap away now that the
            // prompt is raised here rather than from the edit form, and it
            // destroys a standing rule. `restoreRoutine` exists for exactly
            // this: it keeps the id, so the days already filed under it are
            // not orphaned, and it keeps `exceptions`, the record of the days
            // deliberately deleted.
            successAction: {
              label: "Undo",
              onPress: () => {
                const restored = saveWithFeedback(
                  () => restoreRoutine(routine),
                  {
                    success: `Restored ${slot.label} and its repeats`,
                    failure: "Couldn't restore that routine.",
                  },
                );
                // Refills the days the sweep below took away, under the same
                // deterministic ids, and schedules their alerts afresh.
                if (restored.ok) materializeRoutines();
              },
            },
          });
          // The sweep is what takes the upcoming stops off the lists, and it
          // cancels their alerts on the way out.
          if (removed.ok) materializeRoutines();
          return removed;
        }
      }

      hapticDelete();
      // Re-read after the prompt. `slot` is the copy the swipe captured, and
      // the alert id is the field written behind our back while the question
      // was on screen — `runNotificationSync` stamps one on after its own
      // awaited forecast fetch. Cancelling the stale copy's id cancels
      // nothing, and once the slot is gone there is no route back to the
      // alert: everything that cleans one up finds it through
      // `slot.notificationId`.
      const current =
        findSlotById(useItineraryStore.getState().plans, slot.id)?.slot ?? slot;

      return saveWithFeedback(
        () => {
          cancelAndDeleteSlot(deleteSlot, date, current);
          // A stop a routine filled in has to be remembered as *deleted*, not
          // merely absent: the next top-up reads an empty day as "not
          // materialised yet" and would put it straight back, undoing the
          // delete without anyone asking.
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
                  // The delete cancelled the scheduled alert, so the id on the
                  // slot now refers to a notification that no longer exists —
                  // carrying it back would leave the stop looking scheduled
                  // forever and no alert would ever fire again.
                  return restoreSlot(date, stripNotificationHandles(current));
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
      );
    },
    [
      deleteSlot,
      restoreSlot,
      routines,
      deleteRoutine,
      restoreRoutine,
      addException,
      removeException,
      materializeRoutines,
      scheduleRainNotificationForSlot,
    ],
  );
}
