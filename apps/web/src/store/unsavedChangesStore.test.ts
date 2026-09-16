import { useDialogStore } from "./dialogStore";
import {
  confirmDiscard,
  guardNavigation,
  useUnsavedChangesStore,
} from "./unsavedChangesStore";

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
  useUnsavedChangesStore.setState({ dirty: false });
});

describe("confirmDiscard", () => {
  it("lets a clean form through without asking", async () => {
    // A confirmation on an untouched form is pure friction, and one that
    // always appears is one people learn to dismiss without reading.
    await expect(confirmDiscard()).resolves.toBe(true);
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("asks when there is something to lose", async () => {
    useUnsavedChangesStore.setState({ dirty: true });
    const answer = confirmDiscard();

    expect(useDialogStore.getState().dialog).toMatchObject({
      title: "Discard changes?",
    });

    useDialogStore.getState().answer("discard");
    await expect(answer).resolves.toBe(true);
  });

  it("keeps the form when the question is dismissed", async () => {
    // Dismissal has to mean "keep editing" — the unanswered-question
    // convention every other dialog in the app follows.
    useUnsavedChangesStore.setState({ dirty: true });
    const answer = confirmDiscard();

    useDialogStore
      .getState()
      .answer(useDialogStore.getState().dialog!.dismissKey);

    await expect(answer).resolves.toBe(false);
  });
});

describe("guardNavigation", () => {
  it("lets a clean navigation through untouched", () => {
    const event = { preventDefault: jest.fn() };
    const navigate = jest.fn();

    guardNavigation(event, navigate);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("blocks first and re-issues the navigation on a discard", async () => {
    // `preventDefault` is synchronous and the question is not, so a blocked
    // navigation has to be re-issued by hand — there is no way to resume one.
    useUnsavedChangesStore.setState({ dirty: true });
    const event = { preventDefault: jest.fn() };
    const navigate = jest.fn();

    guardNavigation(event, navigate);
    expect(event.preventDefault).toHaveBeenCalled();

    useDialogStore.getState().answer("discard");
    await Promise.resolve();
    await Promise.resolve();

    expect(navigate).toHaveBeenCalled();
    // Cleared before navigating, or the next page's links inherit a dirty flag
    // belonging to a form that is gone.
    expect(useUnsavedChangesStore.getState().dirty).toBe(false);
  });

  it("goes nowhere when the answer is to keep editing", async () => {
    useUnsavedChangesStore.setState({ dirty: true });
    const navigate = jest.fn();

    guardNavigation({ preventDefault: jest.fn() }, navigate);
    useDialogStore.getState().answer("keep");
    await Promise.resolve();
    await Promise.resolve();

    expect(navigate).not.toHaveBeenCalled();
    expect(useUnsavedChangesStore.getState().dirty).toBe(true);
  });
});
