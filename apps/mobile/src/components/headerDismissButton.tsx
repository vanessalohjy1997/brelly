import { Stack } from "expo-router";
import { Platform, Pressable } from "react-native";

import { ThemedText } from "@/components/themedText";

type Props = {
  label: string;
  onPress: () => void;
};

/**
 * The trailing "Cancel"/"Done" button of a modal screen, as a plain text
 * button.
 *
 * On iOS 26 anything passed to `headerRight` is rendered inside a Liquid Glass
 * capsule, so a text label ends up sitting on a pill-shaped background instead
 * of reading as a text button. `Stack.Toolbar` with `hidesSharedBackground`
 * renders a native bar button item without that background.
 *
 * Android and web keep the plain `headerRight` element: `Stack.Toolbar` is a
 * no-op on web, and on Android `Stack.Toolbar.Button` renders only its icon —
 * text children are dropped — so a text-only button would vanish there.
 */
export function HeaderDismissButton({ label, onPress }: Props) {
  if (Platform.OS === "ios") {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button hidesSharedBackground onPress={onPress}>
          {label}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  return (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable onPress={onPress} hitSlop={8}>
            <ThemedText type="linkPrimary">{label}</ThemedText>
          </Pressable>
        ),
      }}
    />
  );
}
