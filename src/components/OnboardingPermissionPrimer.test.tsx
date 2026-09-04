import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import { OnboardingPermissionPrimer } from "@/components/OnboardingPermissionPrimer";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
});

describe("OnboardingPermissionPrimer", () => {
  it("says location is optional, and what it costs to skip", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        permission="unprompted"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(view.getByText("Location is optional")).toBeTruthy();
    expect(
      view.getByText(/Brelly forecasts the places on your plans/),
    ).toBeTruthy();
    expect(view.getByText(/Skipping costs you nothing/)).toBeTruthy();
  });

  it("renders notification-specific copy for the notification kind", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="notification"
        permission="unprompted"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(view.getByText("Get rain alerts")).toBeTruthy();
    expect(
      view.getByText(/Brelly sends a heads-up before a stop that looks wet/),
    ).toBeTruthy();
  });

  it("labels the primary action neutrally — it opens the OS dialog, it doesn't answer it", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        permission="unprompted"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    // App Review read "Allow" in front of the system dialog as pressure.
    expect(view.queryByText("Allow")).toBeNull();
    expect(view.getByText("Continue")).toBeTruthy();
  });

  it("gives both answers the same visual weight", async () => {
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        permission="unprompted"
        onAllow={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    const styleOf = (label: string) =>
      view.getByText(label).parent?.props.style;

    expect(styleOf("Continue")).toEqual(styleOf("Not now"));
  });

  it.each(["location", "notification"] as const)(
    "asks for the %s permission when there is still a prompt to show",
    async (kind) => {
      const onAllow = jest.fn();
      const view = await render(
        <OnboardingPermissionPrimer
          kind={kind}
          permission="unprompted"
          onAllow={onAllow}
          onSkip={jest.fn()}
        />,
      );

      await fireEvent.press(view.getByText("Continue"));

      expect(onAllow).toHaveBeenCalledTimes(1);
      expect(Linking.openSettings).not.toHaveBeenCalled();
    },
  );

  it.each(["location", "notification"] as const)(
    "routes an already-denied %s permission to system Settings instead of a dead prompt",
    async (kind) => {
      const onAllow = jest.fn();
      const view = await render(
        <OnboardingPermissionPrimer
          kind={kind}
          permission="denied"
          onAllow={onAllow}
          onSkip={jest.fn()}
        />,
      );

      expect(view.getByText(/won't ask again/)).toBeTruthy();
      await fireEvent.press(view.getByText("Open Settings"));

      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
      // The OS resolves a second request instantly to nothing, so it must not
      // fire one and pretend it asked.
      expect(onAllow).not.toHaveBeenCalled();
    },
  );

  it("keeps a way past the step whatever the permission says", async () => {
    const onSkip = jest.fn();
    const view = await render(
      <OnboardingPermissionPrimer
        kind="location"
        permission="denied"
        onAllow={jest.fn()}
        onSkip={onSkip}
      />,
    );

    await fireEvent.press(view.getByText("Not now"));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
