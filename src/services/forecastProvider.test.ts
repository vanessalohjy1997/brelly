import { getForecastForSlotByProvider } from "@/services/forecastProvider";
import { getOpenMeteoForecastForSlot } from "@/services/openMeteo";
import { getForecastForSlot } from "@/services/weather";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest.fn(),
}));
jest.mock("@/services/openMeteo", () => ({
  getOpenMeteoForecastForSlot: jest.fn(),
}));

const mockGetForecastForSlot = getForecastForSlot as jest.Mock;
const mockGetOpenMeteoForecastForSlot = getOpenMeteoForecastForSlot as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForecastForSlot.mockResolvedValue({ forecast: "nea", source: "24hr" });
  mockGetOpenMeteoForecastForSlot.mockResolvedValue({
    forecast: "openMeteo",
    source: "openMeteoHourly",
  });
});

describe("getForecastForSlotByProvider", () => {
  it("calls only the NEA fetcher for provider 'nea'", async () => {
    const result = await getForecastForSlotByProvider({
      provider: "nea",
      region: "east",
      latitude: 1.3,
      longitude: 103.9,
      slotStartTime: "2026-08-17T12:00:00+08:00",
    });

    expect(mockGetForecastForSlot).toHaveBeenCalledWith(
      "east",
      1.3,
      103.9,
      "2026-08-17T12:00:00+08:00",
    );
    expect(mockGetOpenMeteoForecastForSlot).not.toHaveBeenCalled();
    expect(result.forecast).toBe("nea");
  });

  it("calls only the Open-Meteo fetcher for provider 'openMeteo'", async () => {
    const result = await getForecastForSlotByProvider({
      provider: "openMeteo",
      region: "central",
      latitude: 13.7563,
      longitude: 100.5018,
      slotStartTime: "2026-08-17T12:00:00Z",
    });

    expect(mockGetOpenMeteoForecastForSlot).toHaveBeenCalledWith(
      13.7563,
      100.5018,
      "2026-08-17T12:00:00Z",
    );
    expect(mockGetForecastForSlot).not.toHaveBeenCalled();
    expect(result.forecast).toBe("openMeteo");
  });
});
