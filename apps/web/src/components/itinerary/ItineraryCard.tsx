"use client";

import Link from "next/link";

import {
  describeSlotTiming,
  describeUmbrella,
  resolveSlotKind,
  resolveSlotProvider,
  type ItinerarySlot,
} from "@brelly/core";

import { useUvIndex } from "@/hooks/useUvIndex";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import { TEXT_COLOR, BG_COLOR } from "../colorClasses";
import { Icon } from "../Icon";
import { Icons } from "../icons";
import { Text } from "../Text";
import { UmbrellaVerdictIcon } from "../weather/UmbrellaVerdictIcon";
import { ForecastTimestamp, WeatherBadge } from "../weather/WeatherBadge";

type Props = {
  slot: ItinerarySlot;
  onDelete: () => void;
  /**
   * Turns this stop's rain alert off, or back on. Omitted on the archive, where
   * there is no future alert left to mute.
   */
  onToggleMute?: () => void;
  /**
   * The stop has already ended — set on the archive. It drops everything about
   * the weather: the request, the badge, the watermark and the accent bar.
   * There is no forecast for a time that has passed, and a column of "No
   * forecast" would say nothing eight times over.
   *
   * Deliberately *not* a dimmed variant. Every card in the archive is past, so
   * dimming separates it from nothing and only costs contrast.
   */
  past?: boolean;
  /**
   * This is the stop the screen was opened for — the one happening now, or
   * failing that the next to start. Only Today sets it, and only on one card:
   * it answers "where am I supposed to be", and an answer given on every row is
   * not an answer.
   */
  emphasis?: boolean;
};

/**
 * One stop.
 *
 * The biggest single departure from the phone is the row actions. There they
 * are behind a left swipe (`ReanimatedSwipeable`), with an
 * `accessibilityActions` list mirroring them for VoiceOver's rotor. A swipe has
 * no keyboard equivalent and no pointer equivalent, and hover-reveal is
 * unreachable by both — so here the actions are **always present**: two small
 * buttons in the card's own corner, in the same order the panel put them
 * (mute first, delete last, so the destructive one is not the first thing
 * reached).
 *
 * That has a consequence worth stating: the card cannot be one big link with
 * buttons inside it, because a `<button>` nested in an `<a>` is invalid and
 * behaves differently in every browser. So the *title* is the link and the card
 * is its surface — which is also the better document shape, since it gives the
 * link a name instead of making the whole card one enormous anonymous target.
 */
export function ItineraryCard({
  slot,
  onDelete,
  onToggleMute,
  past = false,
  emphasis = false,
}: Props) {
  const muted = !!slot.notificationsMuted;
  // Nothing on an archived card can be muted, and a screen that offers no
  // handler gets no button either.
  const toggleMute = past ? undefined : onToggleMute;

  const {
    data: weather,
    isLoading,
    refetch,
  } = useWeatherForSlot({
    provider: resolveSlotProvider(slot.provider),
    region: slot.neaRegion,
    latitude: slot.latitude,
    longitude: slot.longitude,
    slotStartTime: slot.startTime,
    enabled: !past,
  });
  // Island-wide and cached for an hour, so every card on screen shares one
  // request. An Open-Meteo slot carries its own UV inline instead, since NEA's
  // figure is Singapore-only and meaningless overseas.
  const { data: uv } = useUvIndex();
  const uvIndex = weather?.uvIndex ?? uv?.value;

  const startTime = formatTime(slot.startTime);
  const endTime = formatTime(slot.endTime);

  // "in 40 min" ahead of "02:00 PM – 03:00 PM": the clock answers *when* and
  // leaves *how soon* to the reader, which on Today is the only question.
  // Nothing re-renders on a timer — the countdown is recomputed whenever the
  // page renders, which covers every way back onto it, and a per-card ticker
  // would wake the whole list once a minute to move a number no one is
  // watching.
  const timing = past
    ? { relative: null, isNow: false }
    : describeSlotTiming(slot.startTime, slot.endTime, new Date());

  // The watermark and the bar on the card's edge are the two things readable
  // while scrolling a day at speed, and both carry this. A placeholder forecast
  // ("error", "unavailable") is not a verdict, so it earns neither.
  const hasForecast =
    !past &&
    !!weather &&
    weather.source !== "error" &&
    weather.source !== "unavailable";
  const verdict = hasForecast
    ? describeUmbrella(weather.forecast, uvIndex)
    : null;

  return (
    <article
      className={`relative flex overflow-hidden rounded-control bg-background-element ${
        emphasis ? "border border-primary" : ""
      }`}
    >
      {verdict?.themeColor && (
        <div
          aria-hidden="true"
          className={`w-one shrink-0 self-stretch ${BG_COLOR[verdict.themeColor]}`}
        />
      )}

      {/* The verdict as a picture before it is a sentence: a large, faint
          umbrella-and-marks bleeding off the card's own rounded corner, clipped
          by the card's `overflow-hidden`. A clear stop, or no forecast at all,
          gets no watermark. */}
      {verdict && verdict.reason !== "none" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-four right-two opacity-[var(--brelly-opacity-watermark)]"
        >
          <UmbrellaVerdictIcon
            reason={verdict.reason}
            size="watermark"
            colorClass={
              verdict.themeColor ? TEXT_COLOR[verdict.themeColor] : TEXT_COLOR.text
            }
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-half p-two pl-three">
        <div className="flex items-center justify-between gap-two">
          <div className="flex min-w-0 shrink items-center gap-one">
            {timing.relative && (
              <Text
                variant="small"
                // "Now" is the only one of these that is a state rather than a
                // countdown, so it takes the accent the emphasised card is
                // already outlined in.
                color={timing.isNow ? "primary" : "text"}
                className="font-bold"
              >
                {timing.relative}
              </Text>
            )}
            <Text variant="small" color="textSecondary" className="truncate">
              {startTime} – {endTime}
            </Text>
            {/* Only indoor is marked. Outdoor is the default and most of the
                list, so a glyph on every row would carry no information. */}
            {resolveSlotKind(slot.kind) === "indoor" && (
              <Icon name={Icons.indoor} size="metadata" label="Indoor stop" />
            )}
            {/* Otherwise the only way to find which stops are muted is to open
                every one of them. */}
            {muted && (
              <Icon
                name={Icons.alertsOff}
                size="metadata"
                label="Rain alerts off for this stop"
              />
            )}
            {/* Says the stop came from a routine, which is what makes the scope
                prompt expected rather than a surprise. */}
            {slot.routineId && (
              <Icon name={Icons.repeat} size="metadata" label="Repeating stop" />
            )}
          </div>

          {!past && <ForecastTimestamp weather={weather} />}
        </div>

        <div className="flex items-start justify-between gap-four">
          <div className="flex min-w-0 flex-1 flex-col gap-half">
            <Text as="h3" variant="default" className="truncate font-semibold">
              <Link href={`/plan/${slot.id}`} className="hover:underline">
                {slot.label}
              </Link>
            </Text>
            <Text variant="small" color="textSecondary" className="line-clamp-2">
              {slot.location}
            </Text>
          </div>

          {!past && (
            // Sized to content and capped rather than left to grow — otherwise
            // a long forecast word ("Thundery Showers") claims width from the
            // label column instead of truncating in its own.
            <div className="min-w-0 max-w-[40%] shrink">
              <WeatherBadge
                weather={weather}
                isLoading={isLoading}
                uvIndex={uvIndex}
                onRetry={() => void refetch()}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-one">
          {toggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              // Opens with the visible word. A name that does not contain the
              // label on the control is a Voice Control dead end — "click Mute"
              // matches nothing.
              aria-label={
                muted
                  ? `Unmute — turn rain alerts on for ${slot.label}`
                  : `Mute — turn rain alerts off for ${slot.label}`
              }
              className="flex min-h-[var(--brelly-hit-target)] items-center gap-one rounded-control px-two text-text-secondary"
            >
              <Icon name={muted ? Icons.alerts : Icons.alertsOff} size="inline" />
              <Text variant="eyebrow" color="inherit">
                {muted ? "Unmute" : "Mute"}
              </Text>
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${slot.label}`}
            className="flex min-h-[var(--brelly-hit-target)] items-center gap-one rounded-control px-two text-danger"
          >
            <Icon name={Icons.delete} size="inline" />
            <Text variant="eyebrow" color="inherit">
              Delete
            </Text>
          </button>
        </div>
      </div>
    </article>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
