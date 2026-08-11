import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import AccountLinkScreen from "@/app/account-link";
import {
  linkAnonymousAccount,
  mergeIntoExistingAccount,
  snapshotLocalData,
} from "@/services/accountLinkService";
import {
  getAppleCredential,
  getEmailCredential,
  getGoogleCredential,
} from "@/services/auth";
import { useToastStore } from "@/store/toastStore";
import { fakeAuth } from "@/test/fakeAuth";
import { promptMergeChoice } from "@/utils/promptMergeChoice";

jest.mock("@/services/accountLinkService", () => ({
  linkAnonymousAccount: jest.fn(),
  mergeIntoExistingAccount: jest.fn(),
  snapshotLocalData: jest.fn(),
}));
jest.mock("@/services/auth", () => ({
  configureGoogleSignIn: jest.fn(),
  getGoogleCredential: jest.fn(),
  getAppleCredential: jest.fn(),
  getEmailCredential: jest.fn(),
}));
jest.mock("@/utils/promptMergeChoice", () => ({
  promptMergeChoice: jest.fn(),
}));

const mockLink = linkAnonymousAccount as jest.Mock;
const mockMerge = mergeIntoExistingAccount as jest.Mock;
const mockSnapshot = snapshotLocalData as jest.Mock;
const mockGoogleCredential = getGoogleCredential as jest.Mock;
const mockAppleCredential = getAppleCredential as jest.Mock;
const mockEmailCredential = getEmailCredential as jest.Mock;
const mockPrompt = promptMergeChoice as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.reset();
  useToastStore.setState({ toast: null, modalHosts: [] });
  mockGoogleCredential.mockResolvedValue({ providerId: "google.com" });
  mockAppleCredential.mockResolvedValue({ providerId: "apple.com" });
  mockEmailCredential.mockReturnValue({ providerId: "password" });
});

describe("AccountLinkScreen", () => {
  it("offers Google, Apple, and email while anonymous", async () => {
    const view = await render(<AccountLinkScreen />);

    expect(view.getByText("Continue with Google")).toBeTruthy();
    expect(view.getByText("Continue with Apple")).toBeTruthy();
    expect(view.getByText("Continue with email")).toBeTruthy();
  });

  it("links and dismisses on a brand-new account", async () => {
    mockLink.mockResolvedValue("linked");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Google"));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(mockMerge).not.toHaveBeenCalled();
  });

  it("prompts for a merge and adds local data when the user chooses to", async () => {
    mockLink.mockResolvedValue("merge-required");
    mockSnapshot.mockReturnValue({
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
    mockLink.mockResolvedValue("merge-required");
    mockSnapshot.mockReturnValue({
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
    mockLink.mockResolvedValue("merge-required");
    mockSnapshot.mockReturnValue({
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
    mockLink.mockResolvedValue("merge-required");
    mockSnapshot.mockReturnValue({ slots: [], routines: [], isEmpty: true });
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

    expect(mockEmailCredential).not.toHaveBeenCalled();
  });

  it("continues with email once both fields are filled", async () => {
    mockLink.mockResolvedValue("linked");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "person@example.com",
    );
    await fireEvent.changeText(view.getByLabelText("Password"), "hunter2");
    await fireEvent.press(view.getByText("Continue with email"));

    await waitFor(() =>
      expect(mockEmailCredential).toHaveBeenCalledWith(
        "person@example.com",
        "hunter2",
      ),
    );
  });

  it("links with an Apple credential", async () => {
    mockLink.mockResolvedValue("linked");
    const view = await render(<AccountLinkScreen />);

    await fireEvent.press(view.getByText("Continue with Apple"));

    await waitFor(() => expect(mockAppleCredential).toHaveBeenCalled());
    expect(mockLink).toHaveBeenCalledWith({ providerId: "apple.com" });
  });
});
