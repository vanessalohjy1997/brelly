import { renderHook } from "@testing-library/react";

import {
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { makePlan, makeRoutine, makeSlot } from "@/test/fixtures";
import { useDialogStore } from "@/store/dialogStore";

import { useMuteSlotWithUndo } from "./useMuteSlotWithUndo";

/**
 * The day bucket and the slot's own start have to agree. `updateSlot` re-files
 * a slot into the bucket matching `toDateKey(startTime)`, so a fixture whose
 * date and start disagree silently moves the stop on the first write and the
 * second one finds nothing — which looks exactly like the write not applying.
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

const answer = (key: string) => useDialogStore.getState().answer(key);
const hook = () => renderHook(() => useMuteSlotWithUndo()).result.current;
const slots = () => useItineraryStore.getState().plans[0]?.slots ?? [];

beforeEach(() => {
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useDialogStore.setState({ dialog: null });
});

describe("muting a one-off stop", () => {
  it("sets the cross-client flag the phone reads", async () => {
    // The web sends no alerts. Muting from a laptop is how you stop your phone
    // buzzing about a stop, which is why this is not one of the features web
    // drops.
    const slot = seed();

    await hook()(date, slot);

    expect(slots()[0].notificationsMuted).toBe(true);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Rain alerts off for Lunch",
      action: { label: "Undo" },
    });
  });

  it("clears the phone's alert handle with it", async () => {
    // A stale id reads as "already scheduled" forever —
    // `planNotificationResync` takes `!!notificationId` at its word.
    const slot = seed(makeSlot({ ...future, notificationId: "notif-1" }));

    await hook()(date, slot);

    expect(slots()[0].notificationId).toBeUndefined();
  });

  it("unmutes a muted stop", async () => {
    const slot = seed(makeSlot({ ...future, notificationsMuted: true }));

    await hook()(date, slot);

    expect(slots()[0].notificationsMuted).toBe(false);
    expect(useToastStore.getState().toast?.message).toBe(
      "Rain alerts on for Lunch",
    );
  });

  it("puts the flag back on undo", async () => {
    const slot = seed();
    await hook()(date, slot);

    useToastStore.getState().toast?.action?.onPress();

    expect(slots()[0].notificationsMuted).toBe(false);
  });
});

describe("muting a routine's stop", () => {
  const routine = makeRoutine();

  beforeEach(() => {
    useRoutineStore.setState({ routines: [routine] });
  });

  it("asks, because a silent per-day flag would not survive the next top-up", async () => {
    // Rule 4 of `planRoutineMaterialization` replaces any slot that disagrees
    // with its rule.
    const slot = seed(makeSlot({ ...future, routineId: routine.id }));
    const pending = hook()(date, slot);

    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "Mute Lunch?",
    });

    answer("cancel");
    await expect(pending).resolves.toBeNull();
    expect(slots()[0].notificationsMuted).toBeUndefined();
  });

  it("moves the rule on the series answer", async () => {
    const slot = seed(makeSlot({ ...future, routineId: routine.id }));
    const pending = hook()(date, slot);

    answer("series");
    await pending;

    expect(useRoutineStore.getState().routines[0].notificationsMuted).toBe(true);
  });

  it("detaches the stop, then records the exception, on the day answer", async () => {
    // The order is load-bearing. An exception with no detach behind it is the
    // one state nothing recovers from: the day drops out of the routine's
    // occurrences, so the next top-up reads the stop as unwanted and sweeps the
    // thing the user only meant to mute.
    const slot = seed(makeSlot({ ...future, routineId: routine.id }));
    const pending = hook()(date, slot);

    answer("day");
    await pending;

    expect(slots()[0].routineId).toBeUndefined();
    expect(useRoutineStore.getState().routines[0].exceptions).toContain(date);
  });

  it("offers no undo on either routine path", async () => {
    // Both were asked about before anything happened, and the day answer
    // detached the stop on the way through — an "undo" that silently
    // re-attached it would be a third answer to a question that had two.
    const slot = seed(makeSlot({ ...future, routineId: routine.id }));
    const pending = hook()(date, slot);
    answer("day");
    await pending;

    expect(useToastStore.getState().toast?.action).toBeUndefined();
  });
});
