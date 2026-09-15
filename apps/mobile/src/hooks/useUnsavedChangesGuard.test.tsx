import { renderHook } from "@testing-library/react-native";
import * as ExpoRouter from "expo-router";
import { Alert } from "react-native";

import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

type AlertButton = { text?: string; style?: string; onPress?: () => void };

/**
 * The one navigation object the expo-router mock hands out. Read through the
 * namespace rather than by calling `useNavigation()` here, which the lint rule
 * (rightly) reads as a hook call outside a component.
 */
const navigation = (
  ExpoRouter as unknown as {
    useNavigation: () => { setOptions: jest.Mock };
  }
).useNavigation();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("dismisses straight through when nothing is unsaved", async () => {
    // A confirmation on an untouched form is friction, and one that always
    // appears is one people learn to dismiss without reading.
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = await renderHook(() => useUnsavedChangesGuard(false));
    const discard = jest.fn();

    result.current(discard);

    expect(discard).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("asks before discarding unsaved edits", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = await renderHook(() => useUnsavedChangesGuard(true));
    const discard = jest.fn();

    result.current(discard);

    expect(alertSpy).toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("discards only when the destructive option is chosen", async () => {
    let buttons: AlertButton[] = [];
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, given) => {
        buttons = (given ?? []) as AlertButton[];
      });
    const { result } = await renderHook(() => useUnsavedChangesGuard(true));
    const discard = jest.fn();

    result.current(discard);
    buttons.find((b) => b.style === "cancel")?.onPress?.();
    expect(discard).not.toHaveBeenCalled();

    buttons.find((b) => b.style === "destructive")?.onPress?.();
    expect(discard).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("blocks the modal's swipe-down while there are unsaved edits", async () => {
    // A swipe isn't deliberate enough to ask about — it can be a mis-aimed
    // scroll on the first field — so it is turned off rather than confirmed,
    // leaving the button, which does ask, as the only way out.
    await renderHook(() => useUnsavedChangesGuard(true));

    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      gestureEnabled: false,
    });
  });

  it("gives the swipe back once the form is clean", async () => {
    await renderHook(() => useUnsavedChangesGuard(false));

    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
  });
});
