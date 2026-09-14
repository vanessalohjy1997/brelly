import {
  deleteSlotDoc,
  writeSlot,
  writeSlotFields,
} from "@/services/itinerarySync";
import { useItineraryStore } from "@/store/itineraryStore";

jest.mock("@/services/itinerarySync", () => ({
  writeSlot: jest.fn(),
  writeSlotFields: jest.fn(),
  deleteSlotDoc: jest.fn(),
}));

const mockWriteSlot = writeSlot as jest.Mock;
const mockWriteSlotFields = writeSlotFields as jest.Mock;
const mockDeleteSlotDoc = deleteSlotDoc as jest.Mock;

// Real Singapore coordinates so `neaRegion` derivation exercises the same
// lookup the app uses — Marina Bay Sands (south) and Jurong East (west).
const MarinaBay = { latitude: 1.2834, longitude: 103.8607 };
const JurongEast = { latitude: 1.3329, longitude: 103.7436 };
const Bangkok = { latitude: 13.7563, longitude: 100.5018 };

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
  jest.clearAllMocks();
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

  it("re-derives the provider when the slot moves across the Singapore border", () => {
    const slot = addSlot("2026-07-31", slotInput());
    expect(plansOn("2026-07-31")?.slots[0].provider).toBe("nea");

    updateSlot("2026-07-31", slot.id, {
      location: "Bangkok",
      ...Bangkok,
    });

    expect(plansOn("2026-07-31")?.slots[0].provider).toBe("openMeteo");
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

describe("addSlot", () => {
  it("accepts an explicit id, for the routine materialiser's deterministic ids", () => {
    const slot = addSlot("2026-07-31", slotInput(), "r_routine1_2026-07-31");

    expect(slot.id).toBe("r_routine1_2026-07-31");
  });

  it("derives provider 'nea' for a Singapore location", () => {
    const slot = addSlot("2026-07-31", slotInput());

    expect(slot.provider).toBe("nea");
  });

  it("derives provider 'openMeteo' for an overseas location", () => {
    const slot = addSlot(
      "2026-07-31",
      slotInput({ location: "Bangkok", ...Bangkok }),
    );

    expect(slot.provider).toBe("openMeteo");
  });
});

describe("cloud sync", () => {
  it("addSlot writes the whole slot to the cloud", () => {
    const slot = addSlot("2026-07-31", slotInput());

    expect(mockWriteSlot).toHaveBeenCalledWith(slot, "2026-07-31");
  });

  it("restoreSlot writes the whole slot to the cloud", () => {
    const slot = addSlot("2026-07-31", slotInput());
    mockWriteSlot.mockClear();

    useItineraryStore.getState().restoreSlot("2026-07-31", slot);

    expect(mockWriteSlot).toHaveBeenCalledWith(slot, "2026-07-31");
  });

  it("updateSlot writes only the changed fields plus the target date to the cloud", () => {
    const slot = addSlot("2026-07-31", slotInput());
    mockWriteSlot.mockClear();

    updateSlot("2026-07-31", slot.id, { label: "Dinner" });

    expect(mockWriteSlotFields).toHaveBeenCalledWith(slot.id, {
      label: "Dinner",
      date: "2026-07-31",
    });
  });

  it("updateSlot does not write to the cloud for a slot that no longer exists", () => {
    updateSlot("2026-07-31", "not-a-real-id", { label: "Dinner" });

    expect(mockWriteSlotFields).not.toHaveBeenCalled();
    expect(mockWriteSlot).not.toHaveBeenCalled();
  });

  it("deleteSlot deletes the cloud doc", () => {
    const slot = addSlot("2026-07-31", slotInput());

    deleteSlot("2026-07-31", slot.id);

    expect(mockDeleteSlotDoc).toHaveBeenCalledWith(slot.id);
  });

  it("deletePlan deletes every slot's cloud doc", () => {
    const a = addSlot("2026-07-31", slotInput({ label: "Lunch" }));
    const b = addSlot("2026-07-31", slotInput({ label: "Coffee" }));

    useItineraryStore.getState().deletePlan("2026-07-31");

    expect(mockDeleteSlotDoc).toHaveBeenCalledWith(a.id);
    expect(mockDeleteSlotDoc).toHaveBeenCalledWith(b.id);
  });
});

describe("detaching a routine's slot", () => {
  it("re-keys the slot to a fresh id and clears routineId", () => {
    const slot = addSlot("2026-07-31", slotInput(), "r_routine1_2026-07-31");
    useItineraryStore.setState({
      plans: [
        {
          id: "2026-07-31",
          date: "2026-07-31",
          slots: [{ ...slot, routineId: "routine1" }],
        },
      ],
    });

    const detached = updateSlot("2026-07-31", slot.id, {
      routineId: undefined,
    });

    expect(detached?.id).not.toBe(slot.id);
    expect(detached?.routineId).toBeUndefined();
  });

  it("deletes the old cloud doc and writes the new one under the new id", () => {
    const slot = addSlot("2026-07-31", slotInput(), "r_routine1_2026-07-31");
    useItineraryStore.setState({
      plans: [
        {
          id: "2026-07-31",
          date: "2026-07-31",
          slots: [{ ...slot, routineId: "routine1" }],
        },
      ],
    });
    mockWriteSlot.mockClear();

    const detached = updateSlot("2026-07-31", slot.id, {
      routineId: undefined,
    });

    expect(mockDeleteSlotDoc).toHaveBeenCalledWith(slot.id);
    expect(mockWriteSlot).toHaveBeenCalledWith(detached, "2026-07-31");
    expect(mockWriteSlotFields).not.toHaveBeenCalled();
  });

  it("does not re-key an ordinary edit that never had a routineId", () => {
    const slot = addSlot("2026-07-31", slotInput());

    const updated = updateSlot("2026-07-31", slot.id, { label: "Dinner" });

    expect(updated?.id).toBe(slot.id);
  });
});
