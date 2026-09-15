import {
  describeUmbrella,
  formatRelativeTimestamp,
  formatTempRange,
  type SlotForecast,
} from "@brelly/core";

import { Icon } from "../Icon";
import { Icons } from "../icons";
import { TEXT_COLOR } from "../colorClasses";
import { Text } from "../Text";

type Props = {
  weather: SlotForecast | undefined;
  isLoading: boolean;
  /** Island-wide UV index, the second half of the umbrella verdict. */
  uvIndex?: number | null;
  onRetry?: () => void;
};

export function WeatherBadge({ weather, isLoading, uvIndex, onRetry }: Props) {
  // A placeholder at the badge's real height rather than a bare spinner a
  // fraction of its size — otherwise every card resizes when data lands.
  if (isLoading) {
    return (
      <div className="flex min-h-[var(--brelly-hit-target)] items-center justify-end gap-two">
        <Text variant="small" color="textSecondary">
          Checking the sky…
        </Text>
      </div>
    );
  }

  // "unavailable" means the provider has no forecast for this date/time yet —
  // nothing to retry. "error" means the request itself failed, so a retry can
  // plausibly succeed, and is worth a control when one is offered.
  if (weather?.source === "error") {
    return (
      <div className="flex min-h-[var(--brelly-hit-target)] items-center justify-end">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[var(--brelly-hit-target)] rounded-control px-two text-right"
          >
            <Text variant="smallBold" color="danger">
              Couldn&rsquo;t load · Retry
            </Text>
          </button>
        ) : (
          <Text variant="smallBold" color="danger">
            Couldn&rsquo;t load
          </Text>
        )}
      </div>
    );
  }

  if (!weather || weather.source === "unavailable") {
    return (
      <div className="flex min-h-[var(--brelly-hit-target)] items-center justify-end">
        <Text variant="smallBold" color="textSecondary">
          No forecast
        </Text>
      </div>
    );
  }

  const verdict = describeUmbrella(weather.forecast, uvIndex);

  // One accessible node carrying the whole sentence. The verdict word on screen
  // is the short form; a screen reader gets what the card no longer writes out
  // anywhere else, because the pill that used to say it is gone and the colour
  // that replaced it says nothing aloud.
  //
  // Freshness is deliberately not part of this: every reading's age renders in
  // the card's corner, and `ForecastTimestamp` speaks its own.
  const spoken = [
    verdict.label,
    weather.forecast,
    weather.temperature && formatTempRange(weather.temperature),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="flex min-h-[var(--brelly-hit-target)] flex-col items-end gap-half text-right">
      {/* One string for a screen reader, in place of three fragments read as
          three separate things. `role="text"` would be the direct equivalent
          of what the phone does and is not an ARIA role — it exists in WebKit
          alone — so the sentence is written out where only assistive
          technology reads it, and the visible parts are hidden from it. */}
      <span className="sr-only">{spoken}</span>
      {/* The umbrella answer in a word, coloured by the verdict — the app named
          after an umbrella should say the decision, not leave the reader to
          translate a condition into one. Only when an umbrella is actually
          needed: a clear stop stays wordless, matching the restraint it already
          gets on the card. */}
      {verdict.themeColor && (
        <span
          aria-hidden="true"
          className={`truncate text-small-bold ${TEXT_COLOR[verdict.themeColor]}`}
        >
          {verdict.shortLabel}
        </span>
      )}
      {/* The provider's own wording, demoted beneath the verdict word when there
          is one and leading in its own right when the stop is clear. */}
      <span
        aria-hidden="true"
        className={
          verdict.needed
            ? "truncate text-small text-text-secondary"
            : "truncate text-small-bold text-text"
        }
      >
        {weather.forecast}
      </span>
      {weather.temperature && (
        <span aria-hidden="true" className="text-small text-text-secondary">
          {formatTempRange(weather.temperature)}
        </span>
      )}
    </div>
  );
}

/**
 * The freshness clock, split out so `ItineraryCard` can place it in the card's
 * top-right corner, aligned with the plan's own time, instead of buried beside
 * the temperature.
 *
 * Every reading that has an age renders here, whichever tier answered. It used
 * to take only the live "Updated 4m ago" case and leave the outlook and offline
 * ones inside `WeatherBadge` — but which tier answers is decided by geography,
 * so the same plan put its timestamp in two different places depending on where
 * it was, and a column of cards had no one line to scan for staleness.
 */
export function ForecastTimestamp({
  weather,
}: {
  weather: SlotForecast | undefined;
}) {
  if (
    !weather ||
    weather.source === "error" ||
    weather.source === "unavailable"
  ) {
    return null;
  }

  // A cached reading's age is measured from when it was stored, not from the
  // provider's issue time — that is the number that says how stale the app's
  // view of the world is.
  const age = formatRelativeTimestamp(weather.cachedAt ?? weather.updatedAt);
  const freshness = describeFreshness(weather.source, age);
  if (!freshness) return null;

  const isUpdated = freshness.startsWith("Updated ");

  return (
    <div className="flex shrink-0 items-center gap-half text-text-secondary">
      <span className="sr-only">{freshness}</span>
      {/* The clock stands in for the word "Updated" only. "Outlook" and
          "Offline" say something it cannot — how far the reading is being
          stretched, and that it came off disk — so those stay in words. */}
      <Icon name={Icons.time} size="metadata" />
      <span aria-hidden="true" className="truncate text-small">
        {isUpdated ? age : freshness}
      </span>
    </div>
  );
}

/**
 * One plain-language freshness note instead of two competing ones. The badge
 * used to show an API-tier label ("2hr" as "Live", "4day" as "4-day") next to
 * "Updated 12m ago" — the tier is an implementation detail, and the two
 * together read as metadata about the app rather than about the weather.
 *
 * Split out so the wording can be checked without rendering.
 */
export function describeFreshness(
  source: SlotForecast["source"],
  age: string | null,
): string | null {
  if (source === "cached") return age ? `Offline · saved ${age}` : "Offline";
  if (!age) return null;
  // A 2hr nowcast is minutes old; the 4-day/openMeteoDaily outlook is a
  // lower-confidence, longer-range reading. Saying which one you are looking at
  // matters more than its age.
  if (source === "4day" || source === "openMeteoDaily") return `Outlook · ${age}`;
  return `Updated ${age}`;
}
