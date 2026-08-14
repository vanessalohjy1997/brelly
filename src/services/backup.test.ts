import { getAuth } from "@react-native-firebase/auth";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { exportBackup, importBackup } from "@/services/backup";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSettingsStore } from "@/store/settingsStore";
import { fakeFirestoreDb } from "@/test/fakeFirestore";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { planRoutineMaterialization } from "@/utils/planRoutineMaterialization";

const mockGetAuth = getAuth as jest.Mock;

// An in-memory filesystem, so a test can write a file, hand its uri to
// `importBackup`, and read back what `exportBackup` produced — the round trip
// is the thing worth checking, and it is exactly where the notification
// handles used to survive.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  return {
    Paths: { cache: "cache" },
    File: class {
      uri: string;
      constructor(base: string, name?: string) {
        this.uri = name === undefined ? base : `${base}/${name}`;
      }
      write(content: string): void {
        files.set(this.uri, content);
      }
      async text(): Promise<string> {
        const content = files.get(this.uri);
        if (content === undefined) throw new Error(`No such file: ${this.uri}`);
        return content;
      }
    },
  };
});

jest.mock("expo-sharing", () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockShare = Sharing.shareAsync as jest.Mock;

const slot: ItinerarySlot = {
  id: "slot-1",
  label: "Botanic Gardens",
  location: "Cluny Rd, Singapore",
  neaRegion: "central",
  latitude: 1.3138,
  longitude: 103.8159,
  startTime: "2026-08-08T15:00:00.000Z",
  endTime: "2026-08-08T17:00:00.000Z",
  // Scheduled on the device that wrote the backup, and meaningless anywhere
  // else.
  notificationId: "device-a-alert",
  notificationLeadMinutes: 45,
};

const plan: DayPlan = { id: "2026-08-08", date: "2026-08-08", slots: [slot] };

const routine: Routine = {
  id: "routine-1",
  label: "Office",
  location: "Raffles Place, Singapore",
  latitude: 1.2843,
  longitude: 103.8514,
  weekdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  startDate: "2026-08-03",
  exceptions: ["2026-08-05"],
};

/** Reads back whatever the last `exportBackup` wrote. */
async function readExportedFile(): Promise<string> {
  const [uri] = mockShare.mock.calls[0] as [string];
  return new File(uri).text();
}

/** Writes a backup file by hand and imports it, as a real file would arrive. */
async function importFile(name: string, contents: unknown): Promise<void> {
  new File(name).write(JSON.stringify(contents));
  await importBackup(name);
}

beforeEach(() => {
  mockShare.mockClear();
  fakeFirestoreDb.reset();
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useSettingsStore.setState({ themePreference: "system" });
  mockGetAuth.mockReturnValue({ currentUser: null });
});

describe("exportBackup", () => {
  it("leaves this device's notification handles out of the file", async () => {
    useItineraryStore.setState({ plans: [plan] });

    await exportBackup();

    const written = await readExportedFile();
    expect(written).not.toContain("device-a-alert");
    expect(JSON.parse(written).itinerary.plans[0].slots[0]).not.toHaveProperty(
      "notificationId",
    );
  });

  it("still exports everything that isn't device-local", async () => {
    useItineraryStore.setState({ plans: [plan] });
    useRoutineStore.setState({ routines: [routine] });

    await exportBackup();

    const written = JSON.parse(await readExportedFile());
    expect(written.itinerary.plans[0].slots[0]).toMatchObject({
      id: "slot-1",
      label: "Botanic Gardens",
      neaRegion: "central",
    });
    expect(written.routines.routines).toEqual([routine]);
  });
});

describe("importBackup", () => {
  it("round-trips plans and routines", async () => {
    useItineraryStore.setState({ plans: [plan] });
    useRoutineStore.setState({ routines: [routine] });
    await exportBackup();
    const [uri] = mockShare.mock.calls[0] as [string];

    useItineraryStore.setState({ plans: [] });
    useRoutineStore.setState({ routines: [] });
    const counts = await importBackup(uri);

    expect(counts).toEqual({ plans: 1, routines: 1 });
    expect(useItineraryStore.getState().plans[0].slots[0].id).toBe("slot-1");
    expect(useRoutineStore.getState().routines).toEqual([routine]);
  });

  it("drops notification handles carried by a file written before the strip", async () => {
    // Backups exported by earlier builds are already out there with the ids in
    // them, so the import is the only place they can be cleaned up.
    await importFile("legacy.json", {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      itinerary: { plans: [plan] },
      routines: { routines: [] },
    });

    const restored = useItineraryStore.getState().plans[0].slots[0];
    expect(restored.notificationId).toBeUndefined();
    expect(restored.notificationLeadMinutes).toBeUndefined();
  });

  it("keeps a routine's own id, so the stops it made aren't orphaned", async () => {
    // `addRoutine` would mint a fresh id here. The imported slot still carries
    // `routineId: "routine-1"`, so a new id makes the materialiser read every
    // upcoming stop as belonging to a rule that no longer exists and sweep it.
    await importFile("backup.json", {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      itinerary: { plans: [] },
      routines: { routines: [routine] },
    });

    expect(useRoutineStore.getState().routines[0].id).toBe("routine-1");
  });

  it("keeps the days the user excepted, so they aren't refilled", async () => {
    await importFile("backup.json", {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      itinerary: { plans: [] },
      routines: { routines: [routine] },
    });

    const [imported] = useRoutineStore.getState().routines;
    expect(imported.exceptions).toEqual(["2026-08-05"]);
    // Stated as the behaviour that depends on it: the excepted day must not
    // come back on the next top-up.
    const actions = planRoutineMaterialization(
      useRoutineStore.getState().routines,
      [],
      new Date("2026-08-03T08:00:00.000Z"),
      14,
    );
    expect(actions.map((a) => a.date)).not.toContain("2026-08-05");
  });

  it("imports the same file twice without duplicating a routine", async () => {
    const contents = {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      itinerary: { plans: [] },
      routines: { routines: [routine] },
    };

    await importFile("backup.json", contents);
    await importFile("backup.json", contents);

    expect(useRoutineStore.getState().routines).toEqual([routine]);
  });

  it("applies the settings it carries", async () => {
    await importFile("backup.json", {
      version: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      itinerary: { plans: [] },
      routines: { routines: [] },
      settings: {
        themePreference: "dark",
        rainAlertsEnabled: false,
        rainLeadMinutes: 30,
        quietHours: { enabled: true, start: "22:00", end: "07:00" },
        digest: { enabled: true, time: "07:30" },
      },
    });

    expect(useSettingsStore.getState().themePreference).toBe("dark");
    expect(useSettingsStore.getState().rainLeadMinutes).toBe(30);
  });

  it("rejects a file that isn't a backup", async () => {
    new File("notes.json").write(JSON.stringify({ hello: "world" }));

    await expect(importBackup("notes.json")).rejects.toThrow(
      "Not a valid Brelly backup file",
    );
  });

  it("rejects a backup whose plans aren't a list", async () => {
    new File("broken.json").write(
      JSON.stringify({
        version: 1,
        itinerary: { plans: "nope" },
        routines: { routines: [] },
      }),
    );

    await expect(importBackup("broken.json")).rejects.toThrow(
      "Not a valid Brelly backup file",
    );
  });

  describe("Firestore batching", () => {
    beforeEach(() => {
      mockGetAuth.mockReturnValue({ currentUser: { uid: "test-uid" } });
    });

    it("writes every imported slot and routine to its own cloud doc", async () => {
      await importFile("backup.json", {
        version: 1,
        exportedAt: "2026-08-01T00:00:00.000Z",
        itinerary: { plans: [plan] },
        routines: { routines: [routine] },
      });

      expect(fakeFirestoreDb.docs.get("users/test-uid/slots/slot-1")).toEqual({
        ...slot,
        notificationId: undefined,
        notificationLeadMinutes: undefined,
        date: "2026-08-08",
      });
      expect(
        fakeFirestoreDb.docs.get("users/test-uid/routines/routine-1"),
      ).toEqual(routine);
    });

    it("does nothing before a uid exists", async () => {
      mockGetAuth.mockReturnValue({ currentUser: null });

      await importFile("backup.json", {
        version: 1,
        exportedAt: "2026-08-01T00:00:00.000Z",
        itinerary: { plans: [plan] },
        routines: { routines: [routine] },
      });

      expect(fakeFirestoreDb.docs.size).toBe(0);
    });

    it("writes a routine carrying an explicit undefined endDate rather than failing the whole batch", async () => {
      // Firestore rejects a literal `undefined` outright — a routine that
      // predates an end date being set (or had one cleared) can carry the key
      // this way, same as the ongoing-routine case in routinesSync.test.ts.
      await importFile("backup.json", {
        version: 1,
        exportedAt: "2026-08-01T00:00:00.000Z",
        itinerary: { plans: [] },
        routines: { routines: [{ ...routine, endDate: undefined }] },
      });

      expect(
        fakeFirestoreDb.docs.get("users/test-uid/routines/routine-1"),
      ).toEqual(routine);
    });
  });
});
