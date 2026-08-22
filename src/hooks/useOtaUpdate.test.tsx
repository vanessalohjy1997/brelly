import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { AppState } from "react-native";

import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { useToastStore } from "@/store/toastStore";

const useUpdatesMock = Updates.useUpdates as jest.Mock;
const checkForUpdateAsync = Updates.checkForUpdateAsync as jest.Mock;
const fetchUpdateAsync = Updates.fetchUpdateAsync as jest.Mock;
const reloadAsync = Updates.reloadAsync as jest.Mock;

const IDLE = {
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  isRestarting: false,
  checkError: undefined,
  downloadError: undefined,
};

/** `isEnabled` is a constant on the real module; the mock makes it writable. */
const setEnabled = (enabled: boolean) => {
  (Updates as { isEnabled: boolean }).isEnabled = enabled;
};

/**
 * The foreground listeners the hook registered, newest last.
 *
 * `AppState.addEventListener` is already a mock in React Native's Jest
 * preset, and a per-test `spyOn` over it does not survive this file's
 * `clearAllMocks` — the restored original comes back with its subscription
 * return value wiped, so the *next* test's unmount dies on
 * `subscription.remove()`. Installing one spy for every test instead removes
 * the ordering coupling and is what lets a test drive a foreground.
 */
let appStateListeners: ((state: string) => void)[] = [];
let appStateSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  setEnabled(true);
  useUpdatesMock.mockReturnValue(IDLE);
  checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  fetchUpdateAsync.mockResolvedValue({ isNew: false });
  reloadAsync.mockResolvedValue(undefined);
  useToastStore.setState({ toast: null });

  appStateListeners = [];
  appStateSpy = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, handler) => {
      appStateListeners.push(handler as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
});

afterEach(() => {
  appStateSpy.mockRestore();
});

const foreground = async () => {
  await act(async () => {
    appStateListeners.forEach((listener) => listener("active"));
  });
};

describe("useOtaUpdate", () => {
  it("reports the state the native module is in", async () => {
    useUpdatesMock.mockReturnValue({ ...IDLE, isUpdatePending: true });
    const { result } = await renderHook(() => useOtaUpdate());

    expect(result.current.status).toBe("ready");
  });

  it("downloads whatever a check finds", async () => {
    // A check that stops at "yes, there is one" leaves nothing on the device,
    // so the button would report an available update forever.
    checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => result.current.checkNow());

    expect(checkForUpdateAsync).toHaveBeenCalled();
    expect(fetchUpdateAsync).toHaveBeenCalled();
  });

  it("does not download when there is nothing to download", async () => {
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => result.current.checkNow());

    expect(fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("never calls the native check in a build without an updates client", async () => {
    // `checkForUpdateAsync` throws rather than resolving "no update" when
    // updates are disabled, which is every development build.
    setEnabled(false);
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => result.current.checkNow());

    expect(result.current.status).toBe("unsupported");
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("swallows a failed check rather than rejecting", async () => {
    // The failure reaches the UI through `useUpdates`' own `checkError`. A
    // rejection here would surface as an unhandled one from the foreground
    // listener, which has no caller to catch it.
    checkForUpdateAsync.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => expect(result.current.checkNow()).resolves.toBeUndefined());
  });

  it("checks again when the app returns to the foreground", async () => {
    // `checkAutomatically: ON_LOAD` fires once per process. An app that is
    // backgrounded rather than killed would otherwise never check again.
    await renderHook(() => useOtaUpdate());
    await foreground();

    await waitFor(() => expect(checkForUpdateAsync).toHaveBeenCalled());
  });

  it("ignores a move to the background", async () => {
    await renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateListeners.forEach((listener) => listener("background"));
    });

    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("does not subscribe to the foreground at all when updates are off", async () => {
    setEnabled(false);

    await renderHook(() => useOtaUpdate());

    expect(appStateSpy).not.toHaveBeenCalled();
  });

  it("runs one check at a time", async () => {
    // `isChecking` lags a tap by a render, so two quick presses would both
    // get past a check that read it instead of the ref.
    let release: (value: { isAvailable: boolean }) => void = () => {};
    checkForUpdateAsync.mockReturnValue(
      new Promise<{ isAvailable: boolean }>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = await renderHook(() => useOtaUpdate());

    let both: Promise<void[]> = Promise.resolve([]);
    await act(async () => {
      both = Promise.all([result.current.checkNow(), result.current.checkNow()]);
    });
    release({ isAvailable: false });
    await act(() => both.then(() => undefined));

    expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("reloads into the staged bundle on restart", async () => {
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => result.current.restart());

    expect(reloadAsync).toHaveBeenCalled();
  });

  it("says so when the reload is refused", async () => {
    // A refused reload leaves the old bundle running with nothing on screen
    // to say the tap did anything at all.
    reloadAsync.mockRejectedValue(new Error("refused"));
    const { result } = await renderHook(() => useOtaUpdate());

    await act(() => result.current.restart());

    expect(useToastStore.getState().toast).toMatchObject({ variant: "error" });
  });
});
