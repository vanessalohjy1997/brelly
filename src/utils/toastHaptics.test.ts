import {
  showToast,
  useToastStore,
} from "@brelly/core";
import { hapticError, hapticSuccess } from "@/utils/haptics";
import { subscribeToastHaptics } from "@/utils/toastHaptics";

jest.mock("@/utils/haptics", () => ({
  hapticError: jest.fn(),
  hapticSuccess: jest.fn(),
}));

let unsubscribe: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ toast: null, modalHosts: [] });
  unsubscribe = subscribeToastHaptics();
});

afterEach(() => {
  unsubscribe();
});

describe("subscribeToastHaptics", () => {
  it("buzzes success when a success toast is raised", () => {
    showToast("Rain alerts on", "success");

    expect(hapticSuccess).toHaveBeenCalledTimes(1);
    expect(hapticError).not.toHaveBeenCalled();
  });

  it("buzzes error when an error toast is raised", () => {
    showToast("Couldn't save that setting. Try again.", "error");

    expect(hapticError).toHaveBeenCalledTimes(1);
    expect(hapticSuccess).not.toHaveBeenCalled();
  });

  it("buzzes again for a second toast of the same variant", () => {
    showToast("Rain alerts on", "success");
    showToast("Rain alerts off", "success");

    expect(hapticSuccess).toHaveBeenCalledTimes(2);
  });

  it("stays silent when the toast is dismissed", () => {
    showToast("Rain alerts on", "success");
    jest.clearAllMocks();

    useToastStore.getState().dismiss();

    expect(hapticSuccess).not.toHaveBeenCalled();
    expect(hapticError).not.toHaveBeenCalled();
  });

  it("stays silent when an unrelated part of the store changes", () => {
    showToast("Rain alerts on", "success");
    jest.clearAllMocks();

    useToastStore.getState().registerModalHost("plan/new");

    expect(hapticSuccess).not.toHaveBeenCalled();
    expect(hapticError).not.toHaveBeenCalled();
  });

  it("stops buzzing once unsubscribed", () => {
    unsubscribe();

    showToast("Rain alerts on", "success");

    expect(hapticSuccess).not.toHaveBeenCalled();
  });
});
