/**
 * Feedback only a phone can give. Every function here is a no-op.
 *
 * The Vibration API exists, and is deliberately not used: it is unimplemented
 * on desktop and on iOS Safari, and where it is implemented it produces a
 * buzz rather than the distinct notification patterns the mobile app plays.
 * A half-present imitation of a tactile vocabulary is worse than its absence.
 *
 * These stay as functions rather than being deleted from the call sites so the
 * two apps' shared code paths read the same, and so the toast store — which is
 * core's, and fires `hapticError`/`hapticSuccess` through the seam — needs no
 * web-specific branch.
 */
export function hapticDelete(): void {}

export function hapticError(): void {}

export function hapticSuccess(): void {}

export function hapticToggle(): void {}
