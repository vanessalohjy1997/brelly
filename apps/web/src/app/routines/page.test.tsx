import { screen } from "@testing-library/react";

import { useCloudSyncStore, useRoutineStore } from "@brelly/core";

import { makeRoutine } from "@/test/fixtures";
import { markCloudReady, renderRoute, resetAppState } from "@/test/routeHarness";

import RoutinesPage from "./page";

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

  it("says nothing about a rule with no days at all", () => {
    // `describeRoutine` returns null there, and rendering an empty row would be
    // worse than rendering nothing.
    useRoutineStore.setState({ routines: [makeRoutine({ weekdays: [] })] });
    renderRoute(<RoutinesPage />);

    expect(screen.queryByText(/^Repeats/)).not.toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
  });
});
