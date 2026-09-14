/**
 * Clearing the OS notification queue. A no-op on web, which schedules none.
 *
 * Narrow on purpose. Core does not schedule, reschedule or ask permission for
 * notifications — `services/notifications.ts` stays in the mobile app whole.
 * The single reason this seam exists is `signOutOfAccount`: leaving an account
 * has to drop the alerts scheduled against it, while their handles still mean
 * something, and that step sits in the middle of core's sign-out ordering.
 */
export { cancelAllNotifications } from "@/services/notifications";
