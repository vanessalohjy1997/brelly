/// <reference types="node" />
/**
 * Exercises the actual allow/deny decisions in `firestore.rules` against a
 * real (local) Firestore emulator — the item `FIREBASE_MIGRATION.md`'s
 * testing section and `PLAN.md`'s "Cloud sync" QA list left open, because a
 * fake can't honestly cover security-rule behaviour. Run via
 * `yarn test:emulator`, which starts the emulator first; not part of the
 * `yarn test` gate, since that needs no running process.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";

const validSlot = {
  label: "Walk in the park",
  location: "Botanic Gardens",
  neaRegion: "central",
  latitude: 1.3138,
  longitude: 103.8159,
  date: "2026-08-14",
  startTime: "09:00",
  endTime: "10:00",
};

const validRoutine = {
  label: "Morning jog",
  location: "East Coast Park",
  latitude: 1.3,
  longitude: 103.9,
  weekdays: [1, 3, 5],
  startTime: "07:00",
  endTime: "08:00",
  startDate: "2026-01-01",
  exceptions: [],
};

let testEnv: RulesTestEnvironment;

function ownerDb() {
  return testEnv.authenticatedContext(OWNER_UID).firestore();
}

function otherDb() {
  return testEnv.authenticatedContext(OTHER_UID).firestore();
}

function unauthedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  const rules = fs.readFileSync(
    path.join(__dirname, "../../../firestore.rules"),
    "utf8",
  );
  const [host, portStr] = (
    process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
  ).split(":");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-brelly",
    firestore: { rules, host, port: Number(portStr) },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

describe("owner-only access", () => {
  test("owner can write and read their own slot", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertSucceeds(setDoc(ref, validSlot));
  });

  test("a different signed-in user cannot write into someone else's slots", async () => {
    const ref = doc(otherDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(setDoc(ref, validSlot));
  });

  test("a different signed-in user cannot read someone else's slots", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", OWNER_UID, "slots", "s1"), validSlot);
    });
    await assertFails(
      getDoc(doc(otherDb(), "users", OWNER_UID, "slots", "s1")),
    );
  });

  test("an unauthenticated request is denied", async () => {
    const ref = doc(unauthedDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(setDoc(ref, validSlot));
  });

  test("owner can delete their own slot", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", OWNER_UID, "slots", "s1"), validSlot);
    });
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertSucceeds(deleteDoc(ref));
  });

  test("a different signed-in user cannot delete the owner's slot", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", OWNER_UID, "slots", "s1"), validSlot);
    });
    const ref = doc(otherDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(deleteDoc(ref));
  });
});

describe("slot field validation", () => {
  test("a well-formed slot is accepted", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertSucceeds(setDoc(ref, validSlot));
  });

  test("a slot missing a required field is rejected", async () => {
    const { label: _label, ...withoutLabel } = validSlot;
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(setDoc(ref, withoutLabel));
  });

  test("a slot with the wrong type for a field is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(
      setDoc(ref, { ...validSlot, latitude: "1.3138" }),
    );
  });

  test("a slot with an unknown neaRegion is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(setDoc(ref, { ...validSlot, neaRegion: "north-west" }));
  });

  test("a slot with an over-length label is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(
      setDoc(ref, { ...validSlot, label: "x".repeat(201) }),
    );
  });

  test("a slot with an over-length notes field is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(
      setDoc(ref, { ...validSlot, notes: "x".repeat(2001) }),
    );
  });

  test("a slot carrying the device-local notificationId is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(
      setDoc(ref, { ...validSlot, notificationId: "local-handle-1" }),
    );
  });

  test("a slot carrying notificationLeadMinutes is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "slots", "s1");
    await assertFails(
      setDoc(ref, { ...validSlot, notificationLeadMinutes: 45 }),
    );
  });
});

describe("routine field validation", () => {
  test("a well-formed routine is accepted", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "routines", "r1");
    await assertSucceeds(setDoc(ref, validRoutine));
  });

  test("a routine with an out-of-range weekday is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "routines", "r1");
    await assertFails(
      setDoc(ref, { ...validRoutine, weekdays: [0, 7] }),
    );
  });

  test("a routine missing the exceptions list is rejected", async () => {
    const { exceptions: _exceptions, ...withoutExceptions } = validRoutine;
    const ref = doc(ownerDb(), "users", OWNER_UID, "routines", "r1");
    await assertFails(setDoc(ref, withoutExceptions));
  });

  test("a routine with a malformed endDate is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "routines", "r1");
    await assertFails(
      setDoc(ref, { ...validRoutine, endDate: "14 Aug 2026" }),
    );
  });
});

describe("settings field validation", () => {
  test("a brand-new install's first partial merge is accepted", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "settings", "app");
    await assertSucceeds(setDoc(ref, { themePreference: "dark" }, { merge: true }));
  });

  test("an unknown rainLeadMinutes value is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "settings", "app");
    await assertFails(
      setDoc(ref, { rainLeadMinutes: 20 }, { merge: true }),
    );
  });

  test("the device-local digestNotificationId is rejected", async () => {
    const ref = doc(ownerDb(), "users", OWNER_UID, "settings", "app");
    await assertFails(
      setDoc(ref, { digestNotificationId: "digest-1" }, { merge: true }),
    );
  });
});
