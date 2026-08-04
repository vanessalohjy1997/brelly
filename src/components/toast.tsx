import { useEffect, useId } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/icon";
import { ThemedText } from "@/components/themedText";
import { Spacing, type ThemeColor } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTheme } from "@/hooks/useTheme";
import {
  dismissToast,
  useToastStore,
  type ToastVariant,
} from "@/store/toastStore";

/**
 * Long enough to read a sentence at a glance, short enough that it never
 * covers a card the user is reaching for. Errors get the same time: the
 * message says what to do and the toast is tappable, so holding it longer
 * would only be in the way.
 */
export const ToastDurationMs = 3200;

/**
 * A toast carrying an action gets longer, because it is now the only way back.
 * The reading time is the same; what is added is the time to *decide* — and a
 * deleted plan that scrolls away in three seconds is a delete with no undo for
 * anyone who looked at the card first.
 */
export const ToastWithActionDurationMs = 6000;

const ICONS: Record<ToastVariant, IconName> = {
  success: { ios: "checkmark.circle.fill", android: "check_circle" },
  error: { ios: "exclamationmark.triangle.fill", android: "error" },
};

/**
 * The status colour rides on the glyph and the outline; the surface stays
 * neutral for both variants. The palette rule for weather — put the colour on
 * a small element, never the whole background — holds here too: a full-bleed
 * red or green bar is more alarm than a saved plan warrants.
 *
 * What was actually broken was that success had no status colour *anywhere*: a
 * violet `primary` glyph on `backgroundSelected`, which in the light theme is
 * the same value as `border`. So it read as an inert chip while failure got a
 * solid red fill. Both now carry their own hue in the same two places.
 */
const ACCENTS: Record<ToastVariant, ThemeColor> = {
  success: "success",
  error: "danger",
};

type Props = {
  /**
   * Distance from the bottom of this host's container to sit above, on top of
   * the toast's own margin — `BottomTabInset` at the root so it clears the tab
   * bar, nothing inside a modal.
   */
  bottomInset?: number;
  /**
   * Marks the single host in the root layout. It draws only while no modal
   * host is mounted, rather than competing on mount order — see `modalHosts`
   * in the store.
   */
  root?: boolean;
};

/**
 * Renders whatever toast is currently raised, if this is the host that owns
 * the screen.
 *
 * Mount one at the root (`root`) and one in each modal screen; `modalHosts` in
 * the store decides which of them draws. See the comment there for why a
 * single root host isn't enough.
 */
export function ToastHost({ bottomInset = 0, root = false }: Props) {
  const colors = useTheme();
  const reduceMotion = useReduceMotion();
  const toast = useToastStore((state) => state.toast);
  const modalHosts = useToastStore((state) => state.modalHosts);
  const registerModalHost = useToastStore((state) => state.registerModalHost);
  const unregisterModalHost = useToastStore(
    (state) => state.unregisterModalHost,
  );
  const hostId = useId();

  useEffect(() => {
    if (root) return;

    registerModalHost(hostId);
    return () => unregisterModalHost(hostId);
  }, [root, hostId, registerModalHost, unregisterModalHost]);

  const isInnermost = root
    ? modalHosts.length === 0
    : modalHosts[modalHosts.length - 1] === hostId;
  const toastId = toast?.id;
  const duration = toast?.action ? ToastWithActionDurationMs : ToastDurationMs;

  useEffect(() => {
    // Only the host that is actually showing the toast times it out —
    // otherwise a hidden host would dismiss a message no one has seen yet.
    if (toastId === undefined || !isInnermost) return;

    const timer = setTimeout(() => dismissToast(toastId), duration);
    return () => clearTimeout(timer);
  }, [toastId, isInnermost, duration]);

  if (!toast || !isInnermost) return null;

  const accent = colors[ACCENTS[toast.variant]];

  return (
    <Animated.View
      // A fade is already about as quiet as an entrance gets, but "Reduce
      // Motion" is a request to be left alone rather than a request for
      // *slightly* less, and a toast appearing outright is not disorienting
      // the way a moving one is.
      entering={reduceMotion ? undefined : FadeIn.duration(160)}
      exiting={reduceMotion ? undefined : FadeOut.duration(160)}
      pointerEvents="box-none"
      style={[styles.container, { bottom: bottomInset + Spacing.three }]}
    >
      <Pressable
        onPress={() => dismissToast(toast.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityHint="Tap to dismiss"
        style={[
          styles.toast,
          { backgroundColor: colors.backgroundElement, borderColor: accent },
        ]}
      >
        <Icon name={ICONS[toast.variant]} size={18} tintColor={accent} />
        <ThemedText
          style={[styles.message, { color: colors.text }]}
          numberOfLines={3}
        >
          {toast.message}
        </ThemedText>
        {toast.action && (
          // Nested inside the dismiss-on-tap surface: a press that lands on
          // the button runs the action and never reaches the parent, and one
          // that lands anywhere else still dismisses. The action dismisses
          // itself afterwards so no handler has to remember to.
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              dismissToast(toast.id);
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.action}
          >
            <ThemedText style={[styles.actionLabel, { color: colors.primary }]}>
              {toast.action.label}
            </ThemedText>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.three,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: "100%",
  },
  message: {
    flexShrink: 1,
    fontWeight: "500",
  },
  action: {
    // Sits hard against the toast's right edge rather than floating in the
    // middle of it, so the message can take whatever width it needs first.
    paddingLeft: Spacing.two,
    minHeight: 32,
    justifyContent: "center",
  },
  actionLabel: {
    fontWeight: "700",
  },
});
