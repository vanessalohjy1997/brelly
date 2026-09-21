"use client";

import Link from "next/link";

import {
  findCurrentOrNextSlot,
  findPlanByDate,
  sortSlotsByStart,
  splitPlansByTime,
  todayKey,
  useCloudBootstrapError,
  useCloudReady,
  useItineraryStore,
} from "@brelly/core";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Icons } from "@/components/icons";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { LiveConditionsCard } from "@/components/weather/LiveConditionsCard";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import { NearbyWeatherPrompt } from "@/components/weather/NearbyWeatherPrompt";
import { useAlertsReachPhone } from "@/hooks/useAlertsReachPhone";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useLiveConditions } from "@/hooks/useLiveConditions";
import { useMuteSlotWithUndo } from "@/hooks/useMuteSlotWithUndo";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useUvIndex } from "@/hooks/useUvIndex";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { useDeviceLocationStore } from "@/store/deviceLocationStore";

/**
 * Today: what is still ahead of you, and what the sky is doing where you are.
 *
 * Two things the phone's version has are deliberately absent.
 *
 * The **onboarding primer** does not port, and not only because one of its two
 * steps asks for notifications. It sets `hasSeenOnboarding` — a *cloud* flag —
 * after the notification step, and that flag suppresses the phone's own
 * location primer. A new web user would otherwise silently turn off the copy
 * App Review litigated on iOS. So web neither shows the primer nor writes the
 * flag; `NearbyWeatherPrompt` already explains before asking, which was the
 * primer's real job.
 *
 * The **update banner** goes with OTA, which does not exist here: a browser
 * reloads.
 */
export default function TodayPage() {
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  // Subscribing to `plans` (not to a getter, whose identity never changes) is
  // what makes this page re-render when a plan is added or edited.
  const plans = useItineraryStore((state) => state.plans);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const toggleMuteWithUndo = useMuteSlotWithUndo();
  // Mute is offered only where it can do something: the web sends no alerts,
  // so until a phone reads the same account the control would be a toggle on
  // nothing. The switch on the form stays, with copy that says as much.
  const alertsReachPhone = useAlertsReachPhone();
  const requestLocation = useDeviceLocationStore((state) => state.request);

  const now = new Date();
  const todaysDate = todayKey(now);
  // Today, but only the part of it that has not happened yet. A stop drops off
  // this list the minute it ends and turns up in History — the page is for what
  // is ahead, and a finished stop's forecast is no longer a question.
  const { upcoming, past } = splitPlansByTime(plans, now);
  const todaysPlan = findPlanByDate(upcoming, todaysDate);
  const hasSlotsToday = !!todaysPlan;
  // Told apart from "nothing planned": a day whose stops have all finished is a
  // different situation from an empty one, and saying so is what stops the
  // archive from looking like data loss.
  const dayIsDone = !hasSlotsToday && !!findPlanByDate(past, todaysDate);

  // Location stays on whether or not there are plans — "Right now" means
  // *here*, so the live card is anchored to the device the whole time. The
  // forecast preview is only fetched in the empty state.
  const {
    isAvailable: hasWeatherNearby,
    forecasts: nearbyForecasts,
    coords: nearbyCoords,
    permission: locationPermission,
  } = useNearbyForecast(true, { fetchForecast: !hasSlotsToday });

  // `focusSlot` earns its keep separately from the live card: it draws the
  // emphasis outline on the current/next stop ("where am I headed"), which is a
  // different question from "what is it doing on me now". Each stop's own
  // forecast already lives on its card; the live card must not borrow a stop's
  // coordinates and label them as here.
  const focusSlot = todaysPlan
    ? findCurrentOrNextSlot(todaysPlan.slots, now)
    : undefined;

  const { data: liveConditions } = useLiveConditions(
    nearbyCoords?.latitude ?? null,
    nearbyCoords?.longitude ?? null,
  );
  // No region, no permission gate — NEA publishes one island-wide UV figure, so
  // this resolves even with no plans and no location.
  const { data: uvIndex } = useUvIndex();
  const { isRefreshing, refresh } = useWeatherRefresh();

  const today = now.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={today}
        actions={
          <>
            {/* Pull-to-refresh has no honest web equivalent — a page that
                hijacks the overscroll gesture fights the browser's own
                pull-to-reload — so the gesture becomes a control. An icon
                rather than a labelled button: the forecasts refresh on their
                own, so this is a secondary action and should not sit at the
                same weight as Add. */}
            <Button
              tone="quiet"
              label={isRefreshing ? "Refreshing…" : "Refresh"}
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              <Icon
                name={Icons.refresh}
                size="control"
                className={isRefreshing ? "motion-safe:animate-spin" : undefined}
              />
            </Button>
            <Link
              href="/plan/new"
              className="inline-flex min-h-[var(--brelly-hit-target)] items-center rounded-control bg-primary px-three text-small-bold text-on-primary"
            >
              + Add
            </Link>
          </>
        }
      />

      {!ready ? (
        <Skeleton
          label="Loading your plans…"
          error={bootstrapError}
          onRetry={retryCloudBootstrap}
        />
      ) : !hasSlotsToday ? (
        <div className="flex flex-col gap-three">
          {hasWeatherNearby ? (
            <>
              <NearbyForecastPreview
                forecasts={nearbyForecasts}
                uvIndex={uvIndex?.value}
              />
              <LiveConditionsCard conditions={liveConditions} uvIndex={uvIndex} />
            </>
          ) : (
            <>
              <NearbyWeatherPrompt
                permission={locationPermission}
                onRequest={() => void requestLocation()}
              />
              {/* UV needs no location, so it stands on its own here. */}
              <LiveConditionsCard conditions={null} uvIndex={uvIndex} />
            </>
          )}
          <EmptyState
            // Without a forecast card above, the empty state needs its own
            // visual anchor; with one, this icon is just repetition.
            icon={hasWeatherNearby ? undefined : Icons.partlyCloudy}
            title={dayIsDone ? "Nothing left today" : "No plans yet"}
            body={
              dayIsDone
                ? "Every stop today has finished. You'll find them in History."
                : "Add a stop and Brelly will show the weather for it."
            }
            action={
              <Link
                href="/plan/new"
                className="mt-two inline-flex min-h-[var(--brelly-hit-target)] items-center rounded-control bg-primary px-four text-small-bold text-on-primary"
              >
                + Add a plan
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-three">
          {/* "Right now" is the weather where you are, so it needs the same
              grant the empty state asks for. When it is not held, offer the
              prompt rather than silently borrowing a stop's coordinates — the
              current stop's own forecast is on its card already. UV is
              island-wide, so it shows regardless. */}
          {hasWeatherNearby ? (
            <LiveConditionsCard conditions={liveConditions} uvIndex={uvIndex} />
          ) : (
            <>
              <NearbyWeatherPrompt
                permission={locationPermission}
                onRequest={() => void requestLocation()}
              />
              <LiveConditionsCard conditions={null} uvIndex={uvIndex} />
            </>
          )}
          {/* Start time first, always — a day is read as a timeline, and the
              drag-to-reorder this replaces produced an order that contradicted
              the clock and the Plans page both. */}
          <ul className="flex flex-col gap-three">
            {sortSlotsByStart(todaysPlan.slots).map((slot) => (
              <li key={slot.id}>
                <ItineraryCard
                  slot={slot}
                  // The same stop the live readings above are anchored to, so
                  // the outlined card and the "Right now" figures are talking
                  // about one place rather than two.
                  emphasis={slot.id === focusSlot?.id}
                  onDelete={() => void deleteWithUndo(todaysPlan.date, slot)}
                  onToggleMute={
                    alertsReachPhone
                      ? () => void toggleMuteWithUndo(todaysPlan.date, slot)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
