import { useNavigation } from "expo-router";
import { useCallback, useEffect } from "react";
import { Alert } from "react-native";

/**
 * Stops a half-filled form from being thrown away by a stray tap or swipe.
 *
 * A modal has two ways out and they need different treatment:
 *
 * - **The Cancel button** is deliberate, so it asks. `confirmDiscard` runs the
 *   dismiss straight through when nothing is unsaved — a confirmation on an
 *   untouched form is pure friction, and one that always appears is one people
 *   learn to dismiss without reading.
 * - **The swipe-down** is not deliberate enough to ask about; it can be a
 *   mis-aimed scroll on the first field. It is disabled outright while the
 *   form is dirty, which is what UIKit's `isModalInPresentation` is for and
 *   what `gestureEnabled` maps to. Blocking it leaves the button as the only
 *   exit, and the button asks.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);

  return useCallback(
    (discard: () => void) => {
      if (!dirty) {
        discard();
        return;
      }

      Alert.alert(
        "Discard changes?",
        "This plan hasn't been saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: discard },
        ],
      );
    },
    [dirty],
  );
}
