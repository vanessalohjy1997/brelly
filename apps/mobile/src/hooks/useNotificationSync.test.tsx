import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useNotificationSync } from "@/hooks/useNotificationSync";
import { runNotificationSync } from "@/services/notificationSync";
import {
  useItineraryStore,
  useSettingsStore,
  type DayPlan,
} from "@brelly/core";

jest.mock("@/services/notificationSync", () => ({
  runNotificationSync: jest.fn(),
}));

const mockRun = runNotificationSync as jest.Mock;

const PLAN: DayPlan = {
  id: "p1",
  date: "2026-07-31",
  slots: [
    {
      id: "s1",
      label: "Picnic",
      location: "East Coast Park, Singapore",
      neaRegion: "east",
      latitude: 1.3009,
      longitude: 103.9124,
      startTime: "2026-07-31T16:00:00+08:00",
      endTime: "2026-07-31T18:00:00+08:00",
    },
  ],
};

/** Drives the AppState listener the hook registers. */
function foreground() {
  const addEventListener = AppState.addEventListener as unknown as jest.Mock;
  const handler = addEventListener.mock.calls.at(-1)?.[1];
  handler?.("active");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockResolvedValue(undefined);
  useItineraryStore.setState({ plans: [PLAN] });
  useSettingsStore.setState({
    rainAlertsEnabled: true,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
    digest: { enabled: false, time: "07:30" },
    digestNotificationId: null,
  });
  jest.spyOn(AppState, "addEventListener").mockReturnValue({
    remove: jest.fn(),
  } as unknown as ReturnType<typeof AppState.addEventListener>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useNotificationSync", () => {
  it("syncs once on mount", async () => {
    await renderHook(() => useNotificationSync());

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
  });

  it("passes the current plans and settings", async () => {
    await renderHook(() => useNotificationSync());

    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        plans: [PLAN],
        settings: expect.objectContaining({ rainAlertsEnabled: true }),
      }),
    );
  });

  it("re-syncs when stops arrive after mount (Firestore hydration)", async () => {
    // The store starts empty and is filled by the cloud snapshot *after* the
    // hook mounts — the mount sync must not be the last word.
    useItineraryStore.setState({ plans: [] });
    await renderHook(() => useNotificationSync());
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    await act(async () => {
      useItineraryStore.setState({ plans: [PLAN] });
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    expect(mockRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ plans: [PLAN] }),
    );
  });

  it("does not re-sync when only an unrelated field changes", async () => {
    await renderHook(() => useNotificationSync());
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    // Same stop id and start time, different label — the forecast window is
    // unchanged, so this must not trigger another round of fetches.
    const renamed = {
      ...PLAN,
      slots: [{ ...PLAN.slots[0], label: "Beach day" }],
    };
    await act(async () => {
      useItineraryStore.setState({ plans: [renamed] });
    });

    // Wait past the debounce window; still only the mount sync.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("syncs again when the app returns to the foreground", async () => {
    await renderHook(() => useNotificationSync());
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    foreground();

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
  });

  it("ignores background transitions", async () => {
    await renderHook(() => useNotificationSync());
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    const addEventListener = AppState.addEventListener as unknown as jest.Mock;
    addEventListener.mock.calls.at(-1)?.[1]("background");

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("swallows a sync failure instead of surfacing it", async () => {
    mockRun.mockRejectedValue(new Error("offline"));

    await expect(renderHook(() => useNotificationSync())).resolves.toBeDefined();
  });

  it("unsubscribes on unmount", async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({
      remove,
    } as unknown as ReturnType<typeof AppState.addEventListener>);

    const { unmount } = await renderHook(() => useNotificationSync());
    await unmount();

    expect(remove).toHaveBeenCalled();
  });
});
