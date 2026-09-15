import { act, renderHook } from "@testing-library/react";

import { useAuthUser } from "./useAuthUser";

let currentUser: { uid: string; isAnonymous: boolean } | null = {
  uid: "anon-1",
  isAnonymous: true,
};
let notify: ((user: typeof currentUser) => void) | null = null;
const unsubscribe = jest.fn();

jest.mock("@/services/firebase", () => ({
  getFirebaseAuth: () => ({ get currentUser() { return currentUser; } }),
  subscribeToAuthUser: (onChange: (user: typeof currentUser) => void) => {
    notify = onChange;
    return unsubscribe;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { uid: "anon-1", isAnonymous: true };
  notify = null;
});

describe("useAuthUser", () => {
  it("has the session on the first render, not one render later", () => {
    const { result } = renderHook(() => useAuthUser());
    expect(result.current).toMatchObject({ uid: "anon-1" });
  });

  it("re-renders when the identity changes under it", () => {
    // Which is exactly what account linking does, from outside React. The SDK
    // swaps `currentUser` and *then* calls its listeners, which is the order
    // this stands in for — a notification whose snapshot has not moved is one
    // React is right to ignore.
    const { result } = renderHook(() => useAuthUser());

    act(() => {
      currentUser = { uid: "real-1", isAnonymous: false };
      notify?.(currentUser);
    });

    expect(result.current).toMatchObject({ uid: "real-1", isAnonymous: false });
  });

  it("unsubscribes on unmount", () => {
    renderHook(() => useAuthUser()).unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
