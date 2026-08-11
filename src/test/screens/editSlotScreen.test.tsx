import { act, fireEvent } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";

import EditSlotScreen from "@/app/plan/[id]";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useToastStore } from "@/store/toastStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan } from "@/types/itinerary";
import type { Routine } from "@/types/routine";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
}));

const mockSearchParams = useLocalSearchParams as unknown as jest.Mock;

const PLAN: DayPlan = {
  id: "p1",
  date: "2026-07-31",
  slots: [
    {
      id: "slot-1",
      label: "Lunch with Sam",
      location: "Tanjong Pagar, Singapore",
      neaRegion: "central",
      latitude: 1.2766,
      longitude: 103.8456,
      startTime: new Date(2026, 6, 31, 12, 30).toISOString(),
      endTime: new Date(2026, 6, 31, 13, 30).toISOString(),
    },
  ],
};

/**
 * 31 Jul 2026 is a Friday, so a Mon–Fri routine covers the day `PLAN` is on.
 */
const ROUTINE: Routine = {
  id: "r1",
  label: "Lunch with Sam",
  location: "Tanjong Pagar, Singapore",
  latitude: 1.2766,
  longitude: 103.8456,
  weekdays: [1, 2, 3, 4, 5],
  startTime: "12:30",
  endTime: "13:30",
  startDate: "2026-07-27",
  exceptions: [],
};

/** Seeds the screen with a stop that a routine produced. */
function withRoutine() {
  useRoutineStore.setState({ routines: [ROUTINE] });
  useItineraryStore.setState({
    plans: [{ ...PLAN, slots: [{ ...PLAN.slots[0], routineId: "r1" }] }],
  });
}

type AlertButton = { text: string; onPress?: () => void };

/** The buttons the scope prompt was raised with. */
function scopePromptButtons(): AlertButton[] {
  const alert = Alert.alert as unknown as jest.Mock;
  return alert.mock.calls.at(-1)?.[2] ?? [];
}

/**
 * Makes the scope prompt answer itself the moment it is raised.
 *
 * Both Save and Delete now *await* that answer, so the alternative — press,
 * then reach into the mock and press a button — leaves the press promise
 * pending at the point the test asserts, and RNTL never recovers the render
 * for the next test.
 */
function answerScopePromptWith(text: string) {
  (Alert.alert as unknown as jest.Mock).mockImplementation(
    (_title: string, _message: string, buttons: AlertButton[] = []) => {
      buttons.find((button) => button.text === text)?.onPress?.();
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [PLAN] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
  mockSearchParams.mockReturnValue({ id: "slot-1" });
});

describe("EditSlotScreen", () => {
  it("shows a loading skeleton before the cloud data is ready", async () => {
    useCloudSyncStore.setState({ slotsReady: false });

    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByText("Loading your plan…")).toBeTruthy();
    expect(view.queryByDisplayValue("Lunch with Sam")).toBeNull();
  });

  // Regression test. `useItineraryStore((s) => s.findSlotById(id))` returned a
  // fresh `{ date, slot }` object on every render, which zustand's
  // useSyncExternalStore read as a perpetual state change — opening a plan
  // crashed with "Maximum update depth exceeded". The lookup is now a pure
  // function over the (stable) plans array.
  it("renders without re-rendering itself indefinitely", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByDisplayValue("Lunch with Sam")).toBeTruthy();
  });

  it("prefills the form from the slot being edited", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByDisplayValue("Lunch with Sam")).toBeTruthy();
    // The location comes back as a confirmed chip rather than as editable
    // text — it already resolved to coordinates, and typing over it would
    // silently take those away.
    expect(
      view.getByLabelText("Location set to Tanjong Pagar, Singapore"),
    ).toBeTruthy();
  });

  it("saves changes to the store and navigates back", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Lunch with Alex",
    );
    await fireEvent.press(view.getByText("Save changes"));

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "Lunch with Alex",
    );
    expect(router.back).toHaveBeenCalled();
  });

  it("deletes the slot and navigates back", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Delete plan"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(router.back).toHaveBeenCalled();
  });

  it("no longer stops to confirm — the toast's Undo is the safety net", async () => {
    // The dialog used to guard this path while the swipe gesture on the lists
    // deleted outright, which put the friction on the deliberate action and
    // left the accidental one unprotected.
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Delete plan"));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Lunch with Sam",
      action: { label: "Undo" },
    });
    alertSpy.mockRestore();
  });

  it("offers the plan back after deleting it, with its identity intact", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Delete plan"));
    useToastStore.getState().toast?.action?.onPress();

    const plans = useItineraryStore.getState().plans;
    expect(plans).toHaveLength(1);
    // Same id, not a lookalike copy: the route that was open pointed at it,
    // and so does anything else holding a reference.
    expect(plans[0].slots[0]).toMatchObject({
      id: "slot-1",
      label: "Lunch with Sam",
    });
  });

  it("shows a fallback instead of crashing when the slot no longer exists", async () => {
    mockSearchParams.mockReturnValue({ id: "deleted-slot" });

    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByText("This plan no longer exists.")).toBeTruthy();
  });

  it("does not write to the store until the edit is saved", async () => {
    // The header's Cancel button is a native bar item (see
    // HeaderDismissButton), so it never reaches the rendered tree — what's
    // testable, and what actually matters, is that abandoning the screen
    // can't have already mutated the plan.
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Changed but not saved",
    );

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "Lunch with Sam",
    );
  });

  it("keeps a per-stop mute through a save", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent(
      view.getByLabelText("Rain alerts for this stop"),
      "valueChange",
      false,
    );
    await fireEvent.press(view.getByText("Save changes"));

    expect(useItineraryStore.getState().plans[0].slots[0].notificationsMuted).toBe(
      true,
    );
  });

  it("keeps an indoor tag through a save", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Indoor"));
    await fireEvent.press(view.getByText("Save changes"));

    const saved = useItineraryStore.getState().plans[0].slots[0];
    expect(saved.kind).toBe("indoor");
    // The tag seeds the switch, and the seeded value is what gets written —
    // the point of the tag is that saying "indoor" is enough.
    expect(saved.notificationsMuted).toBe(true);
  });

  it("carries the indoor tag onto a copy of the stop", async () => {
    // `handleDuplicate` builds its slot field by field rather than spreading,
    // so a new field is dropped here unless it is named — and silently: the
    // copy looks right in every other respect.
    useItineraryStore.setState({
      plans: [
        { ...PLAN, slots: [{ ...PLAN.slots[0], kind: "indoor" as const }] },
      ],
    });
    const view = await renderWithProviders(<EditSlotScreen />);

    // The picker already defaults to tomorrow, which is not the day this stop
    // is on, so the copy lands somewhere of its own without touching it.
    await fireEvent.press(view.getByText("Duplicate"));

    const copy = useItineraryStore
      .getState()
      .plans.flatMap((plan) => plan.slots)
      .find((slot) => slot.id !== "slot-1");
    expect(copy?.kind).toBe("indoor");
  });

  describe("a stop that came from a routine", () => {
    beforeEach(() => {
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("says so, since there is no repeat control on this screen", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      expect(view.getByText("Repeats Mon–Fri")).toBeTruthy();
    });

    it("asks which days a save is meant for", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      await fireEvent.changeText(
        view.getByDisplayValue("Lunch with Sam"),
        "Lunch with Alex",
      );
      answerScopePromptWith("Cancel");
      await fireEvent.press(view.getByText("Save changes"));

      expect(scopePromptButtons().map((b) => b.text)).toEqual([
        "Cancel",
        "This day only",
        "This and future days",
      ]);
    });

    it("does not ask on an ordinary stop", async () => {
      const view = await renderWithProviders(<EditSlotScreen />);

      await fireEvent.press(view.getByText("Save changes"));

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(router.back).toHaveBeenCalled();
    });

    it("cuts one day loose, and marks it so the top-up can't refill it", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      await fireEvent.changeText(
        view.getByDisplayValue("Lunch with Sam"),
        "Lunch with Alex",
      );
      answerScopePromptWith("This day only");
      await fireEvent.press(view.getByText("Save changes"));

      const saved = useItineraryStore.getState().plans[0].slots[0];
      expect(saved.label).toBe("Lunch with Alex");
      // Detached: nothing may rewrite or sweep this day again.
      expect(saved.routineId).toBeUndefined();
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([
        "2026-07-31",
      ]);
    });

    it("rewrites the rule when the whole routine is meant", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      await fireEvent.changeText(
        view.getByDisplayValue("Lunch with Sam"),
        "Lunch with Alex",
      );
      answerScopePromptWith("This and future days");
      await fireEvent.press(view.getByText("Save changes"));

      expect(useRoutineStore.getState().routines[0].label).toBe(
        "Lunch with Alex",
      );
      // The rule changed, not this one day — no exception is recorded.
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([]);
    });

    it("commits nothing when the question goes unanswered", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      await fireEvent.changeText(
        view.getByDisplayValue("Lunch with Sam"),
        "Lunch with Alex",
      );
      answerScopePromptWith("Cancel");
      await fireEvent.press(view.getByText("Save changes"));

      expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
        "Lunch with Sam",
      );
      expect(router.back).not.toHaveBeenCalled();
    });

    it("asks which days a delete is meant for", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      answerScopePromptWith("Cancel");
      await fireEvent.press(view.getByText("Delete plan"));

      expect(scopePromptButtons().map((b) => b.text)).toEqual([
        "Cancel",
        "Delete this day",
        "Delete all future days",
      ]);
      expect(useItineraryStore.getState().plans).toHaveLength(1);
    });

    it("records an exception when one day is deleted", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      answerScopePromptWith("Delete this day");
      await fireEvent.press(view.getByText("Delete plan"));

      expect(useItineraryStore.getState().plans).toHaveLength(0);
      // Without this the next top-up reads the empty day as "not filled in
      // yet" and puts the stop straight back.
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([
        "2026-07-31",
      ]);
    });

    it("lifts the exception again on undo", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      answerScopePromptWith("Delete this day");
      await fireEvent.press(view.getByText("Delete plan"));
      await act(async () => {
        useToastStore.getState().toast?.action?.onPress();
      });

      expect(useItineraryStore.getState().plans).toHaveLength(1);
      expect(useRoutineStore.getState().routines[0].exceptions).toEqual([]);
    });

    it("deletes the rule, not the days already lived through", async () => {
      withRoutine();
      const view = await renderWithProviders(<EditSlotScreen />);

      answerScopePromptWith("Delete all future days");
      await fireEvent.press(view.getByText("Delete plan"));

      expect(useRoutineStore.getState().routines).toHaveLength(0);
      expect(router.back).toHaveBeenCalled();
    });
  });
});
