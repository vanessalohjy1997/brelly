import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import {
  ToastDurationMs,
  ToastHost,
  ToastWithActionDurationMs,
} from "@/components/toast";
import { Colors } from "@/constants/theme";
import { showToast, useToastStore } from "@/store/toastStore";

// Jest renders under the light scheme, so the expected values come from
// `Colors.light` rather than being hardcoded hex in two places.
const styleOf = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as ViewStyle) ?? {};

beforeEach(() => {
  useToastStore.setState({ toast: null, modalHosts: [] });
});

describe("ToastHost", () => {
  it("renders nothing until a toast is raised", async () => {
    const view = await render(<ToastHost />);

    expect(view.toJSON()).toBeNull();
  });

  it("shows the message of the toast on screen", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Rain alerts off"));

    expect(view.getByText("Rain alerts off")).toBeTruthy();
  });

  it("announces itself to assistive tech", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Deleted Morning run"));

    expect(view.getByRole("alert")).toBeTruthy();
  });

  it("shows a failure message as an error", async () => {
    const view = await render(<ToastHost />);

    await act(async () =>
      showToast("Couldn't save that setting. Try again.", "error"),
    );

    // Success and failure are told apart by their glyph as well as their
    // colour, so the difference survives for anyone who can't use the colour.
    expect(view.getByTestId("symbol-error")).toBeTruthy();
    expect(view.queryByTestId("symbol-check_circle")).toBeNull();
  });

  it("marks a successful save with a checkmark", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Added Morning run"));

    expect(view.getByTestId("symbol-check_circle")).toBeTruthy();
  });

  it("dismisses when tapped", async () => {
    const view = await render(<ToastHost />);
    await act(async () => showToast("Rain alerts on"));

    await fireEvent.press(view.getByRole("alert"));

    expect(view.queryByText("Rain alerts on")).toBeNull();
  });
});

describe("ToastHost — variant colour", () => {
  it("outlines a success toast in the success colour", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Added Morning run"));

    expect(styleOf(view.getByRole("alert")).borderColor).toBe(
      Colors.light.success,
    );
  });

  it("outlines a failure toast in the danger colour", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Couldn't save that.", "error"));

    expect(styleOf(view.getByRole("alert")).borderColor).toBe(
      Colors.light.danger,
    );
  });

  it("gives a success toast a status colour of its own", async () => {
    // The regression this guards: success used to have no status colour
    // anywhere — a violet `primary` glyph on `backgroundSelected`, which in
    // the light theme is the same value as `border` — so it read as an inert
    // chip while a failure got a solid red fill.
    const view = await render(<ToastHost />);

    await act(async () => showToast("Rain alerts off"));

    const { borderColor } = styleOf(view.getByRole("alert"));
    expect(borderColor).not.toBe(Colors.light.border);
    expect(borderColor).not.toBe(Colors.light.primary);
  });

  it("tells the two variants apart by colour", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Added Morning run"));
    const success = styleOf(view.getByRole("alert")).borderColor;

    await act(async () => showToast("Couldn't save that.", "error"));
    const error = styleOf(view.getByRole("alert")).borderColor;

    expect(success).not.toBe(error);
  });

  it("keeps the surface neutral rather than tinting the whole toast", async () => {
    // Colour belongs on the glyph and the outline. A full-bleed red or green
    // bar is more alarm than a saved plan warrants, and it's the same rule the
    // weather palette follows — never the whole background.
    const view = await render(<ToastHost />);

    await act(async () => showToast("Couldn't save that.", "error"));

    expect(styleOf(view.getByRole("alert")).backgroundColor).toBe(
      Colors.light.backgroundElement,
    );
  });

  it("leaves the message in ordinary body text", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Added Morning run"));

    expect(view.getByText("Added Morning run")).toHaveStyle({
      color: Colors.light.text,
    });
  });
});

describe("ToastHost — auto dismiss", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("clears the toast once its time is up", async () => {
    const view = await render(<ToastHost />);
    await act(async () => showToast("Digest at 06:30"));

    expect(view.getByText("Digest at 06:30")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(ToastDurationMs);
    });

    expect(view.queryByText("Digest at 06:30")).toBeNull();
  });

  it("gives a replacement toast its own full time on screen", async () => {
    const view = await render(<ToastHost />);
    await act(async () => showToast("first"));

    await act(async () => {
      jest.advanceTimersByTime(ToastDurationMs - 200);
    });
    await act(async () => showToast("second"));
    await act(async () => {
      jest.advanceTimersByTime(ToastDurationMs - 200);
    });

    expect(view.getByText("second")).toBeTruthy();
  });

  it("holds an undoable toast longer — it is the only way back", async () => {
    const view = await render(<ToastHost />);
    await act(async () =>
      showToast("Deleted Morning run", "success", {
        label: "Undo",
        onPress: jest.fn(),
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(ToastDurationMs);
    });
    expect(view.getByText("Deleted Morning run")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(ToastWithActionDurationMs - ToastDurationMs);
    });
    expect(view.queryByText("Deleted Morning run")).toBeNull();
  });
});

describe("ToastHost — actions", () => {
  it("carries no action button unless one was raised with it", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Rain alerts off"));

    expect(view.queryByText("Undo")).toBeNull();
  });

  it("runs the action when its button is pressed", async () => {
    const onPress = jest.fn();
    const view = await render(<ToastHost />);

    await act(async () => showToast("Deleted Morning run", "success", {
      label: "Undo",
      onPress,
    }));
    await fireEvent.press(view.getByText("Undo"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself after the action, so no handler has to", async () => {
    const view = await render(<ToastHost />);

    await act(async () => showToast("Deleted Morning run", "success", {
      label: "Undo",
      onPress: jest.fn(),
    }));
    await fireEvent.press(view.getByText("Undo"));

    expect(useToastStore.getState().toast).toBeNull();
  });

  it("does not run the action when the toast is dismissed by tapping it", async () => {
    // The button is nested inside the dismiss surface — a tap that misses it
    // must still only dismiss.
    const onPress = jest.fn();
    const view = await render(<ToastHost />);

    await act(async () => showToast("Deleted Morning run", "success", {
      label: "Undo",
      onPress,
    }));
    await fireEvent.press(view.getByRole("alert"));

    expect(onPress).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast).toBeNull();
  });
});

describe("ToastHost — root and modal hosts", () => {
  it("draws in the modal host, not behind it at the root", async () => {
    // A modal presented over the root owns the screen on iOS, so a toast has
    // to come from its host and must not also render behind it.
    const root = await render(<ToastHost root />);
    const modal = await render(<ToastHost />);

    await act(async () => showToast("Copied to Sat, 2 Aug"));

    expect(modal.getByText("Copied to Sat, 2 Aug")).toBeTruthy();
    expect(root.queryByText("Copied to Sat, 2 Aug")).toBeNull();
  });

  it("yields to a modal host that mounted first", async () => {
    // Cold-starting into a modal mounts both in one commit, and the modal's
    // effect runs before the root's — so this can't be decided by mount order.
    const modal = await render(<ToastHost />);
    const root = await render(<ToastHost root />);

    await act(async () => showToast("Rain alerts off"));

    expect(modal.getByText("Rain alerts off")).toBeTruthy();
    expect(root.queryByText("Rain alerts off")).toBeNull();
  });

  it("hands a live toast back to the root host when the modal closes", async () => {
    // This is what makes "Added Morning run" survive the `router.back()` that
    // raised it and finish its life on the tab underneath.
    const root = await render(<ToastHost root />);
    const modal = await render(<ToastHost />);
    await act(async () => showToast("Added Morning run"));

    await act(async () => modal.unmount());

    expect(root.getByText("Added Morning run")).toBeTruthy();
  });

  it("draws at the root when nothing is presented over it", async () => {
    const root = await render(<ToastHost root />);

    await act(async () => showToast("Deleted Morning run"));

    expect(root.getByText("Deleted Morning run")).toBeTruthy();
  });
});
