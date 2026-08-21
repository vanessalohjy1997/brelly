import { fireEvent } from "@testing-library/react-native";
import * as Updates from "expo-updates";

import { UpdateBanner } from "@/components/UpdateBanner";
import { renderWithProviders } from "@/test/renderWithProviders";

const useUpdatesMock = Updates.useUpdates as jest.Mock;
const reloadAsync = Updates.reloadAsync as jest.Mock;

const IDLE = {
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  isRestarting: false,
  checkError: undefined,
  downloadError: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  (Updates as { isEnabled: boolean }).isEnabled = true;
  useUpdatesMock.mockReturnValue(IDLE);
  reloadAsync.mockResolvedValue(undefined);
});

describe("UpdateBanner", () => {
  it("renders nothing when there is no update staged", async () => {
    const { queryByText } = await renderWithProviders(<UpdateBanner />);

    expect(queryByText("Update ready")).toBeNull();
  });

  it("renders nothing while an update is still downloading", async () => {
    // Offering a restart mid-download would restart into the *old* bundle.
    useUpdatesMock.mockReturnValue({ ...IDLE, isDownloading: true });
    const { queryByText } = await renderWithProviders(<UpdateBanner />);

    expect(queryByText("Update ready")).toBeNull();
  });

  it("offers the restart once a bundle is staged", async () => {
    useUpdatesMock.mockReturnValue({ ...IDLE, isUpdatePending: true });
    const { getByText } = await renderWithProviders(<UpdateBanner />);

    expect(getByText("Update ready")).toBeTruthy();
    expect(getByText("Restart now")).toBeTruthy();
  });

  it("reloads into the new bundle when the restart is taken", async () => {
    useUpdatesMock.mockReturnValue({ ...IDLE, isUpdatePending: true });
    const { getByText } = await renderWithProviders(<UpdateBanner />);

    await fireEvent.press(getByText("Restart now"));

    expect(reloadAsync).toHaveBeenCalled();
  });

  it("goes away when dismissed, without restarting", async () => {
    // Nothing here is urgent — the update applies on the next launch either
    // way — so the banner must not hold the screen hostage.
    useUpdatesMock.mockReturnValue({ ...IDLE, isUpdatePending: true });
    const { getByText, queryByText } = await renderWithProviders(
      <UpdateBanner />,
    );

    await fireEvent.press(getByText("Later"));

    expect(queryByText("Update ready")).toBeNull();
    expect(reloadAsync).not.toHaveBeenCalled();
  });
});
