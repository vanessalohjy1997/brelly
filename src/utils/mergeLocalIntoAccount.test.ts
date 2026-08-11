import { resolveMergeWrites } from "@/utils/mergeLocalIntoAccount";
import type { ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";

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
  } as ItinerarySlot;
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

describe("resolveMergeWrites", () => {
  it("keeps ids that don't collide with the target account", () => {
    const result = resolveMergeWrites(
      { slots: [{ date: "2025-06-01", slot: slot() }], routines: [routine()] },
      { slotIds: new Set(), routineIds: new Set() },
      () => "minted-id",
    );

    expect(result.slots[0].slot.id).toBe("s1");
    expect(result.routines[0].id).toBe("r1");
  });

  it("mints a fresh id for a slot whose id already exists in the target", () => {
    const result = resolveMergeWrites(
      { slots: [{ date: "2025-06-01", slot: slot({ id: "s1" }) }], routines: [] },
      { slotIds: new Set(["s1"]), routineIds: new Set() },
      () => "minted-slot-id",
    );

    expect(result.slots[0].slot.id).toBe("minted-slot-id");
  });

  it("mints a fresh id for a routine whose id already exists in the target", () => {
    const result = resolveMergeWrites(
      { slots: [], routines: [routine({ id: "r1" })] },
      { slotIds: new Set(), routineIds: new Set(["r1"]) },
      () => "minted-routine-id",
    );

    expect(result.routines[0].id).toBe("minted-routine-id");
  });

  it("strips device-local notification handles from every slot", () => {
    const result = resolveMergeWrites(
      {
        slots: [
          {
            date: "2025-06-01",
            slot: slot({ notificationId: "notif-1", notificationLeadMinutes: 45 }),
          },
        ],
        routines: [],
      },
      { slotIds: new Set(), routineIds: new Set() },
      () => "minted-id",
    );

    expect(result.slots[0].slot.notificationId).toBeUndefined();
    expect(result.slots[0].slot.notificationLeadMinutes).toBeUndefined();
  });

  it("preserves the date paired with each slot", () => {
    const result = resolveMergeWrites(
      { slots: [{ date: "2025-06-15", slot: slot() }], routines: [] },
      { slotIds: new Set(), routineIds: new Set() },
      () => "minted-id",
    );

    expect(result.slots[0].date).toBe("2025-06-15");
  });
});
