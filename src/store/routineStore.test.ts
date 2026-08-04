import { useRoutineStore } from "@/store/routineStore";

/** 3 Aug 2026 is a Monday. */
const MONDAY = "2026-08-03";

const office = {
  label: "Office",
  location: "Raffles Place, Singapore",
  latitude: 1.2843,
  longitude: 103.8514,
  weekdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  startDate: MONDAY,
};

beforeEach(() => {
  useRoutineStore.setState({ routines: [] });
});

describe("useRoutineStore", () => {
  it("returns the routine it added, so the caller can materialise it", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    expect(added.id).toBeTruthy();
    expect(added.label).toBe("Office");
    expect(useRoutineStore.getState().routines).toEqual([added]);
  });

  it("starts every routine with no exceptions", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    expect(added.exceptions).toEqual([]);
  });

  it("gives each routine its own id", () => {
    const first = useRoutineStore.getState().addRoutine(office);
    const second = useRoutineStore.getState().addRoutine(office);

    expect(first.id).not.toBe(second.id);
  });

  it("edits a rule without disturbing the days already excepted", () => {
    const added = useRoutineStore.getState().addRoutine(office);
    useRoutineStore.getState().addException(added.id, "2026-08-05");

    useRoutineStore.getState().updateRoutine(added.id, { startTime: "10:00" });

    const [routine] = useRoutineStore.getState().routines;
    expect(routine.startTime).toBe("10:00");
    expect(routine.exceptions).toEqual(["2026-08-05"]);
  });

  it("records an exception once, however many times a day is deleted", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    useRoutineStore.getState().addException(added.id, "2026-08-05");
    useRoutineStore.getState().addException(added.id, "2026-08-05");

    expect(useRoutineStore.getState().routines[0].exceptions).toEqual([
      "2026-08-05",
    ]);
  });

  it("lifts an exception, which is what an undone delete needs", () => {
    const added = useRoutineStore.getState().addRoutine(office);
    useRoutineStore.getState().addException(added.id, "2026-08-05");

    useRoutineStore.getState().removeException(added.id, "2026-08-05");

    expect(useRoutineStore.getState().routines[0].exceptions).toEqual([]);
  });

  it("ignores an exception for a routine that no longer exists", () => {
    // A slot can outlive its rule — deleting the routine leaves the current
    // day's stop on screen until the next sweep, and deleting *that* must not
    // throw.
    expect(() =>
      useRoutineStore.getState().addException("gone", "2026-08-05"),
    ).not.toThrow();
    expect(useRoutineStore.getState().routines).toEqual([]);
  });

  it("deletes only the routine asked for", () => {
    const first = useRoutineStore.getState().addRoutine(office);
    const second = useRoutineStore
      .getState()
      .addRoutine({ ...office, label: "Gym" });

    useRoutineStore.getState().deleteRoutine(first.id);

    expect(useRoutineStore.getState().routines).toEqual([second]);
  });
});
