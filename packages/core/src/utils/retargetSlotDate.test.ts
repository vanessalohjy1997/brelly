import { retargetSlotDate } from "@/utils/retargetSlotDate";

describe("retargetSlotDate", () => {
  it("moves the date forward while keeping the same local time-of-day", () => {
    const original = new Date(2026, 6, 30, 14, 30, 0).toISOString(); // 30 Jul 2026, 2:30pm local
    const result = retargetSlotDate(original, "2026-08-02");

    const resultDate = new Date(result);
    expect(resultDate.getFullYear()).toBe(2026);
    expect(resultDate.getMonth()).toBe(7); // August
    expect(resultDate.getDate()).toBe(2);
    expect(resultDate.getHours()).toBe(14);
    expect(resultDate.getMinutes()).toBe(30);
  });

  it("moves the date backward while keeping the same local time-of-day", () => {
    const original = new Date(2026, 6, 30, 9, 15, 0).toISOString();
    const result = retargetSlotDate(original, "2026-07-25");

    const resultDate = new Date(result);
    expect(resultDate.getDate()).toBe(25);
    expect(resultDate.getHours()).toBe(9);
    expect(resultDate.getMinutes()).toBe(15);
  });

  it("handles a year boundary crossing", () => {
    const original = new Date(2026, 0, 1, 8, 0, 0).toISOString();
    const result = retargetSlotDate(original, "2025-12-31");

    const resultDate = new Date(result);
    expect(resultDate.getFullYear()).toBe(2025);
    expect(resultDate.getMonth()).toBe(11);
    expect(resultDate.getDate()).toBe(31);
    expect(resultDate.getHours()).toBe(8);
  });
});
