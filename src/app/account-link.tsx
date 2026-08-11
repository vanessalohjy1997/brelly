import type { AuthCredential } from "@react-native-firebase/auth";
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
  getAppleCredential,
  getEmailCredential,
  getGoogleCredential,
} from "@/services/auth";
import {
  linkAnonymousAccount,
  mergeIntoExistingAccount,
  snapshotLocalData,
} from "@/services/accountLinkService";
import { showToast } from "@/store/toastStore";
import { promptMergeChoice } from "@/utils/promptMergeChoice";

export default function AccountLinkScreen() {
  const theme = useTheme();
  const authUser = useAuthUser();
  const [isLinking, setIsLinking] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const linkedAs = authUser && !authUser.isAnonymous
    ? (authUser.email ?? authUser.displayName ?? "your account")
    : null;

  const handleLink = async (
    getCredential: () => Promise<AuthCredential>,
  ): Promise<void> => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const credential = await getCredential();
      const result = await linkAnonymousAccount(credential);

      if (result === "linked") {
        showToast("Backed up", "success");
        router.back();
        return;
      }

      const snapshot = snapshotLocalData();
      if (snapshot.isEmpty) {
        await mergeIntoExistingAccount(credential, snapshot, false);
        showToast("Signed in", "success");
        router.back();
        return;
      }

      const choice = await promptMergeChoice(
        snapshot.slots.length,
        snapshot.routines.length,
      );
      if (choice === "cancel") return;

      await mergeIntoExistingAccount(credential, snapshot, choice === "add");
      showToast(
        choice === "add" ? "Added your plans" : "Signed in",
        "success",
      );
      router.back();
    } catch {
      showToast("Couldn't back up your data", "error");
    } finally {
      setIsLinking(false);
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
                    onPress={() => handleLink(getGoogleCredential)}
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
                      onPress={() => handleLink(getAppleCredential)}
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
                      handleLink(() =>
                        Promise.resolve(getEmailCredential(email, password)),
                      )
                    }
                    disabled={isLinking || !email || !password}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: isLinking || !email || !password,
                    }}
                    style={[
                      styles.testButton,
                      { backgroundColor: theme.background },
                      (isLinking || !email || !password) && styles.disabled,
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
