import type { ItinerarySlot } from "@/types/itinerary";
import { detectScheduleConflicts } from "@/utils/detectScheduleConflicts";

function slot(
  overrides: Partial<ItinerarySlot> & Pick<ItinerarySlot, "label" | "startTime" | "endTime">,
): ItinerarySlot {
  return {
    id: overrides.label,
    location: "Test",
    neaRegion: "west",
    latitude: 1.35,
    longitude: 103.8,
    ...overrides,
  };
}

describe("detectScheduleConflicts", () => {
  it("returns empty for fewer than two slots", () => {
    expect(detectScheduleConflicts([])).toEqual([]);
    expect(
      detectScheduleConflicts([
        slot({ label: "A", startTime: "2026-08-04T09:00", endTime: "2026-08-04T10:00" }),
      ]),
    ).toEqual([]);
  });

  it("detects overlapping slots", () => {
    const conflicts = detectScheduleConflicts([
      slot({ label: "A", startTime: "2026-08-04T09:00", endTime: "2026-08-04T11:00" }),
      slot({ label: "B", startTime: "2026-08-04T10:00", endTime: "2026-08-04T12:00" }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("overlap");
    expect(conflicts[0].detail).toContain("A");
    expect(conflicts[0].detail).toContain("B");
  });

  it("allows adjacent non-overlapping slots", () => {
    const conflicts = detectScheduleConflicts([
      slot({ label: "A", startTime: "2026-08-04T09:00", endTime: "2026-08-04T10:00" }),
      slot({ label: "B", startTime: "2026-08-04T10:00", endTime: "2026-08-04T11:00" }),
    ]);
    expect(conflicts).toEqual([]);
  });

  it("detects implausible gap for distant locations with short gap", () => {
    const conflicts = detectScheduleConflicts([
      slot({
        label: "Changi",
        startTime: "2026-08-04T09:00",
        endTime: "2026-08-04T10:00",
        latitude: 1.3644,
        longitude: 103.9915,
      }),
      slot({
        label: "Jurong",
        startTime: "2026-08-04T10:05",
        endTime: "2026-08-04T11:00",
        latitude: 1.3329,
        longitude: 103.7436,
      }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("implausible-gap");
    expect(conflicts[0].detail).toContain("km");
  });

  it("allows distant locations with sufficient gap", () => {
    const conflicts = detectScheduleConflicts([
      slot({
        label: "Changi",
        startTime: "2026-08-04T09:00",
        endTime: "2026-08-04T10:00",
        latitude: 1.3644,
        longitude: 103.9915,
      }),
      slot({
        label: "Jurong",
        startTime: "2026-08-04T11:00",
        endTime: "2026-08-04T12:00",
        latitude: 1.3329,
        longitude: 103.7436,
      }),
    ]);
    expect(conflicts).toEqual([]);
  });

  it("sorts slots by start time before checking", () => {
    const conflicts = detectScheduleConflicts([
      slot({ label: "B", startTime: "2026-08-04T10:00", endTime: "2026-08-04T12:00" }),
      slot({ label: "A", startTime: "2026-08-04T09:00", endTime: "2026-08-04T11:00" }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("overlap");
  });
});
