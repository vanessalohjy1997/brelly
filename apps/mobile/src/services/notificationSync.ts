import {
  cancelNotification,
  listScheduledAlerts,
  scheduleDigestNotification,
  scheduleRainNotification,
} from "@/services/notifications";
import {
  buildDigestMessage,
  buildWidgetSnapshot,
  clearedNotificationHandles,
  findPlanByDate,
  getForecastForSlot,
  nextOccurrenceOfTime,
  planNotificationResync,
  reconcileScheduledAlerts,
  toDateKey,
  upcomingSlots,
  type DayPlan,
  type FoundSlot,
  type ItinerarySlot,
  type SlotForecast,
} from "@brelly/core";
import { writeWidgetSnapshot } from "@/services/widgetBridge";

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
 * It starts by reading the OS queue back, and treats that — not the handles
 * on the slots — as the record of what is scheduled. The handles live only in
 * memory, so a cold start forgets them, and each forgotten handle used to
 * mean one more alert queued for the same stop. See
 * `reconcileScheduledAlerts` for the rules; the store is written back to
 * match, so a screen cancelling `slot.notificationId` cancels a real alert.
 *
 * Takes its state and its writers as plain data so it can be exercised
 * without the MMKV-backed stores.
 */
export async function runNotificationSync(
  context: NotificationSyncContext,
): Promise<void> {
  const queue = await listScheduledAlerts().catch(() => null);
  const upcoming = await reconcileWithQueue(context, queue);
  const entries = await fetchForecasts(upcoming);

  await applyRainActions(context, entries);
  await syncDigest(context, entries, queue);

  // The lock-screen/home-screen widget rides on the same schedule: this sync
  // already re-reads every upcoming stop's forecast on mount and on every
  // foreground, so publishing the next-stop glance here costs no extra fetch
  // and keeps the widget as fresh as the app itself. See `widgetBridge.ts`.
  writeWidgetSnapshot(buildWidgetSnapshot(entries, context.now));
}

/**
 * Cancels every alert the queue holds that no stop should have — duplicates,
 * strays for deleted stops, untagged ones from an older build — and hands
 * back the upcoming stops with their handles corrected to what is queued.
 * Corrections are written to the store too. When the queue could not be read
 * there is nothing to reconcile against, and the store's handles stand.
 */
async function reconcileWithQueue(
  context: NotificationSyncContext,
  queue: Awaited<ReturnType<typeof listScheduledAlerts>> | null,
): Promise<FoundSlot[]> {
  if (queue === null) return upcomingSlots(context.plans, context.now);

  const { upcoming, cancel } = reconcileScheduledAlerts(
    context.plans,
    context.now,
    queue,
  );

  for (const id of cancel) {
    await cancelNotification(id).catch(() => {
      // Best-effort, like every other cancel in the app.
    });
  }

  const before = new Map(
    upcomingSlots(context.plans, context.now).map(({ slot }) => [slot.id, slot]),
  );
  for (const { date, slot } of upcoming) {
    const was = before.get(slot.id);
    if (
      was?.notificationId === slot.notificationId &&
      was?.notificationLeadMinutes === slot.notificationLeadMinutes
    ) {
      continue;
    }
    context.updateSlot(
      date,
      slot.id,
      slot.notificationId
        ? {
            notificationId: slot.notificationId,
            notificationLeadMinutes: slot.notificationLeadMinutes,
          }
        : clearedNotificationHandles,
    );
  }

  return upcoming;
}

async function fetchForecasts(upcoming: FoundSlot[]): Promise<ForecastEntry[]> {
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
  queue: Awaited<ReturnType<typeof listScheduledAlerts>> | null,
): Promise<void> {
  // Always clear the previous one first: the digest is a one-shot trigger
  // re-created on each foreground, so skipping this would stack duplicates.
  // Every digest the OS holds goes, not just the one the store remembers —
  // the store forgets on each cold start, and the queue does not.
  const queued = queue?.flatMap((alert) =>
    alert.kind === "digest" ? [alert.id] : [],
  ) ?? [];
  const stale = new Set(queued);
  if (context.digestNotificationId) stale.add(context.digestNotificationId);
  for (const id of stale) {
    await cancelNotification(id).catch(() => {});
  }
  if (context.digestNotificationId) context.setDigestNotificationId(null);

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
