import type { User } from "@react-native-firebase/auth";
import { useEffect, useState } from "react";

import { getFirebaseAuth, subscribeToAuthUser } from "@/services/firebase";

/**
 * The current Firebase user, kept live — `settings.tsx` and
 * `account-link.tsx` both need to know whether it's still anonymous or has
 * been linked to a real identity, and re-render the moment that changes.
 */
export function useAuthUser(): User | null {
  const [user, setUser] = useState(() => getFirebaseAuth().currentUser);

  useEffect(() => subscribeToAuthUser(setUser), []);

  return user;
}
