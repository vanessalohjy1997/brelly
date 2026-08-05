import { fireEvent, render } from "@testing-library/react-native";

import { OnboardingPermissionPrimer } from "@/components/OnboardingPermissionPrimer";

describe("OnboardingPermissionPrimer", () => {
  it("renders location-specific copy for the location kind", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(view.getByText("Know where you are")).toBeTruthy();
    expect(
      view.getByText(
        /Brelly uses your location to show nearby weather and prefill your stop/,
      ),
    ).toBeTruthy();
  });

  it("renders notification-specific copy for the notification kind", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="notification"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(view.getByText("Get rain alerts")).toBeTruthy();
    expect(
      view.getByText(
        /Brelly sends a heads-up before a stop that looks wet/,
      ),
    ).toBeTruthy();
  });

  it("calls onAllow when Allow is pressed", async () => {
    const onAllow = jest.fn();
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        onAllow={onAllow}
        onSkip={jest.fn()}
      />,
    );

    await fireEvent.press(view.getByText("Allow"));

    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when Not now is pressed", async () => {
    const onSkip = jest.fn();
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        onAllow={jest.fn()}
        onSkip={onSkip}
      />,
    );

    await fireEvent.press(view.getByText("Not now"));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
