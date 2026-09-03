import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import { AppState } from "react-native";

import { useDeviceLocationPermission } from "@/hooks/useDeviceLocationPermission";
import { resetDeviceLocationStore } from "@/store/deviceLocationStore";

const getPermissions =
  Location.getForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getForegroundPermissionsAsync
  >;
const requestPermissions =
  Location.requestForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.requestForegroundPermissionsAsync
  >;
const getPosition = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;

type Status = Awaited<
  ReturnType<typeof Location.getForegroundPermissionsAsync>
>;

const status = (value: string) => ({ status: value }) as Status;

beforeEach(() => {
  jest.clearAllMocks();
  resetDeviceLocationStore();
  getPermissions.mockResolvedValue(status("granted"));
  requestPermissions.mockResolvedValue(status("granted"));
  getPosition.mockResolvedValue({
    coords: { latitude: 1.3521, longitude: 103.8198 },
  } as Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>);
});

describe("useDeviceLocationPermission", () => {
  it("reads the existing status on mount without prompting", async () => {
    const { result } = await renderHook(() => useDeviceLocationPermission());

    expect(result.current.permission).toBe("granted");
    expect(getPermissions).toHaveBeenCalled();
    // A grant carried over from a previous run must not cost a second dialog.
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("reports a refusal rather than re-asking", async () => {
    getPermissions.mockResolvedValue(status("denied"));

    const { result } = await renderHook(() => useDeviceLocationPermission());

    expect(result.current.permission).toBe("denied");
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("re-reads on return to the foreground, since Settings is the only way back", async () => {
    getPermissions.mockResolvedValue(status("denied"));
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    const { result } = await renderHook(() => useDeviceLocationPermission());
    expect(result.current.permission).toBe("denied");

    // Granted in the system Settings app while we were backgrounded — nothing
    // tells the app, so coming back is the only chance to notice.
    getPermissions.mockResolvedValue(status("granted"));
    await act(async () => {
      listeners.forEach((listener) => listener("active"));
    });

    expect(result.current.permission).toBe("granted");
  });

  it("ignores every app state but the return to the foreground", async () => {
    getPermissions.mockResolvedValue(status("denied"));
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    await renderHook(() => useDeviceLocationPermission());
    getPermissions.mockClear();

    // Going *out* changes nothing we could have learned.
    await act(async () => {
      listeners.forEach((listener) => listener("background"));
    });

    expect(getPermissions).not.toHaveBeenCalled();
  });

  it("notices a grant switched off in Settings, not only one switched on", async () => {
    // The reported bug: the foreground re-read used to run only from `denied`
    // and `unavailable`, so a permission revoked while backgrounded left every
    // screen saying "Location is on" indefinitely.
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    const { result } = await renderHook(() => useDeviceLocationPermission());
    expect(result.current.permission).toBe("granted");

    getPermissions.mockResolvedValue(status("denied"));
    await act(async () => {
      listeners.forEach((listener) => listener("active"));
    });

    expect(result.current.permission).toBe("denied");
  });

  it("does nothing at all when disabled", async () => {
    const { result } = await renderHook(() =>
      useDeviceLocationPermission(false),
    );

    expect(getPermissions).not.toHaveBeenCalled();
    expect(result.current.permission).toBe("checking");
  });

  it("prompts only when asked to", async () => {
    getPermissions.mockResolvedValue(status("undetermined"));
    const { result } = await renderHook(() => useDeviceLocationPermission());
    expect(result.current.permission).toBe("unprompted");

    await act(async () => {
      await result.current.request();
    });

    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(result.current.permission).toBe("granted");
  });
});
