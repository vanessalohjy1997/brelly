import type { SlotForecast } from "./weather";
import type { ItinerarySlot } from "../types/itinerary";
import { describeUmbrella, type UmbrellaReason } from "../utils/describeUmbrella";

/**
 * The single-glance payload the WidgetKit extension reads across the App-Group
 * boundary. Kept flat and JSON-only on purpose: it is serialised into shared
 * `UserDefaults` by `writeWidgetSnapshot` and decoded by Swift (`WidgetSnapshot`
 * in `targets/widget/index.swift`). Any field added here has to be mirrored
 * there — the two processes never share types, only this shape.
 */
export type WidgetSnapshot = {
  /** When the app last wrote this, so the widget can show how stale it is. */
  generatedAt: string;
  /** null when nothing is upcoming — the widget renders its empty glance. */
  next: WidgetNextSlot | null;
};

export type WidgetNextSlot = {
  label: string;
  location: string;
  /** ISO start time; the widget formats it in the device locale. */
  startTime: string;
  forecastText: string | null;
  temperature: { low: number; high: number } | null;
  /**
   * null when no forecast could be loaded for the stop — the widget says "No
   * forecast" rather than a confident, wrong "Clear". A resolved verdict
   * always carries its reason, matching `describeUmbrella`.
   */
  umbrella: WidgetUmbrella | null;
};

export type WidgetUmbrella = {
  needed: boolean;
  reason: UmbrellaReason;
  shortLabel: string;
};

/**
 * The minimum this builder needs from the notification sync's own per-slot
 * forecast fetch. Structurally what `notificationSync`'s `ForecastEntry`
 * already is, so its entries pass straight in with no adapter — and narrow
 * enough to construct in a test without the store or the network.
 */
export type WidgetForecastEntry = {
  slot: ItinerarySlot;
  /** null when the fetch failed or matched no area — never a placeholder. */
  forecastText: string | null;
  forecast: SlotForecast;
};

/**
 * Reduces every upcoming stop and its already-fetched forecast to the one the
 * widget shows: the soonest to start. The notification sync hands its entries
 * in pre-filtered and sorted, but this re-derives both so the payload is
 * correct on any input — the glance is the app's public face on the lock
 * screen and must not depend on a caller's ordering.
 */
export function buildWidgetSnapshot(
  entries: WidgetForecastEntry[],
  now: Date,
): WidgetSnapshot {
  const next = entries
    .filter((entry) => new Date(entry.slot.startTime).getTime() > now.getTime())
    .sort(
      (a, b) =>
        new Date(a.slot.startTime).getTime() -
        new Date(b.slot.startTime).getTime(),
    )[0];

  if (!next) {
    return { generatedAt: now.toISOString(), next: null };
  }

  const { slot, forecastText, forecast } = next;
  // "We don't know" is a real third state, distinct from "clear": a stop whose
  // forecast fetch failed carries neither a forecast string nor a UV reading,
  // and `describeUmbrella` would read that absence as CLEAR.
  const forecastKnown = forecastText !== null || forecast.uvIndex != null;
  const verdict = describeUmbrella(forecastText ?? undefined, forecast.uvIndex);

  return {
    generatedAt: now.toISOString(),
    next: {
      label: slot.label,
      location: slot.location,
      startTime: slot.startTime,
      forecastText,
      temperature: forecast.temperature ?? null,
      umbrella: forecastKnown
        ? {
            needed: verdict.needed,
            reason: verdict.reason,
            shortLabel: verdict.shortLabel,
          }
        : null,
    },
  };
}
