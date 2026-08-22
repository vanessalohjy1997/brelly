import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { showToast } from "@/store/toastStore";
import {
  describeOtaUpdateState,
  type OtaUpdateState,
} from "@/utils/otaUpdateState";

export type UseOtaUpdate = OtaUpdateState & {
  /** Checks, and downloads whatever it finds. A check alone buys nothing. */
  checkNow: () => Promise<void>;
  /** Swaps to the staged bundle now, rather than at the next cold start. */
  restart: () => Promise<void>;
};

/**
 * The over-the-air update the app is running, and the one waiting for it.
 *
 * `checkAutomatically` is left at its `ON_LOAD` default, so a cold start
 * already fetches a new bundle in the background and runs it next launch —
 * this hook exists for the two things that default does not cover. The first
 * is telling the user: a silent swap on some future launch means a fix can sit
 * downloaded and unused for days while they look at the bug it repairs. The
 * second is the warm case — `ON_LOAD` fires once per process, so an app that
 * is backgrounded rather than killed (the normal way a phone treats an app
 * opened daily) never checks again for as long as it survives.
 *
 * `Updates.isEnabled` is read inside the callbacks rather than at module
 * scope: it is `false` in a development build and in Expo Go, and calling
 * `checkForUpdateAsync` there throws rather than returning "no update".
 */
export function useOtaUpdate(): UseOtaUpdate {
  const {
    isChecking,
    isDownloading,
    isUpdateAvailable,
    isUpdatePending,
    isRestarting,
    checkError,
    downloadError,
  } = Updates.useUpdates();

  // Not derived from `isChecking`/`isDownloading`: those are the native
  // module's own state and lag a tap by a render, so two quick presses of
  // "Check for updates" — or a foreground landing on top of one — would both
  // get through. A ref settles it in the same tick.
  const busy = useRef(false);

  const checkNow = useCallback(async () => {
    if (!Updates.isEnabled || busy.current) return;
    busy.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch {
      // Swallowed on purpose: `useUpdates` surfaces the same failure through
      // `checkError`/`downloadError`, which is what the UI reads. Rethrowing
      // here would only turn a background foreground-check into a crash.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkNow();
    });
    return () => subscription.remove();
  }, [checkNow]);

  const restart = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // A refused reload leaves the app running the old bundle with no other
      // sign anything happened, so this is the one failure worth saying out
      // loud — the update is not lost, it just needs a real relaunch.
      showToast("Couldn't restart. Close and reopen Brelly.", "error");
    }
  }, []);

  return {
    ...describeOtaUpdateState({
      isEnabled: Updates.isEnabled,
      isChecking,
      isDownloading,
      isUpdateAvailable,
      isUpdatePending,
      isRestarting,
      checkError,
      downloadError,
    }),
    checkNow,
    restart,
  };
}
