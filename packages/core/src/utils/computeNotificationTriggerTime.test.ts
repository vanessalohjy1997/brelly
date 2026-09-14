import { computeNotificationTriggerTime } from "@/utils/computeNotificationTriggerTime";

describe("computeNotificationTriggerTime", () => {
  it("returns a time the default lead (45min) before the slot start, when that's still in the future", () => {
    const slotStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h away
    const result = computeNotificationTriggerTime(slotStartTime);

    expect(result).not.toBeNull();
    const expected = new Date(slotStartTime).getTime() - 45 * 60 * 1000;
    expect(result!.getTime()).toBe(expected);
  });

  it("respects a custom lead time", () => {
    const slotStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const result = computeNotificationTriggerTime(slotStartTime, 15);

    const expected = new Date(slotStartTime).getTime() - 15 * 60 * 1000;
    expect(result!.getTime()).toBe(expected);
  });

  it("returns null when the lead time has already passed (slot starts too soon)", () => {
    const slotStartTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min away
    expect(computeNotificationTriggerTime(slotStartTime)).toBeNull();
  });

  it("returns null for a slot that's already in the past", () => {
    const slotStartTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(computeNotificationTriggerTime(slotStartTime)).toBeNull();
  });
});
