import { GoogleAuthProvider } from "@react-native-firebase/auth";

import {
  linkAnonymousAccount,
  mergeIntoExistingAccount,
  resumePendingMergeIfNeeded,
  snapshotLocalData,
} from "@/services/accountLinkService";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { mmkvStorage } from "@/store/mmkvStorage";
import { useRoutineStore } from "@/store/routineStore";
import { fakeAuth } from "@/test/fakeAuth";
import { fakeFirestoreDb } from "@/test/fakeFirestore";
import type { ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";

const ANON_UID = "anon-uid";
const EXISTING_UID = "existing-uid";
const PENDING_KEY = "brelly-pending-merge";

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Lunch",
    location: "Downtown",
    neaRegion: "central",
    latitude: 1.3,
    longitude: 103.8,
    startTime: "2025-06-01T12:00:00.000Z",
    endTime: "2025-06-01T13:00:00.000Z",
    ...overrides,
  };
}

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    label: "Office",
    location: "Downtown",
    latitude: 1.3,
    longitude: 103.8,
    weekdays: [1, 2, 3],
    startTime: "09:00",
    endTime: "18:00",
    startDate: "2025-01-01",
    exceptions: [],
    ...overrides,
  };
}

beforeEach(() => {
  fakeAuth.reset();
  fakeFirestoreDb.reset();
  mmkvStorage.removeItem(PENDING_KEY);
  mmkvStorage.removeItem(`brelly-migration-complete:${ANON_UID}`);
  mmkvStorage.removeItem(`brelly-migration-complete:${EXISTING_UID}`);
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
  });
  fakeAuth.setCurrentUser({ uid: ANON_UID, isAnonymous: true });
});

describe("linkAnonymousAccount", () => {
  it("links a brand-new credential onto the current (anonymous) uid", async () => {
    const credential = GoogleAuthProvider.credential("token-new");

    const result = await linkAnonymousAccount(credential);

    expect(result).toBe("linked");
    expect(fakeAuth.currentUser?.uid).toBe(ANON_UID);
    expect(fakeAuth.currentUser?.isAnonymous).toBe(false);
  });

  it("returns merge-required when the credential already belongs to an account", async () => {
    const credential = GoogleAuthProvider.credential("token-existing");
    fakeAuth.registerExistingAccount(credential, {
      uid: EXISTING_UID,
      isAnonymous: false,
      email: "existing@example.com",
    });

    const result = await linkAnonymousAccount(credential);

    expect(result).toBe("merge-required");
    expect(fakeAuth.currentUser?.uid).toBe(ANON_UID);
  });
});

describe("snapshotLocalData", () => {
  it("reports isEmpty when there are no local plans or routines", () => {
    expect(snapshotLocalData().isEmpty).toBe(true);
  });

  it("flattens slots out of plans and includes routines, excluding settings", () => {
    useItineraryStore.setState({
      plans: [{ id: "2025-06-01", date: "2025-06-01", slots: [slot()] }],
    });
    useRoutineStore.setState({ routines: [routine()] });

    const snapshot = snapshotLocalData();

    expect(snapshot.isEmpty).toBe(false);
    expect(snapshot.slots).toEqual([{ date: "2025-06-01", slot: slot() }]);
    expect(snapshot.routines).toEqual([routine()]);
  });
});

describe("mergeIntoExistingAccount", () => {
  function credentialForExistingAccount() {
    const credential = GoogleAuthProvider.credential(`token-${Math.random()}`);
    fakeAuth.registerExistingAccount(credential, {
      uid: EXISTING_UID,
      isAnonymous: false,
    });
    return credential;
  }

  it("deletes the anonymous user's slots, routines, and settings doc", async () => {
    fakeFirestoreDb.docs.set(`users/${ANON_UID}/slots/s1`, { id: "s1" });
    fakeFirestoreDb.docs.set(`users/${ANON_UID}/routines/r1`, { id: "r1" });
    fakeFirestoreDb.docs.set(`users/${ANON_UID}/settings/app`, {});
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [routine({ id: "r1" })],
    };

    await mergeIntoExistingAccount(credential, snapshot, false);

    expect(fakeFirestoreDb.docs.has(`users/${ANON_UID}/slots/s1`)).toBe(false);
    expect(fakeFirestoreDb.docs.has(`users/${ANON_UID}/routines/r1`)).toBe(
      false,
    );
    expect(fakeFirestoreDb.docs.has(`users/${ANON_UID}/settings/app`)).toBe(
      false,
    );
  });

  it("switches the session to the target account's uid", async () => {
    const credential = credentialForExistingAccount();

    await mergeIntoExistingAccount(
      credential,
      { slots: [], routines: [] },
      false,
    );

    expect(fakeAuth.currentUser?.uid).toBe(EXISTING_UID);
    expect(fakeAuth.currentUser?.isAnonymous).toBe(false);
  });

  it("marks the new uid's migration complete even when not adding local data", async () => {
    const credential = credentialForExistingAccount();

    await mergeIntoExistingAccount(
      credential,
      { slots: [], routines: [] },
      false,
    );

    expect(mmkvStorage.getItem(`brelly-migration-complete:${EXISTING_UID}`)).toBe(
      "true",
    );
  });

  it("writes local slots and routines into the target account when adding", async () => {
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [routine({ id: "r1" })],
    };

    await mergeIntoExistingAccount(credential, snapshot, true);

    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`),
    ).toMatchObject({ id: "s1", date: "2025-06-01" });
    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/routines/r1`),
    ).toMatchObject({ id: "r1" });
  });

  it("strips notification handles from a merged slot, same as every other write path that crosses a device or account boundary", async () => {
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [
        {
          date: "2025-06-01",
          slot: slot({
            id: "s1",
            notificationId: "device-a-alert",
            notificationLeadMinutes: 45,
          }),
        },
      ],
      routines: [],
    };

    await mergeIntoExistingAccount(credential, snapshot, true);

    const doc = fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`);
    expect(doc?.notificationId).toBeUndefined();
    expect(doc?.notificationLeadMinutes).toBeUndefined();
  });

  it("does not throw merging a routine built with an explicit undefined endDate", async () => {
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [],
      routines: [routine({ id: "r1", endDate: undefined })],
    };

    await expect(
      mergeIntoExistingAccount(credential, snapshot, true),
    ).resolves.toBeUndefined();
    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/routines/r1`),
    ).toEqual(routine({ id: "r1" }));
  });

  it("writes nothing into the target account when not adding", async () => {
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [],
    };

    await mergeIntoExistingAccount(credential, snapshot, false);

    expect(fakeFirestoreDb.docs.has(`users/${EXISTING_UID}/slots/s1`)).toBe(
      false,
    );
  });

  it("mints a fresh id for a slot that collides with one already in the target account, without touching the existing doc", async () => {
    fakeFirestoreDb.docs.set(`users/${EXISTING_UID}/slots/s1`, {
      id: "s1",
      label: "Already there",
    });
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1", label: "Mine" }) }],
      routines: [],
    };

    await mergeIntoExistingAccount(credential, snapshot, true);

    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`),
    ).toMatchObject({ label: "Already there" });
    const slotDocs = [...fakeFirestoreDb.docs.keys()].filter((path) =>
      path.startsWith(`users/${EXISTING_UID}/slots/`),
    );
    expect(slotDocs).toHaveLength(2);
  });

  it("attaches live listeners for the new uid, flipping cloud-ready flags", async () => {
    const credential = credentialForExistingAccount();

    await mergeIntoExistingAccount(
      credential,
      { slots: [], routines: [] },
      false,
    );

    expect(useCloudSyncStore.getState().settingsReady).toBe(true);
    expect(useCloudSyncStore.getState().routinesReady).toBe(true);
    expect(useCloudSyncStore.getState().slotsReady).toBe(true);
  });

  it("clears the pending-merge key once the write commits", async () => {
    const credential = credentialForExistingAccount();
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [],
    };

    await mergeIntoExistingAccount(credential, snapshot, true);

    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("resumePendingMergeIfNeeded", () => {
  it("does nothing when there is no pending merge", async () => {
    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("does not resume while still signed in anonymously", async () => {
    mmkvStorage.setItem(PENDING_KEY, JSON.stringify({ slots: [], routines: [] }));

    await resumePendingMergeIfNeeded();

    expect(mmkvStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  it("finishes a merge interrupted after the identity switch", async () => {
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [routine({ id: "r1" })],
    };
    mmkvStorage.setItem(PENDING_KEY, JSON.stringify(snapshot));
    fakeAuth.setCurrentUser({ uid: EXISTING_UID, isAnonymous: false });

    await resumePendingMergeIfNeeded();

    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`),
    ).toMatchObject({ id: "s1" });
    expect(mmkvStorage.getItem(`brelly-migration-complete:${EXISTING_UID}`)).toBe(
      "true",
    );
    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
