import {
  resetDeviceLocationStore,
  useDeviceLocationStore,
} from "./deviceLocationStore";

const getCurrentPosition = jest.fn();
const permissionQuery = jest.fn();

/** Orchard Road. `getRegionFromCoordinates` puts it in "south" — checked
 * against the function rather than guessed from the name. */
const position = {
  coords: { latitude: 1.3009, longitude: 103.8386 },
} as GeolocationPosition;

beforeEach(() => {
  jest.clearAllMocks();
  resetDeviceLocationStore();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        onSuccess: PositionCallback,
        onError: PositionErrorCallback,
      ) => getCurrentPosition(onSuccess, onError),
    },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: permissionQuery },
  });

  permissionQuery.mockResolvedValue({ state: "prompt" });
  getCurrentPosition.mockImplementation((onSuccess: PositionCallback) =>
    onSuccess(position),
  );
});

const store = () => useDeviceLocationStore.getState();

describe("sync", () => {
  it("reads the answer without prompting", async () => {
    // The whole point of the sync/request split: someone who granted this on a
    // previous visit must not be asked again, and someone who has not must not
    // be asked without being told why first.
    await store().sync();

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(store().permission).toBe("unprompted");
  });

  it("resolves a position when the permission is already held", async () => {
    permissionQuery.mockResolvedValue({ state: "granted" });

    await store().sync();

    expect(store()).toMatchObject({
      permission: "granted",
      region: "south",
      coords: { latitude: 1.3009, longitude: 103.8386 },
    });
  });

  it("drops the last known point when a grant has been revoked", async () => {
    // This read is the only thing that notices a permission switched off in the
    // site-settings panel. Keeping the point would leave "Right now" reporting
    // the weather at a location the user had just revoked access to.
    permissionQuery.mockResolvedValue({ state: "granted" });
    await store().sync();

    permissionQuery.mockResolvedValue({ state: "denied" });
    await store().sync();

    expect(store()).toMatchObject({
      permission: "denied",
      region: null,
      coords: null,
    });
  });

  it("treats an unanswerable query as unprompted, not as denied", async () => {
    // Safari shipped geolocation long before it shipped a Permissions API
    // entry for it. "We cannot know without asking" is what `unprompted` means.
    permissionQuery.mockRejectedValue(new Error("unsupported"));

    await store().sync();

    expect(store().permission).toBe("unprompted");
  });

  it("shares one round trip between concurrent callers", async () => {
    permissionQuery.mockResolvedValue({ state: "granted" });

    await Promise.all([store().sync(), store().sync(), store().sync()]);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

describe("request", () => {
  it("asks, and a position is the prompt", async () => {
    // There is no separate "request permission" call in the browser.
    await store().request();

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(store().permission).toBe("granted");
  });

  it("tells a refusal apart from a failed fix", async () => {
    // Only one of the two is worth offering a way back from, and neither is
    // fixed by asking again.
    getCurrentPosition.mockImplementation(
      (_: PositionCallback, onError: PositionErrorCallback) =>
        onError({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    );

    await store().request();

    expect(store().permission).toBe("unavailable");
  });

  it("supersedes an in-flight sync rather than being overwritten by it", async () => {
    // A `sync()` started while the user was still deciding must not land on top
    // of the answer they just gave.
    permissionQuery.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ state: "denied" }), 10)),
    );
    const stale = store().sync();
    await store().request();
    await stale;

    expect(store().permission).toBe("granted");
  });
});
