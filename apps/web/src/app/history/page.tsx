"use client";

import { useState } from "react";

import {
  countSlots,
  filterPlans,
  formatPlanDate,
  showToast,
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
import {
  PlanSearchField,
  SearchThreshold,
} from "@/components/itinerary/PlanSearchField";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { Text } from "@/components/Text";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { askDialog } from "@/store/dialogStore";

const PRUNE_AFTER_DAYS = 30;

/**
 * Where a stop goes once it is over.
 *
 * Nothing is deleted when a plan passes — it moves here, and Plans is left
 * showing only what is still ahead. The two lists are the two halves of one
 * `splitPlansByTime` call, so a stop is in exactly one of them and the boundary
 * cannot drift between the pages.
 *
 * A page of its own, not a control buried in Plans: this is one of the three
 * things the app is for, not a place you have to know exists.
 */
export default function HistoryPage() {
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  const plans = useItineraryStore((state) => state.plans);
  const deletePlan = useItineraryStore((state) => state.deletePlan);
  const deleteWithUndo = useDeleteSlotWithUndo();
  const [query, setQuery] = useState("");

  const today = todayKey();
  const { past } = splitPlansByTime(plans, new Date());

  const matching = filterPlans(past, query);
  const sections = matching.map((plan) => ({
    title: formatPlanDate(plan.date, today),
    date: plan.date,
    slots: plan.slots,
  }));

  const hasPast = past.length > 0;
  // This is the list that grows without bound — nothing is ever deleted from it
  // — so it is the one that most needs a way in other than scrolling.
  const showSearch = countSlots(past) >= SearchThreshold || query.length > 0;

  const handlePrune = async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PRUNE_AFTER_DAYS);
    const cutoff = todayKey(cutoffDate);
    const toPrune = past.filter((plan) => plan.date < cutoff);

    if (toPrune.length === 0) {
      showToast(`Nothing older than ${PRUNE_AFTER_DAYS} days`, "success");
      return;
    }

    // The one delete in the app with no undo behind it, so it is the one that
    // asks first. Every other delete is reversible for as long as its toast is
    // up, which is both faster than a dialog and safer — it covers the
    // accidental press too. This one cannot be: it removes whole days at once.
    const answer = await askDialog({
      title: "Clear old plans?",
      message: `Delete ${toPrune.length} day${toPrune.length === 1 ? "" : "s"} older than ${PRUNE_AFTER_DAYS} days. This cannot be undone.`,
      dismissKey: "cancel",
      actions: [
        { key: "delete", label: "Delete", tone: "destructive" },
        { key: "cancel", label: "Cancel", tone: "cancel" },
      ],
    });
    if (answer !== "delete") return;

    for (const plan of toPrune) deletePlan(plan.date);
    showToast(
      `Cleared ${toPrune.length} old day${toPrune.length === 1 ? "" : "s"}`,
      "success",
    );
  };

  return (
    <>
      <PageHeader title="History" />

      {hasPast && (
        <div className="flex items-center gap-two pb-two">
          {showSearch && (
            <div className="flex-1">
              <PlanSearchField
                value={query}
                onChange={setQuery}
                placeholder="Search past plans"
              />
            </div>
          )}
          <Button
            tone="quiet"
            onClick={() => void handlePrune()}
            className="ml-auto"
          >
            <Icon name={Icons.clearOlder} size="inline" />
            Clear older
          </Button>
        </div>
      )}

      {!ready ? (
        <Skeleton
          label="Loading your history…"
          error={bootstrapError}
          onRetry={retryCloudBootstrap}
        />
      ) : !hasPast ? (
        <EmptyState
          icon={Icons.history}
          title="Nothing here yet"
          body="Stops move here once they have finished, so nothing you plan is ever lost."
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={Icons.search}
          title="No matches"
          body={`Nothing here matches “${query.trim()}”.`}
        />
      ) : (
        <div className="flex flex-col gap-three">
          {sections.map((section) => (
            <section key={section.date}>
              <Text variant="smallBold" as="h2" className="block pt-three pb-two">
                {section.title}
              </Text>
              <ul className="flex flex-col gap-one">
                {section.slots.map((slot) => (
                  <li key={slot.id}>
                    <ItineraryCard
                      slot={slot}
                      past
                      onDelete={() => void deleteWithUndo(section.date, slot)}
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
