"use client";

import { useCallback, useEffect } from "react";

import {
  materializedSlotId,
  planRoutineMaterialization,
  RoutineHorizonDays,
  useCloudReady,
  useItineraryStore,
  useRoutineStore,
} from "@brelly/core";

import { useTabVisible } from "./useTabVisible";

/**
 * Fills in the next fortnight of every routine, and sweeps stops no rule still
 * wants.
 *
 * The web runs this, and that is a decision rather than a port. The argument
 * against is that two clients writing the same documents have no ordering field
 * to resolve them; the argument for is stronger and specific: deleting a
 * routine *is* a delete plus a sweep, so a web client that materialised nothing
 * would delete the rule and leave a fortnight of its stops standing until the
 * phone next opened. And the write is idempotent by construction —
 * `materializedSlotId` is deterministic in `(routine, date)`, so two clients
 * computing the same action produce the same document id and the second write
 * overwrites rather than duplicating.
 *
 * What the web does *not* do is schedule alerts, which is most of what the
 * phone's version of this function is. Removals therefore go through the
 * store's plain `deleteSlot` rather than `cancelAndDeleteSlot`.
 *
 * Both stores are read through `getState()` at call time rather than subscribed
 * to: the caller is always something that just changed them, and a subscribed
 * value would be the copy from before that change.
 */
export function useRoutineMaterializer(): () => void {
  return useCallback(() => {
    const { routines } = useRoutineStore.getState();
    const { plans, addSlot, deleteSlot } = useItineraryStore.getState();

    const actions = planRoutineMaterialization(
      routines,
      plans,
      new Date(),
      RoutineHorizonDays,
    );

    for (const action of actions) {
      if (action.type === "remove") {
        deleteSlot(action.date, action.slot.id);
        continue;
      }
      // `!` is safe: every "add" action's slot comes from `routineSlotForDate`,
      // which always sets `routineId`.
      addSlot(
        action.date,
        action.slot,
        materializedSlotId(action.slot.routineId!, action.date),
      );
    }
  }, []);
}

/**
 * Keeps the routine horizon topped up, on mount and on every return to the tab.
 *
 * The first pass is gated on `useCloudReady()`. Without it the cold-boot state
 * is genuinely empty rather than merely stale — there is no persisted seed — so
 * an ungated mount would read every routine's days as unfilled and rewrite them
 * on every load. The deterministic id makes that idempotent rather than
 * duplicating, but it is still a fortnight of wasted writes per visit.
 */
export function useRoutineSync(): void {
  const materialize = useRoutineMaterializer();
  const ready = useCloudReady();

  useEffect(() => {
    if (!ready) return;
    materialize();
  }, [ready, materialize]);

  useTabVisible(materialize, ready);
}
