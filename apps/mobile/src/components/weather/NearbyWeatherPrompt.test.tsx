import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import { NearbyWeatherPrompt } from "@/components/weather/NearbyWeatherPrompt";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openSettings").mockImplementation(async () => {});
});

describe("NearbyWeatherPrompt", () => {
  it("explains why before prompting, rather than firing the OS dialog on mount", async () => {
    const onRequest = jest.fn();
    const view = await render(
      <NearbyWeatherPrompt permission="unprompted" onRequest={onRequest} />,
    );

    expect(view.getByText(/only reads your location while you have it open/)).toBeTruthy();
    // Nothing happens until the user asks for it.
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("requests permission when the user opts in", async () => {
    const onRequest = jest.fn();
    const view = await render(
      <NearbyWeatherPrompt permission="unprompted" onRequest={onRequest} />,
    );

    await fireEvent.press(view.getByText("Show weather near me"));

    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it("offers a way back after a refusal — the OS won't ask twice", async () => {
    const onRequest = jest.fn();
    const view = await render(
      <NearbyWeatherPrompt permission="denied" onRequest={onRequest} />,
    );

    await fireEvent.press(view.getByText("Open Settings"));

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    // Re-prompting is pointless once denied, so it must not try.
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("distinguishes 'no fix came back' from a refusal, and retries in place", async () => {
    const onRequest = jest.fn();
    const view = await render(
      <NearbyWeatherPrompt permission="unavailable" onRequest={onRequest} />,
    );

    expect(view.getByText("Couldn't find you")).toBeTruthy();
    await fireEvent.press(view.getByText("Try again"));

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it("renders nothing once permission is granted", async () => {
    const view = await render(
      <NearbyWeatherPrompt permission="granted" onRequest={jest.fn()} />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it("renders nothing while the status is still being read", async () => {
    const view = await render(
      <NearbyWeatherPrompt permission="checking" onRequest={jest.fn()} />,
    );

    expect(view.toJSON()).toBeNull();
  });
});
