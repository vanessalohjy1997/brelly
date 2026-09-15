import { askDialog, useDialogStore } from "./dialogStore";

const question = {
  title: "That account already has data",
  message: "Add your 3 plans and 1 routine to it?",
  dismissKey: "cancel",
  actions: [
    { key: "add", label: "Add" },
    { key: "dont-add", label: "Don't add" },
    { key: "cancel", label: "Cancel", tone: "cancel" as const },
  ],
};

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
});

describe("askDialog", () => {
  it("publishes the request and settles on the button pressed", async () => {
    const answer = askDialog(question);

    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "That account already has data",
      dismissKey: "cancel",
    });

    useDialogStore.getState().answer("dont-add");

    await expect(answer).resolves.toBe("dont-add");
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("gives each request a fresh id, so a repeat ask re-opens", async () => {
    const first = askDialog(question);
    const firstId = useDialogStore.getState().dialog?.id;
    useDialogStore.getState().answer("cancel");
    await first;

    const second = askDialog(question);
    expect(useDialogStore.getState().dialog?.id).not.toBe(firstId);
    useDialogStore.getState().answer("cancel");
    await second;
  });

  it("ignores a second answer rather than settling twice", async () => {
    const answer = askDialog(question);

    useDialogStore.getState().answer("add");
    // A button press that also closes the native <dialog> fires this path
    // twice. The second must not contradict the first.
    useDialogStore.getState().answer("cancel");

    await expect(answer).resolves.toBe("add");
  });

  it("dismisses an open question when a second one arrives", async () => {
    const first = askDialog(question);
    const second = askDialog({ ...question, title: "Sign out?" });

    // The first promise settles as dismissed rather than hanging forever
    // behind a dialog the user can no longer see.
    await expect(first).resolves.toBe("cancel");
    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "Sign out?",
    });

    useDialogStore.getState().answer("add");
    await expect(second).resolves.toBe("add");
  });

  it("does nothing when answered with no question open", () => {
    expect(() => useDialogStore.getState().answer("add")).not.toThrow();
  });
});
