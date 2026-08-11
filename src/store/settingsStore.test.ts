import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";
import { writeSettingsFields } from "@/services/settingsSync";

jest.mock("@/services/settingsSync", () => ({
  writeSettingsFields: jest.fn(),
}));

const mockWriteSettingsFields = writeSettingsFields as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, digestNotificationId: null });
});

describe("useSettingsStore defaults", () => {
  it("starts at DEFAULT_SETTINGS plus no digest notification scheduled", () => {
    const state = useSettingsStore.getState();

    expect(state.themePreference).toBe(DEFAULT_SETTINGS.themePreference);
    expect(state.rainAlertsEnabled).toBe(DEFAULT_SETTINGS.rainAlertsEnabled);
    expect(state.rainLeadMinutes).toBe(DEFAULT_SETTINGS.rainLeadMinutes);
    expect(state.quietHours).toEqual(DEFAULT_SETTINGS.quietHours);
    expect(state.digest).toEqual(DEFAULT_SETTINGS.digest);
    expect(state.hasSeenOnboarding).toBe(DEFAULT_SETTINGS.hasSeenOnboarding);
    expect(state.digestNotificationId).toBeNull();
  });
});

describe("cloud-synced setters", () => {
  it("setThemePreference updates locally and writes to the cloud", () => {
    useSettingsStore.getState().setThemePreference("dark");

    expect(useSettingsStore.getState().themePreference).toBe("dark");
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      themePreference: "dark",
    });
  });

  it("setRainAlertsEnabled updates locally and writes to the cloud", () => {
    useSettingsStore.getState().setRainAlertsEnabled(false);

    expect(useSettingsStore.getState().rainAlertsEnabled).toBe(false);
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      rainAlertsEnabled: false,
    });
  });

  it("setRainLeadMinutes updates locally and writes to the cloud", () => {
    useSettingsStore.getState().setRainLeadMinutes(15);

    expect(useSettingsStore.getState().rainLeadMinutes).toBe(15);
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      rainLeadMinutes: 15,
    });
  });

  it("setQuietHours merges the partial update before writing to the cloud", () => {
    useSettingsStore.getState().setQuietHours({ enabled: true });

    expect(useSettingsStore.getState().quietHours).toEqual({
      enabled: true,
      start: "22:00",
      end: "07:00",
    });
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
  });

  it("setDigest merges the partial update before writing to the cloud", () => {
    useSettingsStore.getState().setDigest({ time: "06:30" });

    expect(useSettingsStore.getState().digest).toEqual({
      enabled: false,
      time: "06:30",
    });
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      digest: { enabled: false, time: "06:30" },
    });
  });

  it("setHasSeenOnboarding updates locally and writes to the cloud", () => {
    useSettingsStore.getState().setHasSeenOnboarding(true);

    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
    expect(mockWriteSettingsFields).toHaveBeenCalledWith({
      hasSeenOnboarding: true,
    });
  });
});

describe("setDigestNotificationId", () => {
  it("updates locally and never writes to the cloud", () => {
    useSettingsStore.getState().setDigestNotificationId("notif-123");

    expect(useSettingsStore.getState().digestNotificationId).toBe(
      "notif-123",
    );
    expect(mockWriteSettingsFields).not.toHaveBeenCalled();
  });
});
