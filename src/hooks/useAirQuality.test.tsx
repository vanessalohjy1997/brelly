import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useAirQuality } from "@/hooks/useAirQuality";
import { fetchPsi, fetchUvIndex } from "@/services/airQuality";

jest.mock("@/services/airQuality", () => ({
  fetchPsi: jest.fn(),
  fetchUvIndex: jest.fn(),
}));

const mockPsi = fetchPsi as jest.Mock;
const mockUv = fetchUvIndex as jest.Mock;

const PSI_READING = {
  updatedTimestamp: "2026-07-31T14:00:41+08:00",
  psi: { north: 52, south: 51, east: 52, west: 52, central: 57 },
  pm25: { north: 13, south: 12, east: 13, west: 13, central: 18 },
};

const UV_READING = {
  updatedTimestamp: "2026-07-31T13:10:57+08:00",
  value: 8,
  hour: "2026-07-31T13:00:00+08:00",
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPsi.mockResolvedValue(PSI_READING);
  mockUv.mockResolvedValue(UV_READING);
});

describe("useAirQuality", () => {
  it("returns the PSI for the requested region and the island-wide UV index", async () => {
    const { result } = await renderHook(() => useAirQuality("central"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      psi: 57,
      uvIndex: 8,
      updatedAt: "2026-07-31T14:00:41+08:00",
    });
  });

  it("reads a different region's PSI", async () => {
    const { result } = await renderHook(() => useAirQuality("south"), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.psi).toBe(51);
  });

  it("still returns the UV index when PSI fails", async () => {
    mockPsi.mockRejectedValue(new Error("offline"));

    const { result } = await renderHook(() => useAirQuality("central"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      psi: null,
      uvIndex: 8,
      updatedAt: "2026-07-31T13:10:57+08:00",
    });
  });

  it("still returns PSI when the UV request fails", async () => {
    mockUv.mockRejectedValue(new Error("offline"));

    const { result } = await renderHook(() => useAirQuality("east"), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ psi: 52, uvIndex: null });
  });

  it("does not fetch without a region", async () => {
    const { result } = await renderHook(() => useAirQuality(null), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(mockPsi).not.toHaveBeenCalled();
    expect(mockUv).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", async () => {
    await renderHook(() => useAirQuality("central", false), { wrapper });

    expect(mockPsi).not.toHaveBeenCalled();
  });
});
