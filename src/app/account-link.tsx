import { linkProvider, type LinkRequest } from "@brelly/platform/auth";
import { router } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderDismissButton } from "@/components/headerDismissButton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { ToastHost } from "@/components/toast";
import { Spacing } from "@/constants/theme";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTheme } from "@/hooks/useTheme";
import {
  mergeIntoExistingAccount,
  readAnonymousData,
  signOutOfAccount,
} from "@/services/accountLinkService";
import { showToast } from "@/store/toastStore";
import { confirmSignOut } from "@/utils/confirmSignOut";
import { describeAuthError } from "@/utils/describeAuthError";
import { promptMergeChoice } from "@/utils/promptMergeChoice";

export default function AccountLinkScreen() {
  const theme = useTheme();
  const authUser = useAuthUser();
  const [isLinking, setIsLinking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Trimmed because a keyboard suggestion or a paste routinely carries a
  // trailing space, and Firebase rejects that as `auth/invalid-email`.
  const canSubmitEmail = email.trim().length > 0 && password.length > 0;

  const linkedAs = authUser && !authUser.isAnonymous
    ? (authUser.email ?? authUser.displayName ?? "your account")
    : null;

  const handleLink = async (request: LinkRequest): Promise<void> => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      // One call, not "get a credential, then link it". The two steps are
      // separable on a phone and not on the web, where the provider popup is
      // itself the sign-in — so the seam takes the intent and hands back the
      // credential it ended up using. The merge below needs that credential
      // rather than a fresh one: re-running the provider would mean a second
      // sheet here, and a popup with no user gesture behind it on the web.
      const result = await linkProvider(request);

      if (result.status === "linked") {
        showToast("Backed up", "success");
        router.back();
        return;
      }

      const { credential } = result;

      // Read once, here, and thread the same value through the question and
      // the merge. It used to read the Zustand stores, which are a mirror of
      // these documents rather than the documents — so a session whose
      // listeners had not hydrated yet saw "nothing to merge", skipped the
      // question entirely and went straight into the discard branch. That is a
      // silent, unprompted deletion of everything in the account. Asking
      // "Add your 0 plans and 0 routines to it?" one line further down was the
      // same bug, just visible.
      const cloud = await readAnonymousData();

      if (cloud.isEmpty) {
        await mergeIntoExistingAccount(credential, cloud, false);
        showToast("Signed in", "success");
        router.back();
        return;
      }

      const choice = await promptMergeChoice(
        cloud.slots.length,
        cloud.routines.length,
      );
      if (choice === "cancel") return;

      await mergeIntoExistingAccount(credential, cloud, choice === "add");
      showToast(
        choice === "add" ? "Added your plans" : "Signed in",
        "success",
      );
      router.back();
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
      router.back();
    } catch {
      // The session is whatever `signOutOfAccount` left it as, and it puts
      // the anonymous user back before it can throw for any reason the user
      // could act on — so this says the sign-out didn't happen rather than
      // guessing which half did.
      showToast("Couldn't sign out", "error");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton label="Done" onPress={() => router.back()} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {linkedAs ? (
            <ThemedView type="backgroundElement" style={styles.optionGroup}>
              <ThemedView style={styles.subSetting}>
                <ThemedText style={styles.testButtonText}>
                  Backed up as {linkedAs}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  Your plans, routines, and settings are saved to this
                  account.
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.subSetting}>
                <Pressable
                  onPress={handleSignOut}
                  disabled={isSigningOut}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSigningOut }}
                  style={[
                    styles.testButton,
                    { backgroundColor: theme.background },
                    isSigningOut && styles.disabled,
                  ]}
                >
                  <ThemedText
                    themeColor="danger"
                    style={styles.testButtonText}
                  >
                    Sign out
                  </ThemedText>
                </Pressable>
                <ThemedText themeColor="textSecondary" style={styles.hint}>
                  This device goes back to keeping your plans on its own.
                  Nothing is removed from the account.
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Add an account so your plans survive a lost phone and follow
                you to another device.
              </ThemedText>

              <ThemedView type="backgroundElement" style={styles.optionGroup}>
                <ThemedView style={styles.subSetting}>
                  <Pressable
                    onPress={() => handleLink({ provider: "google" })}
                    disabled={isLinking}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isLinking }}
                    style={[
                      styles.testButton,
                      { backgroundColor: theme.background },
                      isLinking && styles.disabled,
                    ]}
                  >
                    <ThemedText style={styles.testButtonText}>
                      Continue with Google
                    </ThemedText>
                  </Pressable>
                </ThemedView>

                {Platform.OS === "ios" && (
                  <ThemedView style={styles.subSetting}>
                    <Pressable
                      onPress={() => handleLink({ provider: "apple" })}
                      disabled={isLinking}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isLinking }}
                      style={[
                        styles.testButton,
                        { backgroundColor: theme.background },
                        isLinking && styles.disabled,
                      ]}
                    >
                      <ThemedText style={styles.testButtonText}>
                        Continue with Apple
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
                Or with email
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.optionGroup}>
                <ThemedView style={styles.subSetting}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    editable={!isLinking}
                    style={[styles.input, { color: theme.text }]}
                    accessibilityLabel="Email"
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    editable={!isLinking}
                    style={[styles.input, { color: theme.text }]}
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    onPress={() =>
                      handleLink({
                        provider: "email",
                        email: email.trim(),
                        password,
                      })
                    }
                    disabled={isLinking || !canSubmitEmail}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: isLinking || !canSubmitEmail,
                    }}
                    style={[
                      styles.testButton,
                      { backgroundColor: theme.background },
                      (isLinking || !canSubmitEmail) && styles.disabled,
                    ]}
                  >
                    <ThemedText style={styles.testButtonText}>
                      Continue with email
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <ToastHost />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: Spacing.two,
  },
  optionGroup: {
    borderRadius: Spacing.two,
    overflow: "hidden",
  },
  hint: {
    fontSize: 12,
  },
  subSetting: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  testButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  testButtonText: {
    fontWeight: "600",
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.3)",
  },
  disabled: {
    opacity: 0.5,
  },
});
