import { renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import {
  useRoutineMaterializer,
  useRoutineSync,
} from "@/hooks/useRoutineMaterializer";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { Routine } from "@/types/routine";
import { RoutineHorizonDays } from "@/utils/routineOccurrences";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
}));

jest.mock("@/services/notifications", () => ({
  ...jest.requireActual("@/services/notifications"),
  scheduleRainNotification: jest.fn().mockResolvedValue(null),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

/** 3 Aug 2026 is a Monday, so a Mon–Fri routine starts that day. */
const MONDAY = "2026-08-03";

const OFFICE: Omit<Routine, "id" | "exceptions"> = {
  label: "Office",
  location: "Raffles Place, Singapore",
  latitude: 1.2843,
  longitude: 103.8514,
  weekdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  startDate: MONDAY,
};

/** Drives the AppState listener the sync hook registers. */
function foreground() {
  const addEventListener = AppState.addEventListener as unknown as jest.Mock;
  addEventListener.mock.calls.at(-1)?.[1]?.("active");
}

function slotCount() {
  return useItineraryStore
    .getState()
    .plans.reduce((total, plan) => total + plan.slots.length, 0);
}

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useSettingsStore.setState({
    rainAlertsEnabled: false, // keeps the fire-and-forget fetch out of the way
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
    rainLeadMinutes: 45,
  });
  // Mid-morning on the Monday, so the day's 09:00–18:00 stop is still ahead.
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 3, 10, 0));
  jest.spyOn(AppState, "addEventListener").mockReturnValue({
    remove: jest.fn(),
  } as unknown as ReturnType<typeof AppState.addEventListener>);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useRoutineMaterializer", () => {
  it("fills in the horizon for a routine that has none of its days yet", async () => {
    useRoutineStore.getState().addRoutine(OFFICE);
    const { result } = await renderHook(() => useRoutineMaterializer());

    result.current();

    // Two working weeks plus the Monday that closes the fortnight.
    expect(slotCount()).toBe(11);
    expect(RoutineHorizonDays).toBe(14);
  });

  it("stamps every stop with the routine that made it", async () => {
    const routine = useRoutineStore.getState().addRoutine(OFFICE);
    const { result } = await renderHook(() => useRoutineMaterializer());

    result.current();

    const slots = useItineraryStore.getState().plans.flatMap((p) => p.slots);
    expect(slots.every((slot) => slot.routineId === routine.id)).toBe(true);
  });

  it("does not fill the same day in twice", async () => {
    useRoutineStore.getState().addRoutine(OFFICE);
    const { result } = await renderHook(() => useRoutineMaterializer());

    result.current();
    const first = slotCount();
    result.current();

    expect(slotCount()).toBe(first);
  });

  it("skips a day the user deleted", async () => {
    const routine = useRoutineStore.getState().addRoutine(OFFICE);
    useRoutineStore.getState().addException(routine.id, "2026-08-05");
    const { result } = await renderHook(() => useRoutineMaterializer());

    result.current();

    expect(
      useItineraryStore.getState().plans.map((plan) => plan.date),
    ).not.toContain("2026-08-05");
  });

  it("sweeps future stops once the routine is deleted", async () => {
    const routine = useRoutineStore.getState().addRoutine(OFFICE);
    const { result } = await renderHook(() => useRoutineMaterializer());
    result.current();

    useRoutineStore.getState().deleteRoutine(routine.id);
    result.current();

    expect(slotCount()).toBe(0);
  });

  it("leaves a stop the user hand-made alone", async () => {
    useItineraryStore.getState().addSlot("2026-08-04", {
      label: "Lunch",
      location: "Tiong Bahru",
      latitude: 1.2847,
      longitude: 103.8318,
      startTime: new Date(2026, 7, 4, 12, 0).toISOString(),
      endTime: new Date(2026, 7, 4, 13, 0).toISOString(),
    });
    const { result } = await renderHook(() => useRoutineMaterializer());

    result.current();

    expect(
      useItineraryStore
        .getState()
        .plans.flatMap((p) => p.slots)
        .some((slot) => slot.label === "Lunch"),
    ).toBe(true);
  });

  it("reads the routine added a moment ago, not the render before it", async () => {
    // The add screen calls this immediately after `addRoutine`, so a
    // subscribed copy of the store would be one render out of date.
    const { result } = await renderHook(() => useRoutineMaterializer());

    useRoutineStore.getState().addRoutine(OFFICE);
    result.current();

    expect(slotCount()).toBeGreaterThan(0);
  });
});

describe("useRoutineSync", () => {
  it("tops up on mount", async () => {
    useRoutineStore.getState().addRoutine(OFFICE);

    await renderHook(() => useRoutineSync());

    await waitFor(() => expect(slotCount()).toBeGreaterThan(0));
  });

  it("tops up again on returning to the foreground", async () => {
    await renderHook(() => useRoutineSync());
    expect(slotCount()).toBe(0);

    useRoutineStore.getState().addRoutine(OFFICE);
    foreground();

    await waitFor(() => expect(slotCount()).toBeGreaterThan(0));
  });
});
