"use client";

import { useCallback } from "react";

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

import { useRoutineMaterializer } from "./useRoutineMaterializer";

/**
 * A delete that was asked about and answered, or `null` because the question
 * was dismissed — see `askEditScope`. Only a routine's stop raises the
 * question, so `null` is only ever possible for one.
 */
export type DeleteResult = SaveResult<void> | null;

/**
 * Deletes a stop and offers it back for as long as the toast is up.
 *
 * Every delete goes through here — the row action on all three lists and the
 * button on the edit page — which is what makes an undo possible at all: one
 * place knows what was removed and one place can put it back.
 *
 * It replaces a confirmation dialog, and the reasoning is worth keeping: an
 * undo is both faster than a dialog — nothing to dismiss on the way to the
 * thing you meant — and safer, because it also covers the accidental press,
 * which no amount of confirming on the *other* path ever could.
 *
 * A routine's stop is the one exception, and not for confirmation's sake:
 * "delete this" is genuinely two different deletes and no undo can guess which
 * was meant.
 *
 * Two things the phone's version does are absent here, both because the web has
 * no notifications: nothing is cancelled on the way out, and nothing is
 * rescheduled on the way back in. `stripNotificationHandles` still runs on the
 * restore — the handle belongs to a phone's alert queue, and carrying a stale
 * one back would leave that phone believing the stop is still scheduled.
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

  return useCallback(
    async (date: string, slot: ItinerarySlot): Promise<DeleteResult> => {
      // A stop that has already ended has no series reading, so it is never
      // asked about. The archive is a record of what happened, and no top-up
      // touches a day before today — so asking would offer "delete all future
      // days" from the one screen that only holds history.
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
          // Only the *rule* is deleted. The days it already produced and that
          // have been and gone stay in the archive, because they happened.
          const removed = saveWithFeedback(() => deleteRoutine(routine.id), {
            success: `Deleted ${slot.label} and its repeats`,
            failure: "Couldn't delete that routine. Try again.",
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
                // Refills the days the sweep took away, under the same
                // deterministic ids.
                if (restored.ok) materializeRoutines();
              },
            },
          });
          // The sweep is what takes the upcoming stops off the lists.
          if (removed.ok) materializeRoutines();
          return removed;
        }
      }

      // Re-read after the prompt: `slot` is the copy the row captured, and a
      // phone sharing this account may have written to it while the question
      // was on screen.
      const current =
        findSlotById(useItineraryStore.getState().plans, slot.id)?.slot ?? slot;

      return saveWithFeedback(
        () => {
          deleteSlot(date, current.id);
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
              saveWithFeedback(
                () => {
                  // Lifted before the stop goes back, so the day is wanted
                  // again by the time anything reads the routine.
                  if (slot.routineId) removeException(slot.routineId, date);
                  return restoreSlot(date, stripNotificationHandles(current));
                },
                {
                  success: `Restored ${slot.label}`,
                  failure: "Couldn't restore that plan.",
                },
              );
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
    ],
  );
}
