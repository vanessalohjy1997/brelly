import { ExtensionStorage } from "@bacons/apple-targets";
import { Platform } from "react-native";

import type { WidgetSnapshot } from "@/services/widgetSnapshot";

/**
 * The App Group the app and the WidgetKit extension share. It is written in
 * three places that must agree or the two processes stop seeing the same
 * container: here, the app's own entitlement in `app.json`
 * (`ios.entitlements`), and the target's entitlement in
 * `targets/widget/expo-target.config.js`.
 */
export const WIDGET_APP_GROUP = "group.com.sg.brelly.app";

/** The `UserDefaults` key the Swift `TimelineProvider` reads. */
export const WIDGET_SNAPSHOT_KEY = "nextSlot";

/**
 * The widget's WidgetKit `kind`. Must equal the `kind` string on the Swift
 * `Widget`, or `reloadWidget` refreshes nothing.
 */
export const WIDGET_KIND = "brellyWidget";

/**
 * Publishes the next-stop glance into the shared App-Group container the widget
 * reads, then asks WidgetKit to rebuild its timeline.
 *
 * Deliberately iOS-only and best-effort. There is no widget on Android — the
 * platform has no lock-screen widgets — so this is a no-op there. And a failure
 * to write is background upkeep: it must never take down the notification sync
 * that calls it (`ExtensionStorage` reaches a native module that only exists in
 * a real iOS build, so a bare import guard is not enough).
 */
export function writeWidgetSnapshot(snapshot: WidgetSnapshot): void {
  if (Platform.OS !== "ios") return;

  try {
    const storage = new ExtensionStorage(WIDGET_APP_GROUP);
    storage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch {
    // Best-effort: a widget-write failure must not surface to the user.
  }
}
