import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useUvIndex } from "@/hooks/useUvIndex";
import { fetchUvIndex } from "@/services/airQuality";

jest.mock("@/services/airQuality", () => ({
  fetchUvIndex: jest.fn(),
}));

const mockUv = fetchUvIndex as jest.Mock;

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
  mockUv.mockResolvedValue(UV_READING);
});

describe("useUvIndex", () => {
  it("returns the latest value and the timestamp it was published at", async () => {
    const { result } = await renderHook(() => useUvIndex(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      value: 8,
      updatedAt: "2026-07-31T13:10:57+08:00",
    });
  });

  it("fetches without a region — UV is island-wide, so no location is needed", async () => {
    const { result } = await renderHook(() => useUvIndex(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUv).toHaveBeenCalledWith();
  });

  it("does not fetch when disabled", async () => {
    await renderHook(() => useUvIndex(false), { wrapper });

    expect(mockUv).not.toHaveBeenCalled();
  });
});
