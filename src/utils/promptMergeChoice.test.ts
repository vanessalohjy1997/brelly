import { Alert } from "react-native";

import { promptMergeChoice } from "@/utils/promptMergeChoice";

type Button = {
  text: string;
  style?: string;
  onPress?: () => void;
};

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

describe("promptMergeChoice", () => {
  it("resolves 'add' when the user chooses to add their data", async () => {
    const answer = promptMergeChoice(3, 1);
    press("Add");

    await expect(answer).resolves.toBe("add");
  });

  it("resolves 'dont-add' when the user declines", async () => {
    const answer = promptMergeChoice(3, 1);
    press("Don't add");

    await expect(answer).resolves.toBe("dont-add");
  });

  it("resolves 'cancel' on Cancel", async () => {
    const answer = promptMergeChoice(3, 1);
    press("Cancel");

    await expect(answer).resolves.toBe("cancel");
  });

  it("resolves 'cancel' when dismissed without pressing anything", async () => {
    const answer = promptMergeChoice(3, 1);
    const alert = Alert.alert as unknown as jest.Mock;
    alert.mock.calls.at(-1)?.[3]?.onDismiss?.();

    await expect(answer).resolves.toBe("cancel");
  });

  it("pluralizes counts of one correctly", async () => {
    const answer = promptMergeChoice(1, 1);

    expect(Alert.alert).toHaveBeenCalledWith(
      "That account already has data",
      "Add your 1 plan and 1 routine to it?",
      expect.anything(),
      expect.anything(),
    );

    press("Cancel");
    await answer;
  });

  it("pluralizes counts other than one", async () => {
    const answer = promptMergeChoice(2, 5);

    expect(Alert.alert).toHaveBeenCalledWith(
      "That account already has data",
      "Add your 2 plans and 5 routines to it?",
      expect.anything(),
      expect.anything(),
    );

    press("Cancel");
    await answer;
  });
});
