/** Core only ever clears the queue, and only from `signOutOfAccount`. On web
 * this is genuinely a no-op, so a no-op is the honest fake. */
export function cancelAllNotifications(): Promise<void> {
  return Promise.resolve();
}
