import type { Routine } from "@/types/routine";

/**
 * Pure lookups over the routines array.
 *
 * Not store methods, for the reason spelled out on `@/utils/planSelectors`: a
 * selector that builds a fresh object re-runs forever, and one that selects a
 * store function never re-runs at all. Select `state.routines` and call these
 * against it.
 */
export function findRoutineById(
  routines: Routine[],
  id: string,
): Routine | undefined {
  return routines.find((routine) => routine.id === id);
}

/** The routine a slot came from, if it still exists. */
export function routineForSlot(
  routines: Routine[],
  routineId: string | undefined,
): Routine | undefined {
  return routineId ? findRoutineById(routines, routineId) : undefined;
}
