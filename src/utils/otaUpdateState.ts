/**
 * The one place that decides what an over-the-air update is currently doing.
 *
 * `useUpdates()` hands back seven independent booleans and two errors, several
 * of which are true at once (a pending update is also an available one, and a
 * failed download leaves `isUpdateAvailable` set). Reading them ad hoc at each
 * call site is how a banner ends up saying "downloading" over a bundle that
 * finished ten seconds ago. Collapsing them into one ordered enum here — plain
 * data in, plain data out — keeps the ordering in a single testable function
 * rather than in whichever component was written first.
 */
export type OtaUpdateStatus =
  /** No updates client in this binary — Expo Go, or a development build. */
  | "unsupported"
  | "current"
  | "checking"
  | "available"
  | "downloading"
  /** Downloaded and staged. The next launch runs it; so does `reloadAsync`. */
  | "ready"
  | "restarting"
  | "error";

/** The subset of `useUpdates()` this depends on, plus `Updates.isEnabled`. */
export type OtaUpdateSignals = {
  isEnabled: boolean;
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isRestarting: boolean;
  checkError?: Error;
  downloadError?: Error;
};

export type OtaUpdateState = {
  status: OtaUpdateStatus;
  /** Settings copy. Says what is true right now, not what the app intends. */
  message: string;
};

/**
 * Ordered most-specific first, because the flags overlap. `ready` outranks
 * `available` and both outrank the errors: a download that failed *after* an
 * earlier one succeeded still has a runnable bundle staged, and telling
 * someone it failed would hide the restart that is genuinely waiting for them.
 */
export function describeOtaUpdateState(
  signals: OtaUpdateSignals,
): OtaUpdateState {
  if (!signals.isEnabled) {
    return {
      status: "unsupported",
      message: "This build installs updates with the app itself.",
    };
  }
  if (signals.isRestarting) {
    return { status: "restarting", message: "Restarting…" };
  }
  if (signals.isUpdatePending) {
    return {
      status: "ready",
      message: "An update is ready. Restart to use it.",
    };
  }
  if (signals.isDownloading) {
    return { status: "downloading", message: "Downloading an update…" };
  }
  if (signals.isChecking) {
    return { status: "checking", message: "Checking for updates…" };
  }
  if (signals.checkError || signals.downloadError) {
    return {
      status: "error",
      message: "Couldn't check for updates. Try again later.",
    };
  }
  if (signals.isUpdateAvailable) {
    return { status: "available", message: "An update is available." };
  }
  return { status: "current", message: "Brelly is up to date." };
}
