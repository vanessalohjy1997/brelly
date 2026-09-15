import { act, renderHook } from "@testing-library/react";

import { useDialogStore } from "@/store/dialogStore";
import { useUnsavedChangesStore } from "@/store/unsavedChangesStore";

import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
  useUnsavedChangesStore.setState({ dirty: false });
  jest.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("publishes the dirty flag so the sidebar can see it", () => {
    // The sidebar is the exit a modal never had, and it is rendered by a
    // component that knows nothing about the form.
    const { rerender, unmount } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } },
    );
    expect(useUnsavedChangesStore.getState().dirty).toBe(false);

    rerender({ dirty: true });
    expect(useUnsavedChangesStore.getState().dirty).toBe(true);

    unmount();
    expect(useUnsavedChangesStore.getState().dirty).toBe(false);
  });

  it("warns on tab close only while there is something to lose", () => {
    const { rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } },
    );

    expect(fireBeforeUnload().defaultPrevented).toBe(false);

    rerender({ dirty: true });
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it("buffers a history entry so Back can be caught at all", () => {
    // `popstate` is not cancelable. The only way to stay put is to have pushed
    // a spare entry while dirty, so the first Back press consumes that one.
    const pushState = jest.spyOn(window.history, "pushState");

    renderHook(() => useUnsavedChangesGuard(true));

    expect(pushState).toHaveBeenCalledWith(
      { brellyUnsavedGuard: true },
      "",
    );
  });

  it("asks on Back, and puts the buffer back when told to keep editing", async () => {
    const pushState = jest.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedChangesGuard(true));
    pushState.mockClear();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "Discard changes?",
    });

    await act(async () => {
      useDialogStore.getState().answer("keep");
    });

    // Without this the *next* Back press would leave without asking.
    expect(pushState).toHaveBeenCalledWith({ brellyUnsavedGuard: true }, "");
  });

  it("re-issues the Back on a discard", async () => {
    const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
    renderHook(() => useUnsavedChangesGuard(true));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await act(async () => {
      useDialogStore.getState().answer("discard");
    });

    expect(back).toHaveBeenCalled();
    expect(useUnsavedChangesStore.getState().dirty).toBe(false);
  });

  it("does none of it while the form is clean", () => {
    const pushState = jest.spyOn(window.history, "pushState");
    renderHook(() => useUnsavedChangesGuard(false));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(pushState).not.toHaveBeenCalled();
    expect(useDialogStore.getState().dialog).toBeNull();
  });
});

function fireBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}
