import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { shiftDays, todayKey, useItineraryStore, useToastStore } from "@brelly/core";

import { makePlan, makeSlot } from "@/test/fixtures";
import { mockNextLink } from "@/test/mockNextLink";
import { markCloudReady, renderRoute, resetAppState } from "@/test/routeHarness";
import { useDialogStore } from "@/store/dialogStore";

import HistoryPage from "./page";

jest.mock("next/link", () => mockNextLink());
jest.mock("@/hooks/useWeatherForSlot", () => ({
  useWeatherForSlot: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useUvIndex", () => ({
  useUvIndex: () => ({ data: { value: 4, updatedAt: null } }),
}));

function at(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

/** A finished day, `daysAgo` before today. */
function pastDay(daysAgo: number, label = "Lunch") {
  const date = shiftDays(todayKey(), -daysAgo);
  return makePlan(date, [
    makeSlot({
      id: `slot-${daysAgo}`,
      label,
      startTime: at(date, 9),
      endTime: at(date, 10),
    }),
  ]);
}

beforeEach(() => {
  resetAppState();
  markCloudReady();
});

describe("History", () => {
  it("says nothing is lost, rather than that nothing is here", () => {
    renderRoute(<HistoryPage />);

    expect(
      screen.getByRole("heading", { name: "Nothing here yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing you plan is ever lost/)).toBeInTheDocument();
  });

  it("lists finished stops under the day they happened", () => {
    useItineraryStore.setState({ plans: [pastDay(1), pastDay(3)] });
    renderRoute(<HistoryPage />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("drops the weather column, because there is no forecast for a past time", () => {
    useItineraryStore.setState({ plans: [pastDay(1)] });
    renderRoute(<HistoryPage />);

    expect(screen.queryByText("Checking the sky…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mute/ })).not.toBeInTheDocument();
  });

  it("asks before a prune, because this is the one delete with no undo", async () => {
    // Every other delete is reversible for as long as its toast is up, which is
    // both faster than a dialog and safer. This one removes whole days at once.
    useItineraryStore.setState({ plans: [pastDay(40), pastDay(1)] });
    renderRoute(<HistoryPage />);

    await userEvent.click(screen.getByRole("button", { name: /Clear older/ }));

    await waitFor(() =>
      expect(useDialogStore.getState().dialog).toMatchObject({
        title: "Clear old plans?",
      }),
    );
    expect(useDialogStore.getState().dialog?.message).toContain("cannot be undone");
  });

  it("deletes only the days past the cutoff", async () => {
    useItineraryStore.setState({ plans: [pastDay(40), pastDay(1)] });
    renderRoute(<HistoryPage />);

    await userEvent.click(screen.getByRole("button", { name: /Clear older/ }));
    await waitFor(() => expect(useDialogStore.getState().dialog).not.toBeNull());
    useDialogStore.getState().answer("delete");

    await waitFor(() =>
      expect(useItineraryStore.getState().plans).toHaveLength(1),
    );
    expect(useToastStore.getState().toast?.message).toBe("Cleared 1 old day");
  });

  it("changes nothing when the question is dismissed", async () => {
    useItineraryStore.setState({ plans: [pastDay(40), pastDay(1)] });
    renderRoute(<HistoryPage />);

    await userEvent.click(screen.getByRole("button", { name: /Clear older/ }));
    await waitFor(() => expect(useDialogStore.getState().dialog).not.toBeNull());
    useDialogStore.getState().answer("cancel");

    await waitFor(() =>
      expect(useItineraryStore.getState().plans).toHaveLength(2),
    );
  });

  it("says so rather than asking when there is nothing old enough", async () => {
    useItineraryStore.setState({ plans: [pastDay(1)] });
    renderRoute(<HistoryPage />);

    await userEvent.click(screen.getByRole("button", { name: /Clear older/ }));

    await waitFor(() =>
      expect(useToastStore.getState().toast?.message).toBe(
        "Nothing older than 30 days",
      ),
    );
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("offers a search once the archive is worth searching", async () => {
    useItineraryStore.setState({
      plans: [
        pastDay(1, "Lunch"),
        pastDay(2, "Kayaking"),
        pastDay(3, "Dentist"),
        pastDay(4, "Library"),
        pastDay(5, "Market"),
        pastDay(6, "Gym"),
      ],
    });
    renderRoute(<HistoryPage />);

    await userEvent.type(screen.getByRole("searchbox"), "kayak");

    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("says 'no matches' for a query that finds nothing", async () => {
    useItineraryStore.setState({
      plans: Array.from({ length: 6 }, (_, i) => pastDay(i + 1, `Thing${i}x`)),
    });
    renderRoute(<HistoryPage />);

    await userEvent.type(screen.getByRole("searchbox"), "zzzz");

    expect(screen.getByRole("heading", { name: "No matches" })).toBeInTheDocument();
  });
});
