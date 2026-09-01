import { Alert } from "react-native";

import { confirmSignOut } from "@/utils/confirmSignOut";

type AlertButton = { text?: string; onPress?: () => void };

function pressButton(text: string): void {
  const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0] as [
    string,
    string,
    AlertButton[],
  ];
  buttons.find((button) => button.text === text)?.onPress?.();
}

beforeEach(() => {
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("confirmSignOut", () => {
  it("resolves true only when Sign out is pressed", async () => {
    const answer = confirmSignOut();
    pressButton("Sign out");

    await expect(answer).resolves.toBe(true);
  });

  it("resolves false on Cancel", async () => {
    const answer = confirmSignOut();
    pressButton("Cancel");

    await expect(answer).resolves.toBe(false);
  });

  it("resolves false when the alert is dismissed unanswered", async () => {
    const answer = confirmSignOut();
    const [, , , options] = (Alert.alert as jest.Mock).mock.calls[0] as [
      string,
      string,
      AlertButton[],
      { onDismiss: () => void },
    ];
    options.onDismiss();

    await expect(answer).resolves.toBe(false);
  });

  it("says the account keeps the data, so this does not read as a delete", async () => {
    const answer = confirmSignOut();
    const [, message] = (Alert.alert as jest.Mock).mock.calls[0] as [
      string,
      string,
    ];

    expect(message).toContain("stay in the account");
    pressButton("Cancel");
    await answer;
  });
});
