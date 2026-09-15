/**
 * Clearing the OS notification queue — nothing to clear here.
 *
 * Narrow on purpose, exactly as on mobile: the single reason this seam exists
 * is `signOutOfAccount`, which has to drop scheduled alerts while their handles
 * still mean something, and that step sits in the middle of core's sign-out
 * ordering.
 */
export { cancelAllNotifications } from "@/services/notifications";
