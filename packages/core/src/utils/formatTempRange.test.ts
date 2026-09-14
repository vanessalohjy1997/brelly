import { formatTempRange } from "@/utils/formatTempRange";

describe("formatTempRange", () => {
  it("rounds and formats a low/high range as a Celsius string", () => {
    expect(formatTempRange({ low: 24, high: 33 })).toBe("24–33°C");
  });

  it("rounds fractional values to the nearest degree", () => {
    expect(formatTempRange({ low: 24.4, high: 32.6 })).toBe("24–33°C");
  });
});
