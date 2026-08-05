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
