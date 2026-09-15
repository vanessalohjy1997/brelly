import { renderHook } from "@testing-library/react";

import { useTabVisible } from "./useTabVisible";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => setVisibility("visible"));

describe("useTabVisible", () => {
  it("runs when the tab comes back to the foreground", () => {
    const onVisible = jest.fn();
    renderHook(() => useTabVisible(onVisible));

    setVisibility("hidden");
    expect(onVisible).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("reads the callback through a ref, so a re-render does not re-run the work", () => {
    // The same shape `useNotificationSync` uses on the phone: an ordinary store
    // write must not tear the listener down and run a whole pass.
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ callback }: { callback: () => void }) => useTabVisible(callback),
      { initialProps: { callback: first } },
    );

    rerender({ callback: second });
    setVisibility("visible");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const onVisible = jest.fn();
    renderHook(() => useTabVisible(onVisible, false));

    setVisibility("visible");

    expect(onVisible).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    const onVisible = jest.fn();
    renderHook(() => useTabVisible(onVisible)).unmount();

    setVisibility("visible");

    expect(onVisible).not.toHaveBeenCalled();
  });
});
