import type { ThemePreference } from "@brelly/core";

/**
 * The mirror of `themePreference`, and an honest account of what it buys.
 *
 * The preference itself lives in **Firestore**, which is the right home for it
 * — it follows the user to another device, which is the whole point — and the
 * wrong shape for server rendering: the server cannot know it before the client
 * has signed in and the settings listener has delivered a snapshot. Without
 * something else, every visit renders at the system preference and then
 * corrects itself visibly for anyone whose choice differs from it.
 *
 * So the client writes the answer to a cookie once it knows, and the server
 * reads that on the *next* visit. Three limits, all real:
 *
 * - the first visit still flashes, because there is nothing to read yet;
 * - a change made on the phone leaves this stale, so the next visit renders
 *   the old theme and then corrects — better than always correcting, not the
 *   same as right;
 * - a per-user cookie makes the response uncacheable at the edge unless it is
 *   served with `Vary: Cookie`.
 *
 * It is a cache of a Firestore value, in other words, and not a second source
 * of truth. Nothing reads it except the initial `data-theme` attribute.
 */
export const THEME_COOKIE = "brelly-theme";

/** A year. The preference changes rarely and the cookie is rewritten on every visit that knows better. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * `"system"` is written like any other value rather than clearing the cookie.
 * Clearing would be indistinguishable from "no cookie yet", and those two
 * states want different first paints on a machine whose system theme disagrees
 * with a deliberate choice of "follow the system".
 */
export function serialiseThemeCookie(preference: ThemePreference): string {
  return `${THEME_COOKIE}=${preference}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * The `data-theme` attribute for a preference, or `undefined` for "system" —
 * which is the absence of the attribute, so that `prefers-color-scheme` is left
 * to decide.
 */
export function themeAttribute(
  preference: ThemePreference | undefined,
): "light" | "dark" | undefined {
  return preference === "light" || preference === "dark" ? preference : undefined;
}

/** Narrows a raw cookie value, which is attacker-controlled text like any other. */
export function parseThemeCookie(
  value: string | undefined,
): ThemePreference | undefined {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : undefined;
}
