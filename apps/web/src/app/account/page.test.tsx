import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useToastStore } from "@brelly/core";

import { useDialogStore } from "@/store/dialogStore";
import { renderRoute, resetAppState } from "@/test/routeHarness";

import AccountPage from "./page";

const linkProvider = jest.fn();
jest.mock("@brelly/platform/auth", () => ({
  linkProvider: (request: unknown) => linkProvider(request),
}));

const readAnonymousData = jest.fn();
const mergeIntoExistingAccount = jest.fn();
const signOutOfAccount = jest.fn();
jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  readAnonymousData: () => readAnonymousData(),
  mergeIntoExistingAccount: (...args: unknown[]) =>
    mergeIntoExistingAccount(...args),
  signOutOfAccount: () => signOutOfAccount(),
}));

let authUser: {
  isAnonymous: boolean;
  email?: string | null;
  displayName?: string | null;
} | null = { isAnonymous: true };
jest.mock("@/hooks/useAuthUser", () => ({ useAuthUser: () => authUser }));

/** A credential the popup handed back, opaque to everything but Firebase. */
const CREDENTIAL = { providerId: "google.com" };

/** Waits for a dialog to open and presses one of its buttons. */
async function answerDialog(key: string) {
  await waitFor(() => expect(useDialogStore.getState().dialog).not.toBeNull());
  useDialogStore.getState().answer(key);
}

beforeEach(() => {
  resetAppState();
  jest.clearAllMocks();
  authUser = { isAnonymous: true };
  linkProvider.mockResolvedValue({ status: "linked" });
  readAnonymousData.mockResolvedValue({
    isEmpty: false,
    slots: [{ id: "slot-1" }],
    routines: [{ id: "routine-1" }],
  });
  mergeIntoExistingAccount.mockResolvedValue(undefined);
  signOutOfAccount.mockResolvedValue(undefined);
});

/** Fills the email pair and submits it. */
async function submitEmail(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), " sam@example.com ");
  await user.type(screen.getByLabelText("Password"), "hunter2");
  await user.click(screen.getByRole("button", { name: "Continue with email" }));
}

describe("AccountPage", () => {
  it("offers Apple to every browser, not just an Apple one", () => {
    // The phone gates this on `Platform.OS === "ios"` because
    // `expo-apple-authentication` only exists there. Apple's JS Sign In works
    // anywhere, so the gate has nothing left to protect.
    renderRoute(<AccountPage />);

    expect(
      screen.getByRole("button", { name: "Continue with Apple" }),
    ).toBeInTheDocument();
  });

  it("links a provider and says so", async () => {
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(linkProvider).toHaveBeenCalledWith({ provider: "google" });
    await waitFor(() =>
      expect(useToastStore.getState().toast?.message).toBe("Backed up"),
    );
    expect(readAnonymousData).not.toHaveBeenCalled();
  });

  it("trims the email, because autofill carries a trailing space", async () => {
    // Firebase rejects that as `auth/invalid-email`.
    const user = userEvent.setup();
    renderRoute(<AccountPage />);

    await submitEmail(user);

    expect(linkProvider).toHaveBeenCalledWith({
      provider: "email",
      email: "sam@example.com",
      password: "hunter2",
    });
  });

  it("will not submit an email with half the pair filled in", async () => {
    const user = userEvent.setup();
    renderRoute(<AccountPage />);

    await user.type(screen.getByLabelText("Email"), "sam@example.com");

    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeDisabled();
  });

  it("reads the cloud, not the stores, before asking about a merge", async () => {
    // The stores are a mirror of those documents: a session whose listeners had
    // not hydrated saw "nothing to merge" and went straight into the discard
    // branch — a silent deletion of everything in the account.
    linkProvider.mockResolvedValue({
      status: "merge-required",
      credential: CREDENTIAL,
    });
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await answerDialog("add");

    expect(readAnonymousData).toHaveBeenCalled();
    await waitFor(() =>
      expect(mergeIntoExistingAccount).toHaveBeenCalledWith(
        CREDENTIAL,
        expect.objectContaining({ isEmpty: false }),
        true,
      ),
    );
    expect(useToastStore.getState().toast?.message).toBe("Added your plans");
  });

  it("signs in without merging when the answer is don't add", async () => {
    linkProvider.mockResolvedValue({
      status: "merge-required",
      credential: CREDENTIAL,
    });
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await answerDialog("dont-add");

    await waitFor(() =>
      expect(mergeIntoExistingAccount).toHaveBeenCalledWith(
        CREDENTIAL,
        expect.anything(),
        false,
      ),
    );
    expect(useToastStore.getState().toast?.message).toBe("Signed in");
  });

  it("does nothing at all when the merge question is cancelled", async () => {
    linkProvider.mockResolvedValue({
      status: "merge-required",
      credential: CREDENTIAL,
    });
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await answerDialog("cancel");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).toBeEnabled(),
    );
    expect(mergeIntoExistingAccount).not.toHaveBeenCalled();
  });

  it("skips the question when there is nothing to merge", async () => {
    linkProvider.mockResolvedValue({
      status: "merge-required",
      credential: CREDENTIAL,
    });
    readAnonymousData.mockResolvedValue({
      isEmpty: true,
      slots: [],
      routines: [],
    });
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(mergeIntoExistingAccount).toHaveBeenCalledWith(
        CREDENTIAL,
        expect.anything(),
        false,
      ),
    );
    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("says what went wrong in the provider's own terms", async () => {
    linkProvider.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderRoute(<AccountPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(useToastStore.getState().toast?.variant).toBe("error"),
    );
  });

  it("asks before signing out, and stays put on a cancel", async () => {
    // The one action here undo cannot cover: it swaps the whole session in one
    // step and a toast could not re-enter a password it never held.
    authUser = { isAnonymous: false, email: "sam@example.com" };
    renderRoute(<AccountPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await answerDialog("cancel");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
    );
    expect(signOutOfAccount).not.toHaveBeenCalled();
  });

  it("signs out when the question is answered", async () => {
    authUser = { isAnonymous: false, email: "sam@example.com" };
    renderRoute(<AccountPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await answerDialog("sign-out");

    await waitFor(() => expect(signOutOfAccount).toHaveBeenCalled());
    expect(useToastStore.getState().toast?.message).toBe("Signed out");
  });

  it("says the sign-out did not happen rather than guessing which half did", async () => {
    authUser = { isAnonymous: false, email: "sam@example.com" };
    signOutOfAccount.mockRejectedValue(new Error("network"));
    renderRoute(<AccountPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await answerDialog("sign-out");

    await waitFor(() =>
      expect(useToastStore.getState().toast?.message).toBe("Couldn't sign out"),
    );
  });

  it("shows who the session belongs to, and no sign-in controls", () => {
    authUser = { isAnonymous: false, email: "sam@example.com" };
    renderRoute(<AccountPage />);

    expect(
      screen.getByText("Backed up as sam@example.com"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
  });
});
