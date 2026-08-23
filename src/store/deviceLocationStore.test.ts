import * as Location from "expo-location";

import {
  resetDeviceLocationStore,
  useDeviceLocationStore,
} from "@/store/deviceLocationStore";

const mockGetPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const mockRequestPermission =
  Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

const store = () => useDeviceLocationStore.getState();

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
});

describe("deviceLocationStore", () => {
  it("starts out knowing nothing, and asks the OS for nothing until told to", () => {
    expect(store().permission).toBe("checking");
    expect(store().region).toBeNull();
    expect(store().coords).toBeNull();
    expect(mockGetPermission).not.toHaveBeenCalled();
  });

  it("reads the status on sync without ever prompting", async () => {
    await store().sync();

    expect(store().permission).toBe("unprompted");
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("resolves a region and a point when the permission is already held", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });

    await store().sync();

    expect(store().permission).toBe("granted");
    expect(store().region).toBe("south");
    expect(store().coords).toEqual({ latitude: 1.2833, longitude: 103.8607 });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("surfaces a standing denial without re-prompting", async () => {
    mockGetPermission.mockResolvedValue({ status: "denied" });

    await store().sync();

    expect(store().permission).toBe("denied");
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("tells a granted permission with no fix apart from a refusal", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });
    mockPosition.mockRejectedValue(new Error("no fix"));

    await store().sync();

    expect(store().permission).toBe("unavailable");
  });

  it("costs one round trip however many screens sync at once", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });

    // Today and Plans are both mounted and both call this in the same commit.
    await Promise.all([store().sync(), store().sync(), store().sync()]);

    expect(mockGetPermission).toHaveBeenCalledTimes(1);
    expect(store().permission).toBe("granted");
  });

  it("prompts on request, and records the grant for everyone", async () => {
    await store().request();

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(store().permission).toBe("granted");
    expect(store().region).toBe("south");
  });

  it("records a refusal so the caller can offer a way back", async () => {
    mockRequestPermission.mockResolvedValue({ status: "denied" });

    await store().request();

    expect(store().permission).toBe("denied");
    expect(store().region).toBeNull();
  });

  it("doesn't let a read started earlier overwrite a fresher answer", async () => {
    // A sync is out — say the AppState listener fired while the status was
    // "denied" — and the user grants the permission before it comes back.
    let finishTheStaleRead!: (result: { status: string }) => void;
    mockGetPermission.mockReturnValue(
      new Promise<{ status: string }>((resolve) => {
        finishTheStaleRead = resolve;
      }),
    );
    const stale = store().sync();

    await store().request();
    expect(store().permission).toBe("granted");

    finishTheStaleRead({ status: "denied" });
    await stale;

    expect(store().permission).toBe("granted");
  });

  it("resets to a cold start, in-flight bookkeeping included", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });
    await store().sync();

    resetDeviceLocationStore();

    expect(store().permission).toBe("checking");
    expect(store().region).toBeNull();
    expect(store().coords).toBeNull();

    // The dedupe is keyed off module-level state, so a reset that missed it
    // would hand the next test a promise that has already resolved.
    await store().sync();
    expect(mockGetPermission).toHaveBeenCalledTimes(2);
  });
});
