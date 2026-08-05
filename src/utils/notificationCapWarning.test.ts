import { assessNotificationCap } from "@/utils/notificationCapWarning";

describe("assessNotificationCap", () => {
  it("reports safe when well below cap", () => {
    const status = assessNotificationCap(10);
    expect(status.nearCap).toBe(false);
    expect(status.atCap).toBe(false);
  });

  it("reports nearCap when approaching limit", () => {
    const status = assessNotificationCap(55);
    expect(status.nearCap).toBe(true);
    expect(status.atCap).toBe(false);
  });

  it("reports atCap when at the limit", () => {
    const status = assessNotificationCap(64);
    expect(status.nearCap).toBe(false);
    expect(status.atCap).toBe(true);
  });

  it("reports atCap when over the limit", () => {
    const status = assessNotificationCap(70);
    expect(status.atCap).toBe(true);
  });
});
