/** `localStorage`'s shape, over a Map. Same surface MMKV is adapted to. */
const store = new Map<string, string>();

export const platformStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
