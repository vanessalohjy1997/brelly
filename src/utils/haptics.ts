import * as Haptics from "expo-haptics";

export function hapticDelete(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * A switch flipped — rain alerts off, rain alerts back on.
 *
 * `selectionAsync` rather than the warning `hapticDelete` uses: muting is
 * reversible by the same gesture that caused it, so it should not feel like
 * the destructive action sitting next to it on the swipe.
 */
export function hapticToggle(): void {
  Haptics.selectionAsync();
}
