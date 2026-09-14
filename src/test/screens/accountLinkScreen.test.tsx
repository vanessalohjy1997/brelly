import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { linkProvider } from "@brelly/platform/auth";

import AccountLinkScreen from "@/app/account-link";
import {
  mergeIntoExistingAccount,
  readAnonymousData,
  signOutOfAccount,
} from "@/services/accountLinkService";
import { useToastStore } from "@/store/toastStore";
import { fakeAuth } from "@/test/fakeAuth";
import { confirmSignOut } from "@/utils/confirmSignOut";
import { promptMergeChoice } from "@/utils/promptMergeChoice";

jest.mock("@/services/accountLinkService", () => ({
  mergeIntoExistingAccount: jest.fn(),
  readAnonymousData: jest.fn(),
  signOutOfAccount: jest.fn(),
}));
// The screen no longer acquires a credential and then links it — those were
// two steps only because a phone allows them to be. It states the intent and
// the seam hands back whatever credential it ended up using.
jest.mock("@brelly/platform/auth", () => ({ linkProvider: jest.fn() }));
jest.mock("@/utils/promptMergeChoice", () => ({
  promptMergeChoice: jest.fn(),
}));
jest.mock("@/utils/confirmSignOut", () => ({
  confirmSignOut: jest.fn(),
}));

const mockLink = linkProvider as jest.Mock;
const mockMerge = mergeIntoExistingAccount as jest.Mock;
const mockCloudRead = readAnonymousData as jest.Mock;
const mockPrompt = promptMergeChoice as jest.Mock;
const mockSignOut = signOutOfAccount as jest.Mock;
const mockConfirmSignOut = confirmSignOut as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.reset();
  useToastStore.setState({ toast: null, modalHosts: [] });
});

describe("AccountLinkScreen", () => {
  it("offers Google, Apple, and email while anonymous", async () => {
    const view = await render(<AccountLinkScreen />);

    expect(view.getByText("Continue with Google")).toBeTruthy();
    expect(view.getByText("Continue with Apple")).toBeTruthy();
    expect(view.getByText("Continue with email")).toBeTruthy();
  });

  it("links and dismisses on a brand-new account", async () => {
    mockLink.mockResolvedValue({ status: "linked" });
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(mockMerge).not.toHaveBeenCalled();
  });

  it("prompts for a merge and adds local data when the user chooses to", async () => {
    mockLink.mockResolvedValue({
      status: "merge-required",
      credential: { providerId: "google.com" },
    });
    mockCloudRead.mockResolvedValue({
      slots: [{ date: "2025-06-01", slot: {} }],
      routines: [{}],
      isEmpty: false,
    });
    mockPrompt.mockResolvedValue("add");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() =>
      expect(mockMerge).toHaveBeenCalledWith(
        { providerId: "google.com" },
        expect.objectContaining({ isEmpty: false }),
        true,
      ),
    );
    expect(router.back).toHaveBeenCalled();
  });

  it("merges without local data when the user declines", async () => {
    mockLink.mockResolvedValue({
      status: "merge-required",
      credential: { providerId: "google.com" },
    });
    mockCloudRead.mockResolvedValue({
      slots: [{ date: "2025-06-01", slot: {} }],
      routines: [],
      isEmpty: false,
    });
    mockPrompt.mockResolvedValue("dont-add");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() =>
      expect(mockMerge).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false,
      ),
    );
  });

  it("does nothing further when the merge prompt is cancelled", async () => {
    mockLink.mockResolvedValue({
      status: "merge-required",
      credential: { providerId: "google.com" },
    });
    mockCloudRead.mockResolvedValue({
      slots: [{ date: "2025-06-01", slot: {} }],
      routines: [],
      isEmpty: false,
    });
    mockPrompt.mockResolvedValue("cancel");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() => expect(mockPrompt).toHaveBeenCalled());
    expect(mockMerge).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("skips the prompt and merges quietly when there is nothing local to bring across", async () => {
    mockLink.mockResolvedValue({
      status: "merge-required",
      credential: { providerId: "google.com" },
    });
    mockCloudRead.mockResolvedValue({ slots: [], routines: [], isEmpty: true });
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() =>
      expect(mockMerge).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        false,
      ),
    );
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it("shows an error toast when linking fails", async () => {
    mockLink.mockRejectedValue(new Error("network"));
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() =>
      expect(view.getByText("Couldn't back up your data")).toBeTruthy(),
    );
  });

  it("shows who it's backed up as once linked, with no provider rows", async () => {
    fakeAuth.setCurrentUser({
      uid: "u1",
      isAnonymous: false,
      email: "person@example.com",
    });
    const view = await render(<AccountLinkScreen />);

    expect(view.getByText("Backed up as person@example.com")).toBeTruthy();
    expect(view.queryByText("Continue with Google")).toBeNull();
  });

  it("does nothing when the email button is pressed with an empty field", async () => {
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with email"));

    expect(mockLink).not.toHaveBeenCalled();
  });

  it("continues with email once both fields are filled", async () => {
    mockLink.mockResolvedValue({ status: "linked" });
    const view = await render(<AccountLinkScreen />);

    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "person@example.com",
    );
    await fireEvent.changeText(view.getByLabelText("Password"), "hunter2");
    await fireEvent.press(view.getByText("Continue with email"));

    await waitFor(() =>
      expect(mockLink).toHaveBeenCalledWith({
        provider: "email",
        email: "person@example.com",
        password: "hunter2",
      }),
    );
  });

  it("says why the email flow failed instead of one generic message", async () => {
    // The generic toast made a disabled provider, a mistyped address and a
    // wrong password indistinguishable from the device.
    mockLink.mockRejectedValue(
      Object.assign(new Error("nope"), { code: "auth/operation-not-allowed" }),
    );
    const view = await render(<AccountLinkScreen />);

    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "person@example.com",
    );
    await fireEvent.changeText(view.getByLabelText("Password"), "hunter2");
    await fireEvent.press(view.getByText("Continue with email"));

    await waitFor(() =>
      expect(
        view.getByText("Email sign-in isn't turned on for this app"),
      ).toBeTruthy(),
    );
  });

  it("trims the email before building the credential", async () => {
    mockLink.mockResolvedValue({ status: "linked" });
    const view = await render(<AccountLinkScreen />);

    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "  person@example.com ",
    );
    await fireEvent.changeText(view.getByLabelText("Password"), "hunter2");
    await fireEvent.press(view.getByText("Continue with email"));

    await waitFor(() =>
      expect(mockLink).toHaveBeenCalledWith({
        provider: "email",
        email: "person@example.com",
        password: "hunter2",
      }),
    );
  });

  it("keeps the email button disabled for whitespace-only input", async () => {
    const view = await render(<AccountLinkScreen />);

    await fireEvent.changeText(view.getByLabelText("Email"), "   ");
    await fireEvent.changeText(view.getByLabelText("Password"), "hunter2");
    await fireEvent.press(view.getByText("Continue with email"));

    expect(mockLink).not.toHaveBeenCalled();
  });

  describe("signing out", () => {
    function renderLinked() {
      fakeAuth.setCurrentUser({
        uid: "u1",
        isAnonymous: false,
        email: "person@example.com",
      });
      return render(<AccountLinkScreen />);
    }

    it("offers sign out only once there is an account to leave", async () => {
      const anonymous = await render(<AccountLinkScreen />);
      expect(anonymous.queryByText("Sign out")).toBeNull();

      const linked = await renderLinked();
      expect(linked.getByText("Sign out")).toBeTruthy();
    });

    it("asks before signing out, and does nothing when the answer is no", async () => {
      mockConfirmSignOut.mockResolvedValue(false);
      const view = await renderLinked();

      await fireEvent.press(view.getByText("Sign out"));

      await waitFor(() => expect(mockConfirmSignOut).toHaveBeenCalled());
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it("signs out and dismisses once confirmed", async () => {
      mockConfirmSignOut.mockResolvedValue(true);
      mockSignOut.mockResolvedValue(undefined);
      const view = await renderLinked();

      await fireEvent.press(view.getByText("Sign out"));

      await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
      expect(router.back).toHaveBeenCalled();
    });

    it("says so when signing out fails, rather than dismissing as if it worked", async () => {
      mockConfirmSignOut.mockResolvedValue(true);
      mockSignOut.mockRejectedValue(new Error("network"));
      const view = await renderLinked();

      await fireEvent.press(view.getByText("Sign out"));

      await waitFor(() =>
        expect(view.getByText("Couldn't sign out")).toBeTruthy(),
      );
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  it("links with an Apple credential", async () => {
    mockLink.mockResolvedValue({ status: "linked" });
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Apple"));

    await waitFor(() =>
      expect(mockLink).toHaveBeenCalledWith({ provider: "apple" }),
    );
  });
});
