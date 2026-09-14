import * as Notifications from "expo-notifications";

/**
 * Clearing the OS notification queue. A no-op on web, which schedules none.
 *
 * Narrow on purpose. Core does not schedule, reschedule or ask permission for
 * notifications — `services/notifications.ts` stays in the mobile app whole.
 * The single reason this seam exists is `signOutOfAccount`: leaving an account
 * has to drop the alerts scheduled against it, while their handles still mean
 * something, and that step sits in the middle of core's sign-out ordering.
 *
 * The implementation lives here rather than being re-exported from
 * `services/notifications.ts`, which is where every other alert function sits.
 * That file imports `@brelly/core` for its pure helpers, so re-exporting
 * through it closed a require cycle — core's barrel → `accountLinkService` →
 * this seam → `services/notifications.ts` → core's barrel — and Metro warned
 * on every start that the values in it could be uninitialised. Nothing else in
 * the app calls this, so the seam owning it costs no duplication.
 *
 * `cancelAllScheduledNotificationsAsync` per the v57 docs:
 * https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
