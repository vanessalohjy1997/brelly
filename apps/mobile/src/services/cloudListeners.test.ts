import { doc, onSnapshot, setDoc } from "@react-native-firebase/firestore";

import {
  attachCloudListeners,
  DEFAULT_SETTINGS,
  detachCloudListeners,
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
  useSettingsStore,
} from "@brelly/core";
import { getFirebaseFirestore } from "@/services/firebase";
import { fakeFirestoreDb } from "@brelly/core/test";

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

  it("keeps this device's notification handles across a slots snapshot", async () => {
    // The handles never reach Firestore, so the snapshot arrives without
    // them; writing it in as-is forgot every scheduled alert, and the next
    // sync queued a duplicate for each rainy stop.
    attachCloudListeners(UID);
    await setDoc(doc(getFirebaseFirestore(), "users", UID, "slots", "s1"), {
      id: "s1",
      date: "2026-07-31",
      label: "Picnic",
      location: "East Coast Park",
      neaRegion: "east",
      latitude: 1.3009,
      longitude: 103.9124,
      startTime: "2026-07-31T16:00:00+08:00",
      endTime: "2026-07-31T18:00:00+08:00",
    });
    useItineraryStore.setState((state) => ({
      plans: state.plans.map((plan) => ({
        ...plan,
        slots: plan.slots.map((slot) => ({
          ...slot,
          notificationId: "notif-1",
          notificationLeadMinutes: 45,
        })),
      })),
    }));

    await setDoc(
      doc(getFirebaseFirestore(), "users", UID, "slots", "s1"),
      { label: "Picnic at the beach" },
      { merge: true },
    );

    const slot = useItineraryStore.getState().plans[0].slots[0];
    expect(slot.label).toBe("Picnic at the beach");
    expect(slot.notificationId).toBe("notif-1");
    expect(slot.notificationLeadMinutes).toBe(45);
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
