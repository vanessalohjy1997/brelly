import type { Routine } from "@/types/routine";
import { findRoutineById, routineForSlot } from "@/utils/routineSelectors";

const routines: Routine[] = [
  {
    id: "r1",
    label: "Office",
    location: "Raffles Place, Singapore",
    latitude: 1.2843,
    longitude: 103.8514,
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
    startDate: "2026-08-03",
    exceptions: [],
  },
];

describe("findRoutineById", () => {
  it("finds one by id", () => {
    expect(findRoutineById(routines, "r1")?.label).toBe("Office");
  });

  it("returns undefined for an id that isn't there", () => {
    expect(findRoutineById(routines, "r2")).toBeUndefined();
  });
});

describe("routineForSlot", () => {
  it("resolves a slot's routine", () => {
    expect(routineForSlot(routines, "r1")?.label).toBe("Office");
  });

  it("returns undefined for a slot that belongs to no routine", () => {
    expect(routineForSlot(routines, undefined)).toBeUndefined();
  });

  it("returns undefined for a routine that has since been deleted", () => {
    // A stop can outlive its rule between the delete and the next sweep, and
    // the edit screen has to read that as an ordinary plan rather than crash.
    expect(routineForSlot(routines, "gone")).toBeUndefined();
  });
});
