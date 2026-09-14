import { renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useMuteSlotWithUndo } from "@/hooks/useMuteSlotWithUndo";
import {
  getForecastForSlotByProvider,
  materializedSlotId,
  useItineraryStore,
  useRoutineStore,
  useSettingsStore,
  useToastStore,
  type ItinerarySlot,
  type Routine,
} from "@brelly/core";
import {
  cancelNotification,
  scheduleRainNotification,
} from "@/services/notifications";

jest.mock("@brelly/core/services/forecastProvider", () => ({
  getForecastForSlotByProvider: jest.fn(),
}));
jest.mock("@/services/notifications", () => ({
  ...jest.requireActual("@/services/notifications"),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  scheduleRainNotification: jest.fn(),
}));

const mockForecast = getForecastForSlotByProvider as jest.Mock;
const mockCancel = cancelNotification as jest.Mock;
const mockSchedule = scheduleRainNotification as jest.Mock;

/** 17 Aug 2026 is a Monday, which is the day every fixture below falls on. */
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

function makeSlot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "slot-1",
    label: "Lunch",
    location: "Tanjong Pagar, Singapore",
    neaRegion: "central",
    latitude: 1.2766,
    longitude: 103.8456,
    startTime: new Date(2026, 7, 17, 15, 0).toISOString(),
    endTime: new Date(2026, 7, 17, 16, 0).toISOString(),
    ...overrides,
  };
}

/** The slot as it is in the store now — the hook re-keys it on a detach. */
function storedSlots(): ItinerarySlot[] {
  return useItineraryStore.getState().plans.flatMap((plan) => plan.slots);
}

function seed(...slots: ItinerarySlot[]) {
  useItineraryStore.setState({
    plans: [{ id: DATE, date: DATE, slots }],
  });
}

/**
 * Answers the scope prompt the moment it is raised.
 *
 * The hook *awaits* that answer, so the alternative — call, then reach into
 * the mock and press a button — leaves the call pending at the point the test
 * asserts. Same trick as `editSlotScreen.test.tsx`.
 */
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

/** The buttons the last prompt offered. */
function scopePromptButtons(): { text: string }[] {
  return (Alert.alert as unknown as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockForecast.mockResolvedValue({
    forecast: "Thundery Showers",
    source: "24hr",
  });
  mockSchedule.mockResolvedValue("notif-new");
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useSettingsStore.setState({
    // Off by default so the fire-and-forget forecast fetch stays out of the
    // way; the tests that are *about* re-scheduling turn it on.
    rainAlertsEnabled: false,
    rainLeadMinutes: 45,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  });
  // Mid-morning on the Monday, so the day's 15:00 stop is still ahead of the
  // materialiser (rule 2 leaves a stop that has already ended alone).
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 17, 10, 0));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useMuteSlotWithUndo", () => {
  describe("a one-off stop", () => {
    it("mutes it, and names the stop that went quiet", async () => {
      seed(makeSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, makeSlot());

      expect(storedSlots()[0].notificationsMuted).toBe(true);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts off for Lunch",
        variant: "success",
      });
    });

    it("asks nothing — there is no series to confuse one day with", async () => {
      seed(makeSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, makeSlot());

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("cancels the alert it had, and forgets the handle", async () => {
      // The id left behind would read as "already scheduled" forever —
      // `planNotificationResync` takes `!!notificationId` at its word.
      const slot = makeSlot({
        notificationId: "notif-1",
        notificationLeadMinutes: 45,
      });
      seed(slot);
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, slot);

      expect(mockCancel).toHaveBeenCalledWith("notif-1");
      expect(storedSlots()[0].notificationId).toBeUndefined();
      expect(storedSlots()[0].notificationLeadMinutes).toBeUndefined();
    });

    it("schedules a fresh alert off the current forecast when unmuted", async () => {
      // Not the forecast the old alert was scheduled against, which by now
      // may be hours old.
      useSettingsStore.setState({ rainAlertsEnabled: true });
      const slot = makeSlot({ notificationsMuted: true });
      seed(slot);
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, slot);

      expect(storedSlots()[0].notificationsMuted).toBe(false);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts on for Lunch",
      });
      await waitFor(() => expect(mockForecast).toHaveBeenCalled());
      await waitFor(() => expect(mockSchedule).toHaveBeenCalled());
    });

    it("mutes even when cancelling the old alert fails", async () => {
      // A cancel that rejects is best-effort: the mute is already on screen and
      // in the store, and the foreground resync will clear the stray. What it
      // must not do is reject out of the seam as an unhandled rejection.
      mockCancel.mockRejectedValueOnce(new Error("no such notification"));
      const slot = makeSlot({ notificationId: "notif-1" });
      seed(slot);
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      const outcome = await result.current(DATE, slot);

      expect(outcome?.ok).toBe(true);
      expect(storedSlots()[0].notificationsMuted).toBe(true);
    });

    it("offers the mute back for as long as the toast is up", async () => {
      seed(makeSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, makeSlot());
      useToastStore.getState().toast?.action?.onPress();

      expect(storedSlots()[0].notificationsMuted).toBe(false);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts on for Lunch",
      });
    });

    it("re-schedules the alert when a mute is undone", async () => {
      useSettingsStore.setState({ rainAlertsEnabled: true });
      seed(makeSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, makeSlot());
      useToastStore.getState().toast?.action?.onPress();

      await waitFor(() => expect(mockSchedule).toHaveBeenCalled());
    });

    it("cancels the alert an unmute scheduled when that unmute is undone", async () => {
      // The scheduler is fire-and-forget, so by the time Undo is pressed the
      // id is on the slot in the store rather than on the copy the toast's
      // handler closed over.
      useSettingsStore.setState({ rainAlertsEnabled: true });
      const slot = makeSlot({ notificationsMuted: true });
      seed(slot);
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      await result.current(DATE, slot);
      await waitFor(() =>
        expect(storedSlots()[0].notificationId).toBe("notif-new"),
      );
      useToastStore.getState().toast?.action?.onPress();

      expect(mockCancel).toHaveBeenCalledWith("notif-new");
      expect(storedSlots()[0].notificationsMuted).toBe(true);
      expect(storedSlots()[0].notificationId).toBeUndefined();
    });
  });

  describe("a routine's stop", () => {
    const routineSlot = () =>
      makeSlot({
        id: materializedSlotId(ROUTINE.id, DATE),
        label: "Office",
        routineId: ROUTINE.id,
      });

    beforeEach(() => {
      useRoutineStore.setState({ routines: [ROUTINE] });
    });

    it("asks whether one day or the whole rule is meant", async () => {
      // A routine's slot can't take a silent per-day flag: rule 4 of
      // `planRoutineMaterialization` would replace it at the next top-up.
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Cancel");

      await result.current(DATE, routineSlot());

      expect(Alert.alert).toHaveBeenCalled();
      expect(scopePromptButtons().map((button) => button.text)).toEqual([
        "Cancel",
        "Mute this day",
        "Mute all future days",
      ]);
    });

    it("words the question for the direction it is going", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Cancel");

      await result.current(
        DATE,
        { ...routineSlot(), notificationsMuted: true },
      );

      expect(scopePromptButtons().map((button) => button.text)).toEqual([
        "Cancel",
        "Unmute this day",
        "Unmute all future days",
      ]);
    });

    it("commits nothing when the question goes unanswered", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Cancel");

      const outcome = await result.current(DATE, routineSlot());

      expect(outcome).toBeNull();
      expect(storedSlots()[0].notificationsMuted).toBeUndefined();
      expect(useToastStore.getState().toast).toBeNull();
    });

    it("cuts the day loose when only that day is meant", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Mute this day");

      await result.current(DATE, routineSlot());

      const stored = storedSlots()[0];
      expect(stored.notificationsMuted).toBe(true);
      // Detached, and re-keyed off the deterministic routine id — otherwise a
      // later top-up would overwrite the stop that was deliberately kept.
      expect(stored.routineId).toBeUndefined();
      expect(stored.id).not.toBe(materializedSlotId(ROUTINE.id, DATE));
      // And the day is marked, so the top-up can't fill it back in beside it.
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([DATE]);
    });

    it("offers no undo on a detached day — the question was the safety net", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Mute this day");

      await result.current(DATE, routineSlot());

      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts off for Office",
      });
      expect(useToastStore.getState().toast?.action).toBeUndefined();
    });

    it("cancels the alert the store has now, not the one the swipe remembered", async () => {
      // The prompt stands for seconds, and `runNotificationSync` stamps an id
      // on after its own awaited forecast fetch. Cancelling the captured copy's
      // id cancels nothing, and the update below wipes the real one — leaving
      // an alert `planNotificationResync` can never find again.
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
          buttons.find((button) => button.text === "Mute this day")?.onPress?.();
        },
      );
      const { result } = await renderHook(() => useMuteSlotWithUndo());

      // The copy handed in never had an id, which is the whole point.
      expect(slot.notificationId).toBeUndefined();
      await result.current(DATE, slot);

      expect(mockCancel).toHaveBeenCalledWith("notif-late");
    });

    it("records no exception when the detach didn't happen", async () => {
      // The stop went away while the prompt was up. An exception with no
      // detach behind it is unrecoverable: the day drops out of the routine's
      // occurrences and the next top-up sweeps the stop.
      useItineraryStore.setState({ plans: [] });
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Mute this day");

      const outcome = await result.current(DATE, routineSlot());

      expect(outcome?.ok).toBe(false);
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([]);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Couldn't change alerts for that stop. Try again.",
        variant: "error",
      });
    });

    it("moves the rule when the whole routine is meant, and rewrites its days", async () => {
      seed(routineSlot());
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Mute all future days");

      await result.current(DATE, routineSlot());

      expect(useRoutineStore.getState().routines[0].notificationsMuted).toBe(
        true,
      );
      // The materialiser replaced every upcoming stop, so the one on screen
      // carries the rule's new flag rather than waiting for a top-up. The
      // count is asserted first on purpose: `every` is true of an empty array,
      // so a sweep that wiped the days would satisfy the flag check alone.
      const rewritten = storedSlots();
      expect(rewritten.length).toBeGreaterThan(0);
      expect(rewritten.map((slot) => slot.id)).toContain(
        materializedSlotId(ROUTINE.id, DATE),
      );
      expect(rewritten.every((slot) => slot.notificationsMuted === true)).toBe(
        true,
      );
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([]);
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts off for Office and its repeats",
      });
    });

    it("takes the whole routine off mute, and its days with it", async () => {
      // The mirror of the test above. Without it, hardcoding the series branch
      // to `notificationsMuted: true` passes the entire suite.
      useRoutineStore.setState({
        routines: [{ ...ROUTINE, notificationsMuted: true }],
      });
      seed({ ...routineSlot(), notificationsMuted: true });
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Unmute all future days");

      await result.current(DATE, { ...routineSlot(), notificationsMuted: true });

      expect(useRoutineStore.getState().routines[0].notificationsMuted).toBe(
        false,
      );
      const rewritten = storedSlots();
      expect(rewritten.length).toBeGreaterThan(0);
      expect(rewritten.every((slot) => slot.notificationsMuted === false)).toBe(
        true,
      );
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Rain alerts on for Office and its repeats",
      });
    });

    it("schedules the unmuted day's alert against its new id, not the routine's", async () => {
      // The detach re-keys the slot. An alert scheduled against the old
      // `r_{routineId}_{date}` id is written back to a slot that no longer
      // exists, so the handle is dropped and the alert is orphaned.
      useSettingsStore.setState({ rainAlertsEnabled: true });
      const muted = { ...routineSlot(), notificationsMuted: true };
      seed(muted);
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Unmute this day");

      await result.current(DATE, muted);

      const detached = storedSlots()[0];
      expect(detached.id).not.toBe(materializedSlotId(ROUTINE.id, DATE));
      await waitFor(() =>
        expect(storedSlots()[0].notificationId).toBe("notif-new"),
      );
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: detached.id }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("leaves the day it never filled in alone", async () => {
      // A stop the user made by hand on a routine's day is not the routine's,
      // and muting the rule must not sweep it.
      const handMade = makeSlot({ id: "hand-made", label: "Lunch" });
      seed(routineSlot(), handMade);
      const { result } = await renderHook(() => useMuteSlotWithUndo());
      answerScopePromptWith("Mute all future days");

      await result.current(DATE, routineSlot());

      const stored = storedSlots().find((slot) => slot.id === "hand-made");
      // Present first: `stored?.notificationsMuted` is undefined for a slot
      // that was swept, which is exactly what this test is here to catch.
      expect(stored).toBeDefined();
      expect(stored?.notificationsMuted).toBeUndefined();
    });
  });
});
