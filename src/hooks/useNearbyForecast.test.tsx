import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { getUpcomingForecast } from "@/services/weather";
import {
  resetDeviceLocationStore,
  useDeviceLocationStore,
} from "@/store/deviceLocationStore";

jest.mock("@/services/weather", () => ({
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

const mockGetPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const mockRequestPermission =
  Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** Drives the AppState listener the hook registers while it can recover. */
async function foreground() {
  const addEventListener = AppState.addEventListener as unknown as jest.Mock;
  const handler = addEventListener.mock.calls.at(-1)?.[1];
  await act(async () => {
    handler?.("active");
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDeviceLocationStore();
  mockGetPermission.mockResolvedValue({ status: "undetermined" });
  mockRequestPermission.mockResolvedValue({ status: "granted" });
  mockPosition.mockResolvedValue({
    // Marina Bay. `getRegionFromCoordinates` files this under NEA's south
    // region — the mapping itself is covered in neaRegions.test.ts.
    coords: { latitude: 1.2833, longitude: 103.8607 },
  });
  jest.spyOn(AppState, "addEventListener").mockReturnValue({
    remove: jest.fn(),
  } as unknown as ReturnType<typeof AppState.addEventListener>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useNearbyForecast", () => {
  it("does not prompt on mount — the OS dialog needs an explanation first", async () => {
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("unprompted"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(getUpcomingForecast).not.toHaveBeenCalled();
  });

  it("prompts only when asked, and resolves a region on grant", async () => {
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unprompted"));

    await act(async () => {
      await result.current.requestPermission();
    });

    await waitFor(() => expect(result.current.permission).toBe("granted"));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.region).toBe("south");
    expect(result.current.isAvailable).toBe(true);
  });

  it("reports a refusal as denied so the caller can offer a way back", async () => {
    mockRequestPermission.mockResolvedValue({ status: "denied" });
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unprompted"));

    await act(async () => {
      await result.current.requestPermission();
    });

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.isAvailable).toBe(false);
  });

  it("skips the prompt entirely when permission was granted on a previous run", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("granted"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("surfaces a standing denial without re-prompting", async () => {
    mockGetPermission.mockResolvedValue({ status: "denied" });

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("distinguishes a granted permission with no fix from a refusal", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });
    mockPosition.mockRejectedValue(new Error("no fix"));

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("unavailable"));
  });

  it("does nothing at all when disabled — a screen with plans never prompts", async () => {
    const { result } = await renderHook(() => useNearbyForecast(false), {
      wrapper,
    });

    expect(mockGetPermission).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(result.current.forecasts).toEqual([]);
  });

  it("resolves the device location but skips the forecast preview when only the location is wanted", async () => {
    // Today keeps location on even with plans — the "Right now" card is
    // anchored to the device point — but only wants the empty-state forecast
    // preview when there are no plans.
    mockGetPermission.mockResolvedValue({ status: "granted" });

    const { result } = await renderHook(
      () => useNearbyForecast(true, { fetchForecast: false }),
      { wrapper },
    );

    // The location resolved: coords and region are there for the live card…
    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    expect(result.current.region).toBe("south");
    expect(result.current.coords).toEqual({
      latitude: 1.2833,
      longitude: 103.8607,
    });
    // …but the upcoming-forecast preview was never fetched.
    expect(getUpcomingForecast).not.toHaveBeenCalled();
    expect(result.current.forecasts).toEqual([]);
  });

  // The regression this hook was rewritten for. Native tabs keep every screen
  // mounted, so Today and Plans both hold a live copy of this hook at once.
  it("grants once for the whole app, not once per screen", async () => {
    const { result } = await renderHook(
      () => ({
        today: useNearbyForecast(true),
        plans: useNearbyForecast(true),
      }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.today.permission).toBe("unprompted"),
    );
    expect(result.current.plans.permission).toBe("unprompted");
    // Two consumers, one round trip.
    expect(mockGetPermission).toHaveBeenCalledTimes(1);

    // Granted from Plans…
    await act(async () => {
      await result.current.plans.requestPermission();
    });

    // …and Today has it too, without a second prompt.
    await waitFor(() => expect(result.current.today.isAvailable).toBe(true));
    expect(result.current.today.region).toBe("south");
    expect(result.current.plans.isAvailable).toBe(true);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("picks up a grant made outside the hook, like the onboarding primer's", async () => {
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unprompted"));

    await act(async () => {
      await useDeviceLocationStore.getState().request();
    });

    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    expect(result.current.region).toBe("south");
  });

  it("re-reads on the way back from Settings, so a denial can recover", async () => {
    mockGetPermission.mockResolvedValue({ status: "denied" });
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("denied"));

    mockGetPermission.mockResolvedValue({ status: "granted" });
    await foreground();

    await waitFor(() => expect(result.current.permission).toBe("granted"));
    // Recovered by re-reading, not by prompting again — iOS wouldn't show the
    // dialog a second time anyway.
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("re-reads on the way back when no fix came back either", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });
    mockPosition.mockRejectedValueOnce(new Error("no fix"));
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unavailable"));

    await foreground();

    await waitFor(() => expect(result.current.permission).toBe("granted"));
  });

  it("drops the forecast when the grant is switched off in Settings", async () => {
    // The re-read runs from every state, not only the ones with something to
    // recover — otherwise a revoked permission leaves the nearby card up, fed
    // by the point the store was still holding.
    mockGetPermission.mockResolvedValue({ status: "granted" });
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    mockGetPermission.mockResolvedValue({ status: "denied" });
    await foreground();

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.coords).toBeNull();
    expect(result.current.region).toBeNull();
  });
});
