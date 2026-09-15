"use client";

import { useCallback } from "react";

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

import { useRoutineMaterializer } from "./useRoutineMaterializer";

/** `null` when a routine's scope prompt was dismissed — see `DeleteResult`. */
export type MuteResult = SaveResult<void> | null;

/**
 * Turns one stop's rain alert off, or back on, from wherever it is listed.
 *
 * Worth saying plainly what this does on a platform with no notifications: it
 * edits a **cross-client** flag. The web sends no alerts, but the phone reads
 * `notificationsMuted` off the same document — so muting a stop from a laptop
 * is how you stop your phone buzzing about it, which is a perfectly ordinary
 * thing to want and the reason this is not one of the features web drops.
 *
 * `clearedNotificationHandles` still goes on every write. The handle is a
 * phone's alert id; leaving a stale one behind would have that phone read the
 * stop as "already scheduled" forever — `planNotificationResync` takes
 * `!!notificationId` at its word.
 *
 * A routine's stop cannot take a silent per-day flag: rule 4 of
 * `planRoutineMaterialization` replaces any slot that disagrees with its rule,
 * so a quiet mute would vanish at the next top-up. Hence the same day/series
 * question — the series answer moves the rule, the day answer cuts the stop
 * loose first.
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

  return useCallback(
    async (date: string, slot: ItinerarySlot): Promise<MuteResult> => {
      // The state being moved *to*, which is what every message below is about
      // — reading `slot.notificationsMuted` again after the write would
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
          // materialiser replaces each one.
          if (saved.ok) materializeRoutines();
          return saved;
        }
      }

      // Re-read after the prompt, which on a routine's stop has been standing
      // in front of this for seconds — and a phone on the same account writes
      // to these documents.
      const current =
        findSlotById(useItineraryStore.getState().plans, slot.id)?.slot ?? slot;

      /** Puts the flag back — the one-off path's Undo, below. */
      const revert = (): void => {
        saveWithFeedback(
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
      };

      let updated: ItinerarySlot | undefined;
      return saveWithFeedback(
        () => {
          updated = updateSlot(date, current.id, {
            notificationsMuted: muted,
            ...(routine ? { routineId: undefined } : null),
            ...clearedNotificationHandles,
          });
          // The slot is not where the caller thinks it is — deleted, or already
          // re-filed. Thrown rather than reported as a success, because the
          // toast would otherwise say the alerts changed and offer to undo a
          // write that never happened.
          if (!updated) throw new Error(`No slot ${slot.id} on ${date}`);
          // "This day only" cuts the stop loose: the exception stops the next
          // top-up filling the day back in beside it, and clearing `routineId`
          // puts it out of the rule's reach for good.
          //
          // Recorded *after* the detach, and only if it happened. An exception
          // with no detach behind it is the one state nothing recovers from:
          // the day drops out of the routine's occurrences, so the next top-up
          // reads the stop as unwanted and sweeps the thing the user only meant
          // to mute.
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
          // be a third answer to a question that had two.
          successAction: routine
            ? undefined
            : { label: "Undo", onPress: revert },
        },
      );
    },
    [updateSlot, routines, updateRoutine, addException, materializeRoutines],
  );
}
