/**
 * The test doubles for the two native-backed SDKs, as a second entry point.
 *
 * Separate from `@brelly/core` on purpose: these are fakes, and the barrel is
 * what the apps bundle. They live in the package rather than in an app because
 * both apps need them and neither owns them — `fakeFirestore` stands in for
 * whichever Firestore SDK the platform seam resolves to, and the shape it
 * fakes is the modular API that both of them share.
 *
 * Excluded from `collectCoverageFrom`, like every other `test/` directory
 * here: a fake that no test exercises is a fake nobody needs, not a coverage
 * hole.
 */
export {
  createAuthMock,
  fakeAuth,
  type FakeAuthUser,
  type FakeCredential,
} from "./fakeAuth";
export {
  createFirestoreMock,
  fakeFirestoreDb,
  type FakeQuerySnapshot,
  type FakeSnapshot,
} from "./fakeFirestore";
