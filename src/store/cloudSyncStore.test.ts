import { renderHook, waitFor } from "@testing-library/react-native";

import { useCloudReady, useCloudSyncStore } from "@/store/cloudSyncStore";

beforeEach(() => {
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
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

  it("drops every flag back to false via resetReady", () => {
    useCloudSyncStore.setState({
      settingsReady: true,
      routinesReady: true,
      slotsReady: true,
    });

    useCloudSyncStore.getState().resetReady();

    expect(useCloudSyncStore.getState().settingsReady).toBe(false);
    expect(useCloudSyncStore.getState().routinesReady).toBe(false);
    expect(useCloudSyncStore.getState().slotsReady).toBe(false);
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
