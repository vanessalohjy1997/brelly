/**
 * Deep-links to Brelly's own page in the OS settings app.
 *
 * Returns `false` here, always: a site cannot open the browser's permission UI.
 * Callers already handle `false` — an Android ROM with no settings activity
 * produces it too — so no new branch is needed, only different copy, which
 * belongs with the callers rather than here.
 */
export { openAppSettings } from "@/services/appSettings";
