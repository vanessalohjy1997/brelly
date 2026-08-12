import { getAuth } from "@react-native-firebase/auth";
import { onSnapshot, setDoc } from "@react-native-firebase/firestore";

import { subscribeToSettingsDoc, writeSettingsFields } from "@/services/settingsSync";
import { useToastStore } from "@/store/toastStore";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

const mockGetAuth = getAuth as jest.Mock;
const mockSetDoc = setDoc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fakeFirestoreDb.reset();
  useToastStore.setState({ toast: null, modalHosts: [] });
  mockGetAuth.mockReturnValue({ currentUser: { uid: "test-uid" } });
});

describe("writeSettingsFields", () => {
  it("does nothing before a uid exists", () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    writeSettingsFields({ themePreference: "dark" });

    expect(fakeFirestoreDb.docs.size).toBe(0);
  });

  it("writes the given fields plus the schema version, merged onto the doc", () => {
    writeSettingsFields({ themePreference: "dark" });

    expect(fakeFirestoreDb.docs.get("users/test-uid/settings/app")).toEqual({
      themePreference: "dark",
      schemaVersion: 2,
    });
  });

  it("merges a second write rather than overwriting the whole doc", () => {
    writeSettingsFields({ themePreference: "dark" });
    writeSettingsFields({ rainAlertsEnabled: false });

    expect(fakeFirestoreDb.docs.get("users/test-uid/settings/app")).toEqual({
      themePreference: "dark",
      rainAlertsEnabled: false,
      schemaVersion: 2,
    });
  });

  it("reports a background failure without throwing", async () => {
    mockSetDoc.mockReturnValueOnce(Promise.reject(new Error("offline")));

    expect(() => writeSettingsFields({ themePreference: "dark" })).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't sync to the cloud — you're still working locally",
      variant: "error",
    });
  });
});

describe("subscribeToSettingsDoc", () => {
  it("delivers an empty object for a doc that doesn't exist yet", () => {
    const onData = jest.fn();

    subscribeToSettingsDoc("test-uid", onData);

    expect(onData).toHaveBeenCalledWith({});
  });

  it("migrates and delivers an existing doc's fields", () => {
    fakeFirestoreDb.docs.set("users/test-uid/settings/app", {
      themePreference: "dark",
      schemaVersion: 1,
    });
    const onData = jest.fn();

    subscribeToSettingsDoc("test-uid", onData);

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        themePreference: "dark",
        hasSeenOnboarding: true,
      }),
    );
  });

  it("delivers again when the doc changes", () => {
    const onData = jest.fn();
    subscribeToSettingsDoc("test-uid", onData);
    onData.mockClear();

    writeSettingsFields({ themePreference: "light" });

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({ themePreference: "light" }),
    );
  });

  it("stops delivering after unsubscribe", () => {
    const onData = jest.fn();
    const unsubscribe = subscribeToSettingsDoc("test-uid", onData);
    onData.mockClear();

    unsubscribe();
    writeSettingsFields({ themePreference: "light" });

    expect(onData).not.toHaveBeenCalled();
  });

  it("hands a listener failure to onError rather than throwing", () => {
    const mockOnSnapshot = onSnapshot as jest.Mock;
    const failure = new Error("permission-denied");
    mockOnSnapshot.mockImplementationOnce((_ref, _onNext, onErrorCb) => {
      onErrorCb(failure);
      return () => {};
    });
    const onData = jest.fn();
    const onError = jest.fn();

    subscribeToSettingsDoc("test-uid", onData, onError);

    expect(onError).toHaveBeenCalledWith(failure);
  });
});
