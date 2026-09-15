import {
  describeUmbrella,
  formatPeriodLabel,
  formatTempRange,
  type UpcomingPeriodForecast,
} from "@brelly/core";

import { TEXT_COLOR } from "../colorClasses";
import { Surface } from "../Surface";
import { Text } from "../Text";
import { UmbrellaVerdictIcon } from "./UmbrellaVerdictIcon";
import { WeatherIcon } from "./WeatherIcon";

type Props = {
  forecasts: UpcomingPeriodForecast[];
  /**
   * Island-wide UV, the sun half of the verdict. Only the soonest period claims
   * it — a UV reading taken now says nothing about this evening.
   */
  uvIndex?: number | null;
};

/**
 * Weather nearby, the hero of the "no plans" empty state — the most useful
 * thing on screen when there is nothing planned. The soonest period gets the
 * large treatment; any later ones in the window are compact rows. Temperature
 * appears on the hero alone, because NEA reports one range for the whole day
 * and repeating it per period would be noise.
 */
export function NearbyForecastPreview({ forecasts, uvIndex }: Props) {
  if (forecasts.length === 0) return null;

  const [current, ...later] = forecasts;
  const verdict = describeUmbrella(current.forecast, uvIndex);
  const heroTint = verdict.themeColor
    ? TEXT_COLOR[verdict.themeColor]
    : TEXT_COLOR.text;

  return (
    <Surface as="section" className="flex flex-col gap-two p-three">
      <Text variant="eyebrow" color="textSecondary" as="h2">
        Nearby
      </Text>

      <div className="flex items-center gap-three">
        {verdict.reason === "none" ? (
          <WeatherIcon forecast={current.forecast} size="hero" />
        ) : (
          // One step up from `hero`: the umbrella-and-marks reads visually
          // lighter than a filled symbol at the same nominal size, so it needs
          // the bump to match — see the emphasis note in the theme.
          <UmbrellaVerdictIcon
            reason={verdict.reason}
            size="heroEmphasis"
            colorClass={heroTint}
            haloClass="bg-background-element"
            // Nothing beside it repeats the verdict here — the hero line is the
            // provider's wording, not the answer — so this icon has to speak.
            label={verdict.label}
          />
        )}
        <div className="flex min-w-0 flex-col gap-half">
          {/* The tint stays on the icon and never moves to this line: at 20px
              it would need 4.5:1, and `umbrellaSun` is 3.62:1 on this surface —
              fine for a graphic, short of it for text. */}
          <Text variant="subtitle" as="p">
            {current.forecast}
          </Text>
          <Text variant="small" color="textSecondary">
            {formatPeriodLabel(current.start)} ·{" "}
            {formatTempRange(current.temperature)}
          </Text>
        </div>
      </div>

      {later.length > 0 && (
        <div className="flex flex-col gap-two">
          {/* The `border` token, not a surface colour standing in for one.
              The phone faked this out of `backgroundSelected` back when
              `border` was an alias for it; both themes now give it a real
              hairline, measured to read the same weight in each. A CSS border
              rather than a filled box, so it is a hairline at every device
              pixel ratio rather than a rounded 2px bar. */}
          <div className="border-t border-border" />
          {later.map((period) => {
            // No UV here on purpose: the sun half of the verdict is a reading
            // taken now, which says nothing about a period later today.
            const wet =
              describeUmbrella(period.forecast, null).reason === "rain";
            return (
              <div
                key={period.start}
                className="flex items-center justify-between gap-two"
              >
                <Text variant="small" color="textSecondary">
                  {formatPeriodLabel(period.start)}
                </Text>
                <div className="flex min-w-0 items-center gap-one">
                  {wet ? (
                    // One step up from `control` — same visual-weight
                    // compensation as the hero pair above.
                    <UmbrellaVerdictIcon
                      reason="rain"
                      size="controlEmphasis"
                      colorClass={TEXT_COLOR.umbrellaRain}
                      haloClass="bg-background-element"
                      label="Umbrella — rain"
                    />
                  ) : (
                    <WeatherIcon forecast={period.forecast} size="control" />
                  )}
                  <Text variant="small" className="truncate font-medium">
                    {period.forecast}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
