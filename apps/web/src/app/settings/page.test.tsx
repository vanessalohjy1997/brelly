import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useSettingsStore, useToastStore } from "@brelly/core";

import { useDeviceLocationStore } from "@/store/deviceLocationStore";
import { useLocalCacheStore } from "@/store/localCacheStore";
import { mockNextLink } from "@/test/mockNextLink";
import { renderRoute, resetAppState } from "@/test/routeHarness";

import SettingsPage from "./page";

jest.mock("next/link", () => mockNextLink());

const exportBackup = jest.fn();
jest.mock("@/services/backup", () => ({
  exportBackup: () => exportBackup(),
}));

let authUser: { isAnonymous: boolean; email?: string | null; displayName?: string | null } | null =
  { isAnonymous: true };
jest.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => authUser,
}));

const requestLocation = jest.fn();
jest.mock("@/hooks/useDeviceLocationPermission", () => ({
  useDeviceLocationPermission: () => ({
    permission: useDeviceLocationStore.getState().permission,
    request: requestLocation,
  }),
}));

beforeEach(() => {
  resetAppState();
  jest.clearAllMocks();
  authUser = { isAnonymous: true };
  useSettingsStore.setState({ themePreference: "system" });
  useLocalCacheStore.setState({ mode: "persistent", reason: null });
  useDeviceLocationStore.setState({ permission: "unprompted" });
});

describe("SettingsPage", () => {
  it("shows the three sections the web has, and none of the four it does not", () => {
    // Notifications, "Check your alerts", Calendar and App updates are hidden
    // rather than half-built — there is nothing behind them here.
    renderRoute(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backup" })).toBeInTheDocument();
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    expect(screen.queryByText("Rain alerts")).not.toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("App updates")).not.toBeInTheDocument();
  });

  it("marks the appearance the settings document currently holds", () => {
    useSettingsStore.setState({ themePreference: "dark" });
    renderRoute(<SettingsPage />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("saves an appearance and says which one", async () => {
    renderRoute(<SettingsPage />);

    await userEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(useSettingsStore.getState().themePreference).toBe("light");
    expect(useToastStore.getState().toast?.message).toBe(
      "Appearance set to Light",
    );
  });

  it("offers to ask for location only while there is still a dialog left", () => {
    // "Ask again" on a refused permission is the button that silently does
    // nothing — the browser will not re-prompt.
    renderRoute(<SettingsPage />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("names the browser's own control for a refusal, with nothing to press", () => {
    useDeviceLocationStore.setState({ permission: "denied" });
    renderRoute(<SettingsPage />);

    expect(screen.getByText("Location is off")).toBeInTheDocument();
    expect(screen.getByText(/padlock beside the address bar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("offers nothing to press once location is granted", () => {
    useDeviceLocationStore.setState({ permission: "granted" });
    renderRoute(<SettingsPage />);

    expect(screen.getByText("Location is on")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("asks for location when the row's own button is pressed", async () => {
    renderRoute(<SettingsPage />);

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(requestLocation).toHaveBeenCalled();
  });

  it("downloads a backup and says it landed", async () => {
    renderRoute(<SettingsPage />);

    await userEvent.click(screen.getByRole("button", { name: "Export data" }));

    expect(exportBackup).toHaveBeenCalled();
    await waitFor(() =>
      expect(useToastStore.getState().toast?.message).toBe("Backup downloaded"),
    );
  });

  it("says so when the download could not be made", async () => {
    exportBackup.mockImplementation(() => {
      throw new Error("no blob");
    });
    renderRoute(<SettingsPage />);

    await userEvent.click(screen.getByRole("button", { name: "Export data" }));

    expect(useToastStore.getState().toast?.message).toBe(
      "Couldn't export backup",
    );
  });

  it("invites an anonymous session to add an account", () => {
    renderRoute(<SettingsPage />);

    expect(
      screen.getByRole("link", { name: "Back up your data" }),
    ).toHaveAttribute("href", "/account");
    expect(
      screen.getByText("Add an account so your plans survive a lost laptop."),
    ).toBeInTheDocument();
  });

  it("puts the address in the hint, not in the button", () => {
    // An email is status, not an action, and a long one inside a centred button
    // reads as a broken button.
    authUser = { isAnonymous: false, email: "someone@example.com" };
    renderRoute(<SettingsPage />);

    expect(screen.getByRole("link", { name: "Your account" })).toBeInTheDocument();
    expect(
      screen.getByText(/Backed up as someone@example\.com/),
    ).toBeInTheDocument();
  });

  it("falls back to a display name, then to a generic, for a linked session", () => {
    authUser = { isAnonymous: false, email: null, displayName: "Sam" };
    const { rerender } = renderRoute(<SettingsPage />);
    expect(screen.getByText(/Backed up as Sam/)).toBeInTheDocument();

    authUser = { isAnonymous: false, email: null, displayName: null };
    rerender(<SettingsPage />);
    expect(screen.getByText(/Backed up as your account/)).toBeInTheDocument();
  });

  it("says when this browser refused to store anything locally", () => {
    // The one browser-specific failure worth a permanent row: without a
    // persistent cache an offline edit is gone on reload, with no error.
    useLocalCacheStore.setState({ mode: "memory", reason: "private window" });
    renderRoute(<SettingsPage />);

    expect(
      screen.getByText(/won't survive a reload/),
    ).toBeInTheDocument();
  });

  it("says nothing about the cache when it is working", () => {
    renderRoute(<SettingsPage />);

    expect(screen.queryByText(/won't survive a reload/)).not.toBeInTheDocument();
  });
});
