import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import {
  isAlreadyPlanned,
  slotToCalendarEvent,
  summarizeExport,
  summarizeImport,
  toImportableEvents,
  type ImportableEvent,
} from "@/utils/calendarSync";

const NOW = new Date(2026, 7, 1, 14, 0);

function at(day: number, hour: number): Date {
  return new Date(2026, 7, day, hour, 0, 0, 0);
}

function slot(label: string, start: Date, end: Date): ItinerarySlot {
  return {
    id: label,
    label,
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3,
    longitude: 103.9,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function plan(date: string, slots: ItinerarySlot[]): DayPlan {
  return { id: date, date, slots };
}

function importable(
  title: string,
  start: Date,
  end: Date,
): ImportableEvent {
  return { id: title, title, location: "Somewhere", startDate: start, endDate: end };
}

describe("slotToCalendarEvent", () => {
  it("carries the label, place and window across", () => {
    const event = slotToCalendarEvent(slot("Beach run", at(2, 9), at(2, 10)));

    expect(event.title).toBe("Beach run");
    expect(event.location).toBe("East Coast Park, Singapore");
    expect(event.startDate).toEqual(at(2, 9));
    expect(event.endDate).toEqual(at(2, 10));
  });

  it("says where the event came from, in a field every calendar shows", () => {
    const event = slotToCalendarEvent(slot("Beach run", at(2, 9), at(2, 10)));

    expect(event.notes).toContain("Brelly");
  });
});

describe("toImportableEvents", () => {
  const base = {
    id: "e1",
    title: "Standup",
    location: "One Raffles Place",
    startDate: at(2, 9),
    endDate: at(2, 10),
  };

  it("keeps an ordinary upcoming event", () => {
    expect(toImportableEvents([base], NOW)).toHaveLength(1);
  });

  it("drops an all-day event, which has no start time to forecast against", () => {
    expect(toImportableEvents([{ ...base, allDay: true }], NOW)).toEqual([]);
  });

  it("drops an event with nowhere attached", () => {
    // The whole job is the weather *there*; a stop with no coordinates is a
    // card that permanently says "No forecast".
    expect(toImportableEvents([{ ...base, location: null }], NOW)).toEqual([]);
    expect(toImportableEvents([{ ...base, location: "   " }], NOW)).toEqual([]);
  });

  it("drops an untitled event", () => {
    expect(toImportableEvents([{ ...base, title: "  " }], NOW)).toEqual([]);
  });

  it("drops an event that has already finished", () => {
    expect(
      toImportableEvents([{ ...base, startDate: at(1, 9), endDate: at(1, 10) }], NOW),
    ).toEqual([]);
  });

  it("keeps an event already in progress", () => {
    const running = { ...base, startDate: at(1, 13), endDate: at(1, 15) };
    expect(toImportableEvents([running], NOW)).toHaveLength(1);
  });

  it("accepts dates as strings, which is how some platforms return them", () => {
    const stringly = {
      ...base,
      startDate: at(2, 9).toISOString(),
      endDate: at(2, 10).toISOString(),
    };

    expect(toImportableEvents([stringly], NOW)[0].startDate).toEqual(at(2, 9));
  });

  it("drops an event whose dates don't parse rather than importing a NaN stop", () => {
    expect(
      toImportableEvents([{ ...base, startDate: "not a date" }], NOW),
    ).toEqual([]);
  });

  it("returns them soonest first", () => {
    const events = [
      { ...base, id: "late", startDate: at(4, 9), endDate: at(4, 10) },
      { ...base, id: "soon", startDate: at(2, 9), endDate: at(2, 10) },
    ];

    expect(toImportableEvents(events, NOW).map((e) => e.id)).toEqual([
      "soon",
      "late",
    ]);
  });

  it("trims the text it keeps", () => {
    const padded = { ...base, title: "  Standup  ", location: " Raffles " };
    const [event] = toImportableEvents([padded], NOW);

    expect(event.title).toBe("Standup");
    expect(event.location).toBe("Raffles");
  });
});

describe("isAlreadyPlanned", () => {
  const plans = [
    plan("2026-08-02", [slot("Standup", at(2, 9), at(2, 10))]),
  ];

  it("recognises the same event by name and start time", () => {
    expect(
      isAlreadyPlanned(plans, importable("Standup", at(2, 9), at(2, 10))),
    ).toBe(true);
  });

  it("ignores case, so a hand-typed copy still counts", () => {
    expect(
      isAlreadyPlanned(plans, importable("standup", at(2, 9), at(2, 10))),
    ).toBe(true);
  });

  it("does not match a different time on the same day", () => {
    expect(
      isAlreadyPlanned(plans, importable("Standup", at(2, 11), at(2, 12))),
    ).toBe(false);
  });

  it("does not match the same time on a different day", () => {
    expect(
      isAlreadyPlanned(plans, importable("Standup", at(3, 9), at(3, 10))),
    ).toBe(false);
  });

  it("is false when nothing is planned that day at all", () => {
    expect(isAlreadyPlanned([], importable("Standup", at(2, 9), at(2, 10)))).toBe(
      false,
    );
  });
});

describe("summarizeImport", () => {
  it("explains an empty calendar rather than reporting zero", () => {
    expect(summarizeImport({ imported: 0, duplicates: 0, unresolved: 0 })).toBe(
      "No upcoming events with a location to import",
    );
  });

  it("explains a run that found only things already planned", () => {
    // "Imported 0 events" after tapping Import reads as a failure, and this is
    // the normal outcome of running it twice.
    expect(summarizeImport({ imported: 0, duplicates: 3, unresolved: 0 })).toBe(
      "Everything in your calendar is already planned",
    );
  });

  it("counts one import in the singular", () => {
    expect(summarizeImport({ imported: 1, duplicates: 0, unresolved: 0 })).toBe(
      "Imported 1 event",
    );
  });

  it("mentions what it skipped and why", () => {
    expect(summarizeImport({ imported: 2, duplicates: 1, unresolved: 1 })).toBe(
      "Imported 2 events · 1 already planned · 1 had a location we couldn't find",
    );
  });
});

describe("summarizeExport", () => {
  it("says there was nothing to add rather than adding nothing quietly", () => {
    expect(summarizeExport(0)).toBe("Nothing upcoming to add to your calendar");
  });

  it("counts one in the singular", () => {
    expect(summarizeExport(1)).toBe("Added 1 plan to your calendar");
  });

  it("counts several in the plural", () => {
    expect(summarizeExport(4)).toBe("Added 4 plans to your calendar");
  });
});
