import { renderHook } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { Alert } from "react-native";

import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import type { ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { materializedSlotId } from "@/utils/routineOccurrences";

jest.mock("@/services/forecastProvider", () => ({
  getForecastForSlotByProvider: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
}));
jest.mock("@/services/notifications", () => ({
  ...jest.requireActual("@/services/notifications"),
  scheduleRainNotification: jest.fn().mockResolvedValue(null),
}));

// Asserted at the end of the chain rather than on a mocked
// `cancelNotification`: the delete goes through the *real*
// `cancelAndDeleteSlot`, which calls its own module-internal reference, so a
// module mock would never see it — and this is the call that actually matters.
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

/** 17 Aug 2026 is a Monday — the day every fixture below falls on. */
const DATE = "2026-08-17";

const ROUTINE: Routine = {
  id: "r1",
  label: "Office",
  location: "Raffles Place, Singapore",
  latitude: 1.2843,
  longitude: 103.8514,
  weekdays: [1],
  startTime: "15:00",
  endTime: "16:00",
  startDate: DATE,
  exceptions: [],
};

function routineSlot(): ItinerarySlot {
  return {
    id: materializedSlotId(ROUTINE.id, DATE),
    label: "Office",
    location: "Raffles Place, Singapore",
    neaRegion: "central",
    latitude: 1.2843,
    longitude: 103.8514,
    startTime: new Date(2026, 7, 17, 15, 0).toISOString(),
    endTime: new Date(2026, 7, 17, 16, 0).toISOString(),
    routineId: ROUTINE.id,
  };
}

function storedSlots(): ItinerarySlot[] {
  return useItineraryStore.getState().plans.flatMap((plan) => plan.slots);
}

function seed(...slots: ItinerarySlot[]) {
  useItineraryStore.setState({ plans: [{ id: DATE, date: DATE, slots }] });
}

/** Answers the scope prompt as it is raised — the hook awaits it. */
function answerScopePromptWith(text: string) {
  (Alert.alert as unknown as jest.Mock).mockImplementation(
    (
      _title: string,
      _message: string,
      buttons: { text: string; onPress?: () => void }[] = [],
    ) => {
      buttons.find((button) => button.text === text)?.onPress?.();
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [ROUTINE] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useSettingsStore.setState({
    rainAlertsEnabled: false,
    rainLeadMinutes: 45,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  });
  // Mid-morning on the Monday, so the day's 15:00 stop is still ahead of the
  // materialiser and inside the horizon it fills.
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 17, 10, 0));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useDeleteSlotWithUndo", () => {
  it("cancels the alert the store has now, not the one the swipe remembered", async () => {
    // The prompt stands for seconds, and `runNotificationSync` stamps an id on
    // after its own awaited forecast fetch. Once the stop is deleted there is
    // no route back to that alert — everything that cancels one finds it
    // through `slot.notificationId`.
    const slot = routineSlot();
    seed(slot);
    (Alert.alert as unknown as jest.Mock).mockImplementation(
      (
        _title: string,
        _message: string,
        buttons: { text: string; onPress?: () => void }[] = [],
      ) => {
        useItineraryStore.getState().updateSlot(DATE, slot.id, {
          notificationId: "notif-late",
          notificationLeadMinutes: 45,
        });
        buttons.find((button) => button.text === "Delete this day")?.onPress?.();
      },
    );
    const { result } = await renderHook(() => useDeleteSlotWithUndo());

    expect(slot.notificationId).toBeUndefined();
    await result.current(DATE, slot);

    expect(mockCancel).toHaveBeenCalledWith("notif-late");
    expect(storedSlots()).toHaveLength(0);
  });

  it("asks nothing about a stop whose rule has already been deleted", async () => {
    // `routineId` outlives the rule. There is no series to offer, and the
    // materialiser sweeps the stop regardless.
    useRoutineStore.setState({ routines: [] });
    seed(routineSlot());
    const { result } = await renderHook(() => useDeleteSlotWithUndo());

    await result.current(DATE, routineSlot());

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(storedSlots()).toHaveLength(0);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Office",
      action: { label: "Undo" },
    });
  });

  it("asks nothing about a stop that has already ended", async () => {
    // The archive is a record of what happened. Rule 1 of the materialiser
    // never touches a day before today, so there is no top-up that could put
    // this back and no series reading to choose between — and asking would
    // offer to destroy a live rule from inside History.
    const ended = {
      ...routineSlot(),
      startTime: new Date(2026, 7, 17, 8, 0).toISOString(),
      endTime: new Date(2026, 7, 17, 9, 0).toISOString(),
    };
    seed(ended);
    const { result } = await renderHook(() => useDeleteSlotWithUndo());

    await result.current(DATE, ended);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(storedSlots()).toHaveLength(0);
    expect(useRoutineStore.getState().routines).toHaveLength(1);
  });

  describe("deleting the whole routine", () => {
    it("takes the rule and its upcoming days, and says so", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useDeleteSlotWithUndo());
      answerScopePromptWith("Delete all future days");

      await result.current(DATE, routineSlot());

      expect(useRoutineStore.getState().routines).toHaveLength(0);
      expect(storedSlots()).toHaveLength(0);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Deleted Office and its repeats",
      });
    });

    it("offers the routine back — a swipe and one mis-tap is not a decision", async () => {
      // The prompt is reachable from a list now, not just the edit form, so
      // this branch has to be as undoable as every other delete.
      seed(routineSlot());
      const { result } = await renderHook(() => useDeleteSlotWithUndo());
      answerScopePromptWith("Delete all future days");

      await result.current(DATE, routineSlot());
      useToastStore.getState().toast?.action?.onPress();

      const restored = useRoutineStore.getState().routines;
      expect(restored).toHaveLength(1);
      // The same id, or every stop it ever made is orphaned.
      expect(restored[0].id).toBe(ROUTINE.id);
      // And the days come back with it, under their deterministic ids.
      expect(storedSlots().map((slot) => slot.id)).toContain(
        materializedSlotId(ROUTINE.id, DATE),
      );
    });

    it("keeps the days the user had already deleted, deleted", async () => {
      // `exceptions` is the record of deliberate deletions; an undo that reset
      // it would refill days nobody asked to see again.
      const nextMonday = "2026-08-24";
      useRoutineStore.setState({
        routines: [{ ...ROUTINE, exceptions: [nextMonday] }],
      });
      seed(routineSlot());
      const { result } = await renderHook(() => useDeleteSlotWithUndo());
      answerScopePromptWith("Delete all future days");

      await result.current(DATE, routineSlot());
      useToastStore.getState().toast?.action?.onPress();

      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([
        nextMonday,
      ]);
      expect(
        useItineraryStore.getState().plans.map((plan) => plan.date),
      ).not.toContain(nextMonday);
    });
  });
});
