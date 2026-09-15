import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export type NotificationPermissionState =
  | "checking"
  | "unprompted"
  | "granted"
  | "denied";

/**
 * Whether the OS will actually deliver anything the app schedules.
 *
 * Settings had no idea. Toggling "Rain alerts" on with the OS permission
 * denied wrote `true` to the store, rendered a switch in the on position, and
 * delivered nothing ever again — the app's main feature turned off by a dialog
 * the user answered days earlier, with the UI insisting it was on.
 *
 * Re-read on every return to the foreground, because the only way back from a
 * denial is the system Settings app: the answer changes while we are in the
 * background, and nothing else would tell us it had.
 */
export function useNotificationPermission() {
  const [status, setStatus] = useState<NotificationPermissionState>("checking");

  // Reads the status without writing it. Keeping the read pure is what lets
  // the effect below update from a promise callback rather than from its own
  // body — the compiler's set-state-in-effect rule reads the latter as a
  // cascading render, and it is right to.
  const read = useCallback(async (): Promise<NotificationPermissionState> => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    // `canAskAgain` is what separates "not asked yet" from "asked and
    // refused". Both are ungranted, but only one of them has a prompt left —
    // the other needs a trip to system settings, and offering a button that
    // silently does nothing is how the original bug felt from the outside.
    return current.canAskAgain ? "unprompted" : "denied";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      read()
        .then((next) => {
          if (!cancelled) setStatus(next);
        })
        .catch(() => {
          // An unreadable permission is not a denial. Leaving the status where
          // it is keeps the banner from accusing the OS of something it may
          // not have done.
        });
    };

    sync();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [read]);

  /** Prompts, if there is still a prompt to show. Returns the new status. */
  const request = useCallback(async () => {
    const result = await Notifications.requestPermissionsAsync();
    const next: NotificationPermissionState = result.granted
      ? "granted"
      : result.canAskAgain
        ? "unprompted"
        : "denied";
    setStatus(next);
    return next;
  }, []);

  return { status, request };
}
