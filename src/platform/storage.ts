/**
 * Small, synchronous key/value storage — MMKV here, `localStorage` on web.
 *
 * The shape is `localStorage`'s on purpose, since that is the half that cannot
 * be changed: MMKV is already adapted to it in `store/mmkvStorage.ts` for
 * zustand's sake, so re-exporting that adapter costs nothing and the web
 * implementation is close to `localStorage` itself.
 *
 * Only the merge bookkeeping in `accountLinkService` reaches for this from
 * core. Everything else that persists goes to Firestore.
 */
export { mmkvStorage as platformStorage } from "@/store/mmkvStorage";
