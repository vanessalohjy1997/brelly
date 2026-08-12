import { getAuth } from "@react-native-firebase/auth";
import { onSnapshot } from "@react-native-firebase/firestore";

import {
  deleteSlotDoc,
  subscribeToSlotsCollection,
  writeSlot,
  writeSlotFields,
} from "@/services/itinerarySync";
import { useToastStore } from "@/store/toastStore";
import { fakeFirestoreDb } from "@/test/fakeFirestore";
import type { ItinerarySlot } from "@/types/itinerary";

const mockGetAuth = getAuth as jest.Mock;

const lunch: ItinerarySlot = {
  id: "s1",
  label: "Lunch",
  location: "Marina Bay Sands",
  neaRegion: "south",
  latitude: 1.2834,
  longitude: 103.8607,
  startTime: "2026-07-31T12:00:00+08:00",
  endTime: "2026-07-31T13:00:00+08:00",
};

const DOC_PATH = "users/test-uid/slots/s1";

beforeEach(() => {
  jest.clearAllMocks();
  fakeFirestoreDb.reset();
  useToastStore.setState({ toast: null, modalHosts: [] });
  mockGetAuth.mockReturnValue({ currentUser: { uid: "test-uid" } });
});

describe("writeSlot", () => {
  it("does nothing before a uid exists", () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    writeSlot(lunch, "2026-07-31");

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("writes the whole slot plus its date to its own doc", () => {
    writeSlot(lunch, "2026-07-31");

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual({
      ...lunch,
      date: "2026-07-31",
    });
  });

  it("never writes notificationId or notificationLeadMinutes", () => {
    writeSlot(
      { ...lunch, notificationId: "notif-1", notificationLeadMinutes: 30 },
      "2026-07-31",
    );

    const doc = fakeFirestoreDb.docs.get(DOC_PATH);
    expect(doc).not.toHaveProperty("notificationId");
    expect(doc).not.toHaveProperty("notificationLeadMinutes");
  });

  it("drops undefined-valued optional fields rather than writing them", () => {
    writeSlot({ ...lunch, notes: undefined }, "2026-07-31");

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).not.toHaveProperty("notes");
  });
});

describe("writeSlotFields", () => {
  it("merges a partial update onto the existing doc", () => {
    writeSlot(lunch, "2026-07-31");

    writeSlotFields("s1", { label: "Brunch" });

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).toEqual({
      ...lunch,
      date: "2026-07-31",
      label: "Brunch",
    });
  });

  it("clears a field the caller set to undefined, rather than leaving it stale", () => {
    writeSlot({ ...lunch, notes: "Bring an umbrella" }, "2026-07-31");

    writeSlotFields("s1", { notes: undefined });

    expect(fakeFirestoreDb.docs.get(DOC_PATH)).not.toHaveProperty("notes");
  });

  it("never merges notificationId or notificationLeadMinutes", () => {
    writeSlot(lunch, "2026-07-31");

    writeSlotFields("s1", {
      notificationId: "notif-1",
      notificationLeadMinutes: 30,
    });

    const doc = fakeFirestoreDb.docs.get(DOC_PATH);
    expect(doc).not.toHaveProperty("notificationId");
    expect(doc).not.toHaveProperty("notificationLeadMinutes");
  });
});

describe("deleteSlotDoc", () => {
  it("removes the slot's doc", () => {
    writeSlot(lunch, "2026-07-31");

    deleteSlotDoc("s1");

    expect(fakeFirestoreDb.docs.has(DOC_PATH)).toBe(false);
  });
});

describe("subscribeToSlotsCollection", () => {
  it("delivers an empty array for a collection with no docs yet", () => {
    const onData = jest.fn();

    subscribeToSlotsCollection("test-uid", onData);

    expect(onData).toHaveBeenCalledWith([]);
  });

  it("groups delivered docs into DayPlans", () => {
    writeSlot(lunch, "2026-07-31");
    const onData = jest.fn();

    subscribeToSlotsCollection("test-uid", onData);

    expect(onData).toHaveBeenCalledWith([
      { id: "2026-07-31", date: "2026-07-31", slots: [lunch] },
    ]);
  });

  it("delivers again when a slot is added after subscribing", () => {
    const onData = jest.fn();
    subscribeToSlotsCollection("test-uid", onData);
    onData.mockClear();

    writeSlot(lunch, "2026-07-31");

    expect(onData).toHaveBeenCalledWith([
      { id: "2026-07-31", date: "2026-07-31", slots: [lunch] },
    ]);
  });

  it("stops delivering after unsubscribe", () => {
    const onData = jest.fn();
    const unsubscribe = subscribeToSlotsCollection("test-uid", onData);
    onData.mockClear();

    unsubscribe();
    writeSlot(lunch, "2026-07-31");

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

    subscribeToSlotsCollection("test-uid", onData, onError);

    expect(onError).toHaveBeenCalledWith(failure);
  });
});

describe("background failures", () => {
  it("report without throwing", async () => {
    const { setDoc } = jest.requireMock("@react-native-firebase/firestore");
    (setDoc as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error("offline")),
    );

    expect(() => writeSlot(lunch, "2026-07-31")).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't sync to the cloud — you're still working locally",
      variant: "error",
    });
  });
});
