import {
  dismissToast,
  showToast,
  useToastStore,
} from "@/store/toastStore";

beforeEach(() => {
  useToastStore.setState({ toast: null, modalHosts: [] });
});

describe("toastStore", () => {
  it("raises a success toast by default", () => {
    showToast("Rain alerts on");

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Rain alerts on",
      variant: "success",
    });
  });

  it("raises an error toast when asked", () => {
    showToast("Couldn't save that setting. Try again.", "error");

    expect(useToastStore.getState().toast).toMatchObject({
      variant: "error",
    });
  });

  it("gives each toast a distinct id", () => {
    showToast("first");
    const first = useToastStore.getState().toast?.id;
    showToast("second");
    const second = useToastStore.getState().toast?.id;

    expect(first).not.toBe(second);
  });

  it("replaces the toast on screen rather than queueing", () => {
    showToast("first");
    showToast("second");

    expect(useToastStore.getState().toast?.message).toBe("second");
  });

  it("clears the toast it was given", () => {
    showToast("Deleted Morning run");
    const { id } = useToastStore.getState().toast!;

    dismissToast(id);

    expect(useToastStore.getState().toast).toBeNull();
  });

  it("ignores a dismiss for a toast that has already been replaced", () => {
    // The timer from the first toast fires after the second has taken its
    // place — without the id guard it would blank a message no one has read.
    showToast("first");
    const staleId = useToastStore.getState().toast!.id;
    showToast("second");

    dismissToast(staleId);

    expect(useToastStore.getState().toast?.message).toBe("second");
  });

  it("clears whatever is showing when no id is given", () => {
    showToast("first");

    dismissToast();

    expect(useToastStore.getState().toast).toBeNull();
  });
});

describe("toastStore — modal host registration", () => {
  it("keeps modal hosts in mount order", () => {
    const { registerModalHost } = useToastStore.getState();

    registerModalHost("settings");
    registerModalHost("plan");

    expect(useToastStore.getState().modalHosts).toEqual(["settings", "plan"]);
  });

  it("empties as the last modal closes, handing the screen back to the root", () => {
    const { registerModalHost, unregisterModalHost } = useToastStore.getState();
    registerModalHost("settings");

    unregisterModalHost("settings");

    expect(useToastStore.getState().modalHosts).toEqual([]);
  });

  it("removes a host from the middle without disturbing the rest", () => {
    const { registerModalHost, unregisterModalHost } = useToastStore.getState();
    registerModalHost("a");
    registerModalHost("b");
    registerModalHost("c");

    unregisterModalHost("b");

    expect(useToastStore.getState().modalHosts).toEqual(["a", "c"]);
  });
});
