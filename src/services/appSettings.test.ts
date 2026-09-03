import { Linking } from "react-native";

import { openAppSettings } from "@/services/appSettings";
import { useToastStore } from "@/store/toastStore";

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ toast: null, modalHosts: [] });
});

describe("openAppSettings", () => {
  it("opens the app's own page in the system Settings app", async () => {
    const openSettings = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValue(undefined);

    await expect(openAppSettings()).resolves.toBe(true);

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it("says so when the OS won't open it, rather than doing nothing visible", async () => {
    jest
      .spyOn(Linking, "openSettings")
      .mockRejectedValue(new Error("no activity found"));

    await expect(openAppSettings()).resolves.toBe(false);

    expect(useToastStore.getState().toast).toEqual(
      expect.objectContaining({
        message: "Couldn't open Settings. Open it yourself and find Brelly.",
        variant: "error",
      }),
    );
  });
});
