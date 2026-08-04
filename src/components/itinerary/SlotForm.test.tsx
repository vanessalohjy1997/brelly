import { act, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import {
  defaultStartTime,
  placeNameOf,
  SlotForm,
  type SlotFormValues,
} from "@/components/itinerary/SlotForm";
import { searchPlaces } from "@/services/geocoding";
import { useSettingsStore } from "@/store/settingsStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import { toDateKey } from "@/utils/dateKeys";

jest.mock("@/services/geocoding", () => ({
  searchPlaces: jest.fn().mockResolvedValue([]),
  getPlaceDetails: jest.fn(),
}));

const mockSearchPlaces = searchPlaces as jest.Mock;

const INITIAL: SlotFormValues = {
  label: "Lunch with Sam",
  location: "Tanjong Pagar, Singapore",
  latitude: 1.2766,
  longitude: 103.8456,
  startTime: new Date(2026, 6, 31, 12, 30).toISOString(),
  endTime: new Date(2026, 6, 31, 13, 30).toISOString(),
};

beforeEach(() => {
  useSettingsStore.setState({
    themePreference: "system",
    rainAlertsEnabled: true,
    rainLeadMinutes: 45,
  });
});

describe("SlotForm", () => {
  it("submits the edited values", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Lunch with Alex",
    );
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Lunch with Alex" }),
    );
  });

  it("refuses to submit without a label, and says so at the field", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(view.getByDisplayValue("Lunch with Sam"), "   ");
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByText("Give this plan a label")).toBeTruthy();
  });

  it("clears a field's error as soon as it is satisfied", async () => {
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByDisplayValue("Lunch with Sam"), "");
    await fireEvent.press(view.getByText("Save"));
    expect(view.getByText("Give this plan a label")).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText("Label"), "Coffee");

    expect(view.queryByText("Give this plan a label")).toBeNull();
  });

  it("submits with rain alerts on by default", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationsMuted: false }),
    );
  });

  it("submits a mute when rain alerts are switched off for this stop", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent(
      view.getByLabelText("Rain alerts for this stop"),
      "valueChange",
      false,
    );
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationsMuted: true }),
    );
  });

  it("shows an existing mute as switched off", async () => {
    const view = await renderWithProviders(
      <SlotForm
        submitLabel="Save"
        initialValues={{ ...INITIAL, notificationsMuted: true }}
        onSubmit={jest.fn()}
      />,
    );

    expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
      false,
    );
  });

  describe("indoor or outdoor", () => {
    it("submits a stop as outdoor unless it is said to be indoors", async () => {
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      await fireEvent.press(view.getByText("Save"));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "outdoor" }),
      );
    });

    it("submits the indoor tag once the chip is pressed", async () => {
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      await fireEvent.press(view.getByText("Indoor"));
      await fireEvent.press(view.getByText("Save"));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "indoor" }),
      );
    });

    it("shows an existing indoor stop as indoors", async () => {
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={{ ...INITIAL, kind: "indoor" }}
          onSubmit={jest.fn()}
        />,
      );

      expect(
        view.getByText("Indoor").parent?.props.accessibilityState,
      ).toMatchObject({ selected: true });
    });

    it("switches this stop's rain alerts off when it is marked indoors", async () => {
      // The whole point of the tag: a mall doesn't need warning about rain, and
      // saying so once should not also mean finding the switch below it.
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
      );
      expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
        true,
      );

      await fireEvent.press(view.getByText("Indoor"));

      expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
        false,
      );
    });

    it("switches them back on when the stop is marked outdoors again", async () => {
      // Symmetric on purpose. If only Indoor moved the switch, correcting a
      // mis-tap would leave the alerts silently off — and a warning that never
      // arrives says nothing about why.
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
      );

      await fireEvent.press(view.getByText("Indoor"));
      await fireEvent.press(view.getByText("Outdoor"));

      expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
        true,
      );
    });

    it("leaves an indoor stop's re-enabled alerts alone when it is reopened", async () => {
      // The tag seeds the switch and then lets go. If the coupling ran on mount
      // instead of on the press, opening this stop to change its label would
      // silently undo a choice the user had already made — and the save would
      // write the undo back.
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={{
            ...INITIAL,
            kind: "indoor",
            notificationsMuted: false,
          }}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
        true,
      );
    });

    it("does not disturb the switch when the current chip is pressed again", async () => {
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={{
            ...INITIAL,
            kind: "indoor",
            notificationsMuted: false,
          }}
          onSubmit={jest.fn()}
        />,
      );

      await fireEvent.press(view.getByText("Indoor"));

      expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
        true,
      );
    });

    it("counts a change of kind as an unsaved change", async () => {
      const onDirtyChange = jest.fn();
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={INITIAL}
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      await fireEvent.press(view.getByText("Indoor"));

      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    it("reads an untagged stop as unchanged rather than as already edited", async () => {
      // `INITIAL` carries no `kind`, and the field resolves that to "outdoor".
      // Comparing the resolved value against the absent one would make every
      // pre-existing plan dirty the moment it opened, so Cancel would stop to
      // ask about changes nobody made.
      const onDirtyChange = jest.fn();
      await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={INITIAL}
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("shows a delete action only when one is provided", async () => {
    const withoutDelete = await renderWithProviders(
      <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
    );
    expect(withoutDelete.queryByText("Delete plan")).toBeNull();

    const onDelete = jest.fn();
    const withDelete = await renderWithProviders(
      <SlotForm submitLabel="Save" onSubmit={jest.fn()} onDelete={onDelete} />,
    );
    await fireEvent.press(withDelete.getByText("Delete plan"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // The pickers are real SwiftUI views, so they read the *system* appearance
  // and not the app's `themePreference`. On the dark theme over a light system
  // that put a translucent light chip with black label text in the middle of a
  // dark form — unreadable, and invisible to any test that checks `Colors`
  // tokens, because no token is involved. `themeVariant` is the one prop tying
  // them to the app's resolved scheme.
  it.each(["dark", "light"] as const)(
    "renders the date and time pickers in the app's %s theme, not the device's",
    async (preference) => {
      useSettingsStore.setState({ themePreference: preference });

      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      const pickers = [
        view.getByTestId("datetime-picker-date"),
        ...view.getAllByTestId("datetime-picker-time"),
      ];
      expect(pickers).toHaveLength(3);
      for (const picker of pickers) {
        expect(picker.props.themeVariant).toBe(preference);
      }
    },
  );

  describe("the picked location", () => {
    it("reads as confirmed rather than as text someone typed", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
      );

      expect(
        view.getByLabelText("Location set to Tanjong Pagar, Singapore"),
      ).toBeTruthy();
      // The search input is gone while a place is confirmed — there is
      // nothing left to search for.
      expect(view.queryByLabelText("Location")).toBeNull();
    });

    it("goes back to a search field when cleared", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
      );

      await fireEvent.press(view.getByLabelText("Clear location"));

      expect(view.getByLabelText("Location")).toBeTruthy();
      expect(
        view.queryByLabelText("Location set to Tanjong Pagar, Singapore"),
      ).toBeNull();
    });

    it("refuses to submit once the confirmed place has been cleared", async () => {
      // Without coordinates there is no NEA area to look a forecast up against.
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      await fireEvent.press(view.getByLabelText("Clear location"));
      await fireEvent.press(view.getByText("Save"));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(view.getByText("Where is this stop?")).toBeTruthy();
    });

    it("says why typed text isn't enough, rather than just that it isn't", async () => {
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      await fireEvent.press(view.getByLabelText("Clear location"));
      await fireEvent.changeText(
        view.getByLabelText("Location"),
        "Botanic Gardens",
      );
      await fireEvent.press(view.getByText("Save"));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        view.getByText("Pick one of the suggestions so we know where this is"),
      ).toBeTruthy();
    });

  });

  describe("the suggestion dropdown", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockSearchPlaces.mockClear();
      mockSearchPlaces.mockResolvedValue([
        {
          placeId: "p1",
          displayName: "East Coast Park",
          secondaryText: "Singapore",
        },
      ]);
    });

    afterEach(() => {
      // A debounce left pending here fires inside the next test and counts as
      // a search it didn't make.
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    /** Types a query and waits out the 350ms search debounce. */
    async function searchFor(
      view: Awaited<ReturnType<typeof renderWithProviders>>,
      query: string,
    ) {
      await fireEvent.changeText(view.getByLabelText("Location"), query);
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }

    it("hangs over the form rather than pushing the fields below it down", async () => {
      // As a block in the flow the list sat between Location and Label and
      // moved every field under it on each keystroke — you aimed at Label and
      // hit whatever the list had pushed into its place.
      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      await searchFor(view, "East Coast");

      const dropdown = await view.findByLabelText("Location suggestions");
      expect(StyleSheet.flatten(dropdown.props.style)).toMatchObject({
        position: "absolute",
      });
      expect(view.getByText("East Coast Park")).toBeTruthy();
    });

    // "Use my location" is a later sibling in the same field, so without a
    // `zIndex` on the input's wrapper it paints straight through the list —
    // its text lands on top of the first result.
    it("paints over the row beneath it rather than under it", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      await searchFor(view, "East Coast");

      const anchor = view.getByLabelText("Location").parent;
      expect(StyleSheet.flatten(anchor?.props.style)).toMatchObject({
        zIndex: expect.any(Number),
      });
      const dropdown = view.getByLabelText("Location suggestions");
      // Android reads `elevation` as stacking order as well as shadow, and it
      // is the only thing that orders views there.
      expect(StyleSheet.flatten(dropdown.props.style).elevation).toBeGreaterThan(
        0,
      );
    });

    it("says it is searching without taking a line to say it", async () => {
      // The message used to sit on a permanently reserved 16pt line under the
      // field — space every form paid for so that this one could appear
      // without shifting the fields below it. It shares the row with "Use my
      // location" instead, which is there either way.
      let resolveSearch: (value: unknown[]) => void = () => {};
      mockSearchPlaces.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
      );
      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      await searchFor(view, "East Coast");

      expect(view.getByText("Searching…")).toBeTruthy();
      expect(view.getByText("Use my location")).toBeTruthy();

      await act(async () => {
        resolveSearch([]);
      });

      expect(view.queryByText("Searching…")).toBeNull();
      expect(view.getByText("Use my location")).toBeTruthy();
    });

    it("closes when the field is left, so it can't sit over the Label field", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      await searchFor(view, "East Coast");
      expect(view.getByText("East Coast Park")).toBeTruthy();

      await fireEvent(view.getByLabelText("Location"), "blur");

      expect(view.queryByLabelText("Location suggestions")).toBeNull();
    });

    it("brings the same suggestions back on focus without searching again", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
      );

      await searchFor(view, "East Coast");

      await fireEvent(view.getByLabelText("Location"), "blur");
      await fireEvent(view.getByLabelText("Location"), "focus");

      expect(view.getByText("East Coast Park")).toBeTruthy();
      // Asserting the calls themselves rather than a count, so a stray search
      // says what it went looking for.
      expect(mockSearchPlaces.mock.calls).toEqual([["East Coast"]]);
    });
  });

  describe("the day and the two times", () => {
    it("moves the whole stop when the day changes", async () => {
      // Both fields used to be `mode="datetime"`, so moving a plan to another
      // day meant editing the same date twice.
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      await fireEvent(
        view.getByTestId("datetime-picker-date"),
        "valueChange",
        new Date(2026, 7, 9),
      );
      await fireEvent.press(view.getByText("Save"));

      const values = onSubmit.mock.calls[0][0] as SlotFormValues;
      expect(toDateKey(new Date(values.startTime))).toBe("2026-08-09");
      expect(toDateKey(new Date(values.endTime))).toBe("2026-08-09");
      // The times of day survive the move.
      expect(new Date(values.startTime).getHours()).toBe(12);
      expect(new Date(values.endTime).getHours()).toBe(13);
    });

    it("keeps a still-valid end when the start time moves", async () => {
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      const [starts] = view.getAllByTestId("datetime-picker-time");
      await fireEvent(starts, "valueChange", new Date(2026, 6, 31, 13));
      await fireEvent.press(view.getByText("Save"));

      const values = onSubmit.mock.calls[0][0] as SlotFormValues;
      expect(new Date(values.startTime).getHours()).toBe(13);
      expect(new Date(values.endTime).getHours()).toBe(13);
      expect(new Date(values.endTime).getMinutes()).toBe(30);
    });

    it("reads an end before the start as running past midnight", async () => {
      const onSubmit = jest.fn();
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
      );

      const [, ends] = view.getAllByTestId("datetime-picker-time");
      await fireEvent(ends, "valueChange", new Date(2026, 6, 31, 0, 30));

      expect(view.getByText("Next day")).toBeTruthy();

      await fireEvent.press(view.getByText("Save"));
      const values = onSubmit.mock.calls[0][0] as SlotFormValues;
      expect(toDateKey(new Date(values.endTime))).toBe("2026-08-01");
    });

    it("says nothing about another day for an ordinary stop", async () => {
      const view = await renderWithProviders(
        <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={jest.fn()} />,
      );

      expect(view.queryByText("Next day")).toBeNull();
    });
  });

  describe("the rain-alert lead window", () => {
    /** ISO times for a stop `minutes` from now. */
    function startingIn(minutes: number): SlotFormValues {
      const start = new Date(Date.now() + minutes * 60 * 1000);
      return {
        ...INITIAL,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      };
    }

    it("warns when a plan starts inside the lead window", async () => {
      // A longer lead silently produces *fewer* alerts on near-term plans:
      // the trigger has already passed, so nothing is scheduled.
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={startingIn(20)}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.getByText(/starts too soon for a rain alert/)).toBeTruthy();
    });

    it("says nothing when there is time to warn", async () => {
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={startingIn(180)}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.queryByText(/starts too soon/)).toBeNull();
    });

    it("says nothing about a stop that was muted anyway", async () => {
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={{ ...startingIn(20), notificationsMuted: true }}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.queryByText(/starts too soon/)).toBeNull();
    });

    it("says nothing when rain alerts are off altogether", async () => {
      useSettingsStore.setState({ rainAlertsEnabled: false });

      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={startingIn(20)}
          onSubmit={jest.fn()}
        />,
      );

      expect(view.queryByText(/starts too soon/)).toBeNull();
    });
  });

  describe("unsaved changes", () => {
    it("starts clean", async () => {
      const onDirtyChange = jest.fn();
      await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={INITIAL}
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it("reports an edit", async () => {
      const onDirtyChange = jest.fn();
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={INITIAL}
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      await fireEvent.changeText(view.getByLabelText("Label"), "Dinner");

      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    it("goes back to clean when the edit is undone by hand", async () => {
      const onDirtyChange = jest.fn();
      const view = await renderWithProviders(
        <SlotForm
          submitLabel="Save"
          initialValues={INITIAL}
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      await fireEvent.changeText(view.getByLabelText("Label"), "Dinner");
      await fireEvent.changeText(view.getByLabelText("Label"), "Lunch with Sam");

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it("counts a blank new form as clean, so Cancel doesn't stop to ask", async () => {
      const onDirtyChange = jest.fn();
      await renderWithProviders(
        <SlotForm
          submitLabel="Add"
          onSubmit={jest.fn()}
          onDirtyChange={onDirtyChange}
        />,
      );

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });
});

describe("placeNameOf", () => {
  it("takes the name and leaves the address", () => {
    expect(
      placeNameOf("Singapore Botanic Gardens, Cluny Road, Singapore"),
    ).toBe("Singapore Botanic Gardens");
  });

  it("passes a name with no address through", () => {
    expect(placeNameOf("Gardens by the Bay")).toBe("Gardens by the Bay");
  });

  it("falls back to the whole string rather than to nothing", () => {
    expect(placeNameOf(", Singapore")).toBe(", Singapore");
  });
});

describe("defaultStartTime", () => {
  it("defaults to the next whole hour today when no day is given", () => {
    const start = defaultStartTime();

    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getTime()).toBeGreaterThan(Date.now());
    expect(start.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("puts the next whole hour on the day the form was opened for", () => {
    const start = defaultStartTime("2026-08-05");

    expect(toDateKey(start)).toBe("2026-08-05");
    expect(start.getMinutes()).toBe(0);
  });

  it("doesn't roll over when today's day-of-month exceeds the target month", () => {
    // Setting the month before the day would push 31 Jan + February into March.
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 31, 10, 15));
    try {
      expect(toDateKey(defaultStartTime("2026-02-05"))).toBe("2026-02-05");
    } finally {
      jest.useRealTimers();
    }
  });

  it("falls back to today for a day it can't parse", () => {
    expect(toDateKey(defaultStartTime("not-a-date"))).toBe(
      toDateKey(new Date()),
    );
  });
});
