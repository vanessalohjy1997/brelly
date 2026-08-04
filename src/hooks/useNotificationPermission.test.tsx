import { renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import { useNotificationPermission } from "@/hooks/useNotificationPermission";

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  requestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
});

describe("useNotificationPermission", () => {
  it("reports a granted permission", async () => {
    const { result } = await renderHook(() => useNotificationPermission());

    await waitFor(() => expect(result.current.status).toBe("granted"));
  });

  it("tells 'not asked yet' apart from 'asked and refused'", async () => {
    // Only one of them has a prompt left. Offering a button that silently
    // does nothing is exactly the bug this hook exists to fix.
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useNotificationPermission());

    await waitFor(() => expect(result.current.status).toBe("unprompted"));
  });

  it("reports a refusal the OS won't re-prompt for as denied", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = await renderHook(() => useNotificationPermission());

    await waitFor(() => expect(result.current.status).toBe("denied"));
  });

  it("does not prompt merely by being mounted", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useNotificationPermission());

    await waitFor(() => expect(result.current.status).toBe("unprompted"));
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("updates when the user grants permission from the prompt", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.status).toBe("unprompted"));

    requestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    await result.current.request();

    await waitFor(() => expect(result.current.status).toBe("granted"));
  });

  it("goes to denied when the prompt is refused", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.status).toBe("unprompted"));

    requestPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    await result.current.request();

    await waitFor(() => expect(result.current.status).toBe("denied"));
  });

  it("holds its ground rather than accusing the OS when the read fails", async () => {
    getPermissions.mockRejectedValue(new Error("unavailable"));
    const { result } = await renderHook(() => useNotificationPermission());

    // Still "checking" — not "denied", which would put an accusatory banner
    // in front of someone whose permission may be perfectly fine.
    await waitFor(() => expect(getPermissions).toHaveBeenCalled());
    expect(result.current.status).toBe("checking");
  });
});
