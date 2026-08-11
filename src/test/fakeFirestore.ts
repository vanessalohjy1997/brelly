/**
 * A minimal in-memory double for the modular functions this app calls out of
 * @react-native-firebase/firestore — see FIREBASE_MIGRATION.md's testing
 * section for why this fakes the modular *functions* (`getFirestore`, `doc`,
 * `setDoc`, `onSnapshot`) rather than a chained `collection().doc().set()`
 * object, which does not exist in the installed SDK.
 *
 * One shared `fakeFirestoreDb` backs every test in a file, mirroring the
 * `react-native-mmkv` fake in jest.setup.js — call `fakeFirestoreDb.reset()`
 * from a test's own `beforeEach` for isolation between tests in the same file.
 */

type Listener = (snapshot: FakeSnapshot) => void;
type QueryListener = (snapshot: FakeQuerySnapshot) => void;

export type FakeSnapshot = {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
};

export type FakeQuerySnapshot = {
  docs: FakeSnapshot[];
};

/**
 * Stand-ins for the modular `arrayUnion`/`arrayRemove` sentinels — resolved
 * against the existing array field inside `FakeDocRef.set`, the same place
 * the real SDK resolves them server-side.
 */
class FakeArrayUnion {
  constructor(public readonly values: unknown[]) {}
}
class FakeArrayRemove {
  constructor(public readonly values: unknown[]) {}
}

/** Stand-in for the modular `deleteField` sentinel — removes the key from the
 * merged result inside `FakeDocRef.set`, rather than setting it to `undefined`
 * (which a merge write would otherwise just leave untouched). */
class FakeDeleteField {}

class FakeDocRef {
  constructor(
    public readonly path: string,
    private readonly db: FakeFirestoreDb,
  ) {}

  get id(): string {
    return this.path.split("/").pop() as string;
  }

  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<void> {
    const existing = this.db.docs.get(this.path);
    const base = options?.merge && existing ? { ...existing } : {};
    const next: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(data)) {
      const current = Array.isArray(next[key]) ? (next[key] as unknown[]) : [];
      if (value instanceof FakeArrayUnion) {
        next[key] = [
          ...current,
          ...value.values.filter((v) => !current.includes(v)),
        ];
      } else if (value instanceof FakeArrayRemove) {
        next[key] = current.filter((v) => !value.values.includes(v));
      } else if (value instanceof FakeDeleteField) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    this.db.docs.set(this.path, next);
    this.db.notify(this.path);
    return Promise.resolve();
  }

  delete(): Promise<void> {
    this.db.docs.delete(this.path);
    this.db.notify(this.path);
    return Promise.resolve();
  }

  onSnapshot(onNext: Listener): () => void {
    const listeners = this.db.listenersFor(this.path);
    listeners.add(onNext);
    onNext(this.db.snapshotAt(this.path));
    return () => listeners.delete(onNext);
  }
}

class FakeCollectionRef {
  constructor(
    public readonly path: string,
    private readonly db: FakeFirestoreDb,
  ) {}

  /** Backs the real modular `doc(collectionRef)` auto-id call — an explicit
   * id if given, else a freshly generated one. */
  doc(id?: string): FakeDocRef {
    return new FakeDocRef(`${this.path}/${id ?? this.db.generateId()}`, this.db);
  }

  onSnapshot(onNext: QueryListener): () => void {
    const listeners = this.db.collectionListenersFor(this.path);
    listeners.add(onNext);
    onNext(this.db.querySnapshotAt(this.path));
    return () => listeners.delete(onNext);
  }
}

class FakeWriteBatch {
  private readonly ops: (() => void)[] = [];

  constructor(private readonly db: FakeFirestoreDb) {}

  set(
    ref: FakeDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): this {
    this.ops.push(() => {
      ref.set(data, options);
    });
    return this;
  }

  delete(ref: FakeDocRef): this {
    this.ops.push(() => {
      ref.delete();
    });
    return this;
  }

  commit(): Promise<void> {
    this.ops.forEach((op) => op());
    return Promise.resolve();
  }
}

class FakeFirestoreDb {
  docs = new Map<string, Record<string, unknown>>();
  private listeners = new Map<string, Set<Listener>>();
  private collectionListeners = new Map<string, Set<QueryListener>>();
  private idCounter = 0;

  doc(path: string): FakeDocRef {
    return new FakeDocRef(path, this);
  }

  /** Backs auto-generated ids — see `FakeCollectionRef.doc`. */
  generateId(): string {
    this.idCounter += 1;
    return `fake-id-${this.idCounter}`;
  }

  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(path, this);
  }

  listenersFor(path: string): Set<Listener> {
    let set = this.listeners.get(path);
    if (!set) {
      set = new Set();
      this.listeners.set(path, set);
    }
    return set;
  }

  collectionListenersFor(path: string): Set<QueryListener> {
    let set = this.collectionListeners.get(path);
    if (!set) {
      set = new Set();
      this.collectionListeners.set(path, set);
    }
    return set;
  }

  snapshotAt(path: string): FakeSnapshot {
    const data = this.docs.get(path);
    return {
      exists: data !== undefined,
      id: path.split("/").pop() as string,
      data: () => data,
    };
  }

  /** Direct children only — a doc one segment deeper than `collectionPath`. */
  querySnapshotAt(collectionPath: string): FakeQuerySnapshot {
    const prefix = `${collectionPath}/`;
    const docs: FakeSnapshot[] = [];
    for (const key of this.docs.keys()) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
        docs.push(this.snapshotAt(key));
      }
    }
    return { docs };
  }

  notify(path: string): void {
    this.listeners
      .get(path)
      ?.forEach((listener) => listener(this.snapshotAt(path)));
    const collectionPath = path.split("/").slice(0, -1).join("/");
    this.collectionListeners
      .get(collectionPath)
      ?.forEach((listener) => listener(this.querySnapshotAt(collectionPath)));
  }

  reset(): void {
    this.docs.clear();
    this.listeners.clear();
    this.collectionListeners.clear();
    this.idCounter = 0;
  }
}

export const fakeFirestoreDb = new FakeFirestoreDb();

function resolvePath(path: string, segments: string[]): string {
  return segments.length ? `${path}/${segments.join("/")}` : path;
}

export function createFirestoreMock() {
  return {
    getFirestore: jest.fn(() => fakeFirestoreDb),
    doc: jest.fn(
      (parent: FakeFirestoreDb, path: string, ...segments: string[]) =>
        parent.doc(resolvePath(path, segments)),
    ),
    collection: jest.fn(
      (parent: FakeFirestoreDb, path: string, ...segments: string[]) =>
        parent.collection(resolvePath(path, segments)),
    ),
    setDoc: jest.fn(
      (
        ref: FakeDocRef,
        data: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => ref.set(data, options),
    ),
    deleteDoc: jest.fn((ref: FakeDocRef) => ref.delete()),
    onSnapshot: jest.fn(
      (ref: FakeDocRef | FakeCollectionRef, onNext: Listener & QueryListener) =>
        ref.onSnapshot(onNext),
    ),
    writeBatch: jest.fn(
      (db: FakeFirestoreDb) => new FakeWriteBatch(db),
    ),
    arrayUnion: jest.fn((...values: unknown[]) => new FakeArrayUnion(values)),
    arrayRemove: jest.fn(
      (...values: unknown[]) => new FakeArrayRemove(values),
    ),
    deleteField: jest.fn(() => new FakeDeleteField()),
  };
}
