import { useDialogStore } from "@/store/dialogStore";

import { askEditScope } from "./askEditScope";

const options = {
  title: "Edit this stop?",
  message: "This stop comes from a routine.",
  dayLabel: "Save this day only",
  seriesLabel: "Save the whole routine",
};

beforeEach(() => {
  useDialogStore.setState({ dialog: null });
});

describe("askEditScope", () => {
  it("offers the day and series actions in the caller's own wording", async () => {
    const scope = askEditScope(options);

    expect(useDialogStore.getState().dialog?.actions).toEqual([
      { key: "day", label: "Save this day only" },
      { key: "series", label: "Save the whole routine", tone: "default" },
      { key: "cancel", label: "Cancel", tone: "cancel" },
    ]);

    useDialogStore.getState().answer("series");
    await expect(scope).resolves.toBe("series");
  });

  it("marks the series action destructive when the caller says so", async () => {
    const scope = askEditScope({ ...options, destructive: true });

    expect(useDialogStore.getState().dialog?.actions[1]).toMatchObject({
      key: "series",
      tone: "destructive",
    });

    useDialogStore.getState().answer("day");
    await expect(scope).resolves.toBe("day");
  });

  it("omits the series action when there is no rule-level reading", async () => {
    // Moving a stop to another day can only mean that day: a routine has no
    // single date, so offering "the whole routine" here would be a question
    // with no meaning.
    const scope = askEditScope({ ...options, seriesLabel: undefined });

    expect(useDialogStore.getState().dialog?.actions.map((a) => a.key)).toEqual([
      "day",
      "cancel",
    ]);

    useDialogStore.getState().answer("day");
    await expect(scope).resolves.toBe("day");
  });

  it("resolves null when dismissed, so an unanswered question commits nothing", async () => {
    const scope = askEditScope(options);

    useDialogStore
      .getState()
      .answer(useDialogStore.getState().dialog!.dismissKey);

    await expect(scope).resolves.toBeNull();
  });
});
