/**
 * `localStorage`, behind the same three-method surface MMKV was adapted to.
 *
 * The shape came from `localStorage` in the first place — `store/mmkvStorage.ts`
 * adapts MMKV to it for zustand's sake — so this implementation is almost the
 * identity function. Almost, because of two things the phone does not have.
 *
 * Server rendering: there is no `window` during SSR, and a read there is
 * answered `null` rather than throwing, because "nothing stored" is the honest
 * answer for a request that has no browser behind it yet.
 *
 * Writes are the opposite. `setItem` throws `QuotaExceededError` in Safari's
 * private mode, and `accountLinkService` depends on that: the pending-merge
 * record is written immediately before a destructive delete, and a storage that
 * cannot hold it is a reason not to start rather than a reason to proceed
 * without one. So nothing here is caught — a failed write must reach the
 * caller.
 */
function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export const webStorage = {
  getItem: (key: string): string | null => storage()?.getItem(key) ?? null,
  setItem: (key: string, value: string): void => {
    const store = storage();
    if (!store) {
      throw new Error(
        `Cannot persist "${key}" with no browser storage — this must run client-side`,
      );
    }
    store.setItem(key, value);
  },
  removeItem: (key: string): void => storage()?.removeItem(key),
};
