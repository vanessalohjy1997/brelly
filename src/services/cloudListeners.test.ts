import { doc, onSnapshot, setDoc } from "@react-native-firebase/firestore";

import { attachCloudListeners, detachCloudListeners } from "@/services/cloudListeners";
import { getFirebaseFirestore } from "@/services/firebase";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

const UID = "test-uid";

beforeEach(() => {
  fakeFirestoreDb.reset();
  detachCloudListeners();
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
    bootstrapError: null,
  });
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, digestNotificationId: null });
  useRoutineStore.setState({ routines: [] });
  useItineraryStore.setState({ plans: [] });
});

afterEach(() => {
  detachCloudListeners();
});

describe("attachCloudListeners", () => {
  it("hydrates all three stores and flips every ready flag on the first snapshot", () => {
    attachCloudListeners(UID);

    expect(useCloudSyncStore.getState().settingsReady).toBe(true);
    expect(useCloudSyncStore.getState().routinesReady).toBe(true);
    expect(useCloudSyncStore.getState().slotsReady).toBe(true);
  });

  it("keeps the stores live as new snapshots arrive", async () => {
    attachCloudListeners(UID);

    await setDoc(doc(getFirebaseFirestore(), "users", UID, "settings", "app"), {
      themePreference: "dark",
    });

    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  it("tears down the previous uid's listeners when attaching a new one", async () => {
    attachCloudListeners(UID);
    attachCloudListeners("other-uid");

    await setDoc(doc(getFirebaseFirestore(), "users", UID, "settings", "app"), {
      themePreference: "dark",
    });

    expect(useSettingsStore.getState().themePreference).not.toBe("dark");
  });
});

describe("attachCloudListeners error handling", () => {
  it("records a listener failure in bootstrapError instead of hanging ready forever", () => {
    const mockOnSnapshot = onSnapshot as jest.Mock;
    mockOnSnapshot.mockImplementationOnce((_ref, _onNext, onError) => {
      onError(new Error("permission-denied"));
      return () => {};
    });

    attachCloudListeners(UID);

    expect(useCloudSyncStore.getState().bootstrapError).toBe(
      "We couldn't load your plans. Check your connection and try again.",
    );
    // The other two listeners still attached and reported ready normally.
    expect(useCloudSyncStore.getState().routinesReady).toBe(true);
    expect(useCloudSyncStore.getState().slotsReady).toBe(true);
  });
});

describe("detachCloudListeners", () => {
  it("stops the stores from reacting to further snapshots", async () => {
    attachCloudListeners(UID);
    detachCloudListeners();

    await setDoc(doc(getFirebaseFirestore(), "users", UID, "settings", "app"), {
      themePreference: "dark",
    });

    expect(useSettingsStore.getState().themePreference).not.toBe("dark");
  });

  it("is safe to call when nothing is attached", () => {
    expect(() => detachCloudListeners()).not.toThrow();
  });
});
