import { Alert } from "react-native";

import { askEditScope } from "@/utils/askEditScope";

type Button = {
  text: string;
  style?: string;
  onPress?: () => void;
};

const options = {
  title: "Save changes to Office?",
  message: "Repeats Mon–Fri.",
  dayLabel: "This day only",
  seriesLabel: "This and future days",
};

/** The buttons the last `Alert.alert` call was given. */
function buttons(): Button[] {
  const alert = Alert.alert as unknown as jest.Mock;
  return alert.mock.calls.at(-1)?.[2] ?? [];
}

function press(text: string) {
  buttons()
    .find((button) => button.text === text)
    ?.onPress?.();
}

beforeEach(() => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("askEditScope", () => {
  it("resolves 'day' when the single-day action is taken", async () => {
    const answer = askEditScope(options);
    press("This day only");

    await expect(answer).resolves.toBe("day");
  });

  it("resolves 'series' when the whole routine is meant", async () => {
    const answer = askEditScope(options);
    press("This and future days");

    await expect(answer).resolves.toBe("series");
  });

  it("resolves null on Cancel, so nothing is committed", async () => {
    const answer = askEditScope(options);
    press("Cancel");

    await expect(answer).resolves.toBeNull();
  });

  it("resolves null when dismissed without pressing anything", async () => {
    // Android's back button and a tap outside on iOS both land here. A promise
    // nobody settles would leave the save half-done forever.
    const answer = askEditScope(options);
    const alert = Alert.alert as unknown as jest.Mock;
    alert.mock.calls.at(-1)?.[3]?.onDismiss?.();

    await expect(answer).resolves.toBeNull();
  });

  it("withholds the series action when it isn't offered", async () => {
    const answer = askEditScope({ ...options, seriesLabel: undefined });

    expect(buttons().map((button) => button.text)).toEqual([
      "Cancel",
      "This day only",
    ]);

    press("This day only");
    await expect(answer).resolves.toBe("day");
  });

  it("marks the series action destructive when it removes days", async () => {
    const answer = askEditScope({ ...options, destructive: true });

    expect(
      buttons().find((button) => button.text === "This and future days")?.style,
    ).toBe("destructive");

    press("Cancel");
    await answer;
  });
});
