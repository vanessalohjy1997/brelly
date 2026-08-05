import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { mmkvStorage } from "@/store/mmkvStorage";
import { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";
import { sortSlotsByStart } from "@/utils/planSelectors";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

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
    : [...plans, { id: generateId(), date, slots: [slot] }];
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
  ) => ItinerarySlot;
  updateSlot: (
    date: string,
    slotId: string,
    updates: Partial<Omit<ItinerarySlot, "id" | "neaRegion">>,
  ) => void;
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

export const useItineraryStore = create<ItineraryState>()(
  persist(
    (set) => ({
      plans: [],

      // ── Actions ──────────────────────────────────────────────────────────────

      addSlot: (date, slotData) => {
        const newSlot: ItinerarySlot = {
          ...slotData,
          id: generateId(),
          // Derive region from coordinates at creation time — stored on the
          // slot so we never re-derive on every render or API call
          neaRegion: getRegionFromCoordinates(
            slotData.latitude,
            slotData.longitude,
          ),
        };

        set((state) => ({ plans: fileSlot(state.plans, date, newSlot) }));

        return newSlot;
      },

      updateSlot: (date, slotId, updates) => {
        set((state) => {
          const current = state.plans
            .find((p) => p.date === date)
            ?.slots.find((s) => s.id === slotId);
          // The slot isn't where the caller thinks it is — most likely it was
          // deleted, or already re-filed by an earlier edit. Nothing to update.
          if (!current) return state;

          const updated = applyUpdates(current, updates);
          // A slot lives in the bucket matching its start date, so editing the
          // date has to re-file it. Updating in place instead leaves the plan
          // rendering under the day it used to be on.
          const targetDate = toDateKey(new Date(updated.startTime));

          if (targetDate === date) {
            return {
              plans: state.plans.map((p) =>
                p.date === date
                  ? {
                      ...p,
                      slots: sortSlotsByStart(
                        p.slots.map((s) => (s.id === slotId ? updated : s)),
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
              updated,
            ),
          };
        });
      },

      deleteSlot: (date, slotId) => {
        set((state) => ({ plans: removeSlot(state.plans, date, slotId) }));
      },

      restoreSlot: (date, slot) => {
        set((state) => ({
          // Deleting the last slot of a day removes the day too, so an undo
          // often has to recreate the plan as well as the stop — which is
          // exactly what `fileSlot` does when the date isn't there.
          plans: fileSlot(
            removeSlot(state.plans, date, slot.id),
            date,
            slot,
          ),
        }));
        return slot;
      },

      // There is deliberately no `reorderSlots`. Slots are ordered by start
      // time and nothing else — see `sortSlotsByStart`.
      deletePlan: (date) => {
        set((state) => ({
          plans: state.plans.filter((p) => p.date !== date),
        }));
      },
    }),
    {
      name: "brelly-itinerary",
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return persisted as ItineraryState;
        return persisted as ItineraryState;
      },
    },
  ),
);
