import {
  EmailAuthProvider,
  GoogleAuthProvider,
} from "@react-native-firebase/auth";
import * as Notifications from "expo-notifications";

import {
  DEFAULT_SETTINGS,
  mergeIntoExistingAccount,
  readAnonymousData,
  resumePendingMergeIfNeeded,
  signOutOfAccount,
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
  useSettingsStore,
  type ItinerarySlot,
  type Routine,
} from "@brelly/core";
import { mmkvStorage } from "@/store/mmkvStorage";
import { fakeAuth } from "@/test/fakeAuth";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

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

function seedCloudSlot(value: ItinerarySlot, date: string): void {
  fakeFirestoreDb.docs.set(`users/${ANON_UID}/slots/${value.id}`, {
    ...value,
    date,
  });
}

function seedCloudRoutine(value: Routine): void {
  fakeFirestoreDb.docs.set(`users/${ANON_UID}/routines/${value.id}`, {
    ...value,
  });
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

// `linkAnonymousAccount` used to live here. It is `linkProvider` in
// `@brelly/platform/auth` now, and so are its tests — acquiring a credential
// and linking it cannot be two steps on the web, and the error codes that
// separate "this identity already has an account" from a real failure belong
// to the SDK rather than to core.

describe("readAnonymousData", () => {
  it("reports isEmpty when the account holds nothing", async () => {
    await expect(readAnonymousData().then((d) => d.isEmpty)).resolves.toBe(true);
  });

  it("reads the account's own documents, not the local mirror of them", async () => {
    // The distinction this whole function exists for. The stores are
    // populated by `onSnapshot` after boot; a session that starts a merge
    // before they hydrate has empty stores and a full account, and this value
    // decides what gets deleted.
    useItineraryStore.setState({ plans: [] });
    useRoutineStore.setState({ routines: [] });
    seedCloudSlot(slot({ id: "s1" }), "2025-06-01");
    seedCloudRoutine(routine({ id: "r1" }));

    const cloud = await readAnonymousData();

    expect(cloud.isEmpty).toBe(false);
    expect(cloud.slots).toEqual([{ date: "2025-06-01", slot: slot({ id: "s1" }) }]);
    expect(cloud.routines).toEqual([routine({ id: "r1" })]);
  });

  it("takes each document's id from the document, not from its body", async () => {
    // An id written into the body and an id in the path can disagree after a
    // collision-minted rename; the path is the one Firestore will honour on
    // the delete.
    fakeFirestoreDb.docs.set(`users/${ANON_UID}/slots/real-id`, {
      ...slot({ id: "stale-id" }),
      date: "2025-06-01",
    });

    const cloud = await readAnonymousData();

    expect(cloud.slots[0].slot.id).toBe("real-id");
  });

  it("refuses to answer when there is no signed-in user to read as", async () => {
    fakeAuth.setCurrentUser(null);

    await expect(readAnonymousData()).rejects.toThrow(
      "No anonymous user to merge from",
    );
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
  it("puts the anonymous user's data back when the wrong password fails the identity switch", async () => {
    // Only the email flow can get this far with a bad secret — Google and
    // Apple prove theirs in their own sheet. Without the restore, a typo'd
    // password deletes the anonymous account's cloud documents and leaves
    // the session anonymous with nothing to switch to.
    const credential = EmailAuthProvider.credential(
      "person@example.com",
      "correct-password",
    );
    fakeAuth.registerExistingAccount(credential, {
      uid: EXISTING_UID,
      isAnonymous: false,
      email: "person@example.com",
    });
    fakeFirestoreDb.docs.set(`users/${ANON_UID}/slots/s1`, { id: "s1" });
    const wrong = EmailAuthProvider.credential(
      "person@example.com",
      "wrong-password",
    );
    const snapshot = {
      slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
      routines: [routine({ id: "r1" })],
    };

    await expect(
      mergeIntoExistingAccount(wrong, snapshot, true),
    ).rejects.toMatchObject({ code: "auth/wrong-password" });

    expect(fakeAuth.currentUser?.uid).toBe(ANON_UID);
    expect(fakeAuth.currentUser?.isAnonymous).toBe(true);
    expect(
      fakeFirestoreDb.docs.get(`users/${ANON_UID}/slots/s1`),
    ).toMatchObject({ id: "s1", date: "2025-06-01" });
    expect(
      fakeFirestoreDb.docs.get(`users/${ANON_UID}/routines/r1`),
    ).toMatchObject({ id: "r1" });
    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("restores every document by id after a failed switch, across batch boundaries", async () => {
    // The scenario the whole delete-then-switch order has to survive, at a
    // size that crosses more than one `writeBatch`: a full account, an empty
    // local mirror, an email merge, a wrong password. Asserted on ids rather
    // than counts, because an id-minting regression keeps the count right.
    const credential = EmailAuthProvider.credential(
      "person@example.com",
      "correct-password",
    );
    fakeAuth.registerExistingAccount(credential, {
      uid: EXISTING_UID,
      isAnonymous: false,
      email: "person@example.com",
    });
    const ids = Array.from({ length: 40 }, (_, i) => `s${i}`);
    for (const id of ids) {
      seedCloudSlot(slot({ id }), "2025-06-01");
    }
    useItineraryStore.setState({ plans: [] });

    const cloud = await readAnonymousData();
    expect(cloud.slots).toHaveLength(40);

    const wrong = EmailAuthProvider.credential(
      "person@example.com",
      "wrong-password",
    );

    await expect(
      mergeIntoExistingAccount(wrong, cloud, true),
    ).rejects.toMatchObject({ code: "auth/wrong-password" });

    expect(fakeAuth.currentUser?.uid).toBe(ANON_UID);
    for (const id of ids) {
      expect(
        fakeFirestoreDb.docs.get(`users/${ANON_UID}/slots/${id}`),
      ).toMatchObject({ id, date: "2025-06-01" });
    }
    expect(
      Object.keys(Object.fromEntries(fakeFirestoreDb.docs)).filter((k) =>
        k.startsWith(`users/${EXISTING_UID}/`),
      ),
    ).toEqual([]);
  });

  it("records the pending merge even in the don't-add branch", async () => {
    // The branch that used to run the delete with no crash record at all: the
    // record was written only when the user chose to add their data. The
    // `catch` around the sign-in covers a *rejected* sign-in; nothing covers
    // the process ending, and a browser tab is closed mid-flow all the time.
    const credential = credentialForExistingAccount();
    seedCloudSlot(slot({ id: "s1" }), "2025-06-01");
    const cloud = await readAnonymousData();
    const setItem = jest.spyOn(mmkvStorage, "setItem");

    await mergeIntoExistingAccount(credential, cloud, false);

    const written = setItem.mock.calls.find(([key]) => key === PENDING_KEY);
    expect(written).toBeDefined();
    expect(JSON.parse(written![1])).toMatchObject({
      anonUid: ANON_UID,
      addLocalData: false,
    });
    setItem.mockRestore();
  });

  it("refuses to start when the pending record cannot be stored", async () => {
    // `localStorage.setItem` throws `QuotaExceededError` in Safari's private
    // mode. A delete with no record is precisely what the record exists to
    // prevent, so the only safe answer is not to begin.
    const credential = credentialForExistingAccount();
    seedCloudSlot(slot({ id: "s1" }), "2025-06-01");
    const cloud = await readAnonymousData();
    const setItem = jest
      .spyOn(mmkvStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    await expect(
      mergeIntoExistingAccount(credential, cloud, true),
    ).rejects.toThrow("QuotaExceededError");
    setItem.mockRestore();

    expect(
      fakeFirestoreDb.docs.get(`users/${ANON_UID}/slots/s1`),
    ).toBeDefined();
    expect(fakeAuth.currentUser?.uid).toBe(ANON_UID);
  });
});

describe("signOutOfAccount", () => {
  beforeEach(() => {
    fakeAuth.setCurrentUser({
      uid: "linked-uid",
      isAnonymous: false,
      email: "person@example.com",
    });
  });

  it("lands on a fresh anonymous session rather than no session at all", async () => {
    await signOutOfAccount();

    expect(fakeAuth.currentUser).not.toBeNull();
    expect(fakeAuth.currentUser?.isAnonymous).toBe(true);
    expect(fakeAuth.currentUser?.uid).not.toBe("linked-uid");
  });

  it("empties the local stores, so the account's data does not sit on the device", async () => {
    useItineraryStore.setState({
      plans: [{ id: "p1", date: "2025-06-01", slots: [slot()] }],
    });
    useRoutineStore.setState({ routines: [routine()] });

    await signOutOfAccount();

    expect(useItineraryStore.getState().plans).toEqual([]);
    expect(useRoutineStore.getState().routines).toEqual([]);
    expect(useSettingsStore.getState().themePreference).toBe(
      DEFAULT_SETTINGS.themePreference,
    );
  });

  it("leaves the account's own documents untouched — signing back in must bring them back", async () => {
    fakeFirestoreDb.docs.set(`users/linked-uid/slots/s1`, { id: "s1" });
    fakeFirestoreDb.docs.set(`users/linked-uid/routines/r1`, { id: "r1" });

    await signOutOfAccount();

    expect(fakeFirestoreDb.docs.get(`users/linked-uid/slots/s1`)).toMatchObject(
      { id: "s1" },
    );
    expect(
      fakeFirestoreDb.docs.get(`users/linked-uid/routines/r1`),
    ).toMatchObject({ id: "r1" });
  });

  it("marks the new anonymous uid migrated, or the next boot uploads the frozen MMKV blobs into it", async () => {
    await signOutOfAccount();

    const newUid = fakeAuth.currentUser?.uid as string;
    expect(mmkvStorage.getItem(`brelly-migration-complete:${newUid}`)).toBe(
      "true",
    );
  });

  it("cancels every scheduled alert, whose handles the emptied stores no longer hold", async () => {
    await signOutOfAccount();

    expect(
      Notifications.cancelAllScheduledNotificationsAsync,
    ).toHaveBeenCalled();
  });

  it("completes even when clearing the notification queue fails", async () => {
    (
      Notifications.cancelAllScheduledNotificationsAsync as jest.Mock
    ).mockRejectedValueOnce(new Error("no permission"));

    await expect(signOutOfAccount()).resolves.toBeUndefined();
    expect(fakeAuth.currentUser?.isAnonymous).toBe(true);
  });

  it("drops a pending merge snapshot, which belonged to the account being left", async () => {
    mmkvStorage.setItem(PENDING_KEY, JSON.stringify({ slots: [], routines: [] }));

    await signOutOfAccount();

    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("resumePendingMergeIfNeeded", () => {
  const snapshot = {
    slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }],
    routines: [routine({ id: "r1" })],
  };

  function seedPending(overrides: Record<string, unknown> = {}): void {
    mmkvStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ anonUid: ANON_UID, snapshot, addLocalData: true, ...overrides }),
    );
  }

  it("does nothing when there is no pending merge", async () => {
    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("finishes a merge interrupted after the identity switch", async () => {
    seedPending();
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

  it("writes nothing into the target when the user chose not to add", async () => {
    // `addLocalData: false` is why the record is written at all in that
    // branch: it is a crash record for the delete, not a payload for a merge.
    seedPending({ addLocalData: false });
    fakeAuth.setCurrentUser({ uid: EXISTING_UID, isAnonymous: false });

    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`)).toBeUndefined();
    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("restores the anonymous account when the session died before the switch", async () => {
    // The case that used to be missing. The delete had already run, the
    // sign-in never did, and the old code bailed on `isAnonymous` — leaving
    // every deleted document sitting in the record with nobody coming back
    // for it. Same uid, same ids, so this is an undo rather than a guess.
    seedPending();

    await resumePendingMergeIfNeeded();

    expect(
      fakeFirestoreDb.docs.get(`users/${ANON_UID}/slots/s1`),
    ).toMatchObject({ id: "s1" });
    expect(
      fakeFirestoreDb.docs.get(`users/${ANON_UID}/routines/r1`),
    ).toMatchObject({ id: "r1" });
    expect(mmkvStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("leaves the record alone when the anonymous uid is a different one", async () => {
    // A record from another session on this device. `firestore.rules` would
    // reject the write anyway, since this session does not own that uid.
    seedPending({ anonUid: "some-other-anon" });

    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.size).toBe(0);
    expect(mmkvStorage.getItem(PENDING_KEY)).not.toBeNull();
  });

  it("ignores a record left by a build that wrote the older shape", async () => {
    mmkvStorage.setItem(PENDING_KEY, JSON.stringify({ slots: [], routines: [] }));

    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("ignores an unparseable record rather than failing the boot", async () => {
    // This runs from `useCloudBootstrap`'s boot effect, so throwing here would
    // take the whole launch with it.
    mmkvStorage.setItem(PENDING_KEY, "{not json");
    fakeAuth.setCurrentUser({ uid: EXISTING_UID, isAnonymous: false });

    await expect(resumePendingMergeIfNeeded()).resolves.toBeUndefined();
    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("treats a record with no addLocalData as one that should be written", async () => {
    // Every record written before the field existed came from the add branch —
    // that was the only branch that wrote one.
    mmkvStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ anonUid: ANON_UID, snapshot }),
    );
    fakeAuth.setCurrentUser({ uid: EXISTING_UID, isAnonymous: false });

    await resumePendingMergeIfNeeded();

    expect(
      fakeFirestoreDb.docs.get(`users/${EXISTING_UID}/slots/s1`),
    ).toMatchObject({ id: "s1" });
  });

  it("does nothing when there is no session at all", async () => {
    seedPending();
    fakeAuth.setCurrentUser(null);

    await resumePendingMergeIfNeeded();

    expect(fakeFirestoreDb.docs.size).toBe(0);
    expect(mmkvStorage.getItem(PENDING_KEY)).not.toBeNull();
  });
});
