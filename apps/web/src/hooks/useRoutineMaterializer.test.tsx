import { renderHook } from "@testing-library/react";

import {
  materializedSlotId,
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
} from "@brelly/core";

import { makeRoutine } from "@/test/fixtures";

import {
  useRoutineMaterializer,
  useRoutineSync,
} from "./useRoutineMaterializer";

const routine = makeRoutine();

function ready() {
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
}

beforeEach(() => {
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
  });
});

describe("useRoutineMaterializer", () => {
  it("fills the horizon with the routine's own days", () => {
    useRoutineStore.setState({ routines: [routine] });

    renderHook(() => useRoutineMaterializer()).result.current();

    const plans = useItineraryStore.getState().plans;
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.slots[0].routineId).toBe("routine-1");
    }
  });

  it("mints the same id a phone would, so a second run overwrites", () => {
    // This is what makes the web running the materialiser safe at all:
    // `materializedSlotId` is deterministic in (routine, date), so two clients
    // computing the same action produce the same document id.
    useRoutineStore.setState({ routines: [routine] });
    const materialize = renderHook(() => useRoutineMaterializer()).result.current;

    materialize();
    const first = useItineraryStore.getState().plans;
    materialize();
    const second = useItineraryStore.getState().plans;

    expect(second.map((p) => p.slots.map((s) => s.id))).toEqual(
      first.map((p) => p.slots.map((s) => s.id)),
    );
    expect(first[0].slots[0].id).toBe(
      materializedSlotId("routine-1", first[0].date),
    );
  });

  it("sweeps the stops of a rule that is gone", () => {
    // The reason the web materialises at all: deleting a routine *is* a delete
    // plus a sweep, and a client that skipped the sweep would leave a fortnight
    // of its stops standing until the phone next opened.
    useRoutineStore.setState({ routines: [routine] });
    const materialize = renderHook(() => useRoutineMaterializer()).result.current;
    materialize();
    expect(useItineraryStore.getState().plans.length).toBeGreaterThan(0);

    useRoutineStore.setState({ routines: [] });
    materialize();

    expect(useItineraryStore.getState().plans).toEqual([]);
  });
});

describe("useRoutineSync", () => {
  it("waits for the first snapshot before deciding a day is unfilled", () => {
    // Without a persisted seed the cold-boot state is genuinely empty rather
    // than merely stale, so an ungated pass would rewrite every routine's
    // fortnight on every visit.
    useRoutineStore.setState({ routines: [routine] });

    renderHook(() => useRoutineSync());

    expect(useItineraryStore.getState().plans).toEqual([]);
  });

  it("tops the horizon up once the stores have landed", () => {
    useRoutineStore.setState({ routines: [routine] });
    ready();

    renderHook(() => useRoutineSync());

    expect(useItineraryStore.getState().plans.length).toBeGreaterThan(0);
  });
});
