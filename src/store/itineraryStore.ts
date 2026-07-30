import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── MMKV storage adapter for Zustand persist ─────────────────────────────────
// Zustand's persist middleware expects a localStorage-like interface.
// MMKV doesn't match that interface out of the box, so we adapt it.

const mmkv = createMMKV({ id: "brelly-storage" });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Store types ──────────────────────────────────────────────────────────────

type ItineraryState = {
  plans: DayPlan[];

  // Selectors
  getTodaysPlan: () => DayPlan | undefined;
  getPlanByDate: (date: string) => DayPlan | undefined;
  findSlotById: (
    slotId: string,
  ) => { date: string; slot: ItinerarySlot } | undefined;

  // Plan actions
  addSlot: (
    date: string,
    slot: Omit<ItinerarySlot, "id" | "neaRegion">,
  ) => void;
  updateSlot: (
    date: string,
    slotId: string,
    updates: Partial<Omit<ItinerarySlot, "id" | "neaRegion">>,
  ) => void;
  deleteSlot: (date: string, slotId: string) => void;
  reorderSlots: (date: string, slots: ItinerarySlot[]) => void;
  deletePlan: (date: string) => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useItineraryStore = create<ItineraryState>()(
  persist(
    (set, get) => ({
      plans: [],

      // ── Selectors ────────────────────────────────────────────────────────────

      getTodaysPlan: () => {
        return get().plans.find((p) => p.date === todayDateString());
      },

      getPlanByDate: (date) => {
        return get().plans.find((p) => p.date === date);
      },

      findSlotById: (slotId) => {
        for (const plan of get().plans) {
          const slot = plan.slots.find((s) => s.id === slotId);
          if (slot) return { date: plan.date, slot };
        }
        return undefined;
      },

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

        set((state) => {
          const existingPlan = state.plans.find((p) => p.date === date);

          if (existingPlan) {
            // Add slot to existing plan, sorted by start time
            return {
              plans: state.plans.map((p) =>
                p.date === date
                  ? {
                      ...p,
                      slots: [...p.slots, newSlot].sort(
                        (a, b) =>
                          new Date(a.startTime).getTime() -
                          new Date(b.startTime).getTime(),
                      ),
                    }
                  : p,
              ),
            };
          }

          // No plan for this date yet — create one
          return {
            plans: [
              ...state.plans,
              { id: generateId(), date, slots: [newSlot] },
            ],
          };
        });
      },

      updateSlot: (date, slotId, updates) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.date === date
              ? {
                  ...p,
                  slots: p.slots
                    .map((s) =>
                      s.id === slotId
                        ? {
                            ...s,
                            ...updates,
                            // Re-derive region if coordinates changed
                            neaRegion:
                              updates.latitude !== undefined ||
                              updates.longitude !== undefined
                                ? getRegionFromCoordinates(
                                    updates.latitude ?? s.latitude,
                                    updates.longitude ?? s.longitude,
                                  )
                                : s.neaRegion,
                          }
                        : s,
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.startTime).getTime() -
                        new Date(b.startTime).getTime(),
                    ),
                }
              : p,
          ),
        }));
      },

      deleteSlot: (date, slotId) => {
        set((state) => ({
          plans: state.plans
            .map((p) =>
              p.date === date
                ? { ...p, slots: p.slots.filter((s) => s.id !== slotId) }
                : p,
            )
            // Clean up the plan entirely if it has no slots left
            .filter((p) => p.slots.length > 0),
        }));
      },

      reorderSlots: (date, slots) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.date === date ? { ...p, slots } : p,
          ),
        }));
      },

      deletePlan: (date) => {
        set((state) => ({
          plans: state.plans.filter((p) => p.date !== date),
        }));
      },
    }),
    {
      name: "brelly-itinerary",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
