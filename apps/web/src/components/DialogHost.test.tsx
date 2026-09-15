import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { askDialog, useDialogStore } from "@/store/dialogStore";

import { DialogHost } from "./DialogHost";

/**
 * jsdom implements `<dialog>` but not its modal behaviour, so `showModal` and
 * `close` are stood in for. What is under test here is the wiring — that the
 * element is opened when a question is raised, that every route out of it
 * settles the promise, and that Escape settles it as *dismissed* — not the
 * browser's focus trap, which is the reason a native `<dialog>` was chosen in
 * the first place.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
});

/**
 * `askDialog` only sets store state, so the synchronous `act` is the right one
 * here — the caveat about wrapping async work in it does not apply. Without the
 * wrapper every case warns that a store update happened outside React's
 * knowledge, which buries a real warning when one arrives.
 */
function ask(request: Parameters<typeof askDialog>[0]): Promise<string> {
  let answer!: Promise<string>;
  act(() => {
    answer = askDialog(request);
  });
  return answer;
}

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

describe("DialogHost", () => {
  it("renders nothing until something asks", () => {
    const { container } = render(<DialogHost />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the question and settles on the button pressed", async () => {
    render(<DialogHost />);
    const answer = ask(question);

    expect(
      await screen.findByRole("heading", {
        name: "That account already has data",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add your 3 plans and 1 routine to it?"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Don't add" }));

    await expect(answer).resolves.toBe("dont-add");
  });

  it("settles as dismissed when the dialog is closed without an answer", async () => {
    // Escape fires `cancel`, and a question nobody answered must resolve to
    // the value that leaves everything alone — every caller depends on it.
    render(<DialogHost />);
    const answer = ask(question);
    const dialog = await screen.findByRole("dialog", { hidden: true });

    dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true }));

    await expect(answer).resolves.toBe("cancel");
  });

  it("puts focus on the harmless action rather than the affirmative one", async () => {
    // Every dialog here stands in front of something destructive or
    // irreversible, so Enter on a dialog nobody has read should do nothing.
    render(<DialogHost />);
    void ask(question);

    expect(await screen.findByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("names the title and the message to assistive technology", async () => {
    render(<DialogHost />);
    void ask(question);

    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-message");
  });

  it("keeps the affirmative first in DOM order and last on screen", async () => {
    // Reversed by CSS, not by markup: the reading order and the tab order
    // follow the DOM, where the action being offered should come first.
    render(<DialogHost />);
    void ask(question);

    const buttons = await screen.findAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Add",
      "Don't add",
      "Cancel",
    ]);
  });

  it("colours a destructive action as one", async () => {
    render(<DialogHost />);
    void ask({
      ...question,
      actions: [
        { key: "sign-out", label: "Sign out", tone: "destructive" },
        { key: "cancel", label: "Cancel", tone: "cancel" },
      ],
    });

    expect(
      await screen.findByRole("button", { name: "Sign out" }),
    ).toHaveClass("bg-danger");
  });
});
