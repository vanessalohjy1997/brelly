import {
  describeOtaUpdateState,
  type OtaUpdateSignals,
} from "@/utils/otaUpdateState";

const idle: OtaUpdateSignals = {
  isEnabled: true,
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  isRestarting: false,
};

const signals = (overrides: Partial<OtaUpdateSignals>): OtaUpdateSignals => ({
  ...idle,
  ...overrides,
});

describe("describeOtaUpdateState", () => {
  it("reports an untouched, enabled build as up to date", () => {
    expect(describeOtaUpdateState(idle)).toEqual({
      status: "current",
      message: "Brelly is up to date.",
    });
  });

  it("reports a build with no updates client as unsupported", () => {
    // A development build and Expo Go both land here, and both would
    // otherwise show "up to date" — which is a claim this build cannot make.
    expect(describeOtaUpdateState(signals({ isEnabled: false })).status).toBe(
      "unsupported",
    );
  });

  it("says unsupported even while other flags are set", () => {
    const state = describeOtaUpdateState(
      signals({ isEnabled: false, isUpdatePending: true, isChecking: true }),
    );

    expect(state.status).toBe("unsupported");
  });

  it("reports a check in progress", () => {
    expect(describeOtaUpdateState(signals({ isChecking: true })).status).toBe(
      "checking",
    );
  });

  it("reports a download in progress", () => {
    expect(
      describeOtaUpdateState(signals({ isDownloading: true })).status,
    ).toBe("downloading");
  });

  it("reports an update found but not yet downloaded as available", () => {
    expect(
      describeOtaUpdateState(signals({ isUpdateAvailable: true })).status,
    ).toBe("available");
  });

  it("reports a staged bundle as ready, and names the restart", () => {
    const state = describeOtaUpdateState(signals({ isUpdatePending: true }));

    expect(state.status).toBe("ready");
    expect(state.message).toMatch(/restart/i);
  });

  it("prefers ready over available, since a pending update is both", () => {
    // expo-updates leaves `isUpdateAvailable` set after the download
    // finishes. Reading them in the other order would leave the banner
    // saying "an update is available" over a bundle already waiting to run.
    const state = describeOtaUpdateState(
      signals({ isUpdateAvailable: true, isUpdatePending: true }),
    );

    expect(state.status).toBe("ready");
  });

  it("prefers ready over a download error", () => {
    // A later download failing does not un-stage the one that succeeded, and
    // reporting the failure would hide a restart that is genuinely waiting.
    const state = describeOtaUpdateState(
      signals({ isUpdatePending: true, downloadError: new Error("offline") }),
    );

    expect(state.status).toBe("ready");
  });

  it("prefers restarting over ready", () => {
    const state = describeOtaUpdateState(
      signals({ isUpdatePending: true, isRestarting: true }),
    );

    expect(state.status).toBe("restarting");
  });

  it("reports a failed check as an error", () => {
    expect(
      describeOtaUpdateState(signals({ checkError: new Error("timeout") }))
        .status,
    ).toBe("error");
  });

  it("reports a failed download as an error", () => {
    expect(
      describeOtaUpdateState(signals({ downloadError: new Error("timeout") }))
        .status,
    ).toBe("error");
  });

  it("prefers an in-flight check over a stale error", () => {
    // The error is from the previous attempt; the retry is what's happening.
    const state = describeOtaUpdateState(
      signals({ isChecking: true, checkError: new Error("timeout") }),
    );

    expect(state.status).toBe("checking");
  });

  it("gives every status a non-empty message", () => {
    const cases: Partial<OtaUpdateSignals>[] = [
      {},
      { isEnabled: false },
      { isChecking: true },
      { isDownloading: true },
      { isUpdateAvailable: true },
      { isUpdatePending: true },
      { isRestarting: true },
      { checkError: new Error("x") },
    ];

    for (const overrides of cases) {
      expect(describeOtaUpdateState(signals(overrides)).message).not.toBe("");
    }
  });
});
