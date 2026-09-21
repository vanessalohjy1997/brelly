"use client";

import { useAuthUser } from "./useAuthUser";

/**
 * Whether a rain-alert setting made here can reach anything that sends one.
 *
 * The web sends no notifications at all. A stop's "Rain alerts" switch and
 * the per-stop mute still mean something, but only on the Brelly phone app,
 * and only when the phone reads the same account — an anonymous browser
 * session has a uid no phone can share. Split out so the form, the cards and
 * the copy can all ask the same question rather than each guessing.
 */
export function alertsReachPhone(
  user: { isAnonymous: boolean } | null | undefined,
): boolean {
  return !!user && !user.isAnonymous;
}

export function useAlertsReachPhone(): boolean {
  return alertsReachPhone(useAuthUser());
}
