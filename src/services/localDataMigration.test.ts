import {
  confirmLocalDataMigration,
  enqueueLocalDataMigration,
} from "@/services/localDataMigration";
import { mmkvStorage } from "@/store/mmkvStorage";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

const UID = "test-uid";
const FLAG_KEY = `brelly-migration-complete:${UID}`;
const DOC_PATH = `users/${UID}/settings/app`;

const office = {
  id: "routine-1",
  label: "Office",
  location: "Raffles Place, Singapore",
  latitude: 1.2843,
  longitude: 103.8514,
  weekdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  startDate: "2026-08-03",
  exceptions: [],
};

const lunch = {
  id: "slot-1",
  label: "Lunch",
  location: "Marina Bay Sands",
  neaRegion: "south",
  latitude: 1.2834,
  longitude: 103.8607,
  startTime: "2026-07-31T12:00:00+08:00",
  endTime: "2026-07-31T13:00:00+08:00",
};

beforeEach(() => {
  fakeFirestoreDb.reset();
  mmkvStorage.removeItem(FLAG_KEY);
  mmkvStorage.removeItem("brelly-settings");
  mmkvStorage.removeItem("brelly-routines");
  mmkvStorage.removeItem("brelly-itinerary");
});

describe("enqueueLocalDataMigration", () => {
  it("does nothing once the migration flag is already set", () => {
    mmkvStorage.setItem(FLAG_KEY, "true");
    mmkvStorage.setItem(
      "brelly-settings",
      JSON.stringify({ state: { themePreference: "dark" }, version: 2 }),
    );

    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("does nothing when there is no local settings blob to migrate", () => {
    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("does nothing when the local blob isn't valid JSON", () => {
    mmkvStorage.setItem("brelly-settings", "{not json");

    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("migrates the local blob, strips digestNotificationId, and writes it to the cloud doc", () => {
    mmkvStorage.setItem(
      "brelly-settings",
      JSON.stringify({
        state: {
          themePreference: "dark",
          rainAlertsEnabled: true,
          rainLeadMinutes: 30,
          quietHours: { enabled: false, start: "22:00", end: "07:00" },
          digest: { enabled: false, time: "07:30" },
          digestNotificationId: "device-local-id",
        },
        version: 1,
      }),
    );

    const commit = enqueueLocalDataMigration(UID);

    expect(commit).not.toBeNull();
    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual({
      themePreference: "dark",
      rainAlertsEnabled: true,
      rainLeadMinutes: 30,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      digest: { enabled: false, time: "07:30" },
      // version 1 predates the hasSeenOnboarding migration.
      hasSeenOnboarding: true,
      schemaVersion: 2,
    });
  });
});

describe("enqueueLocalDataMigration — routines", () => {
  it("does nothing when there is no local routines blob to migrate", () => {
    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("does nothing when the local routines blob isn't valid JSON", () => {
    mmkvStorage.setItem("brelly-routines", "{not json");

    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("migrates each local routine to its own cloud doc", () => {
    mmkvStorage.setItem(
      "brelly-routines",
      JSON.stringify({ state: { routines: [office] }, version: 1 }),
    );

    const commit = enqueueLocalDataMigration(UID);

    expect(commit).not.toBeNull();
    expect(fakeFirestoreDb.docs.get(`users/${UID}/routines/routine-1`)).toEqual(
      office,
    );
  });

  it("migrates settings and routines together in one commit", async () => {
    mmkvStorage.setItem(
      "brelly-settings",
      JSON.stringify({ state: { themePreference: "dark" }, version: 2 }),
    );
    mmkvStorage.setItem(
      "brelly-routines",
      JSON.stringify({ state: { routines: [office] }, version: 1 }),
    );

    const commit = enqueueLocalDataMigration(UID);
    await commit;

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toMatchObject({
      themePreference: "dark",
    });
    expect(
      fakeFirestoreDb.docs.get(`users/${UID}/routines/routine-1`),
    ).toEqual(office);
  });

  it("migrates a locally-persisted routine with an undefined endDate", async () => {
    // An "ongoing" routine (no end date) is built with `endDate: undefined`
    // rather than the key simply being absent — see routinesSync.test.ts.
    // Firestore rejects a literal `undefined` outright, so a pre-Firestore
    // install's ongoing routines used to fail the whole migration commit.
    mmkvStorage.setItem(
      "brelly-routines",
      JSON.stringify({
        state: { routines: [{ ...office, endDate: undefined }] },
        version: 1,
      }),
    );

    const commit = enqueueLocalDataMigration(UID);
    await expect(commit).resolves.toBeUndefined();
    expect(fakeFirestoreDb.docs.get(`users/${UID}/routines/routine-1`)).toEqual(
      office,
    );
  });

  it("chunks writes across multiple batches for a large routine list", () => {
    const routines = Array.from({ length: 450 }, (_, i) => ({
      ...office,
      id: `routine-${i}`,
    }));
    mmkvStorage.setItem(
      "brelly-routines",
      JSON.stringify({ state: { routines }, version: 1 }),
    );

    enqueueLocalDataMigration(UID);

    for (const routine of routines) {
      expect(
        fakeFirestoreDb.docs.get(`users/${UID}/routines/${routine.id}`),
      ).toEqual(routine);
    }
  });
});

describe("enqueueLocalDataMigration — slots", () => {
  it("does nothing when there is no local itinerary blob to migrate", () => {
    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("does nothing when the local itinerary blob isn't valid JSON", () => {
    mmkvStorage.setItem("brelly-itinerary", "{not json");

    const result = enqueueLocalDataMigration(UID);

    expect(result).toBeNull();
  });

  it("flattens each day's slots to its own doc, carrying the date field", () => {
    mmkvStorage.setItem(
      "brelly-itinerary",
      JSON.stringify({
        state: {
          plans: [{ id: "2026-07-31", date: "2026-07-31", slots: [lunch] }],
        },
        version: 1,
      }),
    );

    const commit = enqueueLocalDataMigration(UID);

    expect(commit).not.toBeNull();
    expect(fakeFirestoreDb.docs.get(`users/${UID}/slots/slot-1`)).toEqual({
      ...lunch,
      date: "2026-07-31",
    });
  });

  it("strips notification handles so they never reach the cloud", async () => {
    mmkvStorage.setItem(
      "brelly-itinerary",
      JSON.stringify({
        state: {
          plans: [
            {
              id: "2026-07-31",
              date: "2026-07-31",
              slots: [
                {
                  ...lunch,
                  notificationId: "device-local-notif",
                  notificationLeadMinutes: 45,
                },
              ],
            },
          ],
        },
        version: 1,
      }),
    );

    // Awaited, not just fired: a literal `notificationId: undefined` left in
    // the write payload makes Firestore reject the whole write, which the
    // synchronous doc-property check below couldn't have told apart from a
    // clean strip — both read as `undefined` whether the key is a stripped
    // absence or the doc never landed at all.
    const commit = enqueueLocalDataMigration(UID);
    await expect(commit).resolves.toBeUndefined();

    const doc = fakeFirestoreDb.docs.get(`users/${UID}/slots/slot-1`);
    expect(doc).toEqual({ ...lunch, date: "2026-07-31" });
    expect(doc?.notificationId).toBeUndefined();
    expect(doc?.notificationLeadMinutes).toBeUndefined();
  });

  it("chunks writes across multiple batches for a large slot list", () => {
    const slots = Array.from({ length: 450 }, (_, i) => ({
      ...lunch,
      id: `slot-${i}`,
    }));
    mmkvStorage.setItem(
      "brelly-itinerary",
      JSON.stringify({
        state: {
          plans: [{ id: "2026-07-31", date: "2026-07-31", slots }],
        },
        version: 1,
      }),
    );

    enqueueLocalDataMigration(UID);

    for (const slot of slots) {
      expect(
        fakeFirestoreDb.docs.get(`users/${UID}/slots/${slot.id}`),
      ).toMatchObject({ id: slot.id, date: "2026-07-31" });
    }
  });

  it("migrates settings, routines, and slots together in one commit", async () => {
    mmkvStorage.setItem(
      "brelly-settings",
      JSON.stringify({ state: { themePreference: "dark" }, version: 2 }),
    );
    mmkvStorage.setItem(
      "brelly-itinerary",
      JSON.stringify({
        state: {
          plans: [{ id: "2026-07-31", date: "2026-07-31", slots: [lunch] }],
        },
        version: 1,
      }),
    );

    const commit = enqueueLocalDataMigration(UID);
    await commit;

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toMatchObject({
      themePreference: "dark",
    });
    expect(fakeFirestoreDb.docs.get(`users/${UID}/slots/slot-1`)).toMatchObject(
      { id: "slot-1" },
    );
  });
});

describe("confirmLocalDataMigration", () => {
  it("sets the local flag once the write commits", async () => {
    confirmLocalDataMigration(UID, Promise.resolve());
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mmkvStorage.getItem(FLAG_KEY)).toBe("true");
  });

  it("leaves the flag unset so the next launch retries when the write fails", async () => {
    confirmLocalDataMigration(UID, Promise.reject(new Error("offline")));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mmkvStorage.getItem(FLAG_KEY)).toBeNull();
  });
});
