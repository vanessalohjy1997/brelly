import { renderHook, waitFor } from "@testing-library/react-native";

import {
  describeCloudSyncError,
  useCloudBootstrapError,
  useCloudReady,
  useCloudSyncStore,
} from "@/store/cloudSyncStore";

beforeEach(() => {
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
    bootstrapError: null,
  });
});

describe("useCloudSyncStore", () => {
  it("starts not ready", () => {
    expect(useCloudSyncStore.getState().settingsReady).toBe(false);
    expect(useCloudSyncStore.getState().routinesReady).toBe(false);
    expect(useCloudSyncStore.getState().slotsReady).toBe(false);
  });

  it("flips ready via setSettingsReady", () => {
    useCloudSyncStore.getState().setSettingsReady(true);

    expect(useCloudSyncStore.getState().settingsReady).toBe(true);
  });

  it("flips ready via setRoutinesReady", () => {
    useCloudSyncStore.getState().setRoutinesReady(true);

    expect(useCloudSyncStore.getState().routinesReady).toBe(true);
  });

  it("flips ready via setSlotsReady", () => {
    useCloudSyncStore.getState().setSlotsReady(true);

    expect(useCloudSyncStore.getState().slotsReady).toBe(true);
  });

  it("flips bootstrapError via setBootstrapError", () => {
    useCloudSyncStore.getState().setBootstrapError("offline");

    expect(useCloudSyncStore.getState().bootstrapError).toBe("offline");
  });

  it("drops every flag and the error back to false/null via resetReady", () => {
    useCloudSyncStore.setState({
      settingsReady: true,
      routinesReady: true,
      slotsReady: true,
      bootstrapError: "offline",
    });

    useCloudSyncStore.getState().resetReady();

    expect(useCloudSyncStore.getState().settingsReady).toBe(false);
    expect(useCloudSyncStore.getState().routinesReady).toBe(false);
    expect(useCloudSyncStore.getState().slotsReady).toBe(false);
    expect(useCloudSyncStore.getState().bootstrapError).toBe(null);
  });
});

describe("useCloudBootstrapError", () => {
  it("is null until setBootstrapError is called", async () => {
    const { result } = await renderHook(() => useCloudBootstrapError());

    expect(result.current).toBe(null);

    useCloudSyncStore.getState().setBootstrapError("offline");
    await waitFor(() => expect(result.current).toBe("offline"));
  });
});

describe("describeCloudSyncError", () => {
  it("returns a friendly message rather than a raw Firebase error code", () => {
    expect(describeCloudSyncError()).toBe(
      "We couldn't load your plans. Check your connection and try again.",
    );
  });
});

describe("useCloudReady", () => {
  it("is false until every store has reported ready", async () => {
    const { result } = await renderHook(() => useCloudReady());

    expect(result.current).toBe(false);

    useCloudSyncStore.getState().setSettingsReady(true);
    expect(result.current).toBe(false);

    useCloudSyncStore.getState().setRoutinesReady(true);
    expect(result.current).toBe(false);

    useCloudSyncStore.getState().setSlotsReady(true);
    await waitFor(() => expect(result.current).toBe(true));
  });
});
