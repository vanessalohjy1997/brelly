import { act, renderHook } from "@testing-library/react-native";

import { useAuthUser } from "@/hooks/useAuthUser";
import { fakeAuth } from "@/test/fakeAuth";

beforeEach(() => {
  fakeAuth.reset();
});

describe("useAuthUser", () => {
  it("starts with whatever the current user already is", async () => {
    fakeAuth.setCurrentUser({ uid: "u1", isAnonymous: true });

    const { result } = await renderHook(() => useAuthUser());

    expect(result.current?.uid).toBe("u1");
  });

  it("starts null before any sign-in", async () => {
    const { result } = await renderHook(() => useAuthUser());

    expect(result.current).toBeNull();
  });

  it("updates when the auth state changes after mount", async () => {
    const { result } = await renderHook(() => useAuthUser());

    expect(result.current).toBeNull();

    await act(async () => {
      fakeAuth.setCurrentUser({
        uid: "u2",
        isAnonymous: false,
        email: "person@example.com",
      });
    });

    expect(result.current?.email).toBe("person@example.com");
  });
});
