import { getAuth } from "@react-native-firebase/auth";
import { onSnapshot } from "@react-native-firebase/firestore";

import {
  addExceptionField,
  deleteRoutineDoc,
  removeExceptionField,
  subscribeToRoutinesCollection,
  writeRoutine,
  writeRoutineFields,
} from "@/services/routinesSync";
import { useToastStore } from "@/store/toastStore";
import { fakeFirestoreDb } from "@/test/fakeFirestore";
import type { Routine } from "@/types/routine";

const mockGetAuth = getAuth as jest.Mock;

const office: Routine = {
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
};

const DOC_PATH = "users/test-uid/routines/r1";

beforeEach(() => {
  jest.clearAllMocks();
  fakeFirestoreDb.reset();
  useToastStore.setState({ toast: null, modalHosts: [] });
  mockGetAuth.mockReturnValue({ currentUser: { uid: "test-uid" } });
});

describe("writeRoutine", () => {
  it("does nothing before a uid exists", () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    writeRoutine(office);

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("writes the whole routine to its own doc", () => {
    writeRoutine(office);

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual(office);
  });

  it("does not throw for a routine built with an explicit undefined endDate", () => {
    // plan/new.tsx builds `addRoutine({ ..., endDate: repeat.endDate, ... })`
    // — an "ongoing" routine (no end date chosen) means `repeat.endDate` is
    // `undefined`, not omitted. Firestore rejects a literal `undefined`
    // outright, so this used to throw on every ongoing routine's creation.
    const ongoing: Routine = { ...office, endDate: undefined };

    expect(() => writeRoutine(ongoing)).not.toThrow();
    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual(office);
  });
});

describe("writeRoutineFields", () => {
  it("merges a partial update onto the existing doc", () => {
    writeRoutine(office);

    writeRoutineFields("r1", { startTime: "10:00" });

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual({
      ...office,
      startTime: "10:00",
    });
  });

  it("clears a field via deleteField when the update sets it to undefined", () => {
    writeRoutine({ ...office, endDate: "2026-12-31" });

    writeRoutineFields("r1", { endDate: undefined });

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual(office);
  });
});

describe("deleteRoutineDoc", () => {
  it("removes the routine's doc", () => {
    writeRoutine(office);

    deleteRoutineDoc("r1");

    expect(fakeFirestoreDb.docs.has(DOC_PATH)).toBe(false);
  });
});

describe("addExceptionField / removeExceptionField", () => {
  it("unions a date into the exceptions array without clobbering the rest of the doc", () => {
    writeRoutine(office);

    addExceptionField("r1", "2026-08-05");

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual({
      ...office,
      exceptions: ["2026-08-05"],
    });
  });

  it("does not duplicate an exception already present", () => {
    writeRoutine(office);
    addExceptionField("r1", "2026-08-05");

    addExceptionField("r1", "2026-08-05");

    expect(fakeFirestoreDb.docs.get(DOC_PATH)?.exceptions).toEqual([
      "2026-08-05",
    ]);
  });

  it("removes a date from the exceptions array", () => {
    writeRoutine({ ...office, exceptions: ["2026-08-05", "2026-08-12"] });

    removeExceptionField("r1", "2026-08-05");

    expect(fakeFirestoreDb.docs.get(DOC_PATH)?.exceptions).toEqual([
      "2026-08-12",
    ]);
  });
});

describe("subscribeToRoutinesCollection", () => {
  it("delivers an empty array for a collection with no docs yet", () => {
    const onData = jest.fn();

    subscribeToRoutinesCollection("test-uid", onData);

    expect(onData).toHaveBeenCalledWith([]);
  });

  it("delivers every routine doc under the uid", () => {
    writeRoutine(office);
    writeRoutine({ ...office, id: "r2", label: "Gym" });
    const onData = jest.fn();

    subscribeToRoutinesCollection("test-uid", onData);

    expect(onData).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "r1", label: "Office" }),
        expect.objectContaining({ id: "r2", label: "Gym" }),
      ]),
    );
  });

  it("delivers again when a routine is added after subscribing", () => {
    const onData = jest.fn();
    subscribeToRoutinesCollection("test-uid", onData);
    onData.mockClear();

    writeRoutine(office);

    expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: "r1" })]);
  });

  it("stops delivering after unsubscribe", () => {
    const onData = jest.fn();
    const unsubscribe = subscribeToRoutinesCollection("test-uid", onData);
    onData.mockClear();

    unsubscribe();
    writeRoutine(office);

    expect(onData).not.toHaveBeenCalled();
  });

  it("hands a listener failure to onError rather than throwing", () => {
    const mockOnSnapshot = onSnapshot as jest.Mock;
    const failure = new Error("permission-denied");
    mockOnSnapshot.mockImplementationOnce((_ref, _onNext, onErrorCb) => {
      onErrorCb(failure);
      return () => {};
    });
    const onData = jest.fn();
    const onError = jest.fn();

    subscribeToRoutinesCollection("test-uid", onData, onError);

    expect(onError).toHaveBeenCalledWith(failure);
  });
});

describe("background failures", () => {
  it("report without throwing", async () => {
    const { setDoc } = jest.requireMock("@react-native-firebase/firestore");
    (setDoc as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error("offline")),
    );

    expect(() => writeRoutine(office)).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't sync to the cloud — you're still working locally",
      variant: "error",
    });
  });
});
