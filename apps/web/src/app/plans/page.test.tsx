import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { shiftDays, todayKey, useItineraryStore } from "@brelly/core";

import { makePlan, makeSlot } from "@/test/fixtures";
import { mockNextLink } from "@/test/mockNextLink";
import { markCloudReady, renderRoute, resetAppState } from "@/test/routeHarness";

import PlansPage from "./page";

jest.mock("next/link", () => mockNextLink());
jest.mock("@/hooks/useWeatherForSlot", () => ({
  useWeatherForSlot: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useUvIndex", () => ({
  useUvIndex: () => ({ data: { value: 4, updatedAt: null } }),
}));
jest.mock("@/hooks/useNearbyForecast", () => ({
  useNearbyForecast: () => ({
    isAvailable: false,
    isLoading: false,
    permission: "unprompted",
    requestPermission: jest.fn(),
    forecasts: [],
    region: null,
    coords: null,
  }),
}));

const tomorrow = shiftDays(todayKey(), 1);

/** A stop on `date` at `hour`, as an ISO instant in local time. */
function at(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

/**
 * Distinct one-word labels, not "Stop 0".."Stop 5".
 *
 * `filterPlans` requires *every* term to appear somewhere in the stop's label,
 * location, region or kind — so "Stop 1" is two terms, and the digit matches
 * the postal code in the shared location. Every stop would come back, which
 * looks like the filter not running.
 */
const LABELS = ["Lunch", "Kayaking", "Dentist", "Library", "Market", "Gym"];

function seedUpcoming(count = 1) {
  useItineraryStore.setState({
    plans: [
      makePlan(
        tomorrow,
        Array.from({ length: count }, (_, i) =>
          makeSlot({
            id: `slot-${i}`,
            label: LABELS[i],
            startTime: at(tomorrow, 9 + i),
            endTime: at(tomorrow, 10 + i),
          }),
        ),
      ),
    ],
  });
}

beforeEach(() => {
  resetAppState();
  markCloudReady();
});

describe("Plans", () => {
  it("offers the week strip, pre-dating the add form to each day", () => {
    seedUpcoming();
    renderRoute(<PlansPage />);

    const strip = screen.getByRole("navigation", { name: "Week ahead" });
    expect(within(strip).getAllByRole("link")).toHaveLength(7);
    expect(
      within(strip).getByRole("link", { name: /Add a plan on Today/ }),
    ).toHaveAttribute("href", `/plan/new?date=${todayKey()}`);
  });

  it("groups stops under the day they fall on", () => {
    seedUpcoming(2);
    renderRoute(<PlansPage />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("hides the search field until the list is worth searching", async () => {
    seedUpcoming(2);
    const { rerender } = renderRoute(<PlansPage />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    seedUpcoming(6);
    rerender(<PlansPage />);

    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  });

  it("keeps the field while a query is live, however few results it leaves", async () => {
    // Otherwise narrowing the list to two results pulls the control that
    // narrowed it out from under the user.
    seedUpcoming(6);
    renderRoute(<PlansPage />);

    await userEvent.type(screen.getByRole("searchbox"), "kayak");

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("says 'no matches' rather than 'nothing planned' for a mistyped query", async () => {
    // The user has plans, they just are not these. The other wording reads as
    // data loss for the length of a typo.
    seedUpcoming(6);
    renderRoute(<PlansPage />);

    await userEvent.type(screen.getByRole("searchbox"), "zzzz");

    const emptyState = screen.getByRole("heading", { name: "No matches" })
      .parentElement as HTMLElement;
    // Two controls named "Clear search" are on screen — the field's own and
    // this one — so the empty state's is reached through its own container
    // rather than by name alone.
    await userEvent.click(within(emptyState).getByRole("button"));

    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("distinguishes 'nothing upcoming' from 'nothing planned'", () => {
    // Untrue for someone whose plans have all simply happened — they are in
    // History, one click away.
    useItineraryStore.setState({
      plans: [
        makePlan("2020-01-01", [
          makeSlot({
            startTime: "2020-01-01T09:00:00.000Z",
            endTime: "2020-01-01T10:00:00.000Z",
          }),
        ]),
      ],
    });
    renderRoute(<PlansPage />);

    expect(
      screen.getByRole("heading", { name: "Nothing upcoming" }),
    ).toBeInTheDocument();
  });

  it("says 'nothing planned' when there is genuinely nothing", () => {
    renderRoute(<PlansPage />);
    expect(
      screen.getByRole("heading", { name: "Nothing planned" }),
    ).toBeInTheDocument();
  });

  it("raises a clash as an alert, not as a note beside the list", () => {
    // Information the reader did not ask for and needs before acting on the
    // list underneath it.
    useItineraryStore.setState({
      plans: [
        makePlan(tomorrow, [
          makeSlot({
            id: "a",
            label: "Lunch",
            startTime: at(tomorrow, 12),
            endTime: at(tomorrow, 14),
          }),
          makeSlot({
            id: "b",
            label: "Meeting",
            startTime: at(tomorrow, 13),
            endTime: at(tomorrow, 15),
          }),
        ]),
      ],
    });

    renderRoute(<PlansPage />);

    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("puts Routines behind a named control", () => {
    seedUpcoming();
    renderRoute(<PlansPage />);

    expect(screen.getByRole("link", { name: "Routines" })).toHaveAttribute(
      "href",
      "/routines",
    );
  });
});
