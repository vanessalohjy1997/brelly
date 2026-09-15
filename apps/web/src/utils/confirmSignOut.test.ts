import { useDialogStore } from "@/store/dialogStore";

import { confirmSignOut } from "./confirmSignOut";

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
});

describe("confirmSignOut", () => {
  it("says what survives, which is the part people get wrong", async () => {
    const confirmed = confirmSignOut();

    expect(useDialogStore.getState().dialog?.message).toContain(
      "stay in the account and come back when you sign in again",
    );

    useDialogStore.getState().answer("sign-out");
    await expect(confirmed).resolves.toBe(true);
  });

  it("resolves false on cancel", async () => {
    const confirmed = confirmSignOut();
    useDialogStore.getState().answer("cancel");
    await expect(confirmed).resolves.toBe(false);
  });

  it("resolves false when dismissed", async () => {
    const confirmed = confirmSignOut();
    useDialogStore
      .getState()
      .answer(useDialogStore.getState().dialog!.dismissKey);
    await expect(confirmed).resolves.toBe(false);
  });
});
