/**
 * Feedback that only a phone can give. No-ops here.
 *
 * Only `hapticError`/`hapticSuccess` are in the seam: they fire from the toast
 * store, which core owns. `hapticDelete` and `hapticToggle` are called from row
 * actions in the UI layer, which is rebuilt per platform, so they stay in
 * `utils/haptics.ts` and never cross the boundary.
 */
export { hapticError, hapticSuccess } from "@/utils/haptics";
