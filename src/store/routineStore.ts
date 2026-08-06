import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { mmkvStorage } from "@/store/mmkvStorage";
import type { Routine } from "@/types/routine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Store types ──────────────────────────────────────────────────────────────

// Lookups live in `@/utils/routineSelectors` as pure functions over `routines`,
// for the same reason the itinerary store keeps them out — see the doc comment
// on `@/utils/planSelectors`.
type RoutineState = {
  routines: Routine[];

  addRoutine: (routine: Omit<Routine, "id" | "exceptions">) => Routine;
  /**
   * Puts a routine back exactly as it was — same id, same exceptions.
   *
   * `addRoutine` cannot do this, and the difference is not cosmetic. It mints a
   * fresh id, but every stop the routine already produced carries the *old*
   * `routineId`, so a new one orphans them: `planRoutineMaterialization` reads
   * a slot whose rule it can't find as unwanted and sweeps every upcoming one.
   * And it resets `exceptions` to empty, which is the record of the days the
   * user deliberately deleted — losing it refills them on the next top-up,
   * the "undo the user never asked for" that `Routine.exceptions` exists to
   * prevent.
   *
   * Replaces any routine already holding this id, so importing the same backup
   * twice restores rather than duplicates.
   */
  restoreRoutine: (routine: Routine) => Routine;
  updateRoutine: (
    id: string,
    updates: Partial<Omit<Routine, "id" | "exceptions">>,
  ) => void;
  deleteRoutine: (id: string) => void;
  /** Marks a day this routine must never fill in — see `Routine.exceptions`. */
  addException: (id: string, date: string) => void;
  /** The undo path for `addException`. */
  removeException: (id: string, date: string) => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRoutineStore = create<RoutineState>()(
  persist(
    (set) => ({
      routines: [],

      addRoutine: (routineData) => {
        const routine: Routine = {
          ...routineData,
          id: generateId(),
          exceptions: [],
        };
        set((state) => ({ routines: [...state.routines, routine] }));
        return routine;
      },

      restoreRoutine: (routine) => {
        set((state) => ({
          routines: [
            ...state.routines.filter((r) => r.id !== routine.id),
            routine,
          ],
        }));
        return routine;
      },

      updateRoutine: (id, updates) => {
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        }));
      },

      deleteRoutine: (id) => {
        set((state) => ({
          routines: state.routines.filter((r) => r.id !== id),
        }));
      },

      addException: (id, date) => {
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id && !r.exceptions.includes(date)
              ? { ...r, exceptions: [...r.exceptions, date] }
              : r,
          ),
        }));
      },

      removeException: (id, date) => {
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id
              ? { ...r, exceptions: r.exceptions.filter((d) => d !== date) }
              : r,
          ),
        }));
      },
    }),
    {
      name: "brelly-routines",
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return persisted as RoutineState;
        return persisted as RoutineState;
      },
    },
  ),
);
