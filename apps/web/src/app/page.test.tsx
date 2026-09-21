import { screen, waitFor, within } from "@testing-library/react";

import { useCloudSyncStore, useItineraryStore } from "@brelly/core";

import { makePlan, makeSlot } from "@/test/fixtures";
import { mockNextLink } from "@/test/mockNextLink";
import {
  markCloudReady,
  renderRoute,
  resetAppState,
} from "@/test/routeHarness";
import { useDeviceLocationStore } from "@/store/deviceLocationStore";

import TodayPage from "./page";

jest.mock("next/link", () => mockNextLink());

let authUser: { isAnonymous: boolean } | null = null;
jest.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => authUser,
}));

// The weather layer is exercised by its own hooks' tests; here it is held
// still so the page's four-way branch is what is under test.
jest.mock("@/hooks/useWeatherForSlot", () => ({
  useWeatherForSlot: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useUvIndex", () => ({
  useUvIndex: () => ({ data: { value: 4, updatedAt: null } }),
}));
jest.mock("@/hooks/useLiveConditions", () => ({
  useLiveConditions: () => ({ data: null }),
}));
const nearby = {
  isAvailable: false,
  isLoading: false,
  permission: "unprompted",
  requestPermission: jest.fn(),
  forecasts: [] as unknown[],
  region: null,
  coords: null,
};
jest.mock("@/hooks/useNearbyForecast", () => ({
  useNearbyForecast: () => nearby,
}));

/** Today, at a time the fixture stops are still ahead of. */
function todayAt(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function todayDateKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  resetAppState();
  authUser = null;
  nearby.isAvailable = false;
  nearby.permission = "unprompted";
  nearby.forecasts = [];
});

describe("Today", () => {
  it("shows a skeleton until the first snapshot lands", () => {
    // Gated on readiness rather than on the network: without it the page would
    // flash an empty state at someone who has plans, every single load.
    renderRoute(<TodayPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your plans…");
  });

  it("offers a way out when the bootstrap failed", () => {
    useCloudSyncStore.setState({ bootstrapError: "We couldn't load your plans." });
    renderRoute(<TodayPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your plans.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("asks for location before using it, in the empty state", () => {
    markCloudReady();
    renderRoute(<TodayPage />);

    expect(
      screen.getByRole("heading", { name: "Weather where you are" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No plans yet" })).toBeInTheDocument();
  });

  it("tells a finished day apart from an empty one", () => {
    // A day whose stops have all happened is a different situation from a day
    // with none, and saying so is what stops the archive looking like data loss.
    markCloudReady();
    useItineraryStore.setState({
      plans: [
        makePlan(todayDateKey(), [
          makeSlot({ startTime: todayAt(1), endTime: todayAt(2) }),
        ]),
      ],
    });

    renderRoute(<TodayPage />);

    expect(
      screen.getByRole("heading", { name: "Nothing left today" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You'll find them in History/)).toBeInTheDocument();
  });

  it("lists today's remaining stops in start order", () => {
    // A day is read as a timeline. The drag-to-reorder this replaces produced
    // an order that contradicted the clock and the Plans page both.
    markCloudReady();
    useItineraryStore.setState({
      plans: [
        makePlan(todayDateKey(), [
          makeSlot({
            id: "late",
            label: "Dinner",
            startTime: todayAt(22),
            endTime: todayAt(23),
          }),
          makeSlot({
            id: "early",
            label: "Lunch",
            startTime: todayAt(20),
            endTime: todayAt(21),
          }),
        ]),
      ],
    });

    renderRoute(<TodayPage />);

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("link", { name: "Lunch" })).toBeInTheDocument();
    expect(within(items[1]).getByRole("link", { name: "Dinner" })).toBeInTheDocument();
  });

  it("marks exactly one stop as the one to head for", () => {
    // An answer to "where am I supposed to be" given on every row is not an
    // answer.
    markCloudReady();
    useItineraryStore.setState({
      plans: [
        makePlan(todayDateKey(), [
          makeSlot({ id: "a", label: "Lunch", startTime: todayAt(20), endTime: todayAt(21) }),
          makeSlot({ id: "b", label: "Dinner", startTime: todayAt(22), endTime: todayAt(23) }),
        ]),
      ],
    });

    renderRoute(<TodayPage />);

    const emphasised = screen
      .getAllByRole("article")
      .filter((card) => card.className.includes("border-primary"));
    expect(emphasised).toHaveLength(1);
  });

  it("keeps offering location even with plans, because 'Right now' means here", () => {
    // The live card must not borrow a stop's coordinates and label them as
    // here — the stop's own forecast is already on its card.
    markCloudReady();
    useItineraryStore.setState({
      plans: [
        makePlan(todayDateKey(), [
          makeSlot({ startTime: todayAt(20), endTime: todayAt(21) }),
        ]),
      ],
    });

    renderRoute(<TodayPage />);

    expect(
      screen.getByRole("heading", { name: "Weather where you are" }),
    ).toBeInTheDocument();
  });

  it("asks for the location only when the control is pressed", async () => {
    markCloudReady();
    const request = jest.fn(async () => {});
    useDeviceLocationStore.setState({ request });

    renderRoute(<TodayPage />);
    screen.getByRole("button", { name: "Turn on location" }).click();

    await waitFor(() => expect(request).toHaveBeenCalled());
  });

  it("shows neither an onboarding primer nor an update banner", () => {
    // Both are deliberate absences. The primer's second step asks for
    // notifications and its completion writes `hasSeenOnboarding` — a *cloud*
    // flag that suppresses the phone's own location primer, which is the copy
    // App Review litigated. The banner goes with OTA, which a browser has no
    // equivalent of: it reloads.
    markCloudReady();
    renderRoute(<TodayPage />);

    expect(screen.queryByText(/notification/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/update/i)).not.toBeInTheDocument();
  });

  it("offers Mute only once a phone can honour it", () => {
    // The web sends no alerts, so under an anonymous session the control
    // would toggle nothing.
    markCloudReady();
    useItineraryStore.setState({
      plans: [
        makePlan(todayDateKey(), [
          makeSlot({ startTime: todayAt(22), endTime: todayAt(23) }),
        ]),
      ],
    });
    const { unmount } = renderRoute(<TodayPage />);
    expect(screen.queryByRole("button", { name: /^Mute/ })).not.toBeInTheDocument();
    unmount();

    authUser = { isAnonymous: false };
    renderRoute(<TodayPage />);
    expect(screen.getByRole("button", { name: /^Mute/ })).toBeInTheDocument();
  });

  it("keeps Refresh as an icon with a name, a step below Add", () => {
    markCloudReady();
    renderRoute(<TodayPage />);

    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh).toHaveAttribute("aria-label", "Refresh");
    // The name is the label, not a visible word beside the glyph.
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
  });
});
