import { useItineraryStore } from "@/store/itineraryStore";

// Real Singapore coordinates so `neaRegion` derivation exercises the same
// lookup the app uses — Marina Bay Sands (south) and Jurong East (west).
const MarinaBay = { latitude: 1.2834, longitude: 103.8607 };
const JurongEast = { latitude: 1.3329, longitude: 103.7436 };

function slotInput(overrides: Partial<Parameters<typeof addSlot>[1]> = {}) {
  return {
    label: "Lunch",
    location: "Marina Bay Sands",
    ...MarinaBay,
    startTime: "2026-07-31T15:00:00+08:00",
    endTime: "2026-07-31T16:00:00+08:00",
    ...overrides,
  };
}

const addSlot = useItineraryStore.getState().addSlot;
const updateSlot = useItineraryStore.getState().updateSlot;
const deleteSlot = useItineraryStore.getState().deleteSlot;

const plansOn = (date: string) =>
  useItineraryStore.getState().plans.find((p) => p.date === date);

beforeEach(() => {
  useItineraryStore.setState({ plans: [] });
});

describe("updateSlot", () => {
  it("edits a slot in place when the start date doesn't change", () => {
    const slot = addSlot("2026-07-31", slotInput());

    updateSlot("2026-07-31", slot.id, { label: "Dinner" });

    expect(plansOn("2026-07-31")?.slots).toHaveLength(1);
    expect(plansOn("2026-07-31")?.slots[0].label).toBe("Dinner");
  });

  it("re-files the slot under the new day when the start date changes", () => {
    const slot = addSlot("2026-07-31", slotInput());

    updateSlot("2026-07-31", slot.id, {
      startTime: "2026-08-01T15:00:00+08:00",
      endTime: "2026-08-01T16:00:00+08:00",
    });

    // The whole point: it must not linger on the day it was created on.
    expect(plansOn("2026-07-31")).toBeUndefined();
    expect(plansOn("2026-08-01")?.slots).toHaveLength(1);
    expect(plansOn("2026-08-01")?.slots[0].id).toBe(slot.id);
  });

  it("keeps the rest of the original day's plans when one slot moves away", () => {
    const moving = addSlot("2026-07-31", slotInput({ label: "Lunch" }));
    addSlot("2026-07-31", slotInput({ label: "Coffee" }));

    updateSlot("2026-07-31", moving.id, {
      startTime: "2026-08-01T15:00:00+08:00",
      endTime: "2026-08-01T16:00:00+08:00",
    });

    expect(plansOn("2026-07-31")?.slots.map((s) => s.label)).toEqual(["Coffee"]);
    expect(plansOn("2026-08-01")?.slots.map((s) => s.label)).toEqual(["Lunch"]);
  });

  it("merges into the target day's existing plan, in start-time order", () => {
    addSlot("2026-08-01", slotInput({
      label: "Breakfast",
      startTime: "2026-08-01T09:00:00+08:00",
      endTime: "2026-08-01T10:00:00+08:00",
    }));
    const moving = addSlot("2026-07-31", slotInput({ label: "Lunch" }));

    updateSlot("2026-07-31", moving.id, {
      startTime: "2026-08-01T13:00:00+08:00",
      endTime: "2026-08-01T14:00:00+08:00",
    });

    expect(useItineraryStore.getState().plans).toHaveLength(1);
    expect(plansOn("2026-08-01")?.slots.map((s) => s.label)).toEqual([
      "Breakfast",
      "Lunch",
    ]);
  });

  it("re-derives the NEA region when the slot moves to a new location", () => {
    const slot = addSlot("2026-07-31", slotInput());
    expect(plansOn("2026-07-31")?.slots[0].neaRegion).toBe("south");

    updateSlot("2026-07-31", slot.id, {
      location: "Jurong East",
      ...JurongEast,
    });

    expect(plansOn("2026-07-31")?.slots[0].neaRegion).toBe("west");
  });

  it("is a no-op when the slot isn't on the given day", () => {
    addSlot("2026-07-31", slotInput());
    const before = useItineraryStore.getState().plans;

    updateSlot("2026-07-31", "not-a-real-id", { label: "Dinner" });
    updateSlot("2026-08-01", "not-a-real-id", { label: "Dinner" });

    expect(useItineraryStore.getState().plans).toBe(before);
  });
});

describe("deleteSlot", () => {
  it("drops the day's plan once its last slot is removed", () => {
    const slot = addSlot("2026-07-31", slotInput());

    deleteSlot("2026-07-31", slot.id);

    expect(useItineraryStore.getState().plans).toEqual([]);
  });
});
