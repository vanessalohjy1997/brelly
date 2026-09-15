import { useDialogStore } from "@/store/dialogStore";

import { promptMergeChoice } from "./promptMergeChoice";

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
});

describe("promptMergeChoice", () => {
  it("counts plans and routines in the question", async () => {
    const choice = promptMergeChoice(40, 5);

    expect(useDialogStore.getState().dialog?.message).toBe(
      "Add your 40 plans and 5 routines to it?",
    );

    useDialogStore.getState().answer("add");
    await expect(choice).resolves.toBe("add");
  });

  it("singularises both counts", async () => {
    const choice = promptMergeChoice(1, 1);

    expect(useDialogStore.getState().dialog?.message).toBe(
      "Add your 1 plan and 1 routine to it?",
    );

    useDialogStore.getState().answer("dont-add");
    await expect(choice).resolves.toBe("dont-add");
  });

  it("offers three answers, which is why confirm() could not stand in", () => {
    void promptMergeChoice(2, 0);
    expect(useDialogStore.getState().dialog?.actions.map((a) => a.key)).toEqual([
      "add",
      "dont-add",
      "cancel",
    ]);
    useDialogStore.getState().answer("cancel");
  });

  it("resolves cancel when dismissed", async () => {
    const choice = promptMergeChoice(2, 0);
    useDialogStore
      .getState()
      .answer(useDialogStore.getState().dialog!.dismissKey);
    await expect(choice).resolves.toBe("cancel");
  });
});
