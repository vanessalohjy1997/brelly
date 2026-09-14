/**
 * Deep-links to Brelly's own page in the OS settings app.
 *
 * Returns `false` when there is nowhere to go — which is always, on web, where
 * a site cannot open the browser's permission UI. Callers already handle the
 * `false` case, because an Android ROM with no settings activity produces it
 * too, so the web implementation needs no new branch anywhere.
 */
export { openAppSettings } from "@/services/appSettings";
