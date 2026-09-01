/**
 * Turns a Firebase Auth rejection into something a toast can say.
 *
 * The account-link screen used to show one generic "Couldn't back up your
 * data" for every failure, which made the email/password flow undebuggable
 * from the device: a disabled provider, a mistyped address, and a wrong
 * password all looked identical. Google and Apple hide most of these behind
 * their own sheets; email/password surfaces them all here.
 */
export function describeAuthError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "Email sign-in isn't turned on for this app";
    case "auth/invalid-email":
      return "That email address doesn't look right";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Pick a longer password — at least 6 characters";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "That email already has an account, and the password doesn't match";
    case "auth/user-disabled":
      return "That account has been disabled";
    case "auth/too-many-requests":
      return "Too many tries — wait a minute and try again";
    case "auth/network-request-failed":
      return "No connection — try again when you're back online";
    case "auth/provider-already-linked":
      return "This device is already backed up to an account";
    default:
      return "Couldn't back up your data";
  }
}

/** The `code` off a Firebase error object, or `null` for anything else. */
export function authErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}
