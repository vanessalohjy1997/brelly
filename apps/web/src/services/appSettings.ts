/**
 * There is nowhere to go. A page cannot open the browser's own permission UI,
 * by design — it is the one control the site is not allowed to drive.
 *
 * Returning `false` needs no new branch at any call site: every caller already
 * handles it, because an Android ROM with no settings activity produces the
 * same answer. What the callers must *say* is different, though, and that copy
 * lives with them: "Settings › Brelly" is nonsense in a browser, where the
 * control is the padlock beside the address bar.
 */
export async function openAppSettings(): Promise<boolean> {
  return false;
}
