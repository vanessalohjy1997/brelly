import { act, renderHook } from "@testing-library/react";

import {
  shiftDays,
  todayKey,
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";
import { resetAppState } from "@/test/routeHarness";

import { useDeleteRoutineWithUndo } from "./useDeleteRoutineWithUndo";

const tomorrow = shiftDays(todayKey(), 1);

function at(day: string, hour: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

beforeEach(() => {
  resetAppState();
  useRoutineStore.setState({ routines: [makeRoutine()] });
  useItineraryStore.setState({
    plans: [
      makePlan(tomorrow, [
        makeSlot({
          id: "materialised",
          routineId: "routine-1",
          startTime: at(tomorrow, 7),
          endTime: at(tomorrow, 8),
        }),
      ]),
    ],
  });
});

describe("useDeleteRoutineWithUndo", () => {
  it("deletes the rule, sweeps its upcoming stops, and offers an undo", () => {
    const { result } = renderHook(() => useDeleteRoutineWithUndo());

    act(() => {
      result.current(makeRoutine());
    });

    expect(useRoutineStore.getState().routines).toHaveLength(0);
    // The sweep is what takes the days ahead off the lists.
    expect(useItineraryStore.getState().plans.flatMap((p) => p.slots)).toHaveLength(0);
    const toast = useToastStore.getState().toast;
    expect(toast?.message).toBe("Deleted Morning run and its repeats");
    expect(toast?.action?.label).toBe("Undo");
  });

  it("puts the rule and its days back when the undo is pressed", () => {
    const { result } = renderHook(() => useDeleteRoutineWithUndo());
    act(() => {
      result.current(makeRoutine());
    });

    act(() => {
      useToastStore.getState().toast?.action?.onPress();
    });

    expect(useRoutineStore.getState().routines[0]?.id).toBe("routine-1");
    // Refilled by the same pass, under the same deterministic ids.
    expect(
      useItineraryStore
        .getState()
        .plans.flatMap((p) => p.slots)
        .some((slot) => slot.routineId === "routine-1"),
    ).toBe(true);
    expect(useToastStore.getState().toast?.message).toBe(
      "Restored Morning run and its repeats",
    );
  });
});
