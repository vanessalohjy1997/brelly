import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { Linking } from "react-native";

import SettingsScreen from "@/app/(tabs)/settings";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
import { fakeAuth } from "@/test/fakeAuth";

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const getAllScheduled =
  Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const scheduleNotification =
  Notifications.scheduleNotificationAsync as jest.Mock;
const useUpdatesMock = Updates.useUpdates as jest.Mock;
const checkForUpdateAsync = Updates.checkForUpdateAsync as jest.Mock;
const reloadAsync = Updates.reloadAsync as jest.Mock;

const NO_UPDATE = {
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  isRestarting: false,
  checkError: undefined,
  downloadError: undefined,
};

const DEFAULTS = {
  themePreference: "system" as const,
  rainAlertsEnabled: true,
  rainLeadMinutes: 45 as const,
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  digest: { enabled: false, time: "07:30" },
  digestNotificationId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.reset();
  useSettingsStore.setState(DEFAULTS);
  useToastStore.setState({ toast: null, modalHosts: [] });
  getPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  requestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  getAllScheduled.mockResolvedValue([]);
  (Updates as { isEnabled: boolean }).isEnabled = true;
  useUpdatesMock.mockReturnValue(NO_UPDATE);
  checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  reloadAsync.mockResolvedValue(undefined);
  jest.spyOn(Linking, "openSettings").mockImplementation(async () => {});
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

describe("SettingsScreen — save feedback", () => {
  // Settings has no Save button and never closes on a change, so the toast
  // is the only acknowledgement. Settings is a tab now, not a modal with its
  // own host, so — like the other tabs — these check the store the root
  // `ToastHost` renders from rather than rendered toast text.
  it("confirms a change", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Dark"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Appearance set to Dark",
      variant: "success",
    });
  });

  it("says which way a switch went", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent(view.getByLabelText("Rain alerts"), "valueChange", false);

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Rain alerts off",
    });
  });

  it("confirms a new lead time in the same words as the setting", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("15 min"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Warning 15 minutes ahead",
    });
  });

  it("confirms a digest time", async () => {
    useSettingsStore.setState({ digest: { enabled: true, time: "07:30" } });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("06:30"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Digest at 06:30",
    });
  });

  it("confirms a quiet-hours bound", async () => {
    useSettingsStore.setState({
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("23:00"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Quiet from 23:00",
    });
  });

  it("reports a change that failed to save instead of implying it worked", async () => {
    const failing = jest
      .spyOn(useSettingsStore.getState(), "setRainAlertsEnabled")
      .mockImplementation(() => {
        throw new Error("mmkv: no space left on device");
      });
    const view = await render(<SettingsScreen />);

    await fireEvent(view.getByLabelText("Rain alerts"), "valueChange", false);

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't save that setting. Try again.",
      variant: "error",
    });

    failing.mockRestore();
  });
});

describe("SettingsScreen — rain alert lead time", () => {
  it("shows the current lead time in the rain alerts hint", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.getByText("45 minutes before a stop that looks wet")).toBeTruthy();
  });

  it("offers the four intervals", async () => {
    const view = await render(<SettingsScreen />);

    for (const label of ["15 min", "30 min", "45 min", "1 hr"]) {
      expect(view.getByText(label)).toBeTruthy();
    }
  });

  it("applies a chosen lead time to the store", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("15 min"));

    expect(useSettingsStore.getState().rainLeadMinutes).toBe(15);
  });

  it("re-words the hint once the lead time changes", async () => {
    useSettingsStore.setState({ ...DEFAULTS, rainLeadMinutes: 60 });
    const view = await render(<SettingsScreen />);

    expect(view.getByText("1 hour before a stop that looks wet")).toBeTruthy();
  });

  it("hides the lead time when rain alerts are off — it would control nothing", async () => {
    useSettingsStore.setState({ ...DEFAULTS, rainAlertsEnabled: false });
    const view = await render(<SettingsScreen />);

    expect(view.queryByText("15 min")).toBeNull();
  });

  it("offers no sun-alert control — UV never notifies", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.queryByText(/[Ss]un/)).toBeNull();
    expect(view.queryByText(/UV/)).toBeNull();
  });
});

describe("SettingsScreen — notification permission", () => {
  it("says nothing when the OS is happy to deliver", async () => {
    const view = await render(<SettingsScreen />);

    await waitFor(() =>
      expect(view.queryByText("Notifications are off for Brelly")).toBeNull(),
    );
  });

  it("says so when a switch here cannot possibly work", async () => {
    // Toggling "Rain alerts" on with the OS permission denied used to write
    // `true`, render an on switch, and deliver nothing, indefinitely.
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const view = await render(<SettingsScreen />);

    expect(
      await view.findByText("Notifications are off for Brelly"),
    ).toBeTruthy();
  });

  it("offers the only way back when the OS won't ask again", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(await view.findByText("Open Settings"));

    expect(Linking.openSettings).toHaveBeenCalled();
    // Re-prompting is pointless once refused, so it must not try.
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("prompts in place when there is still a prompt to show", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(await view.findByText("Allow notifications"));

    expect(requestPermissions).toHaveBeenCalled();
  });
});

describe("SettingsScreen — checking your alerts", () => {
  it("reports what the OS actually has queued, not what the switches say", async () => {
    getAllScheduled.mockResolvedValue([{ identifier: "a" }, { identifier: "b" }]);
    const view = await render(<SettingsScreen />);

    expect(
      await view.findByText("2 alerts waiting to be delivered"),
    ).toBeTruthy();
  });

  it("counts one alert in the singular", async () => {
    getAllScheduled.mockResolvedValue([{ identifier: "a" }]);
    const view = await render(<SettingsScreen />);

    expect(await view.findByText("1 alert waiting to be delivered")).toBeTruthy();
  });

  it("sends a test alert and confirms it", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Send a test alert"));

    await waitFor(() => expect(scheduleNotification).toHaveBeenCalled());
    await waitFor(() =>
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Test alert on its way",
        variant: "success",
      }),
    );
  });

  it("says why nothing was sent when permission is refused", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    requestPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Send a test alert"));

    await waitFor(() =>
      expect(useToastStore.getState().toast).toMatchObject({
        variant: "error",
      }),
    );
    expect(scheduleNotification).not.toHaveBeenCalled();
  });
});

describe("SettingsScreen — back up your data", () => {
  it("offers to back up while still anonymous", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.getByText("Back up your data")).toBeTruthy();
  });

  it("shows who it's backed up as once linked", async () => {
    fakeAuth.setCurrentUser({
      uid: "linked-uid",
      isAnonymous: false,
      email: "person@example.com",
    });
    const view = await render(<SettingsScreen />);

    expect(view.getByText("Backed up as person@example.com")).toBeTruthy();
    expect(view.queryByText("Back up your data")).toBeNull();
  });

  it("opens the account-link screen", async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Back up your data"));

    expect(router.push).toHaveBeenCalledWith("/account-link");
  });

  it("says the app is up to date when nothing is staged", async () => {
    const view = await render(<SettingsScreen />);

    expect(view.getByText("Brelly is up to date.")).toBeTruthy();
    expect(view.getByText("Check for updates")).toBeTruthy();
  });

  it("checks for an update on demand", async () => {
    // The whole point of an over-the-air channel is that it is invisible, so
    // this button is the only way to tell a working one from a broken one.
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByText("Check for updates"));

    await waitFor(() => expect(checkForUpdateAsync).toHaveBeenCalled());
  });

  it("turns into a restart once an update is staged", async () => {
    useUpdatesMock.mockReturnValue({ ...NO_UPDATE, isUpdatePending: true });
    const view = await render(<SettingsScreen />);

    expect(view.getByText("An update is ready. Restart to use it.")).toBeTruthy();
    await fireEvent.press(view.getByText("Restart now"));

    await waitFor(() => expect(reloadAsync).toHaveBeenCalled());
  });

  it("disables the button in a build that cannot take updates", async () => {
    // A development build has no updates client. Offering a check there is a
    // button that can only ever throw.
    (Updates as { isEnabled: boolean }).isEnabled = false;
    const view = await render(<SettingsScreen />);

    expect(
      view.getByText("This build installs updates with the app itself."),
    ).toBeTruthy();
    await fireEvent.press(view.getByText("Check for updates"));

    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
