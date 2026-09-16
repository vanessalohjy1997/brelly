import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  todayKey,
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { renderRoute, resetAppState } from "@/test/routeHarness";
import type { SlotFormValues } from "@/components/itinerary/SlotForm";

import NewPlanPage from "./page";

const push = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: jest.fn() }),
  useSearchParams: () => searchParams,
}));

/**
 * The form, reduced to the two things this page's own code depends on: the
 * values it is handed and the `initialDate` it passes down. `SlotForm`'s own
 * behaviour is covered next to `SlotForm`.
 */
let submitted: SlotFormValues = {
  label: "Lunch",
  location: "313@Somerset, 313 Orchard Rd, Singapore 238895",
  latitude: 1.3009,
  longitude: 103.8386,
  startTime: new Date(2026, 8, 20, 12, 0).toISOString(),
  endTime: new Date(2026, 8, 20, 13, 0).toISOString(),
  kind: "outdoor",
  repeat: null,
};

jest.mock("@/components/itinerary/SlotForm", () => ({
  SlotForm: ({
    submitLabel,
    initialDate,
    onSubmit,
    onDirtyChange,
  }: {
    submitLabel: string;
    initialDate?: string;
    onSubmit: (values: SlotFormValues) => void;
    onDirtyChange?: (dirty: boolean) => void;
  }) => (
    <div>
      <span data-testid="initial-date">{initialDate ?? "none"}</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        Type something
      </button>
      <button type="button" onClick={() => onSubmit(submitted)}>
        {submitLabel}
      </button>
    </div>
  ),
}));

jest.mock("@/components/FormPageHeader", () => ({
  FormPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const DAY = "2026-09-20";

beforeEach(() => {
  resetAppState();
  push.mockClear();
  searchParams = new URLSearchParams();
  submitted = {
    label: "Lunch",
    location: "313@Somerset, 313 Orchard Rd, Singapore 238895",
    latitude: 1.3009,
    longitude: 103.8386,
    startTime: new Date(2026, 8, 20, 12, 0).toISOString(),
    endTime: new Date(2026, 8, 20, 13, 0).toISOString(),
    kind: "outdoor",
    repeat: null,
  };
});

describe("NewPlanPage", () => {
  it("opens the form on the day the link named", () => {
    // `?date=` rather than a route param: the day is an option on the add form,
    // not part of what the page is.
    searchParams = new URLSearchParams({ date: DAY });
    renderRoute(<NewPlanPage />);

    expect(screen.getByTestId("initial-date")).toHaveTextContent(DAY);
  });

  it("opens with no day at all when the link named none", () => {
    renderRoute(<NewPlanPage />);

    expect(screen.getByTestId("initial-date")).toHaveTextContent("none");
  });

  it("files the stop under the day the form ended up on", async () => {
    // Not the day the page was opened from — changing the start date in the
    // form has to move the plan with it.
    searchParams = new URLSearchParams({ date: todayKey() });
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    const plan = useItineraryStore
      .getState()
      .plans.find((entry) => entry.date === DAY);
    expect(plan?.slots).toHaveLength(1);
    expect(plan?.slots[0].label).toBe("Lunch");
  });

  it("says what was added, then leaves for the list", async () => {
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    expect(useToastStore.getState().toast?.message).toBe("Added Lunch");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/plans"));
  });

  it("stores a repeat as a rule rather than writing the days out", async () => {
    submitted = {
      ...submitted,
      repeat: { frequency: "weekly", weekdays: [1, 2, 3, 4, 5] },
    };
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    const { routines } = useRoutineStore.getState();
    expect(routines).toHaveLength(1);
    expect(routines[0]).toMatchObject({
      label: "Lunch",
      weekdays: [1, 2, 3, 4, 5],
      // Wall-clock, because a rule has no single date.
      startTime: "12:00",
      endTime: "13:00",
      startDate: DAY,
    });
  });

  it("names the rule in the toast rather than a count", async () => {
    // A number would be a lie about a routine that has no end.
    submitted = {
      ...submitted,
      repeat: { frequency: "weekly", weekdays: [1, 2, 3, 4, 5] },
    };
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    expect(useToastStore.getState().toast?.message).toBe(
      "Added Lunch · Repeats Mon–Fri",
    );
  });

  it("fills in the routine's first fortnight straight away", async () => {
    // So Plans shows the routine on the way back rather than after a reload.
    submitted = {
      ...submitted,
      repeat: { frequency: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    };
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    await waitFor(() =>
      expect(useItineraryStore.getState().plans.length).toBeGreaterThan(1),
    );
  });

  it("writes no separate slot for the first day of a routine", async () => {
    // The materialiser covers that day too, so an `addSlot` here would write it
    // twice.
    submitted = {
      ...submitted,
      repeat: { frequency: "weekly", weekdays: [] },
    };
    renderRoute(<NewPlanPage />);

    await userEvent.click(screen.getByRole("button", { name: "Add plan" }));

    // No weekday matches, so the materialiser fills nothing — and nothing else
    // wrote the stop either.
    expect(useItineraryStore.getState().plans).toEqual([]);
  });
});
