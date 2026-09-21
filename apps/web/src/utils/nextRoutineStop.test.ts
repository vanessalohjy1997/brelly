import { shiftDays, todayKey } from "@brelly/core";

import { makePlan, makeSlot } from "@/test/fixtures";

import { nextRoutineStop } from "./nextRoutineStop";

/** `hour` on `day`, as an ISO instant in local time. */
function at(day: string, hour: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

const today = todayKey();
const tomorrow = shiftDays(today, 1);
const dayAfter = shiftDays(today, 2);
const yesterday = shiftDays(today, -1);

describe("nextRoutineStop", () => {
  it("picks the soonest upcoming stop that belongs to the routine", () => {
    const plans = [
      makePlan(dayAfter, [
        makeSlot({ id: "later", routineId: "r1", startTime: at(dayAfter, 7), endTime: at(dayAfter, 8) }),
      ]),
      makePlan(tomorrow, [
        makeSlot({ id: "other", routineId: "r2", startTime: at(tomorrow, 7), endTime: at(tomorrow, 8) }),
        makeSlot({ id: "next", routineId: "r1", startTime: at(tomorrow, 7), endTime: at(tomorrow, 8) }),
      ]),
    ];

    expect(nextRoutineStop(plans, "r1", new Date())?.id).toBe("next");
  });

  it("ignores stops that have already finished", () => {
    // The archive is a record of what happened; nothing there can be edited
    // as "this and future days".
    const plans = [
      makePlan(yesterday, [
        makeSlot({ id: "gone", routineId: "r1", startTime: at(yesterday, 7), endTime: at(yesterday, 8) }),
      ]),
    ];

    expect(nextRoutineStop(plans, "r1", new Date())).toBeNull();
  });

  it("returns null when the routine has no stop filled in yet", () => {
    const plans = [
      makePlan(tomorrow, [
        makeSlot({ id: "one-off", startTime: at(tomorrow, 7), endTime: at(tomorrow, 8) }),
      ]),
    ];

    expect(nextRoutineStop(plans, "r1", new Date())).toBeNull();
  });
});
