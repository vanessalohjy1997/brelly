/**
 * Only the types cross into core — `accountLinkService` takes a
 * `PlatformCredential` and never looks inside one, which is the point of
 * calling it opaque. `linkProvider` itself is app-side and has no core caller.
 */
import type { FakeCredential } from "../fakeAuth";

export type PlatformCredential = FakeCredential;

export type LinkRequest =
  | { provider: "google" | "apple" }
  | { provider: "email"; email: string; password: string };
