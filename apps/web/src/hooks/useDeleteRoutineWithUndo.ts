"use client";

import { useCallback } from "react";

import {
  saveWithFeedback,
  useRoutineStore,
  type Routine,
  type SaveResult,
} from "@brelly/core";

import { useRoutineMaterializer } from "./useRoutineMaterializer";

/**
 * Deletes a rule and offers it back for as long as the toast is up.
 *
 * Only the *rule* is deleted. The days it already produced and that have been
 * and gone stay in the archive, because they happened; the days still ahead
 * are taken off the lists by the materialiser's sweep, and put back by the
 * same pass — under the same deterministic ids — when the undo is pressed.
 *
 * Shared by the series branch of `useDeleteSlotWithUndo` and by the Routines
 * page, which is the one place a rule can be deleted without a day in hand.
 */
export function useDeleteRoutineWithUndo(): (
  routine: Routine,
  /** What the toast calls it — the stop's own label when pressed from one. */
  label?: string,
) => SaveResult<void> {
  const deleteRoutine = useRoutineStore((state) => state.deleteRoutine);
  const restoreRoutine = useRoutineStore((state) => state.restoreRoutine);
  const materializeRoutines = useRoutineMaterializer();

  return useCallback(
    (routine: Routine, label: string = routine.label) => {
      const removed = saveWithFeedback(() => deleteRoutine(routine.id), {
        success: `Deleted ${label} and its repeats`,
        failure: "Couldn't delete that routine. Try again.",
        successAction: {
          label: "Undo",
          onPress: () => {
            const restored = saveWithFeedback(() => restoreRoutine(routine), {
              success: `Restored ${label} and its repeats`,
              failure: "Couldn't restore that routine.",
            });
            if (restored.ok) materializeRoutines();
          },
        },
      });
      if (removed.ok) materializeRoutines();
      return removed;
    },
    [deleteRoutine, restoreRoutine, materializeRoutines],
  );
}
