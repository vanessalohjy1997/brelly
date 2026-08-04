import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useReduceMotion } from "@/hooks/useReduceMotion";

type Listener = (enabled: boolean) => void;

let listener: Listener | undefined;
let remove: jest.Mock;

beforeEach(() => {
  jest.restoreAllMocks();
  listener = undefined;
  remove = jest.fn();
  // `addEventListener` is overloaded per event name, so the handler and the
  // subscription both need widening through `unknown` — TypeScript resolves
  // the overload to the announcement-finished one, whose handler takes an
  // event object rather than a boolean.
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation((_event, handler) => {
      listener = handler as unknown as Listener;
      return { remove } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >;
    });
});

describe("useReduceMotion", () => {
  it("animates by default while the first read is in flight", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useReduceMotion());

    // False on the very first frame, so a device that doesn't care never
    // flickers into the animation.
    expect(result.current).toBe(false);
  });

  it("reports the setting once it has been read", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    const { result } = await renderHook(() => useReduceMotion());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("follows the setting being turned on while the app is running", async () => {
    // It can be toggled from Control Centre without the app restarting.
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    const { result } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(false));

    await act(async () => listener?.(true));

    expect(result.current).toBe(true);
  });

  it("keeps animating when the platform has no answer", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockRejectedValue(new Error("unsupported"));

    const { result } = await renderHook(() => useReduceMotion());

    await waitFor(() =>
      expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled(),
    );
    expect(result.current).toBe(false);
  });

  it("unsubscribes when it goes away", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);

    const { unmount } = await renderHook(() => useReduceMotion());
    await act(async () => unmount());

    expect(remove).toHaveBeenCalled();
  });
});
