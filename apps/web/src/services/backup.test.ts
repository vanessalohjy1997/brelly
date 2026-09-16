import {
  useItineraryStore,
  useRoutineStore,
  useSettingsStore,
} from "@brelly/core";

import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";

import { backupFilename, buildBackup, exportBackup } from "./backup";

beforeEach(() => {
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useSettingsStore.setState({
    themePreference: "dark",
    rainAlertsEnabled: true,
    rainLeadMinutes: 45,
  });
});

describe("buildBackup", () => {
  it("writes the version the phone's importer checks for", () => {
    expect(buildBackup().version).toBe(1);
  });

  it("carries the plans and routines as they are", () => {
    useItineraryStore.setState({
      plans: [makePlan("2026-09-15", [makeSlot()])],
    });
    useRoutineStore.setState({ routines: [makeRoutine()] });

    const backup = buildBackup();

    expect(backup.itinerary.plans[0].slots[0].label).toBe("Lunch");
    expect(backup.routines.routines[0].label).toBe("Morning run");
  });

  it("leaves the phone's notification bookkeeping behind", () => {
    // A backup outlives the device that wrote it, so a handle into some other
    // phone's alert queue must not travel with it.
    useItineraryStore.setState({
      plans: [
        makePlan("2026-09-15", [
          makeSlot({ notificationId: "notif-1", notificationLeadMinutes: 60 }),
        ]),
      ],
    });

    const [slot] = buildBackup().itinerary.plans[0].slots;

    expect(slot).not.toHaveProperty("notificationId");
    expect(slot).not.toHaveProperty("notificationLeadMinutes");
  });

  it("exports the alert settings the web never shows", () => {
    // They are whatever the phone last wrote, and dropping them here would mean
    // a laptop's backup quietly restored the defaults over them.
    const backup = buildBackup();

    expect(backup.settings.rainAlertsEnabled).toBe(true);
    expect(backup.settings.rainLeadMinutes).toBe(45);
    expect(backup.settings.themePreference).toBe("dark");
  });

  it("stamps when it was taken", () => {
    expect(Date.parse(buildBackup().exportedAt)).not.toBeNaN();
  });
});

describe("backupFilename", () => {
  it("names the day, so two of them sort", () => {
    expect(backupFilename(new Date("2026-09-15T10:00:00Z"))).toBe(
      "brelly-backup-2026-09-15.json",
    );
  });
});

describe("exportBackup", () => {
  it("hands the browser a JSON download and lets the blob go", () => {
    // The only way to start a download from script is a `download` anchor, and
    // an object URL left alive pins the whole file in memory.
    const createObjectURL = jest.fn(() => "blob:brelly");
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    exportBackup();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    expect(blob.type).toBe("application/json");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:brelly");

    click.mockRestore();
  });
});
