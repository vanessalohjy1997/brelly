import {
  cancelNotification,
  scheduleDigestNotification,
  scheduleRainNotification,
} from "@/services/notifications";
import { getForecastForSlot, type SlotForecast } from "@/services/weather";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { buildDigestMessage } from "@/utils/buildDigestMessage";
import { toDateKey } from "@/utils/dateKeys";
import { planNotificationResync } from "@/utils/planNotificationResync";
import { findPlanByDate, upcomingSlots } from "@/utils/planSelectors";
import { nextOccurrenceOfTime } from "@/utils/timeOfDay";

export type NotificationSyncContext = {
  plans: DayPlan[];
  now: Date;
  settings: {
    rainAlertsEnabled: boolean;
    rainLeadMinutes: number;
    quietHours: { enabled: boolean; start: string; end: string };
    digest: { enabled: boolean; time: string };
  };
  digestNotificationId: string | null;
  updateSlot: (
    date: string,
    slotId: string,
    updates: Partial<ItinerarySlot>,
  ) => void;
  setDigestNotificationId: (id: string | null) => void;
};

type ForecastEntry = {
  date: string;
  slot: ItinerarySlot;
  forecastText: string | null;
  forecast: SlotForecast;
};

/**
 * Brings every scheduled notification back in line with the current forecast
 * and the current settings.
 *
 * Rain alerts are scheduled once, when a slot is created — possibly against a
 * 4-day outlook — and then fire regardless of what the weather did afterwards.
 * Running this on every foreground is what makes the alert reflect today's
 * forecast rather than the one that happened to be current at creation time.
 *
 * Takes its state and its writers as plain data so it can be exercised
 * without the MMKV-backed stores.
 */
export async function runNotificationSync(
  context: NotificationSyncContext,
): Promise<void> {
  const entries = await fetchForecasts(context);

  await applyRainActions(context, entries);
  await syncDigest(context, entries);
}

async function fetchForecasts(
  context: NotificationSyncContext,
): Promise<ForecastEntry[]> {
  const upcoming = upcomingSlots(context.plans, context.now);

  return Promise.all(
    upcoming.map(async ({ date, slot }) => {
      const forecast = await getForecastForSlot(
        slot.neaRegion,
        slot.latitude,
        slot.longitude,
        slot.startTime,
      );

      return {
        date,
        slot,
        // The placeholder strings ("Couldn't load forecast", …) are not
        // forecasts — collapsing them to null keeps the resync from reading a
        // failed request as "the rain cleared".
        forecastText:
          forecast.source === "error" || forecast.source === "unavailable"
            ? null
            : forecast.forecast,
        forecast,
      };
    }),
  );
}

async function applyRainActions(
  context: NotificationSyncContext,
  entries: ForecastEntry[],
): Promise<void> {
  const actions = planNotificationResync(entries, {
    rainAlertsEnabled: context.settings.rainAlertsEnabled,
    rainLeadMinutes: context.settings.rainLeadMinutes,
  });

  for (const action of actions) {
    if (action.type === "cancel") {
      await cancelNotification(action.notificationId).catch(() => {
        // Best-effort: a cancel that fails leaves one stale alert, which
        // isn't worth abandoning the rest of the sync over.
      });
      context.updateSlot(action.date, action.slot.id, {
        notificationId: undefined,
        notificationLeadMinutes: undefined,
      });
      continue;
    }

    const entry = entries.find((e) => e.slot.id === action.slot.id);
    if (!entry) continue;

    const notificationId = await scheduleRainNotification(
      action.slot,
      entry.forecast,
      {
        quietHours: context.settings.quietHours,
        leadMinutes: context.settings.rainLeadMinutes,
      },
    );
    if (notificationId) {
      context.updateSlot(action.date, action.slot.id, {
        notificationId,
        notificationLeadMinutes: context.settings.rainLeadMinutes,
      });
    }
  }
}

async function syncDigest(
  context: NotificationSyncContext,
  entries: ForecastEntry[],
): Promise<void> {
  // Always clear the previous one first: the digest is a one-shot trigger
  // re-created on each foreground, so skipping this would stack duplicates.
  if (context.digestNotificationId) {
    await cancelNotification(context.digestNotificationId).catch(() => {});
    context.setDigestNotificationId(null);
  }

  if (!context.settings.digest.enabled) return;

  const triggerDate = nextOccurrenceOfTime(
    context.settings.digest.time,
    context.now,
  );
  if (!triggerDate) return;

  const plan = findPlanByDate(context.plans, toDateKey(triggerDate));
  if (!plan) return;

  const forecastBySlotId = new Map(
    entries.map((entry) => [entry.slot.id, entry.forecastText]),
  );

  const message = buildDigestMessage(
    plan.slots.map((slot) => ({
      label: slot.label,
      startTime: slot.startTime,
      forecastText: forecastBySlotId.get(slot.id) ?? null,
    })),
    triggerDate,
  );
  if (!message) return;

  const notificationId = await scheduleDigestNotification(triggerDate, message);
  context.setDigestNotificationId(notificationId);
}
