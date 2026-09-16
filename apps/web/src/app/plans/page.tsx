"use client";

import Link from "next/link";
import { useState } from "react";

import {
  countSlots,
  detectScheduleConflicts,
  filterPlans,
  formatPlanDate,
  sortSlotsByStart,
  splitPlansByTime,
  todayKey,
  useCloudBootstrapError,
  useCloudReady,
  useItineraryStore,
} from "@brelly/core";

import { Button, buttonClassName } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Icons } from "@/components/icons";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import {
  PlanSearchField,
  SearchThreshold,
} from "@/components/itinerary/PlanSearchField";
import { WeekStrip } from "@/components/itinerary/WeekStrip";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { Text } from "@/components/Text";
import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import { NearbyWeatherPrompt } from "@/components/weather/NearbyWeatherPrompt";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useMuteSlotWithUndo } from "@/hooks/useMuteSlotWithUndo";
import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";

/**
 * `/plan/new`, pre-dated. The parameter has been wired up since the form was
 * written and nothing ever passed it, so adding to next Saturday meant opening
 * the form and hand-scrolling a picker to a day already named on the screen.
 */
const addOn = (date: string) => `/plan/new?date=${date}`;

export default function PlansPage() {
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  const plans = useItineraryStore((state) => state.plans);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const toggleMuteWithUndo = useMuteSlotWithUndo();
  const { isRefreshing, refresh } = useWeatherRefresh();
  const [query, setQuery] = useState("");

  const today = todayKey();
  // Only what is still ahead renders here. Finished stops are not deleted —
  // they move to History, so this list stops growing forever and reads as
  // "what's coming".
  const { upcoming, past } = splitPlansByTime(plans, new Date());

  const matching = filterPlans(upcoming, query);
  const sections = matching.map((plan) => ({
    title: formatPlanDate(plan.date, today),
    date: plan.date,
    // Chronological, like everywhere else. Installs predating the removal of
    // drag-to-reorder still have a hand-dragged order persisted.
    slots: sortSlotsByStart(plan.slots),
  }));

  // Computed straight through rather than memoised, unlike the phone's
  // version. `splitPlansByTime` builds `upcoming` fresh on every render, so a
  // `useMemo` keyed on it never hits — it only looks like it does. The work
  // itself is a pairwise scan over a fortnight of stops.
  const conflicts = detectScheduleConflicts(upcoming.flatMap((p) => p.slots));

  const hasUpcoming = upcoming.length > 0;
  const hasPast = past.length > 0;
  // The field earns its space once the list is past a screen or two — and then
  // stays while a query is live, so narrowing the list to two results cannot
  // pull out from under the control that narrowed it.
  const showSearch = countSlots(upcoming) >= SearchThreshold || query.length > 0;
  const hasMatches = sections.length > 0;

  const {
    isAvailable: hasWeatherNearby,
    forecasts: nearbyForecasts,
    permission: locationPermission,
    requestPermission: requestLocation,
  } = useNearbyForecast(!hasUpcoming);

  return (
    <>
      <PageHeader
        title="Plans"
        actions={
          <>
            <Link
              href="/routines"
              aria-label="Routines"
              className={buttonClassName("quiet")}
            >
              <Icon name={Icons.repeat} size="control" />
            </Link>
            <Button
              tone="quiet"
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              <Icon name={Icons.refresh} size="inline" />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Link href="/plan/new" className={buttonClassName("primary")}>
              <Text variant="smallBold" color="onPrimary">
                + Add
              </Text>
            </Link>
          </>
        }
      />

      {hasUpcoming && showSearch && (
        <div className="pb-two">
          <PlanSearchField
            value={query}
            onChange={setQuery}
            placeholder="Search plans"
          />
        </div>
      )}

      {!ready ? (
        <Skeleton
          label="Loading your plans…"
          error={bootstrapError}
          onRetry={retryCloudBootstrap}
        />
      ) : !hasUpcoming ? (
        <div className="flex flex-col gap-three">
          {hasWeatherNearby ? (
            <NearbyForecastPreview forecasts={nearbyForecasts} />
          ) : (
            <NearbyWeatherPrompt
              permission={locationPermission}
              onRequest={() => void requestLocation()}
            />
          )}
          <EmptyState
            icon={hasWeatherNearby ? undefined : Icons.plans}
            // "Nothing planned" would be untrue for someone whose plans have
            // all simply happened — they are in History, one click away.
            title={hasPast ? "Nothing upcoming" : "Nothing planned"}
            body={
              hasPast
                ? "Everything you planned has been and gone. Add another, or look back through History."
                : "Add a plan for today or a future day to see it here."
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
      ) : !hasMatches ? (
        // Distinct from the empty states above on purpose: the user has plans,
        // they just are not these. Saying "Nothing planned" here would read as
        // data loss for the length of a mistyped query.
        <EmptyState
          icon={Icons.search}
          title="No matches"
          body={`Nothing upcoming matches “${query.trim()}”. Finished stops are in History.`}
          action={
            <Button className="mt-two" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-three">
          <WeekStrip plans={upcoming} renderHref={addOn} />

          {conflicts.map((conflict, index) => (
            <div
              key={`conflict-${index}`}
              // `alert` rather than a plain box: a scheduling clash is
              // information the reader did not ask for and needs before acting
              // on the list underneath it.
              role="alert"
              className="flex items-center gap-two rounded-control border border-umbrella-sun p-two"
            >
              <Icon
                name={Icons.warning}
                size="inline"
                className="text-umbrella-sun"
              />
              <Text variant="small">{conflict.detail}</Text>
            </div>
          ))}

          {sections.map((section) => (
            <section key={section.date}>
              <div className="flex items-center justify-between pt-three pb-two">
                <Text variant="smallBold" as="h2">
                  {section.title}
                </Text>
                <Link
                  href={addOn(section.date)}
                  aria-label={`Add a plan on ${section.title}`}
                  className="inline-flex min-h-[var(--brelly-hit-target)] items-center rounded-control px-two text-text-secondary"
                >
                  <Icon name={Icons.add} size="inline" />
                </Link>
              </div>
              {/* Plain mapped elements rather than a virtualised list. At
                  Brelly's sizes — a fortnight of stops — a windowing library
                  costs more in complexity and in broken find-in-page than it
                  saves in frames. */}
              <ul className="flex flex-col gap-one">
                {section.slots.map((slot) => (
                  <li key={slot.id}>
                    <ItineraryCard
                      slot={slot}
                      onDelete={() => void deleteWithUndo(section.date, slot)}
                      onToggleMute={() =>
                        void toggleMuteWithUndo(section.date, slot)
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
