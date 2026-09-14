import {
  addExceptionField,
  deleteRoutineDoc,
  removeExceptionField,
  writeRoutine,
  writeRoutineFields,
} from "@/services/routinesSync";
import { useRoutineStore } from "@/store/routineStore";

jest.mock("@/services/routinesSync", () => ({
  writeRoutine: jest.fn(),
  writeRoutineFields: jest.fn(),
  deleteRoutineDoc: jest.fn(),
  addExceptionField: jest.fn(),
  removeExceptionField: jest.fn(),
}));

const mockWriteRoutine = writeRoutine as jest.Mock;
const mockWriteRoutineFields = writeRoutineFields as jest.Mock;
const mockDeleteRoutineDoc = deleteRoutineDoc as jest.Mock;
const mockAddExceptionField = addExceptionField as jest.Mock;
const mockRemoveExceptionField = removeExceptionField as jest.Mock;

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
  jest.clearAllMocks();
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

  it("restores a routine under its own id and exceptions", () => {
    // `addRoutine` mints a new id and empties `exceptions`, which is right for
    // a new rule and wrong for one coming back from a backup: the stops it
    // already made point at the old id, and the exceptions are the record of
    // the days the user deleted on purpose.
    const saved = {
      ...office,
      id: "routine-1",
      exceptions: ["2026-08-05"],
    };

    const restored = useRoutineStore.getState().restoreRoutine(saved);

    expect(restored).toEqual(saved);
    expect(useRoutineStore.getState().routines).toEqual([saved]);
  });

  it("replaces rather than duplicates when the id is already there", () => {
    const saved = { ...office, id: "routine-1", exceptions: [] };
    useRoutineStore.getState().restoreRoutine(saved);

    useRoutineStore.getState().restoreRoutine({ ...saved, label: "Gym" });

    expect(useRoutineStore.getState().routines).toEqual([
      { ...saved, label: "Gym" },
    ]);
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

describe("cloud sync", () => {
  it("addRoutine writes the whole routine to the cloud", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    expect(mockWriteRoutine).toHaveBeenCalledWith(added);
  });

  it("restoreRoutine writes the whole routine to the cloud", () => {
    const saved = { ...office, id: "routine-1", exceptions: [] };

    useRoutineStore.getState().restoreRoutine(saved);

    expect(mockWriteRoutine).toHaveBeenCalledWith(saved);
  });

  it("updateRoutine writes only the changed fields to the cloud", () => {
    const added = useRoutineStore.getState().addRoutine(office);
    mockWriteRoutine.mockClear();

    useRoutineStore.getState().updateRoutine(added.id, { startTime: "10:00" });

    expect(mockWriteRoutineFields).toHaveBeenCalledWith(added.id, {
      startTime: "10:00",
    });
  });

  it("updateRoutine does not write to the cloud for a routine that no longer exists", () => {
    useRoutineStore.getState().updateRoutine("gone", { startTime: "10:00" });

    expect(mockWriteRoutineFields).not.toHaveBeenCalled();
  });

  it("deleteRoutine deletes the cloud doc", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    useRoutineStore.getState().deleteRoutine(added.id);

    expect(mockDeleteRoutineDoc).toHaveBeenCalledWith(added.id);
  });

  it("addException writes the exception to the cloud", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    useRoutineStore.getState().addException(added.id, "2026-08-05");

    expect(mockAddExceptionField).toHaveBeenCalledWith(
      added.id,
      "2026-08-05",
    );
  });

  it("addException does not write to the cloud for a routine that no longer exists", () => {
    useRoutineStore.getState().addException("gone", "2026-08-05");

    expect(mockAddExceptionField).not.toHaveBeenCalled();
  });

  it("addException does not write to the cloud when the exception is already there", () => {
    const added = useRoutineStore.getState().addRoutine(office);
    useRoutineStore.getState().addException(added.id, "2026-08-05");
    mockAddExceptionField.mockClear();

    useRoutineStore.getState().addException(added.id, "2026-08-05");

    expect(mockAddExceptionField).not.toHaveBeenCalled();
  });

  it("removeException writes the removal to the cloud", () => {
    const added = useRoutineStore.getState().addRoutine(office);
    useRoutineStore.getState().addException(added.id, "2026-08-05");

    useRoutineStore.getState().removeException(added.id, "2026-08-05");

    expect(mockRemoveExceptionField).toHaveBeenCalledWith(
      added.id,
      "2026-08-05",
    );
  });

  it("removeException does not write to the cloud when there was no exception to lift", () => {
    const added = useRoutineStore.getState().addRoutine(office);

    useRoutineStore.getState().removeException(added.id, "2026-08-05");

    expect(mockRemoveExceptionField).not.toHaveBeenCalled();
  });
});
