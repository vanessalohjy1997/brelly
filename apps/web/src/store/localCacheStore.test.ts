import { act, renderHook } from "@testing-library/react";

import { useCacheIsDegraded, useLocalCacheStore } from "./localCacheStore";

beforeEach(() => {
  useLocalCacheStore.setState({ mode: "persistent", reason: null });
});

describe("localCacheStore", () => {
  it("starts optimistic, because nothing has asked Firestore for a cache yet", () => {
    expect(useLocalCacheStore.getState().mode).toBe("persistent");
    expect(useLocalCacheStore.getState().reason).toBeNull();
  });

  it("records the SDK's own reason alongside the downgrade", () => {
    useLocalCacheStore.getState().setMode("memory", "IndexedDB unavailable");

    expect(useLocalCacheStore.getState()).toMatchObject({
      mode: "memory",
      reason: "IndexedDB unavailable",
    });
  });

  it("clears a stale reason when the mode is set without one", () => {
    useLocalCacheStore.getState().setMode("memory", "private browsing");
    useLocalCacheStore.getState().setMode("persistent");

    expect(useLocalCacheStore.getState().reason).toBeNull();
  });
});

describe("useCacheIsDegraded", () => {
  it("is false while the persistent cache is in use", () => {
    const { result } = renderHook(() => useCacheIsDegraded());
    expect(result.current).toBe(false);
  });

  it("turns true when the cache falls back to memory", () => {
    const { result } = renderHook(() => useCacheIsDegraded());

    act(() => useLocalCacheStore.getState().setMode("memory"));

    expect(result.current).toBe(true);
  });
});
