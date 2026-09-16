import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSettingsStore } from "@brelly/core";

import { defaultStartTime, placeNameOf, SlotForm } from "./SlotForm";

const search = jest.fn();
const selectPlace = jest.fn();
const clearSuggestions = jest.fn();
const getCurrentLocation = jest.fn();

/** What `usePlaceSearch` is reporting on this render. Mutated per test. */
let placeSearch = {
  suggestions: [] as {
    placeId: string;
    displayName: string;
    secondaryText: string;
  }[],
  isSearching: false,
  error: null as string | null,
};

let currentLocation = {
  isLocating: false,
  error: null as string | null,
  permissionDenied: false,
};

jest.mock("@/hooks/usePlaceSearch", () => ({
  usePlaceSearch: () => ({
    ...placeSearch,
    search,
    selectPlace,
    clearSuggestions,
  }),
}));

jest.mock("@/hooks/useCurrentLocation", () => ({
  useCurrentLocation: () => ({ ...currentLocation, getCurrentLocation }),
}));

const SUGGESTION = {
  placeId: "ChIJdYVSUTgZ2jERWmB2FMFj0wA",
  displayName: "Singapore Botanic Gardens, Cluny Road, Singapore",
  secondaryText: "Cluny Road, Singapore",
};

const DETAILS = {
  displayName: SUGGESTION.displayName,
  latitude: 1.3138,
  longitude: 103.8159,
  countryCode: "SG",
};

/** An existing stop, as the edit page hands one over. */
const EXISTING = {
  label: "Lunch",
  location: "313@Somerset, 313 Orchard Rd, Singapore 238895",
  latitude: 1.3009,
  longitude: 103.8386,
  startTime: new Date(2026, 8, 15, 12, 0).toISOString(),
  endTime: new Date(2026, 8, 15, 13, 0).toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  placeSearch = { suggestions: [], isSearching: false, error: null };
  currentLocation = { isLocating: false, error: null, permissionDenied: false };
  selectPlace.mockResolvedValue(DETAILS);
  useSettingsStore.setState({ rainAlertsEnabled: false, rainLeadMinutes: 60 });
});

/** Types into Location and picks the one suggestion the mock offers. */
async function pickAPlace(user: ReturnType<typeof userEvent.setup>) {
  placeSearch = { ...placeSearch, suggestions: [SUGGESTION] };
  await user.type(screen.getByRole("combobox"), "Botanic");
  await user.click(screen.getByText("Singapore Botanic Gardens, Cluny Road, Singapore"));
  await screen.findByRole("button", { name: "Clear location" });
}

describe("SlotForm", () => {
  it("asks for the place first, because it is what supplies the label", () => {
    // Location used to come second, under a Label field with nothing to
    // prefill it.
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    const labels = screen
      .getAllByText(/^(Location|Label)$/)
      .map((node) => node.textContent);
    expect(labels).toEqual(["Location", "Label"]);
  });

  it("prefills the label from the place, minus the address", async () => {
    const user = userEvent.setup();
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    await pickAPlace(user);

    expect(screen.getByLabelText("Label")).toHaveValue(
      "Singapore Botanic Gardens",
    );
  });

  it("stops following the place once the label is the user's", async () => {
    const user = userEvent.setup();
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    await user.type(screen.getByLabelText("Label"), "Picnic");
    await pickAPlace(user);

    expect(screen.getByLabelText("Label")).toHaveValue("Picnic");
  });

  it("refuses a place that was typed but never chosen", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" onSubmit={onSubmit} />);

    await user.type(screen.getByRole("combobox"), "Botanic Gardens");
    await user.type(screen.getByLabelText("Label"), "Picnic");
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(
      screen.getByRole("alert", { name: "" }),
    ).toHaveTextContent("Pick one of the suggestions");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks where the stop is when nothing was typed at all", async () => {
    const user = userEvent.setup();
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(screen.getByText("Where is this stop?")).toBeInTheDocument();
  });

  it("puts focus on the topmost failing field, not the last one", async () => {
    // The phone scrolls to the first error; focus does that and also puts the
    // caret where the fix has to be typed.
    const user = userEvent.setup();
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("wants a label even when the place has one", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" onSubmit={onSubmit} />);

    await pickAPlace(user);
    await user.clear(screen.getByLabelText("Label"));
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(screen.getByText("Give this plan a label")).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reads an earlier Ends as running past midnight rather than rejecting it", async () => {
    // "Ends 00:30" after a 23:00 start is a real itinerary, and an error on a
    // picker that only offers times has no move the user can make to satisfy it.
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Ends"), {
      target: { value: "11:00" },
    });
    expect(screen.getByText("Next day")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const [values] = onSubmit.mock.calls[0] as [{ endTime: string }];
    expect(new Date(values.endTime).getDate()).toBe(16);
  });

  it("refuses a stored stop whose range is already inverted", async () => {
    // Neither time field can produce one — `applyStartTime` and `applyEndTime`
    // both repair the range — so the only way in is an existing slot, which is
    // exactly why the guard is still checked on submit.
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={{
          ...EXISTING,
          startTime: new Date(2026, 8, 15, 13, 0).toISOString(),
          endTime: new Date(2026, 8, 15, 12, 0).toISOString(),
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("End time must be after start time"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the chosen place's own coordinates and country", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" onSubmit={onSubmit} />);

    await pickAPlace(user);
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Singapore Botanic Gardens",
        location: SUGGESTION.displayName,
        latitude: 1.3138,
        longitude: 103.8159,
        countryCode: "SG",
        kind: "outdoor",
        notificationsMuted: false,
      }),
    );
  });

  it("lets a chosen place be taken back", async () => {
    const user = userEvent.setup();
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    await pickAPlace(user);
    await user.click(screen.getByRole("button", { name: "Clear location" }));

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("fills the field in from the device, which names no country", async () => {
    // "Use my location" reverse-geocodes an address and nothing else, so the
    // country code the previous place carried has to be cleared with it.
    getCurrentLocation.mockResolvedValue({
      location: "Cluny Road, Singapore",
      latitude: 1.3138,
      longitude: 103.8159,
    });
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /Use my location/ }));
    await screen.findByRole("button", { name: "Clear location" });
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "Cluny Road, Singapore",
        countryCode: undefined,
      }),
    );
  });

  it("says where to re-allow location after a refusal", () => {
    // The browser's permission panel cannot be opened by a page, so the only
    // useful thing to do is name it.
    currentLocation = { ...currentLocation, permissionDenied: true };
    render(<SlotForm submitLabel="Add plan" onSubmit={jest.fn()} />);

    expect(
      screen.getByText(/padlock beside the address bar/),
    ).toBeInTheDocument();
  });

  it("mutes rain alerts when the stop is tagged indoor, and unmutes on outdoor", async () => {
    // Symmetric on purpose: correcting a mis-tap must not leave alerts silently
    // off, because a missing warning says nothing about itself.
    const user = userEvent.setup();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Indoor" }));
    expect(screen.getByLabelText("Rain alerts")).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Outdoor" }));
    expect(screen.getByLabelText("Rain alerts")).toBeChecked();
  });

  it("leaves the alerts switch alone once it has been set by hand", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Indoor" }));
    await user.click(screen.getByLabelText("Rain alerts"));
    await user.click(screen.getByRole("radio", { name: "Indoor" }));

    expect(screen.getByLabelText("Rain alerts")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "indoor", notificationsMuted: false }),
    );
  });

  it("warns when a stop starts too soon for its own rain alert", () => {
    // A longer lead time silently produces *fewer* alerts, and nothing else on
    // screen can say so.
    useSettingsStore.setState({ rainAlertsEnabled: true, rainLeadMinutes: 60 });
    const soon = new Date(Date.now() + 10 * 60 * 1000);
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={{
          ...EXISTING,
          startTime: soon.toISOString(),
          endTime: new Date(soon.getTime() + 3600_000).toISOString(),
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText(/starts too soon for a rain alert/)).toBeInTheDocument();
  });

  it("says nothing about lead time for a muted stop", () => {
    useSettingsStore.setState({ rainAlertsEnabled: true, rainLeadMinutes: 60 });
    const soon = new Date(Date.now() + 10 * 60 * 1000);
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={{
          ...EXISTING,
          notificationsMuted: true,
          startTime: soon.toISOString(),
          endTime: new Date(soon.getTime() + 3600_000).toISOString(),
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.queryByText(/starts too soon/)).not.toBeInTheDocument();
  });

  it("says when the stop runs past midnight", () => {
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={{
          ...EXISTING,
          startTime: new Date(2026, 8, 15, 23, 0).toISOString(),
          endTime: new Date(2026, 8, 16, 1, 0).toISOString(),
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("Next day")).toBeInTheDocument();
  });

  it("offers a repeat only where the caller allows one", () => {
    const { rerender } = render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.queryByRole("group", { name: "Repeat" })).not.toBeInTheDocument();

    rerender(
      <SlotForm
        submitLabel="Add plan"
        allowRepeat
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "Repeat" })).toBeInTheDocument();
  });

  it("refuses a weekly repeat with no day chosen", async () => {
    // Saving it as a one-off would silently drop a choice the user made.
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" allowRepeat onSubmit={onSubmit} />);

    await pickAPlace(user);
    await user.click(screen.getByRole("radio", { name: "Weekly" }));
    // Clear the day the cadence seeded from the stop's own date.
    const seeded = screen
      .getAllByRole("checkbox")
      .find((box) => (box as HTMLInputElement).checked);
    await user.click(seeded!);
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(screen.getByText("Pick at least one day")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("carries the repeat rule out with the rest of the values", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<SlotForm submitLabel="Add plan" allowRepeat onSubmit={onSubmit} />);

    await pickAPlace(user);
    await user.click(screen.getByRole("radio", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Mon–Fri" }));
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        repeat: expect.objectContaining({ weekdays: [1, 2, 3, 4, 5] }),
      }),
    );
  });

  it("reports itself dirty as soon as anything is typed, and not before", async () => {
    const user = userEvent.setup();
    const onDirtyChange = jest.fn();
    render(
      <SlotForm
        submitLabel="Add plan"
        onSubmit={jest.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText("Label"), "P");

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it("does not read an untagged existing stop as edited", () => {
    // `kind` is absent on every slot created before the tag existed, and
    // comparing the resolved "outdoor" against `undefined` would report dirty
    // on mount.
    const onDirtyChange = jest.fn();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={jest.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("offers a delete only where the caller gave it one", async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(
      <SlotForm
        submitLabel="Save changes"
        initialValues={EXISTING}
        onSubmit={jest.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete plan" }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("renders the caller's extra actions inside the form", () => {
    render(
      <SlotForm submitLabel="Save changes" onSubmit={jest.fn()}>
        <p>Pack for this stop</p>
      </SlotForm>,
    );

    expect(screen.getByText("Pack for this stop")).toBeInTheDocument();
  });
});

describe("placeNameOf", () => {
  it("keeps the name and drops the address", () => {
    expect(
      placeNameOf("Singapore Botanic Gardens, Cluny Road, Singapore"),
    ).toBe("Singapore Botanic Gardens");
  });

  it("keeps a one-part name whole", () => {
    expect(placeNameOf("Gardens by the Bay")).toBe("Gardens by the Bay");
  });

  it("falls back to the whole string when the first part is empty", () => {
    expect(placeNameOf(", Cluny Road")).toBe(", Cluny Road");
  });
});

describe("defaultStartTime", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15, 10, 20));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is the next whole hour", () => {
    const start = defaultStartTime();
    expect(start.getHours()).toBe(11);
    expect(start.getMinutes()).toBe(0);
  });

  it("lands on the day the form was opened for", () => {
    // A plan added from another day's page must not default to today.
    const start = defaultStartTime("2026-10-02");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(2);
    expect(start.getHours()).toBe(11);
  });

  it("does not roll over on a 31st", () => {
    // Setting the month alone on the 31st of January lands in March.
    jest.setSystemTime(new Date(2026, 0, 31, 10, 20));
    const start = defaultStartTime("2026-02-15");
    expect(start.getMonth()).toBe(1);
    expect(start.getDate()).toBe(15);
  });

  it("ignores a key that is not a date", () => {
    const start = defaultStartTime("soon");
    expect(start.getDate()).toBe(15);
  });
});
