import type { ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { stripNotificationHandles } from "@/utils/stripNotificationHandles";

export type LocalSnapshot = {
  slots: { date: string; slot: ItinerarySlot }[];
  routines: Routine[];
};

export type ExistingAccountIds = {
  slotIds: Set<string>;
  routineIds: Set<string>;
};

export type MergeWrites = {
  slots: { date: string; slot: ItinerarySlot }[];
  routines: Routine[];
};

/**
 * Decides what to write when merging a local snapshot into an account that
 * already has its own data — FIREBASE_MIGRATION.md's "Account linking"
 * requirement 2, step 7.
 *
 * An id that already exists in the target gets a fresh one from `mintId`
 * rather than overwriting: silently destroying a plan that already lived in
 * the account would be the worst outcome of a merge that's supposed to be a
 * union. Everything else keeps its id, matching the migration's own
 * same-doc-id-overwrite argument for why re-running is safe.
 *
 * `mintId` is injected (rather than calling `generateDocId()` directly) so
 * this stays a pure, Firestore-free function — the collision-resolution
 * logic is the one part of the merge worth testing in isolation.
 */
export function resolveMergeWrites(
  local: LocalSnapshot,
  existing: ExistingAccountIds,
  mintId: () => string,
): MergeWrites {
  const slots = local.slots.map(({ date, slot }) => ({
    date,
    slot: stripNotificationHandles(
      existing.slotIds.has(slot.id) ? { ...slot, id: mintId() } : slot,
    ),
  }));

  const routines = local.routines.map((routine) =>
    existing.routineIds.has(routine.id)
      ? { ...routine, id: mintId() }
      : routine,
  );

  return { slots, routines };
}
