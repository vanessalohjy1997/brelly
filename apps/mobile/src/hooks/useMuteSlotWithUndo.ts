import { useCallback } from "react";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { useRoutineMaterializer } from "@/hooks/useRoutineMaterializer";
import { cancelNotification } from "@/services/notifications";
import {
  clearedNotificationHandles,
  describeRoutine,
  findSlotById,
  routineForSlot,
  saveWithFeedback,
  useItineraryStore,
  useRoutineStore,
  type ItinerarySlot,
  type SaveResult,
} from "@brelly/core";
import { askEditScope } from "@/utils/askEditScope";
import { hapticToggle } from "@/utils/haptics";

/** `null` when a routine's scope prompt was dismissed — see `DeleteResult`. */
export type MuteResult = SaveResult<void> | null;

/** Best-effort, like every other cancel: a stray alert isn't worth an error. */
function cancelQuietly(notificationId: string | undefined): void {
  if (!notificationId) return;
  cancelNotification(notificationId).catch(() => {
    // The alert either fires once for a muted stop or it doesn't; the
    // foreground resync (`planNotificationResync`) catches it either way.
  });
}

/**
 * Turns one stop's rain alert off, or back on, from wherever it is listed.
 *
 * The mute seam beside `useDeleteSlotWithUndo`, and it exists for the same
 * reason: muting was reachable only through the edit form, so the flag the
 * card already draws as a bell-slash took a modal, a scroll and a Save to
 * change. Both hooks now answer the swipe.
 *
 * Muting cancels the scheduled alert and clears its handles, because the id
 * left behind would read as "already scheduled" forever
 * (`planNotificationResync` takes `!!notificationId` at its word). Unmuting
 * re-reads the forecast rather than trusting the one the old alert was
 * scheduled against.
 *
 * A routine's stop can't take a silent per-day flag: rule 4 of
 * `planRoutineMaterialization` compares `notificationsMuted` against the rule
 * and replaces any slot that disagrees, so a quiet mute would vanish at the
 * next top-up. So the same day/series question the edit form asks is asked
 * here — the series answer moves the rule, the day answer cuts the stop loose
 * first.
 */
export function useMuteSlotWithUndo(): (
  date: string,
  slot: ItinerarySlot,
) => Promise<MuteResult> {
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const routines = useRoutineStore((state) => state.routines);
  const updateRoutine = useRoutineStore((state) => state.updateRoutine);
  const addException = useRoutineStore((state) => state.addException);
  const materializeRoutines = useRoutineMaterializer();
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

  return useCallback(
    async (date: string, slot: ItinerarySlot): Promise<MuteResult> => {
      // The state being moved *to*, which is what every message below is
      // about — reading `slot.notificationsMuted` again after the write would
      // describe the state that was left behind.
      const muted = !slot.notificationsMuted;
      const routine = routineForSlot(routines, slot.routineId);

      if (routine) {
        const scope = await askEditScope({
          title: muted ? `Mute ${slot.label}?` : `Unmute ${slot.label}?`,
          message: `${describeRoutine(routine)}.`,
          dayLabel: muted ? "Mute this day" : "Unmute this day",
          seriesLabel: muted ? "Mute all future days" : "Unmute all future days",
        });
        if (!scope) return null;

        if (scope === "series") {
          hapticToggle();
          const saved = saveWithFeedback(
            () => updateRoutine(routine.id, { notificationsMuted: muted }),
            {
              success: muted
                ? `Rain alerts off for ${slot.label} and its repeats`
                : `Rain alerts on for ${slot.label} and its repeats`,
              failure: "Couldn't change that routine's alerts. Try again.",
            },
          );
          // Every upcoming stop now disagrees with its own rule, so the
          // materialiser replaces each one — cancelling the old alert on the
          // way out and scheduling a fresh one on the way back in.
          if (saved.ok) materializeRoutines();
          return saved;
        }
      }

      hapticToggle();

      // `slot` is the copy the swipe captured, and on a routine's stop the
      // prompt above has been standing in front of it for seconds. The alert
      // id is exactly the field written behind our back in that window:
      // `runNotificationSync` stamps one on after its own awaited forecast
      // fetch. Cancelling the stale copy's id cancels nothing and strands the
      // real alert, which nothing can reach afterwards — the update below
      // clears the handle, and `planNotificationResync` only finds alerts
      // through `!!slot.notificationId`.
      const current =
        findSlotById(useItineraryStore.getState().plans, slot.id)?.slot ?? slot;

      /** Puts the flag back — the one-off path's Undo, below. */
      const revert = (): void => {
        // The unmute being undone may already have scheduled an alert: the
        // scheduler is fire-and-forget, so the id is on the slot in the store
        // by now, not in this closure's copy of it.
        const current = findSlotById(
          useItineraryStore.getState().plans,
          slot.id,
        )?.slot;

        const reverted = saveWithFeedback(
          () =>
            updateSlot(date, slot.id, {
              notificationsMuted: !muted,
              ...clearedNotificationHandles,
            }),
          {
            success: muted
              ? `Rain alerts on for ${slot.label}`
              : `Rain alerts off for ${slot.label}`,
            failure: "Couldn't change alerts for that stop.",
          },
        );
        if (!reverted.ok || !reverted.value) return;

        cancelQuietly(current?.notificationId);
        if (muted) scheduleRainNotificationForSlot(date, reverted.value);
      };

      let updated: ItinerarySlot | undefined;
      const saved = saveWithFeedback(
        () => {
          updated = updateSlot(date, slot.id, {
            notificationsMuted: muted,
            ...(routine ? { routineId: undefined } : null),
            ...clearedNotificationHandles,
          });
          // The slot isn't where the caller thinks it is — deleted, or already
          // re-filed. Thrown rather than reported as a success, because the
          // toast would otherwise say the alerts changed and offer to undo a
          // write that never happened.
          if (!updated) throw new Error(`No slot ${slot.id} on ${date}`);
          // "This day only" cuts the stop loose, exactly as the edit form's
          // does: the exception stops the next top-up from filling the day
          // back in beside it, and clearing `routineId` puts it out of the
          // rule's reach for good.
          //
          // Recorded *after* the detach, and only if it happened. An exception
          // with no detach behind it is the one state nothing recovers from:
          // the day drops out of the routine's occurrences, so the next top-up
          // reads the stop as unwanted and sweeps the thing the user only
          // meant to mute.
          if (routine) addException(routine.id, date);
        },
        {
          success: muted
            ? `Rain alerts off for ${slot.label}`
            : `Rain alerts on for ${slot.label}`,
          failure: "Couldn't change alerts for that stop. Try again.",
          // Undo is offered on a one-off only. The routine paths were asked
          // about before anything happened, and the day one detached the stop
          // on the way through — an "undo" that silently re-attached it would
          // be a third answer to a question that had two. Both stay reversible
          // by the gesture that caused them, which a delete never is.
          successAction: routine
            ? undefined
            : { label: "Undo", onPress: revert },
        },
      );

      if (!saved.ok || !updated) return saved;

      cancelQuietly(current.notificationId);
      // Fire-and-forget, like every other scheduling call. `updated` rather
      // than `slot`: a detached stop was re-keyed to a fresh id by
      // `updateSlot`, and an alert scheduled against the old one would be
      // written back to a slot that no longer exists.
      if (!muted) scheduleRainNotificationForSlot(date, updated);
      return saved;
    },
    [
      updateSlot,
      routines,
      updateRoutine,
      addException,
      materializeRoutines,
      scheduleRainNotificationForSlot,
    ],
  );
}
