import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { cancelAndDeleteSlot } from "@/services/notifications";
import { useCloudReady } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { planRoutineMaterialization } from "@/utils/planRoutineMaterialization";
import {
  materializedSlotId,
  RoutineHorizonDays,
} from "@/utils/routineOccurrences";

/**
 * Fills in the next fortnight of every routine, and sweeps stops that no rule
 * still wants.
 *
 * Both stores are read through `getState()` at call time rather than
 * subscribed to. The caller is always something that just changed them — a
 * routine was added, a rule was edited, the app came back to the foreground —
 * and a subscribed value would be the copy from before that change.
 *
 * Adds go through `addSlot` and are scheduled like any other stop; removes go
 * through `cancelAndDeleteSlot` so a swept stop never leaves a notification
 * pending for a plan that no longer exists.
 */
export function useRoutineMaterializer(): () => void {
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();

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
        cancelAndDeleteSlot(deleteSlot, action.date, action.slot);
        continue;
      }
      // Deterministic id: every materialiser run — this device or another
      // one sharing the uid — computes the same id for the same
      // (routine, date), so a second write is an idempotent overwrite
      // rather than a duplicate. `!` is safe: every "add" action's slot
      // comes from `routineSlotForDate`, which always sets `routineId`.
      const id = materializedSlotId(action.slot.routineId!, action.date);
      const slot = addSlot(action.date, action.slot, id);
      // Fire-and-forget, like every other scheduling call in the app.
      scheduleRainNotificationForSlot(action.date, slot);
    }
  }, [scheduleRainNotificationForSlot]);
}

/**
 * Keeps the routine horizon topped up, on mount and on every return to the
 * foreground.
 *
 * Mounted once, at the root, and structured like `useNotificationSync`: the
 * AppState subscription is registered with a stable dependency list and reads
 * the callback through a ref, so an ordinary store write doesn't tear the
 * listener down and re-run a whole materialisation pass.
 *
 * The first pass is gated on `useCloudReady()`. Without a persisted seed the
 * cold-boot state is genuinely empty until the first snapshot lands, not
 * merely stale — an ungated mount effect would read every routine's days as
 * unfilled and re-materialise them on every launch. The deterministic id in
 * `useRoutineMaterializer` above makes that idempotent rather than
 * duplicating, but it's still wasted writes; this is the actual primary fix.
 * Foreground passes after the first are already fine, since by then the
 * store reflects real state.
 */
export function useRoutineSync(): void {
  const materialize = useRoutineMaterializer();
  const latest = useRef(materialize);
  const ready = useCloudReady();

  useEffect(() => {
    latest.current = materialize;
  }, [materialize]);

  useEffect(() => {
    if (!ready) return;

    latest.current();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") latest.current();
    });

    return () => subscription.remove();
  }, [ready]);
}
