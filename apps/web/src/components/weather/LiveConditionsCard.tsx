import {
  describeUmbrella,
  describeUv,
  formatRelativeTimestamp,
  formatWindSpeedKnots,
  type LiveConditions,
} from "@brelly/core";

import type { UvIndex } from "@/hooks/useUvIndex";
import { TEXT_COLOR } from "../colorClasses";
import { Surface } from "../Surface";
import { Text } from "../Text";
import { UmbrellaVerdictIcon } from "./UmbrellaVerdictIcon";
import { WeatherIcon } from "./WeatherIcon";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 19;

type Props = {
  conditions: LiveConditions | null | undefined;
  uvIndex: UvIndex | undefined;
};

/**
 * What sensors are measuring right now, as opposed to what is forecast — the
 * difference between "showers expected this afternoon" and "it is raining on
 * you". Renders nothing at all when no reading came back, rather than a card
 * full of dashes.
 */
export function LiveConditionsCard({ conditions, uvIndex }: Props) {
  const readings = buildReadings(conditions, uvIndex);
  if (readings.length === 0) return null;

  const observedAgo = formatRelativeTimestamp(conditions?.observedAt);
  const liveForecast = deriveLiveForecastText(conditions);

  // Same umbrella question the plan cards answer, asked of the live reading
  // instead of a forecast.
  const verdict = describeUmbrella(liveForecast ?? undefined, uvIndex?.value);
  const accent = verdict.themeColor
    ? TEXT_COLOR[verdict.themeColor]
    : TEXT_COLOR.text;

  return (
    <Surface
      as="section"
      // Clips the watermark's bleed to the card's own rounded corner instead of
      // letting it poke past.
      className="relative overflow-hidden p-three"
    >
      {verdict.reason !== "none" && (
        <div
          // Decorative on the card, but nothing else here spells the verdict
          // out as a sentence, so the icon carries it.
          className="pointer-events-none absolute -bottom-four right-two opacity-[var(--brelly-opacity-watermark)]"
        >
          <UmbrellaVerdictIcon
            reason={verdict.reason}
            size="watermark"
            colorClass={accent}
            label={verdict.label}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-two">
        <div className="flex items-center gap-one">
          {liveForecast && (
            <WeatherIcon
              forecast={liveForecast}
              size="control"
              className="text-text-secondary"
            />
          )}
          <Text variant="eyebrow" color="textSecondary" as="h2">
            Right now
          </Text>
        </div>
        {conditions?.stationName && (
          <Text variant="eyebrow" color="textSecondary" className="truncate normal-case">
            {conditions.stationName}
            {observedAgo ? ` · ${observedAgo}` : ""}
          </Text>
        )}
      </div>

      <dl className="mt-two flex flex-wrap gap-three">
        {readings.map((reading) => (
          <div key={reading.label} className="flex flex-col gap-half">
            {/* Value over label, and the value is the `<dd>`: a definition list
                is the honest markup for a row of name/number pairs, and it is
                what lets a screen reader pair them rather than reading five
                numbers followed by five words. */}
            <dd className="order-1 truncate text-default">{reading.value}</dd>
            <dt className="order-2 text-eyebrow text-text-secondary">
              {reading.label}
            </dt>
          </div>
        ))}
      </dl>
    </Surface>
  );
}

/**
 * A live rain reading is the one signal this card has that a forecast does not
 * — sensor rainfall now beats a forecast's "chance of showers". Reused as
 * `WeatherIcon`'s `forecast` prop, so the string has to stay in that vocabulary
 * (`forecastToSymbol` matches on "rain"/"fair"/"(night)"). Returns null rather
 * than guessing when there is no rainfall reading at all.
 */
export function deriveLiveForecastText(
  conditions: LiveConditions | null | undefined,
  now: Date = new Date(),
): string | null {
  if (conditions?.rainfallMm === undefined) return null;
  if (conditions.rainfallMm > 0) return "Rain";

  const hour = now.getHours();
  const isDaytime = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
  return isDaytime ? "Fair (Day)" : "Fair (Night)";
}

type Reading = { label: string; value: string };

/**
 * Split out so the "which readings are worth showing" decision — the part with
 * actual rules in it — can be checked without rendering.
 */
export function buildReadings(
  conditions: LiveConditions | null | undefined,
  uvIndex: UvIndex | undefined,
): Reading[] {
  const readings: Reading[] = [];

  if (conditions?.rainfallMm !== undefined) {
    readings.push({
      label: "Rain",
      // The sensor reports a 5-minute accumulation, so a bare "0 mm" is noise
      // where "None" is an answer.
      value: conditions.rainfallMm > 0 ? `${conditions.rainfallMm} mm` : "None",
    });
  }
  if (conditions?.temperatureC !== undefined) {
    readings.push({
      label: "Temp",
      value: `${Math.round(conditions.temperatureC)}°C`,
    });
  }
  if (conditions?.humidityPercent !== undefined) {
    readings.push({
      label: "Humidity",
      value: `${Math.round(conditions.humidityPercent)}%`,
    });
  }

  const wind = formatWindSpeedKnots(conditions?.windSpeedKn);
  if (wind) readings.push({ label: "Wind", value: wind });

  // The five-band WHO scale is a readout, not a verdict — the umbrella decision
  // on a stop card is binary. Colour never carries the band on its own: the
  // label rides alongside, because the WHO palette runs green→red, the axis
  // red-green colour blindness collapses.
  if (uvIndex?.value != null) {
    readings.push({
      label: `UV ${uvIndex.value}`,
      value: describeUv(uvIndex.value).label,
    });
  }

  return readings;
}
