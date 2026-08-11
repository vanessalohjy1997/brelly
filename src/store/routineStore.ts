import { create } from "zustand";

import { generateDocId } from "@/services/firebase";
import {
  addExceptionField,
  deleteRoutineDoc,
  removeExceptionField,
  writeRoutine,
  writeRoutineFields,
} from "@/services/routinesSync";
import type { Routine } from "@/types/routine";

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

// Firestore is now the source of truth (`useCloudBootstrap` hydrates this
// store from the `users/{uid}/routines` collection's `onSnapshot`), so there
// is no `persist` middleware here any more. Every action keeps its old
// synchronous shape — `set()` first for an instant local update, then a
// fire-and-forget cloud write underneath it. See FIREBASE_MIGRATION.md's
// "keep every store action's public shape" section.
export const useRoutineStore = create<RoutineState>()((set, get) => ({
  routines: [],

  addRoutine: (routineData) => {
    const routine: Routine = {
      ...routineData,
      id: generateDocId(),
      exceptions: [],
    };
    set((state) => ({ routines: [...state.routines, routine] }));
    writeRoutine(routine);
    return routine;
  },

  restoreRoutine: (routine) => {
    set((state) => ({
      routines: [
        ...state.routines.filter((r) => r.id !== routine.id),
        routine,
      ],
    }));
    writeRoutine(routine);
    return routine;
  },

  updateRoutine: (id, updates) => {
    if (!get().routines.some((r) => r.id === id)) return;
    set((state) => ({
      routines: state.routines.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
    writeRoutineFields(id, updates);
  },

  deleteRoutine: (id) => {
    set((state) => ({
      routines: state.routines.filter((r) => r.id !== id),
    }));
    deleteRoutineDoc(id);
  },

  addException: (id, date) => {
    const routine = get().routines.find((r) => r.id === id);
    if (!routine || routine.exceptions.includes(date)) return;
    set((state) => ({
      routines: state.routines.map((r) =>
        r.id === id ? { ...r, exceptions: [...r.exceptions, date] } : r,
      ),
    }));
    addExceptionField(id, date);
  },

  removeException: (id, date) => {
    const routine = get().routines.find((r) => r.id === id);
    if (!routine || !routine.exceptions.includes(date)) return;
    set((state) => ({
      routines: state.routines.map((r) =>
        r.id === id
          ? { ...r, exceptions: r.exceptions.filter((d) => d !== date) }
          : r,
      ),
    }));
    removeExceptionField(id, date);
  },
}));
