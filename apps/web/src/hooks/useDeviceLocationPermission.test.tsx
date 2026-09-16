import { renderHook, waitFor } from "@testing-library/react";

import {
  resetDeviceLocationStore,
  useDeviceLocationStore,
} from "@/store/deviceLocationStore";

import { useDeviceLocationPermission } from "./useDeviceLocationPermission";

const sync = jest.fn(async () => {});
const request = jest.fn(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  resetDeviceLocationStore();
  useDeviceLocationStore.setState({ sync, request });
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useDeviceLocationPermission", () => {
  it("reads the existing status on mount, without prompting", async () => {
    const { result } = renderHook(() => useDeviceLocationPermission());

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(request).not.toHaveBeenCalled();
    expect(result.current.permission).toBe("checking");
  });

  it("re-reads when the tab comes back", async () => {
    // The site-settings panel is where this answer is changed and the page is
    // not told, so returning is the only chance to notice — in both directions.
    renderHook(() => useDeviceLocationPermission());
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    setVisibility("visible");

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  });

  it("does nothing at all while disabled", () => {
    renderHook(() => useDeviceLocationPermission(false));
    setVisibility("visible");

    expect(sync).not.toHaveBeenCalled();
  });

  it("hands the prompt back rather than firing it", async () => {
    const { result } = renderHook(() => useDeviceLocationPermission());

    await result.current.request();

    expect(request).toHaveBeenCalled();
  });
});
