import { renderHook, waitFor } from "@testing-library/react-native";

import { retryCloudBootstrap, useCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { ensureAnonymousUser, getFirebaseAuth } from "@/services/firebase";
import { subscribeToSlotsCollection } from "@/services/itinerarySync";
import {
  confirmLocalDataMigration,
  enqueueLocalDataMigration,
} from "@/services/localDataMigration";
import { subscribeToRoutinesCollection } from "@/services/routinesSync";
import { subscribeToSettingsDoc } from "@/services/settingsSync";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";

jest.mock("@/services/firebase", () => ({
  ensureAnonymousUser: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));
jest.mock("@/services/localDataMigration", () => ({
  enqueueLocalDataMigration: jest.fn(),
  confirmLocalDataMigration: jest.fn(),
}));
jest.mock("@/services/settingsSync", () => ({
  subscribeToSettingsDoc: jest.fn(),
}));
jest.mock("@/services/routinesSync", () => ({
  subscribeToRoutinesCollection: jest.fn(),
}));
jest.mock("@/services/itinerarySync", () => ({
  subscribeToSlotsCollection: jest.fn(),
}));

const mockEnsure = ensureAnonymousUser as jest.Mock;
const mockGetAuth = getFirebaseAuth as jest.Mock;
const mockEnqueue = enqueueLocalDataMigration as jest.Mock;
const mockConfirm = confirmLocalDataMigration as jest.Mock;
const mockSubscribeSettings = subscribeToSettingsDoc as jest.Mock;
const mockSubscribeRoutines = subscribeToRoutinesCollection as jest.Mock;
const mockSubscribeSlots = subscribeToSlotsCollection as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
    bootstrapError: null,
  });
  useSettingsStore.setState({
    ...DEFAULT_SETTINGS,
    digestNotificationId: null,
  });
  useRoutineStore.setState({ routines: [] });
  useItineraryStore.setState({ plans: [] });
  mockEnsure.mockResolvedValue(undefined);
  mockGetAuth.mockReturnValue({ currentUser: { uid: "test-uid" } });
  mockEnqueue.mockReturnValue(null);
  mockSubscribeSettings.mockReturnValue(jest.fn());
  mockSubscribeRoutines.mockReturnValue(jest.fn());
  mockSubscribeSlots.mockReturnValue(jest.fn());
});

describe("useCloudBootstrap", () => {
  it("starts not ready", async () => {
    const { result } = await renderHook(() => useCloudBootstrap());

    expect(result.current).toBe(false);
  });

  it("signs in anonymously and subscribes to the settings doc, the routines collection, and the slots collection once a uid exists", async () => {
    await renderHook(() => useCloudBootstrap());

    await waitFor(() =>
      expect(mockSubscribeSettings).toHaveBeenCalledWith(
        "test-uid",
        expect.any(Function),
        expect.any(Function),
      ),
    );
    expect(mockSubscribeRoutines).toHaveBeenCalledWith(
      "test-uid",
      expect.any(Function),
      expect.any(Function),
    );
    expect(mockSubscribeSlots).toHaveBeenCalledWith(
      "test-uid",
      expect.any(Function),
      expect.any(Function),
    );
    expect(mockEnsure).toHaveBeenCalledTimes(1);
  });

  it("hydrates the settings store on its first snapshot", async () => {
    await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockSubscribeSettings).toHaveBeenCalled());
    const onData = mockSubscribeSettings.mock.calls[0][1];
    onData({ themePreference: "dark" });

    await waitFor(() =>
      expect(useSettingsStore.getState().themePreference).toBe("dark"),
    );
  });

  it("hydrates the routine store on its first snapshot", async () => {
    await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockSubscribeRoutines).toHaveBeenCalled());
    const onData = mockSubscribeRoutines.mock.calls[0][1];
    const routines = [{ id: "r1", label: "Office" }];
    onData(routines);

    await waitFor(() =>
      expect(useRoutineStore.getState().routines).toEqual(routines),
    );
  });

  it("hydrates the itinerary store on its first snapshot", async () => {
    await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockSubscribeSlots).toHaveBeenCalled());
    const onData = mockSubscribeSlots.mock.calls[0][1];
    const plans = [{ id: "2026-07-31", date: "2026-07-31", slots: [] }];
    onData(plans);

    await waitFor(() =>
      expect(useItineraryStore.getState().plans).toEqual(plans),
    );
  });

  it("only flips ready once settings, routines, and slots have all reported", async () => {
    const { result } = await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockSubscribeSettings).toHaveBeenCalled());
    mockSubscribeSettings.mock.calls[0][1]({ themePreference: "dark" });

    expect(result.current).toBe(false);

    mockSubscribeRoutines.mock.calls[0][1]([]);

    expect(result.current).toBe(false);

    mockSubscribeSlots.mock.calls[0][1]([]);

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("confirms the migration when a commit was enqueued", async () => {
    const commit = Promise.resolve();
    mockEnqueue.mockReturnValue(commit);

    await renderHook(() => useCloudBootstrap());

    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith("test-uid", commit),
    );
  });

  it("does not confirm when there was nothing to migrate", async () => {
    await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockSubscribeSettings).toHaveBeenCalled());
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("does not throw, stays not ready, and records a friendly error when sign-in fails", async () => {
    mockEnsure.mockRejectedValue(new Error("auth/unknown"));

    const { result } = await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockEnsure).toHaveBeenCalled());
    expect(result.current).toBe(false);
    await waitFor(() =>
      expect(useCloudSyncStore.getState().bootstrapError).toBe(
        "We couldn't load your plans. Check your connection and try again.",
      ),
    );
  });

  it("does not touch bootstrapError for a sign-in that resolves after unmount", async () => {
    let resolveEnsure: () => void = () => {};
    mockEnsure.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveEnsure = resolve;
      }),
    );

    const { unmount } = await renderHook(() => useCloudBootstrap());
    await unmount();
    resolveEnsure();

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockSubscribeSettings).not.toHaveBeenCalled();
    expect(useCloudSyncStore.getState().bootstrapError).toBe(null);
  });

  describe("retryCloudBootstrap", () => {
    it("clears a previous error and re-runs sign-in and listener attachment", async () => {
      mockEnsure.mockRejectedValueOnce(new Error("auth/unknown"));

      await renderHook(() => useCloudBootstrap());

      await waitFor(() =>
        expect(useCloudSyncStore.getState().bootstrapError).toBe(
          "We couldn't load your plans. Check your connection and try again.",
        ),
      );

      mockEnsure.mockResolvedValueOnce(undefined);
      retryCloudBootstrap();

      await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(useCloudSyncStore.getState().bootstrapError).toBe(null),
      );
      expect(mockSubscribeSettings).toHaveBeenCalledWith(
        "test-uid",
        expect.any(Function),
        expect.any(Function),
      );
    });
  });

  it("does nothing further when sign-in resolves without a uid", async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(mockEnsure).toHaveBeenCalled());
    expect(mockSubscribeSettings).not.toHaveBeenCalled();
    expect(mockSubscribeRoutines).not.toHaveBeenCalled();
    expect(mockSubscribeSlots).not.toHaveBeenCalled();
  });
});
