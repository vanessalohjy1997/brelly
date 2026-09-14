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

  // `MAX_PLAUSIBLE_SPEED_KMH` was written when every stop was in Singapore.
  // On an overseas itinerary it trips on every leg, and the banner it raises
  // is unactionable — the user is on a plane.
  describe("legs that are flights", () => {
    const Changi = { latitude: 1.3644, longitude: 103.9915 };
    const JohorBahru = { latitude: 1.4927, longitude: 103.7414 }; // ~31 km away
    const Jurong = { latitude: 1.3329, longitude: 103.7436 }; // ~28 km away
    const TokyoTower = { latitude: 35.6586, longitude: 139.7454 }; // ~5300 km
    const Jfk = { latitude: 40.6413, longitude: -73.7781 };
    const Lax = { latitude: 33.9416, longitude: -118.4085 }; // ~3970 km from JFK

    it("says nothing when the two stops are in different countries", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "Changi",
          ...Changi,
          countryCode: "SG",
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "Johor Bahru",
          ...JohorBahru,
          countryCode: "MY",
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toEqual([]);
    });

    it("still warns inside one country, where the leg is drivable", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "Changi",
          ...Changi,
          countryCode: "SG",
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "Jurong",
          ...Jurong,
          countryCode: "SG",
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe("implausible-gap");
    });

    // The field is absent on every stop made before it existed and on every
    // calendar import. Reading that as "same country as the other stop" would
    // silence the warning for the Singapore itineraries it was written for.
    it("reads an absent country code as unknown, not as the other stop's", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "Changi",
          ...Changi,
          countryCode: "SG",
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "Imported stop",
          ...JohorBahru,
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe("implausible-gap");
    });

    it("says nothing about a domestic flight, which no country code describes", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "JFK",
          ...Jfk,
          countryCode: "US",
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "LAX",
          ...Lax,
          countryCode: "US",
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toEqual([]);
    });

    it("says nothing on distance alone when neither stop names a country", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "Changi",
          ...Changi,
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "Tokyo Tower",
          ...TokyoTower,
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toEqual([]);
    });

    // Straddling `GROUND_TRANSPORT_LIMIT_KM`: one degree of latitude is
    // ~111 km, so these are ~445 km and ~556 km apart.
    it("still checks a leg inside the ground-transport ceiling", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "South",
          latitude: 0,
          longitude: 0,
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "North",
          latitude: 4,
          longitude: 0,
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe("implausible-gap");
    });

    it("stops checking past it", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "South",
          latitude: 0,
          longitude: 0,
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T10:00",
        }),
        slot({
          label: "Far north",
          latitude: 5,
          longitude: 0,
          startTime: "2026-08-04T10:05",
          endTime: "2026-08-04T11:00",
        }),
      ]);

      expect(conflicts).toEqual([]);
    });

    // Only the gap check is about travel. Two stops booked over each other are
    // double-booked wherever they are.
    it("still reports an overlap across countries", () => {
      const conflicts = detectScheduleConflicts([
        slot({
          label: "Changi",
          ...Changi,
          countryCode: "SG",
          startTime: "2026-08-04T09:00",
          endTime: "2026-08-04T11:00",
        }),
        slot({
          label: "Tokyo Tower",
          ...TokyoTower,
          countryCode: "JP",
          startTime: "2026-08-04T10:00",
          endTime: "2026-08-04T12:00",
        }),
      ]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].kind).toBe("overlap");
    });
  });
});
