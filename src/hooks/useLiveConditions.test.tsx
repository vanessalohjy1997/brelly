import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useLiveConditions } from "@/hooks/useLiveConditions";
import { getLiveConditions } from "@/services/liveConditions";

jest.mock("@/services/liveConditions", () => ({
  getLiveConditions: jest.fn(),
}));

const mockGetLiveConditions = getLiveConditions as jest.Mock;

const READING = {
  stationName: "Tanjong Rhu",
  observedAt: "2026-07-31T14:10:00+08:00",
  rainfallMm: 1.4,
  temperatureC: 29.8,
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
  mockGetLiveConditions.mockResolvedValue(READING);
});

describe("useLiveConditions", () => {
  it("fetches the readings for the given point", async () => {
    const { result } = await renderHook(
      () => useLiveConditions(1.3, 103.882),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(READING));
    expect(mockGetLiveConditions).toHaveBeenCalledWith(1.3, 103.882);
  });

  it("does not fetch without coordinates", async () => {
    const { result } = await renderHook(() => useLiveConditions(null, null), {
      wrapper,
    });

    expect(result.current.data).toBeUndefined();
    expect(mockGetLiveConditions).not.toHaveBeenCalled();
  });

  it("does not fetch when only one coordinate is known", async () => {
    await renderHook(() => useLiveConditions(1.3, null), { wrapper });

    expect(mockGetLiveConditions).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", async () => {
    await renderHook(() => useLiveConditions(1.3, 103.882, false), { wrapper });

    expect(mockGetLiveConditions).not.toHaveBeenCalled();
  });

  it("passes through a null result when no station reported", async () => {
    mockGetLiveConditions.mockResolvedValue(null);

    const { result } = await renderHook(
      () => useLiveConditions(1.3, 103.882),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
