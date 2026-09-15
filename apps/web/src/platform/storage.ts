/**
 * Small, synchronous key/value storage — `localStorage` here, MMKV on mobile.
 *
 * Only the merge bookkeeping in `accountLinkService` reaches for this from core.
 * Everything else that persists goes to Firestore.
 */
export { webStorage as platformStorage } from "@/store/webStorage";
