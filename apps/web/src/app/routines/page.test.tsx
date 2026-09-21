import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  shiftDays,
  todayKey,
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";
import { mockNextLink } from "@/test/mockNextLink";
import { markCloudReady, renderRoute, resetAppState } from "@/test/routeHarness";

import RoutinesPage from "./page";

jest.mock("next/link", () => mockNextLink());

const tomorrow = shiftDays(todayKey(), 1);

function at(day: string, hour: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

beforeEach(() => {
  resetAppState();
  markCloudReady();
});

describe("RoutinesPage", () => {
  it("waits rather than saying there are none", () => {
    // The cold-boot store is genuinely empty until the first snapshot lands, so
    // the empty state here would be wrong about every routine.
    useCloudSyncStore.setState({ routinesReady: false });
    renderRoute(<RoutinesPage />);

    expect(screen.getByText("Loading your routines…")).toBeInTheDocument();
  });

  it("offers a way out of a bootstrap that failed outright", () => {
    useCloudSyncStore.setState({
      routinesReady: false,
      bootstrapError: "Couldn't reach your plans",
    });
    renderRoute(<RoutinesPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't reach your plans",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says where routines come from when there are none", () => {
    renderRoute(<RoutinesPage />);

    expect(screen.getByText("No routines")).toBeInTheDocument();
    expect(
      screen.getByText("Add a repeating plan and it will appear here."),
    ).toBeInTheDocument();
  });

  it("reads each rule back in words", () => {
    useRoutineStore.setState({
      routines: [makeRoutine({ weekdays: [1, 2, 3, 4, 5] })],
    });
    renderRoute(<RoutinesPage />);

    expect(screen.getByText("Morning run")).toBeInTheDocument();
    expect(screen.getByText("East Coast Park, Singapore")).toBeInTheDocument();
    expect(screen.getByText("Repeats Mon–Fri")).toBeInTheDocument();
    expect(screen.getByText("07:00 – 08:00")).toBeInTheDocument();
  });

  it("says a rule is indoor and muted, with no stray separator", () => {
    // The phone's version built this line out of conditional fragments and
    // rendered a leading "·" for an indoor routine whose alerts were still on.
    useRoutineStore.setState({
      routines: [makeRoutine({ kind: "indoor", notificationsMuted: true })],
    });
    renderRoute(<RoutinesPage />);

    expect(
      screen.getByText("07:00 – 08:00 · Indoor · Alerts off"),
    ).toBeInTheDocument();
  });

  it("says nothing extra for an ordinary outdoor rule", () => {
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<RoutinesPage />);

    expect(screen.getByText("07:00 – 08:00")).toBeInTheDocument();
  });

  it("counts the days a rule has been told to skip", () => {
    useRoutineStore.setState({
      routines: [makeRoutine({ exceptions: ["2026-09-16", "2026-09-18"] })],
    });
    renderRoute(<RoutinesPage />);

    expect(screen.getByText("2 skipped")).toBeInTheDocument();
  });

  it("says nothing about exceptions when a rule has none", () => {
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<RoutinesPage />);

    expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
  });

  it("names the page, because a URL has to say what it is", () => {
    renderRoute(<RoutinesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Routines" }),
    ).toBeInTheDocument();
  });

  it("links each rule to its next stop, which is where it is edited from", () => {
    // "This day or the rule?" needs a date in hand, so the rule's row goes to
    // the stop rather than to a form of its own.
    useRoutineStore.setState({ routines: [makeRoutine()] });
    useItineraryStore.setState({
      plans: [
        makePlan(tomorrow, [
          makeSlot({
            id: "next-run",
            routineId: "routine-1",
            startTime: at(tomorrow, 7),
            endTime: at(tomorrow, 8),
          }),
        ]),
      ],
    });
    renderRoute(<RoutinesPage />);

    expect(screen.getByRole("link", { name: "Morning run" })).toHaveAttribute(
      "href",
      "/plan/next-run",
    );
  });

  it("leaves the title as text until the rule has a stop to go to", () => {
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<RoutinesPage />);

    expect(screen.queryByRole("link", { name: "Morning run" })).not.toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
  });

  it("deletes a rule with an undo rather than a confirmation", async () => {
    // The one delete here has no day to name, so it can only mean the whole
    // series; the undo is what makes offering it safe.
    useRoutineStore.setState({ routines: [makeRoutine()] });
    renderRoute(<RoutinesPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Morning run and its repeats" }),
    );

    expect(useRoutineStore.getState().routines).toHaveLength(0);
    expect(screen.getByText("No routines")).toBeInTheDocument();
    expect(useToastStore.getState().toast?.action?.label).toBe("Undo");
  });

  it("says nothing about a rule with no days at all", () => {
    // `describeRoutine` returns null there, and rendering an empty row would be
    // worse than rendering nothing.
    useRoutineStore.setState({ routines: [makeRoutine({ weekdays: [] })] });
    renderRoute(<RoutinesPage />);

    expect(screen.queryByText(/^Repeats/)).not.toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
  });
});
