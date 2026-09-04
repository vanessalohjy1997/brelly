import { Linking } from "react-native";

import { showToast } from "@/store/toastStore";

/**
 * Opens Brelly's own page in the system Settings app.
 *
 * This is the only way back from a permission refusal — iOS will not show a
 * dialog for the same permission twice, so an in-app "ask again" button is a
 * button that does nothing. Every dead end in the app routes here instead:
 * the onboarding primer, the nearby-weather card, the add-plan form and the
 * Settings screen's own permission rows.
 *
 * Centralised in one place so the cross-platform behaviour is asserted once.
 * `Linking.openSettings()` is a React Native core API, not an Expo one, and it
 * lands on the app's settings page on both platforms — but it can reject (an
 * Android ROM with no settings activity for the intent), and a rejection here
 * is exactly the silent dead end this whole change exists to remove, so it is
 * caught and said out loud.
 */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    showToast(
      "Couldn't open Settings. Open it yourself and find Brelly.",
      "error",
    );
    return false;
  }
}
