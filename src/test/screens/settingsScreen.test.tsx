import { fireEvent, render } from "@testing-library/react-native";

import SettingsScreen from "@/app/settings";
import { useSettingsStore } from "@/store/settingsStore";

const DEFAULTS = {
  themePreference: "system" as const,
  rainAlertsEnabled: true,
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  digest: { enabled: false, time: "07:30" },
  digestNotificationId: null,
};

beforeEach(() => {
  useSettingsStore.setState(DEFAULTS);
});

describe("SettingsScreen", () => {
  it("applies a theme choice to the store", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Dark"));

    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  it("toggles rain alerts off", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent(view.getByLabelText("Rain alerts"), "valueChange", false);

    expect(useSettingsStore.getState().rainAlertsEnabled).toBe(false);
  });

  it("hides the digest time until the digest is switched on", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.queryByText("Send at")).toBeNull();

    await fireEvent(view.getByLabelText("Daily digest"), "valueChange", true);

    expect(view.getByText("Send at")).toBeTruthy();
  });

  it("changes the digest time", async () => {
    useSettingsStore.setState({ digest: { enabled: true, time: "07:30" } });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("06:30"));

    expect(useSettingsStore.getState().digest.time).toBe("06:30");
  });

  it("keeps the digest enabled when only the time changes", async () => {
    useSettingsStore.setState({ digest: { enabled: true, time: "07:30" } });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("08:30"));

    expect(useSettingsStore.getState().digest).toEqual({
      enabled: true,
      time: "08:30",
    });
  });

  it("hides the quiet-hours bounds until quiet hours are switched on", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.queryByText("From")).toBeNull();

    await fireEvent(view.getByLabelText("Quiet hours"), "valueChange", true);

    expect(view.getByText("From")).toBeTruthy();
    expect(view.getByText("Until")).toBeTruthy();
  });

  it("changes the quiet-hours start without disturbing the end", async () => {
    useSettingsStore.setState({
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("23:00"));

    expect(useSettingsStore.getState().quietHours).toEqual({
      enabled: true,
      start: "23:00",
      end: "07:00",
    });
  });

  it("changes the quiet-hours end", async () => {
    useSettingsStore.setState({
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("08:00"));

    expect(useSettingsStore.getState().quietHours.end).toBe("08:00");
  });
});
