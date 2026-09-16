import { act, renderHook, waitFor } from "@testing-library/react";

import { useCloudSyncStore } from "@brelly/core";
import { useLocalCacheStore } from "@/store/localCacheStore";

import {
  describeSilentBootstrap,
  retryCloudBootstrap,
  useCloudBootstrap,
} from "./useCloudBootstrap";

const ensureAnonymousUser = jest.fn<Promise<void>, []>(async () => {});
const currentUser: { uid: string } | null = { uid: "anon-1" };
let user: { uid: string } | null = currentUser;

jest.mock("@/services/firebase", () => ({
  ensureAnonymousUser: () => ensureAnonymousUser(),
  getFirebaseAuth: () => ({ currentUser: user }),
}));

const attachCloudListeners = jest.fn();
const detachCloudListeners = jest.fn();
const resumePendingMergeIfNeeded = jest.fn<Promise<void>, []>(async () => {});

jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  attachCloudListeners: (...args: unknown[]) => attachCloudListeners(...args),
  detachCloudListeners: () => detachCloudListeners(),
  resumePendingMergeIfNeeded: () => resumePendingMergeIfNeeded(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  user = currentUser;
  ensureAnonymousUser.mockResolvedValue(undefined);
  resumePendingMergeIfNeeded.mockResolvedValue(undefined);
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
    bootstrapError: null,
  });
  useLocalCacheStore.setState({ mode: "persistent", reason: null });
});

describe("useCloudBootstrap", () => {
  it("signs in and attaches the listeners for that uid", async () => {
    renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(attachCloudListeners).toHaveBeenCalledWith("anon-1"));
    expect(ensureAnonymousUser).toHaveBeenCalled();
  });

  it("resumes an interrupted merge, and survives one that fails again", async () => {
    // A browser tab gets closed mid-flow far more casually than an app gets
    // killed, so this path matters more here than on the phone. A failure is
    // left for the next load: the record is still in storage.
    resumePendingMergeIfNeeded.mockRejectedValueOnce(new Error("offline"));
    renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(resumePendingMergeIfNeeded).toHaveBeenCalled());
    await waitFor(() =>
      expect(useCloudSyncStore.getState().bootstrapError).toBeNull(),
    );
  });

  it("surfaces a sign-in failure instead of spinning", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    ensureAnonymousUser.mockRejectedValueOnce(new Error("auth/disabled"));

    renderHook(() => useCloudBootstrap());

    await waitFor(() =>
      expect(useCloudSyncStore.getState().bootstrapError).toMatch(
        /couldn't load your plans/i,
      ),
    );
    consoleError.mockRestore();
  });

  it("detaches the listeners on unmount", async () => {
    const { unmount } = renderHook(() => useCloudBootstrap());
    await waitFor(() => expect(attachCloudListeners).toHaveBeenCalled());

    unmount();

    expect(detachCloudListeners).toHaveBeenCalled();
  });

  it("does nothing when sign-in resolves no uid", async () => {
    user = null;
    renderHook(() => useCloudBootstrap());

    await waitFor(() => expect(ensureAnonymousUser).toHaveBeenCalled());
    expect(attachCloudListeners).not.toHaveBeenCalled();
  });
});

describe("the silent-hang guard", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("says something when no snapshot ever arrives", () => {
    // The failure that has no mobile counterpart. `@react-native-firebase`
    // persists its cache, so an offline phone still gets a first delivery from
    // it. A web client on a memory cache has nothing to deliver from: three
    // listeners attach, none ever calls back, and there is no rejection for
    // anything to catch.
    renderHook(() => useCloudBootstrap());

    act(() => jest.advanceTimersByTime(8000));

    expect(useCloudSyncStore.getState().bootstrapError).not.toBeNull();
  });

  it("stays quiet once anything has landed", () => {
    renderHook(() => useCloudBootstrap());
    act(() => useCloudSyncStore.getState().setSlotsReady(true));

    act(() => jest.advanceTimersByTime(8000));

    expect(useCloudSyncStore.getState().bootstrapError).toBeNull();
  });

  it("leaves a better explanation alone", () => {
    // A rules rejection has already said something specific; replacing it with
    // "check your connection" would send the user to fix the wrong thing.
    renderHook(() => useCloudBootstrap());
    act(() =>
      useCloudSyncStore.getState().setBootstrapError("Permission denied"),
    );

    act(() => jest.advanceTimersByTime(8000));

    expect(useCloudSyncStore.getState().bootstrapError).toBe("Permission denied");
  });
});

describe("describeSilentBootstrap", () => {
  it("says that nothing is stored locally when the cache fell back to memory", () => {
    expect(describeSilentBootstrap(true)).toMatch(/isn't storing a copy/i);
  });

  it("gives the ordinary connection message otherwise", () => {
    expect(describeSilentBootstrap(false)).toMatch(/check your connection/i);
  });
});

describe("retryCloudBootstrap", () => {
  it("clears the error and tries again", async () => {
    useCloudSyncStore.getState().setBootstrapError("Something went wrong");

    retryCloudBootstrap();

    expect(useCloudSyncStore.getState().bootstrapError).toBeNull();
    await waitFor(() => expect(attachCloudListeners).toHaveBeenCalledWith("anon-1"));
  });
});
