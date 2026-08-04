import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import type { NeaRegion } from "@/types/weather";
import {
  countSlots,
  filterPlans,
  searchTerms,
  slotMatches,
} from "@/utils/filterPlans";

function slot(
  id: string,
  label: string,
  location: string,
  neaRegion: NeaRegion = "central",
): ItinerarySlot {
  return {
    id,
    label,
    location,
    neaRegion,
    latitude: 1.3,
    longitude: 103.8,
    startTime: "2026-08-01T09:00:00.000Z",
    endTime: "2026-08-01T10:00:00.000Z",
  };
}

function plan(date: string, slots: ItinerarySlot[]): DayPlan {
  return { id: date, date, slots };
}

const PLANS = [
  plan("2026-08-01", [
    slot("a", "Lunch with Sam", "Singapore Botanic Gardens", "central"),
    slot("b", "Beach run", "East Coast Park", "east"),
  ]),
  plan("2026-08-02", [
    slot("c", "Groceries", "NTUC FairPrice, Jurong Point", "west"),
  ]),
];

describe("searchTerms", () => {
  it("is empty for a blank or whitespace-only query", () => {
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms("   ")).toEqual([]);
  });

  it("lowercases and splits on any run of whitespace", () => {
    expect(searchTerms("  Botanic   GARDENS ")).toEqual([
      "botanic",
      "gardens",
    ]);
  });
});

describe("slotMatches", () => {
  const beach = slot("b", "Beach run", "East Coast Park", "east");

  it("matches everything when there are no terms", () => {
    expect(slotMatches(beach, [])).toBe(true);
  });

  it("matches on the label", () => {
    expect(slotMatches(beach, ["beach"])).toBe(true);
  });

  it("matches on the location", () => {
    expect(slotMatches(beach, ["coast"])).toBe(true);
  });

  it("matches on the derived NEA region, which the user never typed", () => {
    const central = slot("a", "Lunch", "Somewhere", "central");
    expect(slotMatches(central, ["central"])).toBe(true);
    expect(slotMatches(central, ["east"])).toBe(false);
  });

  it("matches on the indoor tag, which the user never typed either", () => {
    const mall = slot("m", "Groceries", "Jurong Point");
    expect(slotMatches({ ...mall, kind: "indoor" }, ["indoor"])).toBe(true);
    expect(slotMatches({ ...mall, kind: "indoor" }, ["outdoor"])).toBe(false);
  });

  it("finds a stop from before the tag existed under 'outdoor'", () => {
    // The *resolved* kind is what is indexed. Indexing the stored one would
    // quietly make the query mean "tagged outdoor" rather than "outdoors", and
    // every plan predating the field would be missing from the answer.
    expect(slotMatches(beach, ["outdoor"])).toBe(true);
  });

  it("ignores case on both sides", () => {
    expect(slotMatches(beach, ["BEACH"])).toBe(true);
  });

  it("matches partial words, since the field filters as you type", () => {
    expect(slotMatches(beach, ["bea"])).toBe(true);
  });

  it("requires every term, but in any order and across fields", () => {
    expect(slotMatches(beach, ["run", "coast"])).toBe(true);
    expect(slotMatches(beach, ["run", "jurong"])).toBe(false);
  });
});

describe("filterPlans", () => {
  it("returns the very same array for a blank query", () => {
    // Reference equality, not deep equality: the Plans screen renders this
    // into a SectionList, and a fresh array every render rebuilds every
    // section for nothing.
    expect(filterPlans(PLANS, "")).toBe(PLANS);
    expect(filterPlans(PLANS, "   ")).toBe(PLANS);
  });

  it("keeps only the matching stops within a day", () => {
    const result = filterPlans(PLANS, "beach");

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-08-01");
    expect(result[0].slots.map((s) => s.id)).toEqual(["b"]);
  });

  it("drops a day left with no matching stops", () => {
    expect(filterPlans(PLANS, "groceries").map((p) => p.date)).toEqual([
      "2026-08-02",
    ]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterPlans(PLANS, "skiing")).toEqual([]);
  });

  it("does not mutate the plans it was given", () => {
    filterPlans(PLANS, "beach");
    expect(PLANS[0].slots).toHaveLength(2);
  });

  it("can filter a whole region at once", () => {
    const result = filterPlans(PLANS, "west");
    expect(result.map((p) => p.date)).toEqual(["2026-08-02"]);
  });
});

describe("countSlots", () => {
  it("counts stops rather than days", () => {
    expect(countSlots(PLANS)).toBe(3);
  });

  it("is zero for no plans", () => {
    expect(countSlots([])).toBe(0);
  });
});
