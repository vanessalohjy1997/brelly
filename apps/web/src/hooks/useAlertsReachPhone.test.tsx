import { renderHook } from "@testing-library/react";

import { alertsReachPhone, useAlertsReachPhone } from "./useAlertsReachPhone";

let authUser: { isAnonymous: boolean } | null = null;
jest.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => authUser,
}));

describe("alertsReachPhone", () => {
  it("is false with no session, and for an anonymous one", () => {
    // An anonymous browser session has a uid no phone can share, so a setting
    // made under it reaches nothing that sends an alert.
    expect(alertsReachPhone(null)).toBe(false);
    expect(alertsReachPhone(undefined)).toBe(false);
    expect(alertsReachPhone({ isAnonymous: true })).toBe(false);
  });

  it("is true once the session is linked to a real identity", () => {
    expect(alertsReachPhone({ isAnonymous: false })).toBe(true);
  });
});

describe("useAlertsReachPhone", () => {
  it("follows the live auth user", () => {
    authUser = { isAnonymous: false };
    expect(renderHook(() => useAlertsReachPhone()).result.current).toBe(true);

    authUser = { isAnonymous: true };
    expect(renderHook(() => useAlertsReachPhone()).result.current).toBe(false);
  });
});
