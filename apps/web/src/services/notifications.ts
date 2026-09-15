/**
 * The web app schedules no notifications, so there is no queue to clear.
 *
 * Kept as a function rather than removed because core's `signOutOfAccount`
 * calls it in the middle of an ordering that matters — alerts are dropped
 * while their handles still mean something — and a seam that exists on one
 * platform only would put that branch back in core.
 */
export async function cancelAllNotifications(): Promise<void> {}
