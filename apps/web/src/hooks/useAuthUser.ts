"use client";

import type { User } from "firebase/auth";
import { useSyncExternalStore } from "react";

import { getFirebaseAuth, subscribeToAuthUser } from "@/services/firebase";

/**
 * The current Firebase user, kept live — the settings and account screens both
 * need to know whether it is still anonymous or has been linked to a real
 * identity, and re-render the moment that changes.
 *
 * `useSyncExternalStore` rather than the phone's `useState` + effect, and the
 * difference is server rendering rather than taste. Auth *is* an external store
 * — a current value plus a subscription — and this hook needs a third thing the
 * phone's version does not: an answer for the server, where there is no session
 * and `getAuth()` must not be called at all. That is what `getServerSnapshot`
 * is, and it also means no state is set from an effect, so the first client
 * render already has the session rather than arriving at it one render later.
 */
export function useAuthUser(): User | null {
  return useSyncExternalStore(
    subscribeToAuthUser,
    () => getFirebaseAuth().currentUser,
    () => null,
  );
}
