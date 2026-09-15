import { renderHook } from "@testing-library/react";

import {
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";
import { useDialogStore } from "@/store/dialogStore";

import { useDeleteSlotWithUndo } from "./useDeleteSlotWithUndo";

/**
 * The day bucket and the slot's own start have to agree. `updateSlot` re-files
 * a slot into the bucket matching `toDateKey(startTime)`, so a fixture whose
 * date and start disagree silently moves the stop on the first write and the
 * second one finds nothing — which looks exactly like the write not applying.
 *
 * Well in the future, so nothing here counts as "already ended".
 */
const date = "2099-01-01";
const future = {
  startTime: "2099-01-01T04:00:00.000Z",
  endTime: "2099-01-01T05:00:00.000Z",
};

function seed(slot = makeSlot(future)) {
  useItineraryStore.setState({ plans: [makePlan(date, [slot])] });
  return slot;
}

function answer(key: string) {
  useDialogStore.getState().answer(key);
}

beforeEach(() => {
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useDialogStore.setState({ dialog: null });
});

const hook = () => renderHook(() => useDeleteSlotWithUndo()).result.current;

describe("deleting an ordinary stop", () => {
  it("removes it and offers it back", async () => {
    const slot = seed();

    await hook()(date, slot);

    expect(useItineraryStore.getState().plans).toEqual([]);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Lunch",
      action: { label: "Undo" },
    });
  });

  it("puts it back under the same id", async () => {
    // An undo that minted a fresh id would orphan anything pointing at the old
    // one, and would read as a different stop to the phone sharing the account.
    const slot = seed();
    await hook()(date, slot);

    useToastStore.getState().toast?.action?.onPress();

    const [plan] = useItineraryStore.getState().plans;
    expect(plan.slots[0].id).toBe(slot.id);
  });

  it("strips a phone's alert handle on the way back", async () => {
    // The handle belongs to an alert queue this platform does not have, and
    // carrying a stale one back would leave that phone believing the stop is
    // still scheduled — nothing would ever fire for it again.
    const slot = seed(makeSlot({ ...future, notificationId: "notif-1" }));
    await hook()(date, slot);

    useToastStore.getState().toast?.action?.onPress();

    expect(useItineraryStore.getState().plans[0].slots[0]).not.toHaveProperty(
      "notificationId",
    );
  });

  it("asks nothing, because the undo is the safety net", async () => {
    const slot = seed();
    await hook()(date, slot);

    expect(useDialogStore.getState().dialog).toBeNull();
  });
});

describe("deleting a routine's stop", () => {
  const routine = makeRoutine();
  const slot = () => makeSlot({ ...future, routineId: routine.id });

  beforeEach(() => {
    useRoutineStore.setState({ routines: [routine] });
  });

  it("asks which delete was meant", async () => {
    // "Delete this" is genuinely two different deletes, and no undo can guess
    // which was meant — the one case where a question beats an undo.
    const target = seed(slot());
    const pending = hook()(date, target);

    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "Delete Lunch?",
    });

    answer("day");
    await pending;
  });

  it("changes nothing when the question is dismissed", async () => {
    const target = seed(slot());
    const pending = hook()(date, target);

    answer("cancel");

    await expect(pending).resolves.toBeNull();
    expect(useItineraryStore.getState().plans[0].slots).toHaveLength(1);
  });

  it("records an exception so the next top-up does not refill the day", async () => {
    // A stop a routine filled in has to be remembered as *deleted*, not merely
    // absent: the materialiser reads an empty day as "not filled yet".
    const target = seed(slot());
    const pending = hook()(date, target);
    answer("day");
    await pending;

    expect(useRoutineStore.getState().routines[0].exceptions).toContain(date);
  });

  it("lifts the exception before the stop goes back", async () => {
    const target = seed(slot());
    const pending = hook()(date, target);
    answer("day");
    await pending;

    useToastStore.getState().toast?.action?.onPress();

    expect(useRoutineStore.getState().routines[0].exceptions).not.toContain(date);
  });

  it("deletes the rule, not the archive, on the series answer", async () => {
    const target = seed(slot());
    const pending = hook()(date, target);

    answer("series");
    await pending;

    expect(useRoutineStore.getState().routines).toEqual([]);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Lunch and its repeats",
    });
  });

  it("restores the rule with its id and its exceptions intact", async () => {
    // `restoreRoutine` keeps both: the id so days already filed under it are
    // not orphaned, the exceptions so days deliberately deleted stay deleted.
    const withException = makeRoutine({ exceptions: ["2026-09-01"] });
    useRoutineStore.setState({ routines: [withException] });
    const target = seed(slot());
    const pending = hook()(date, target);
    answer("series");
    await pending;

    useToastStore.getState().toast?.action?.onPress();

    expect(useRoutineStore.getState().routines[0]).toMatchObject({
      id: withException.id,
      exceptions: ["2026-09-01"],
    });
  });

  it("asks nothing about a stop that has already ended", async () => {
    // The archive is a record of what happened, and no top-up touches a day
    // before today — so asking would offer "delete all future days" from the
    // one screen that only holds history.
    const ended = seed(
      makeSlot({
        routineId: routine.id,
        startTime: "2020-01-01T12:00:00.000Z",
        endTime: "2020-01-01T13:00:00.000Z",
      }),
    );

    await hook()(date, ended);

    expect(useDialogStore.getState().dialog).toBeNull();
    expect(useItineraryStore.getState().plans).toEqual([]);
  });
});
