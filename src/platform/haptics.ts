/**
 * Feedback that only a phone can give. No-ops on web.
 *
 * Only `hapticError`/`hapticSuccess` are here: they fire from the toast store,
 * which core owns. `hapticDelete` and `hapticToggle` are called from swipe
 * actions in the UI layer, which is rebuilt per platform, so they stay in
 * `utils/haptics.ts` and never cross the boundary.
 */
export { hapticError, hapticSuccess } from "@/utils/haptics";
