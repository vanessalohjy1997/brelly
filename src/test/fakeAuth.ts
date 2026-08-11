/**
 * A minimal in-memory double for the modular functions this app calls out of
 * @react-native-firebase/auth — see FIREBASE_MIGRATION.md's testing section
 * for why this fakes the modular *functions* rather than a namespaced
 * `auth()` object, which doesn't exist in the installed SDK.
 *
 * One shared `fakeAuth` backs every test in a file, mirroring
 * `fakeFirestoreDb` in `fakeFirestore.ts` — call `fakeAuth.reset()` from a
 * test's own `beforeEach` for isolation between tests in the same file.
 */

export type FakeAuthUser = {
  uid: string;
  isAnonymous: boolean;
  email?: string | null;
  displayName?: string | null;
};

export type FakeCredential = {
  providerId: string;
  idToken?: string;
  email?: string;
  password?: string;
};

/** The credential-already-in-use scenario is keyed by whatever value
 * identifies the external identity — the id token for Google/Apple, the
 * email for a password credential. */
function credentialKey(credential: FakeCredential): string {
  return credential.idToken ?? credential.email ?? JSON.stringify(credential);
}

class FakeAuthError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

class FakeAuth {
  currentUser: FakeAuthUser | null = null;

  private listeners = new Set<(user: FakeAuthUser | null) => void>();
  private existingAccounts = new Map<string, FakeAuthUser>();
  private uidCounter = 0;

  private setUser(user: FakeAuthUser | null): void {
    this.currentUser = user;
    this.listeners.forEach((listener) => listener(user));
  }

  /** Test-only: seeds a deterministic current user directly, for tests that
   * need a known uid rather than one of the auto-incrementing ones the
   * sign-in methods mint. */
  setCurrentUser(user: FakeAuthUser | null): void {
    this.setUser(user);
  }

  /** Registers a credential as already belonging to a real account, so
   * `linkWithCredential`/`signInWithCredential` against it behave the way
   * `auth/credential-already-in-use` does for a real, already-claimed
   * identity. */
  registerExistingAccount(
    credential: FakeCredential,
    user: FakeAuthUser,
  ): void {
    this.existingAccounts.set(credentialKey(credential), user);
  }

  onAuthStateChanged(callback: (user: FakeAuthUser | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => this.listeners.delete(callback);
  }

  signInAnonymously(): Promise<{ user: FakeAuthUser }> {
    this.uidCounter += 1;
    const user: FakeAuthUser = { uid: `anon-${this.uidCounter}`, isAnonymous: true };
    this.setUser(user);
    return Promise.resolve({ user });
  }

  linkWithCredential(credential: FakeCredential): Promise<{ user: FakeAuthUser }> {
    if (this.existingAccounts.has(credentialKey(credential))) {
      return Promise.reject(new FakeAuthError("auth/credential-already-in-use"));
    }
    const linked: FakeAuthUser = {
      ...(this.currentUser as FakeAuthUser),
      isAnonymous: false,
      email: credential.email ?? null,
    };
    this.setUser(linked);
    return Promise.resolve({ user: linked });
  }

  signInWithCredential(credential: FakeCredential): Promise<{ user: FakeAuthUser }> {
    const existing = this.existingAccounts.get(credentialKey(credential));
    this.uidCounter += 1;
    const user: FakeAuthUser = existing ?? {
      uid: `linked-${this.uidCounter}`,
      isAnonymous: false,
      email: credential.email ?? null,
    };
    this.setUser(user);
    return Promise.resolve({ user });
  }

  reset(): void {
    this.currentUser = null;
    this.listeners.clear();
    this.existingAccounts.clear();
    this.uidCounter = 0;
  }
}

export const fakeAuth = new FakeAuth();

class FakeOAuthProvider {
  constructor(public readonly providerId: string) {}

  credential(options: { idToken?: string }): FakeCredential {
    return { providerId: this.providerId, idToken: options.idToken };
  }
}

export function createAuthMock() {
  return {
    getAuth: jest.fn(() => fakeAuth),
    signInAnonymously: jest.fn((auth: FakeAuth) => auth.signInAnonymously()),
    linkWithCredential: jest.fn(
      (_user: FakeAuthUser, credential: FakeCredential) =>
        fakeAuth.linkWithCredential(credential),
    ),
    signInWithCredential: jest.fn(
      (_auth: FakeAuth, credential: FakeCredential) =>
        fakeAuth.signInWithCredential(credential),
    ),
    onAuthStateChanged: jest.fn(
      (_auth: FakeAuth, callback: (user: FakeAuthUser | null) => void) =>
        fakeAuth.onAuthStateChanged(callback),
    ),
    GoogleAuthProvider: {
      credential: jest.fn(
        (idToken?: string | null): FakeCredential => ({
          providerId: "google.com",
          idToken: idToken ?? undefined,
        }),
      ),
    },
    OAuthProvider: FakeOAuthProvider,
    EmailAuthProvider: {
      credential: jest.fn(
        (email: string, password: string): FakeCredential => ({
          providerId: "password",
          email,
          password,
        }),
      ),
    },
  };
}
