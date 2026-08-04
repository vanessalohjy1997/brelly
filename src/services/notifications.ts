import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { SlotForecast } from "@/services/weather";
import { computeNotificationTriggerTime } from "@/utils/computeNotificationTriggerTime";
import { shouldNotifyForRain } from "@/utils/shouldNotifyForRain";
import { isWithinQuietHours } from "@/utils/timeOfDay";

// Android 8+ requires every notification to belong to a channel; the
// channel's importance controls whether it can alert (vs. silently log).
// Rain alerts and the daily digest get separate channels so a user can mute
// the digest in system settings without losing the time-critical alerts.
export const RAIN_CHANNEL_ID = "weather-alerts";
export const DIGEST_CHANNEL_ID = "daily-digest";

const CHANNEL_NAMES: Record<string, string> = {
  [RAIN_CHANNEL_ID]: "Weather alerts",
  [DIGEST_CHANNEL_ID]: "Daily digest",
};

const readyChannels = new Set<string>();

async function ensureAndroidChannel(channelId: string): Promise<void> {
  if (Platform.OS !== "android" || readyChannels.has(channelId)) return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: CHANNEL_NAMES[channelId] ?? channelId,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  readyChannels.add(channelId);
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export type QuietHoursOption = {
  enabled: boolean;
  start: string;
  end: string;
};

export type ScheduleRainOptions = {
  /** Suppress notifications that would fire inside this window. */
  quietHours?: QuietHoursOption;
  /** Minutes before the slot to fire. Defaults to the 45-minute standard. */
  leadMinutes?: number;
};

/**
 * Schedules a "bring an umbrella" notification shortly before a slot starts,
 * if its forecast predicts rain. Returns the scheduled notification's id (to
 * cancel it later), or null if nothing was scheduled — the slot is muted, the
 * forecast isn't rainy, the lead time has already passed, the alert would land
 * in quiet hours, or permission was denied.
 */
export async function scheduleRainNotification(
  slot: { label: string; startTime: string; notificationsMuted?: boolean },
  forecast: SlotForecast,
  options: ScheduleRainOptions = {},
): Promise<string | null> {
  if (slot.notificationsMuted) return null;
  if (!shouldNotifyForRain(forecast.forecast)) return null;

  const triggerDate = computeNotificationTriggerTime(
    slot.startTime,
    options.leadMinutes,
  );
  if (!triggerDate) return null;

  // Quiet hours suppress the alert rather than delaying it. Pushing it to the
  // end of the window would routinely deliver "bring an umbrella" after the
  // slot had already started, which is worse than not sending it.
  const { quietHours } = options;
  if (
    quietHours?.enabled &&
    isWithinQuietHours(triggerDate, quietHours.start, quietHours.end)
  ) {
    return null;
  }

  const hasPermission = await ensurePermission();
  if (!hasPermission) return null;

  await ensureAndroidChannel(RAIN_CHANNEL_ID);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Bring an umbrella",
      body: `${forecast.forecast} expected for "${slot.label}".`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: RAIN_CHANNEL_ID,
    },
  });
}

/**
 * Schedules the daily digest for one specific moment.
 *
 * Deliberately a one-shot DATE trigger rather than a repeating DAILY one:
 * a notification's body is fixed when it's scheduled, and a repeating trigger
 * would replay whichever day's plans happened to be current when it was set
 * up. The app re-schedules the next occurrence each time it foregrounds.
 */
export async function scheduleDigestNotification(
  triggerDate: Date,
  message: { title: string; body: string },
): Promise<string | null> {
  if (triggerDate.getTime() <= Date.now()) return null;

  const hasPermission = await ensurePermission();
  if (!hasPermission) return null;

  await ensureAndroidChannel(DIGEST_CHANNEL_ID);

  return Notifications.scheduleNotificationAsync({
    content: { title: message.title, body: message.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: DIGEST_CHANNEL_ID,
    },
  });
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * How long a test alert waits before firing.
 *
 * Long enough to close Settings and put the phone down, short enough that
 * nobody wonders whether it worked. Firing immediately would show the alert
 * while the app is in the foreground, which is the one case where the OS may
 * not present a banner at all — so an alert that works would look broken.
 */
export const TEST_NOTIFICATION_DELAY_SECONDS = 5;

/**
 * Sends one alert now-ish, so a user can find out whether alerts reach them
 * without waiting for weather.
 *
 * The whole value of this feature is firing at the right moment, days after it
 * was set up, and until now there was no way to build any confidence in that
 * short of planning something and waiting for rain. Returns false when
 * permission isn't granted, so the caller can say why nothing happened rather
 * than claiming a send.
 */
export async function sendTestNotification(): Promise<boolean> {
  const hasPermission = await ensurePermission();
  if (!hasPermission) return false;

  await ensureAndroidChannel(RAIN_CHANNEL_ID);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Brelly alerts are working",
      body: "This is what a rain alert will look like.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_NOTIFICATION_DELAY_SECONDS,
      repeats: false,
      channelId: RAIN_CHANNEL_ID,
    },
  });
  return true;
}

/**
 * How many alerts are currently scheduled, excluding the test one above.
 *
 * "Rain alerts: on" says what the app intends; this says what is actually
 * queued with the OS. They come apart routinely and for good reasons — no
 * upcoming stop looks wet, every stop is muted, the lead time has passed on
 * the near ones — and the difference is invisible without a number.
 */
export async function countScheduledNotifications(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

/**
 * Deletes a slot and best-effort cancels its scheduled notification (if
 * any). The delete happens synchronously so the UI feels instant; a failed
 * cancellation just means a stray notification fires once for a plan that
 * no longer exists, which isn't worth surfacing an error for.
 */
export function cancelAndDeleteSlot(
  deleteSlot: (date: string, slotId: string) => void,
  date: string,
  slot: { id: string; notificationId?: string },
): void {
  deleteSlot(date, slot.id);
  if (slot.notificationId) {
    cancelNotification(slot.notificationId).catch(() => {
      // best-effort — see doc comment above
    });
  }
}
