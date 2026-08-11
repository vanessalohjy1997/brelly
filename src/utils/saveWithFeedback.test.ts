import { useToastStore } from "@/store/toastStore";
import { notifyCloudSyncFailure, saveWithFeedback } from "@/utils/saveWithFeedback";

const MESSAGES = {
  success: "Rain alerts on",
  failure: "Couldn't save that setting. Try again.",
};

beforeEach(() => {
  useToastStore.setState({ toast: null, modalHosts: [] });
});

describe("saveWithFeedback", () => {
  it("runs the action", () => {
    const action = jest.fn();

    saveWithFeedback(action, MESSAGES);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("confirms a save that went through", () => {
    saveWithFeedback(() => undefined, MESSAGES);

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Rain alerts on",
      variant: "success",
    });
  });

  it("hands back what the action returned", () => {
    const result = saveWithFeedback(() => ({ id: "s1" }), MESSAGES);

    expect(result).toEqual({ ok: true, value: { id: "s1" } });
  });

  it("reports a failed write instead of letting it take the screen down", () => {
    // A persisted zustand store writes to MMKV synchronously inside `set`, so
    // a storage failure surfaces as a throw out of the action itself.
    const result = saveWithFeedback(() => {
      throw new Error("mmkv: no space left on device");
    }, MESSAGES);

    expect(result.ok).toBe(false);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't save that setting. Try again.",
      variant: "error",
    });
  });

  it("keeps the error for the caller", () => {
    const error = new Error("mmkv: no space left on device");

    const result = saveWithFeedback(() => {
      throw error;
    }, MESSAGES);

    expect(result).toEqual({ ok: false, error });
  });

  it("raises no success toast when the action threw", () => {
    saveWithFeedback(() => {
      throw new Error("nope");
    }, MESSAGES);

    expect(useToastStore.getState().toast?.message).not.toBe("Rain alerts on");
  });
});

describe("notifyCloudSyncFailure", () => {
  it("says the change is still safe locally, not that it wasn't saved", () => {
    notifyCloudSyncFailure();

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't sync to the cloud — you're still working locally",
      variant: "error",
    });
  });
});
