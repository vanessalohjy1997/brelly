import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { generateDocId } from "@/services/firebase";
import { deleteSlotDoc, writeSlot, writeSlotFields } from "@/services/itinerarySync";
import { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";
import { sortSlotsByStart } from "@/utils/planSelectors";
import { create } from "zustand";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyUpdates(
  slot: ItinerarySlot,
  updates: Partial<Omit<ItinerarySlot, "id" | "neaRegion">>,
): ItinerarySlot {
  return {
    ...slot,
    ...updates,
    // Re-derive region if coordinates changed
    neaRegion:
      updates.latitude !== undefined || updates.longitude !== undefined
        ? getRegionFromCoordinates(
            updates.latitude ?? slot.latitude,
            updates.longitude ?? slot.longitude,
          )
        : slot.neaRegion,
  };
}

/** Adds a slot to its day's plan, creating that plan if it doesn't exist yet. */
function fileSlot(
  plans: DayPlan[],
  date: string,
  slot: ItinerarySlot,
): DayPlan[] {
  return plans.some((p) => p.date === date)
    ? plans.map((p) =>
        p.date === date
          ? { ...p, slots: sortSlotsByStart([...p.slots, slot]) }
          : p,
      )
    : [...plans, { id: date, date, slots: [slot] }];
}

function removeSlot(
  plans: DayPlan[],
  date: string,
  slotId: string,
): DayPlan[] {
  return (
    plans
      .map((p) =>
        p.date === date
          ? { ...p, slots: p.slots.filter((s) => s.id !== slotId) }
          : p,
      )
      // Clean up the plan entirely if it has no slots left
      .filter((p) => p.slots.length > 0)
  );
}

// ─── Store types ──────────────────────────────────────────────────────────────

// Lookups (`findSlotById`, `findPlanByDate`, …) live in `@/utils/planSelectors`
// as pure functions over `plans`, not as methods here — see the doc comment
// there for why a store method returning a fresh object can't be selected.
type ItineraryState = {
  plans: DayPlan[];

  // Plan actions
  addSlot: (
    date: string,
    slot: Omit<ItinerarySlot, "id" | "neaRegion" | "notificationId">,
    /** Overrides the minted id — the routine materialiser's deterministic
     * `r_{routineId}_{date}` ids are the only caller that needs this. */
    id?: string,
  ) => ItinerarySlot;
  /**
   * Returns the resulting slot, or `undefined` if it wasn't found (deleted,
   * or already re-filed by an earlier edit).
   *
   * Detaching a routine's stop — clearing `routineId` on a slot that had one,
   * "this day only" in the edit screen — re-keys the slot to a fresh id
   * rather than editing in place; see FIREBASE_MIGRATION.md's "IDs" section
   * for why (an exception lifted later would otherwise let the materialiser's
   * deterministic id overwrite the detached stop). The return value is what
   * lets a caller that scheduled a notification against the old id find the
   * new one.
   */
  updateSlot: (
    date: string,
    slotId: string,
    updates: Partial<Omit<ItinerarySlot, "id" | "neaRegion">>,
  ) => ItinerarySlot | undefined;
  deleteSlot: (date: string, slotId: string) => void;
  /**
   * Puts a deleted slot back exactly as it was — same id, same derived region.
   *
   * `addSlot` cannot do this: it mints a new id and re-derives `neaRegion`,
   * which would make an undo produce a *different* plan that merely looks the
   * same. The id in particular has to survive, or anything holding a reference
   * to the old one (an open `plan/[id]` route, a scheduled notification's
   * bookkeeping) points at nothing.
   */
  restoreSlot: (date: string, slot: ItinerarySlot) => ItinerarySlot;
  deletePlan: (date: string) => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

// Firestore is now the source of truth (`useCloudBootstrap` hydrates this
// store from the `users/{uid}/slots` collection's `onSnapshot`), so there is
// no `persist` middleware here any more. Every action keeps its old
// synchronous shape — `set()` first for an instant local update, then a
// fire-and-forget cloud write underneath it. See FIREBASE_MIGRATION.md's
// "keep every store action's public shape" section.
export const useItineraryStore = create<ItineraryState>()((set, get) => ({
  plans: [],

  // ── Actions ──────────────────────────────────────────────────────────────

  addSlot: (date, slotData, id) => {
    const newSlot: ItinerarySlot = {
      ...slotData,
      id: id ?? generateDocId(),
      // Derive region from coordinates at creation time — stored on the
      // slot so we never re-derive on every render or API call
      neaRegion: getRegionFromCoordinates(
        slotData.latitude,
        slotData.longitude,
      ),
    };

    set((state) => ({ plans: fileSlot(state.plans, date, newSlot) }));
    writeSlot(newSlot, date);

    return newSlot;
  },

  updateSlot: (date, slotId, updates) => {
    const current = get()
      .plans.find((p) => p.date === date)
      ?.slots.find((s) => s.id === slotId);
    // The slot isn't where the caller thinks it is — most likely it was
    // deleted, or already re-filed by an earlier edit. Nothing to update.
    if (!current) return undefined;

    // Detaching: the slot had a routine and this update explicitly clears
    // it — currently only the edit screen's "this day only" branch.
    const detaching =
      current.routineId !== undefined &&
      "routineId" in updates &&
      updates.routineId === undefined;

    const updated = applyUpdates(current, updates);
    const finalSlot = detaching ? { ...updated, id: generateDocId() } : updated;
    // A slot lives in the bucket matching its start date, so editing the
    // date has to re-file it. Updating in place instead leaves the plan
    // rendering under the day it used to be on.
    const targetDate = toDateKey(new Date(finalSlot.startTime));

    set((state) => {
      if (targetDate === date) {
        return {
          plans: state.plans.map((p) =>
            p.date === date
              ? {
                  ...p,
                  slots: sortSlotsByStart(
                    p.slots.map((s) => (s.id === slotId ? finalSlot : s)),
                  ),
                }
              : p,
          ),
        };
      }

      return {
        plans: fileSlot(
          removeSlot(state.plans, date, slotId),
          targetDate,
          finalSlot,
        ),
      };
    });

    if (detaching) {
      deleteSlotDoc(slotId);
      writeSlot(finalSlot, targetDate);
    } else {
      writeSlotFields(slotId, { ...updates, date: targetDate });
    }

    return finalSlot;
  },

  deleteSlot: (date, slotId) => {
    set((state) => ({ plans: removeSlot(state.plans, date, slotId) }));
    deleteSlotDoc(slotId);
  },

  restoreSlot: (date, slot) => {
    set((state) => ({
      // Deleting the last slot of a day removes the day too, so an undo
      // often has to recreate the plan as well as the stop — which is
      // exactly what `fileSlot` does when the date isn't there.
      plans: fileSlot(removeSlot(state.plans, date, slot.id), date, slot),
    }));
    writeSlot(slot, date);
    return slot;
  },

  // There is deliberately no `reorderSlots`. Slots are ordered by start
  // time and nothing else — see `sortSlotsByStart`.
  deletePlan: (date) => {
    const slotIds = get()
      .plans.find((p) => p.date === date)
      ?.slots.map((s) => s.id) ?? [];
    set((state) => ({
      plans: state.plans.filter((p) => p.date !== date),
    }));
    for (const id of slotIds) deleteSlotDoc(id);
  },
}));
