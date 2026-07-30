import { createMMKV } from "react-native-mmkv";

// Shared MMKV instance for every zustand `persist` store in the app.
// Zustand's persist middleware expects a localStorage-like interface, which
// MMKV doesn't match out of the box — this adapts it.

const mmkv = createMMKV({ id: "brelly-storage" });

export const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};
