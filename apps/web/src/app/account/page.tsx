"use client";

import { useState } from "react";

import { linkProvider, type LinkRequest } from "@brelly/platform/auth";
import {
  describeAuthError,
  mergeIntoExistingAccount,
  readAnonymousData,
  showToast,
  signOutOfAccount,
} from "@brelly/core";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { Surface } from "@/components/Surface";
import { Text } from "@/components/Text";
import { useAuthUser } from "@/hooks/useAuthUser";
import { confirmSignOut } from "@/utils/confirmSignOut";
import { promptMergeChoice } from "@/utils/promptMergeChoice";

const INPUT_CLASS =
  "min-h-[var(--brelly-hit-target)] w-full rounded-control border border-border bg-background px-two text-default text-text placeholder:text-text-secondary";

/**
 * Adding a real identity to the anonymous session, and leaving one again.
 *
 * A page rather than the phone's modal, and a `<form>` rather than two loose
 * inputs and a button — which is not decoration: it is what makes Enter submit
 * and what tells a password manager that these two fields are one credential.
 *
 * **"Continue with Apple" is not gated here.** The phone gates it on
 * `Platform.OS === "ios"`, because `expo-apple-authentication` only exists
 * there. Apple's JS Sign In works in any browser, so the gate has nothing left
 * to protect and the button is offered to everyone.
 */
export default function AccountPage() {
  const authUser = useAuthUser();
  const [isLinking, setIsLinking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Trimmed because a browser autofill or a paste routinely carries a trailing
  // space, and Firebase rejects that as `auth/invalid-email`.
  const canSubmitEmail = email.trim().length > 0 && password.length > 0;

  const linkedAs =
    authUser && !authUser.isAnonymous
      ? (authUser.email ?? authUser.displayName ?? "your account")
      : null;

  const handleLink = async (request: LinkRequest): Promise<void> => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      // One call, not "get a credential, then link it". On the web the provider
      // popup *is* the sign-in, so the seam takes the intent and hands back the
      // credential it ended up using. The merge below needs that credential
      // rather than a fresh one: re-running the provider would mean a second
      // popup, issued after an `await` and outside the user-gesture task, which
      // browsers block outright.
      const result = await linkProvider(request);

      if (result.status === "linked") {
        showToast("Backed up", "success");
        return;
      }

      const { credential } = result;

      // Read once, here, and thread the same value through the question and the
      // merge. Reading the zustand stores instead — a mirror of these documents
      // rather than the documents — meant a session whose listeners had not
      // hydrated saw "nothing to merge" and went straight into the discard
      // branch: a silent, unprompted deletion of everything in the account.
      const cloud = await readAnonymousData();

      if (cloud.isEmpty) {
        await mergeIntoExistingAccount(credential, cloud, false);
        showToast("Signed in", "success");
        return;
      }

      const choice = await promptMergeChoice(
        cloud.slots.length,
        cloud.routines.length,
      );
      if (choice === "cancel") return;

      await mergeIntoExistingAccount(credential, cloud, choice === "add");
      showToast(choice === "add" ? "Added your plans" : "Signed in", "success");
    } catch (error) {
      showToast(describeAuthError(error), "error");
    } finally {
      setIsLinking(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) return;
    if (!(await confirmSignOut())) return;

    setIsSigningOut(true);
    try {
      await signOutOfAccount();
      showToast("Signed out", "success");
    } catch {
      // The session is whatever `signOutOfAccount` left it as, and it puts the
      // anonymous user back before it can throw for any reason the user could
      // act on — so this says the sign-out didn't happen rather than guessing
      // which half did.
      showToast("Couldn't sign out", "error");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <PageHeader title="Account" />
      <div className="flex flex-col gap-three py-three">
        {linkedAs ? (
          <Surface className="flex flex-col gap-three p-three">
            <div className="flex flex-col gap-half">
              <Text variant="smallBold">Backed up as {linkedAs}</Text>
              <Text variant="small" color="textSecondary">
                Your plans, routines, and settings are saved to this account.
              </Text>
            </div>
            <div className="flex flex-col gap-one">
              {/* Not `Button tone="danger"`: that is a filled red button, and
                  leaving an account is not the destructive act the fill is for
                  — nothing is removed. Danger-coloured text on a quiet control
                  is the same weight the phone gives it. */}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background px-three disabled:opacity-[var(--brelly-opacity-disabled)]"
              >
                <Text variant="smallBold" color="danger">
                  Sign out
                </Text>
              </button>
              <Text variant="small" color="textSecondary">
                This browser goes back to keeping your plans on its own. Nothing
                is removed from the account.
              </Text>
            </div>
          </Surface>
        ) : (
          <>
            <Text variant="small" color="textSecondary">
              Add an account so your plans survive a lost laptop and follow you
              to another device.
            </Text>

            <Surface className="flex flex-col gap-two p-three">
              <Button
                tone="quiet"
                onClick={() => void handleLink({ provider: "google" })}
                disabled={isLinking}
              >
                Continue with Google
              </Button>
              <Button
                tone="quiet"
                onClick={() => void handleLink({ provider: "apple" })}
                disabled={isLinking}
              >
                Continue with Apple
              </Button>
            </Surface>

            <Text variant="fieldLabel" color="textSecondary" as="h2">
              Or with email
            </Text>
            <Surface className="p-three">
              <form
                className="flex flex-col gap-two"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleLink({
                    provider: "email",
                    email: email.trim(),
                    password,
                  });
                }}
              >
                <Field id="account-email" label="Email">
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    // `username` rather than `email`: this field is half of a
                    // sign-in pair, and that is the token a password manager
                    // uses to offer saving the two together.
                    autoComplete="username"
                    disabled={isLinking}
                    placeholder="you@example.com"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field id="account-password" label="Password">
                  <input
                    id="account-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isLinking}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Button
                  type="submit"
                  tone="quiet"
                  disabled={isLinking || !canSubmitEmail}
                >
                  Continue with email
                </Button>
              </form>
            </Surface>
          </>
        )}
      </div>
    </>
  );
}
