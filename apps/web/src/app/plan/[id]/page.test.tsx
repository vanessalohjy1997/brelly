import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getUpcomingForecast,
  shiftDays,
  todayKey,
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import type { SlotFormValues } from "@/components/itinerary/SlotForm";
import { useDialogStore } from "@/store/dialogStore";
import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";
import { markCloudReady, renderRoute, resetAppState } from "@/test/routeHarness";

import EditPlanPage from "./page";

const push = jest.fn();
let params: Record<string, string> = { id: "slot-1" };

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: jest.fn() }),
  useParams: () => params,
}));

jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

const mockUpcoming = getUpcomingForecast as jest.MockedFunction<
  typeof getUpcomingForecast
>;

let weather: unknown = undefined;
jest.mock("@/hooks/useWeatherForSlot", () => ({
  useWeatherForSlot: () => ({ data: weather }),
}));

/** What `submitted` the stub form hands back. Mutated per test. */
let submitted: SlotFormValues;

jest.mock("@/components/itinerary/SlotForm", () => ({
  SlotForm: ({
    submitLabel,
    onSubmit,
    onDelete,
    dryWindow,
    children,
  }: {
    submitLabel: string;
    onSubmit: (values: SlotFormValues) => void;
    onDelete?: () => void;
    dryWindow?: { start: string };
    children?: React.ReactNode;
  }) => (
    <div>
      <button type="button" onClick={() => void onSubmit(submitted)}>
        {submitLabel}
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete}>
          Delete plan
        </button>
      )}
      {dryWindow && <p>dry window {dryWindow.start}</p>}
      {children}
    </div>
  ),
}));

jest.mock("@/components/FormPageHeader", () => ({
  FormPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const DAY = shiftDays(todayKey(), 2);

/** `at(hour)` on `DAY`, as a local-time ISO instant. */
function at(hour: number, day = DAY): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

function seedSlot(overrides = {}) {
  const slot = makeSlot({
    startTime: at(12),
    endTime: at(13),
    ...overrides,
  });
  useItineraryStore.setState({ plans: [makePlan(DAY, [slot])] });
  return slot;
}

/** The values the stub form submits: the stop unchanged unless a test says so. */
function valuesFor(overrides: Partial<SlotFormValues> = {}): SlotFormValues {
  return {
    label: "Lunch",
    location: "313@Somerset, 313 Orchard Rd, Singapore 238895",
    latitude: 1.3009,
    longitude: 103.8386,
    startTime: at(12),
    endTime: at(13),
    kind: "outdoor",
    notificationsMuted: false,
    ...overrides,
  };
}

/** Waits for the scope prompt and presses one of its buttons. */
async function answerDialog(key: string) {
  await waitFor(() => expect(useDialogStore.getState().dialog).not.toBeNull());
  useDialogStore.getState().answer(key);
}

beforeEach(() => {
  resetAppState();
  markCloudReady();
  push.mockClear();
  params = { id: "slot-1" };
  weather = undefined;
  submitted = valuesFor();
  mockUpcoming.mockResolvedValue([]);
});

/** A wet period over the stop, with a dry one straight after it. */
function seedDryWindowAfter() {
  const period = (from: number, to: number, forecast: string) => ({
    start: at(from),
    end: at(to),
    forecast,
    temperature: { low: 26, high: 31 },
    humidity: { low: 65, high: 90 },
  });
  mockUpcoming.mockResolvedValue([
    period(12, 14, "Thundery Showers"),
    period(14, 16, "Partly Cloudy (Day)"),
  ]);
}

describe("EditPlanPage", () => {
  it("waits rather than claiming the plan is gone", () => {
    // The cold-boot store is genuinely empty until the first snapshot lands, so
    // a "no such plan" here would be wrong about every plan.
    useCloudSyncStore.setState({ slotsReady: false });
    seedSlot();
    renderRoute(<EditPlanPage />);

    expect(screen.getByText("Loading your plan…")).toBeInTheDocument();
  });

  it("says the plan is gone for a link to one that is", () => {
    // A URL someone can arrive at cold — a shared link to a deleted stop, or a
    // bookmark. The phone could only reach this screen by pushing onto it.
    params = { id: "slot-nope" };
    renderRoute(<EditPlanPage />);

    expect(screen.getByText("This plan no longer exists")).toBeInTheDocument();
  });

  it("saves an ordinary edit and goes back to the list", async () => {
    seedSlot();
    submitted = valuesFor({ label: "Dinner" });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/plans"));
    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe("Dinner");
    expect(useToastStore.getState().toast?.message).toBe("Updated Dinner");
  });

  it("asks which a routine's stop means, and changes nothing when dismissed", async () => {
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    submitted = valuesFor({ label: "Dinner" });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await answerDialog("cancel");

    await waitFor(() =>
      expect(useItineraryStore.getState().plans[0].slots[0].label).toBe("Lunch"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("rewrites the rule when the answer is the whole series", async () => {
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    submitted = valuesFor({ label: "Dinner" });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await answerDialog("series");

    await waitFor(() =>
      expect(useRoutineStore.getState().routines[0].label).toBe("Dinner"),
    );
    expect(useToastStore.getState().toast?.message).toBe(
      "Updated Dinner and its repeats",
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/plans"));
  });

  it("cuts the day loose from the rule when the answer is this day only", async () => {
    // The exception is what stops the next top-up filling the day back in
    // beside it.
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    submitted = valuesFor({ label: "Dinner" });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await answerDialog("day");

    await waitFor(() =>
      expect(useRoutineStore.getState().routines[0].exceptions).toContain(DAY),
    );
    const saved = useItineraryStore.getState().plans[0].slots[0];
    expect(saved.label).toBe("Dinner");
    expect(saved.routineId).toBeUndefined();
    // A detached slot is minted a new id by the store, so nothing that still
    // holds the materialised one can rewrite or sweep it.
    expect(saved.id).not.toBe("slot-1");
  });

  it("withholds the series option when the stop moved to another day", async () => {
    // A routine has no single date, so there is no rule-level reading of "this
    // now happens on Thursday instead".
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    const moved = shiftDays(DAY, 1);
    submitted = valuesFor({
      startTime: at(12, moved),
      endTime: at(13, moved),
    });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(useDialogStore.getState().dialog).not.toBeNull());
    const dialog = useDialogStore.getState().dialog!;
    expect(dialog.actions.map((action) => action.key)).toEqual(["day", "cancel"]);
    expect(dialog.message).toMatch(/can only apply to this one/);
    useDialogStore.getState().answer("cancel");
  });

  it("copies the stop onto another day and says where it landed", async () => {
    // Nothing else on screen changes when a copy is filed under another day.
    seedSlot();
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const tomorrow = shiftDays(todayKey(), 1);
    const copied = useItineraryStore
      .getState()
      .plans.find((plan) => plan.date === tomorrow);
    expect(copied?.slots[0].label).toBe("Lunch");
    expect(useToastStore.getState().toast?.message).toMatch(/^Copied to /);
  });

  it("deletes with an undo rather than a confirmation, then leaves", async () => {
    seedSlot();
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Delete plan" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/plans"));
    expect(useItineraryStore.getState().plans[0]?.slots ?? []).toHaveLength(0);
    expect(useToastStore.getState().toast?.action?.label).toBe("Undo");
  });

  it("stays on the form when a routine's delete is dismissed", async () => {
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<EditPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Delete plan" }));
    await answerDialog("cancel");

    await waitFor(() =>
      expect(useItineraryStore.getState().plans[0].slots).toHaveLength(1),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("says what the rule promises, on the stop that belongs to it", () => {
    seedSlot({ routineId: "routine-1" });
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<EditPlanPage />);

    expect(screen.getByText("Repeats every day")).toBeInTheDocument();
  });

  it("lists what to pack once there is a forecast to derive it from", () => {
    // `derivePackingList` takes the forecast *text*, which is what NEA's
    // two-hour endpoint returns per area.
    weather = { source: "nea", forecast: "Thundery Showers" };
    seedSlot();
    renderRoute(<EditPlanPage />);

    expect(screen.getByText("Pack for this stop")).toBeInTheDocument();
  });

  it("packs nothing when the forecast itself failed", () => {
    weather = { source: "error" };
    seedSlot();
    renderRoute(<EditPlanPage />);

    expect(screen.queryByText("Pack for this stop")).not.toBeInTheDocument();
  });

  it("hands the dry window next door to the form, rather than saving it itself", async () => {
    // An NEA-only concept: Open-Meteo has no "upcoming periods" endpoint, which
    // is why this is an explicit scope cut overseas rather than a silent gap.
    // The form applies it to its own time fields — `SlotForm.test` covers the
    // move — so nothing is written and nothing else on the form is lost.
    seedSlot();
    seedDryWindowAfter();
    renderRoute(<EditPlanPage />);

    expect(await screen.findByText(`dry window ${at(14)}`)).toBeInTheDocument();
    expect(useItineraryStore.getState().plans[0].slots[0].startTime).toBe(at(12));
    expect(push).not.toHaveBeenCalled();
  });

  it("offers no dry window for a stop overseas", () => {
    seedSlot({ provider: "openMeteo", countryCode: "JP" });
    mockUpcoming.mockClear();
    renderRoute(<EditPlanPage />);

    expect(screen.queryByText(/^dry window/)).not.toBeInTheDocument();
    expect(mockUpcoming).not.toHaveBeenCalled();
  });
});
