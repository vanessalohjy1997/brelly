"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  derivePackingList,
  describeRoutine,
  findSlotById,
  getUpcomingForecast,
  resolveSlotProvider,
  retargetSlotDate,
  routineForSlot,
  routineUpdatesFromSlot,
  saveWithFeedback,
  suggestDryWindow,
  toDateKey,
  useCloudBootstrapError,
  useCloudReady,
  useItineraryStore,
  useRoutineStore,
  type NeaRegion,
} from "@brelly/core";

import { EmptyState } from "@/components/EmptyState";
import { FormPageHeader } from "@/components/FormPageHeader";
import { Icon } from "@/components/Icon";
import { Icons } from "@/components/icons";
import { CopyToDateAction } from "@/components/itinerary/CopyToDateAction";
import { SlotForm } from "@/components/itinerary/SlotForm";
import { Skeleton } from "@/components/Skeleton";
import { Text } from "@/components/Text";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useRoutineMaterializer } from "@/hooks/useRoutineMaterializer";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import { askEditScope } from "@/utils/askEditScope";

export default function EditPlanPage() {
  const router = useRouter();
  const id = String(useParams().id ?? "");
  // Select the (stable) plans array and do the lookup here — selecting the
  // result of a lookup instead returns a new object every render, which zustand
  // reads as an endless stream of store changes.
  const plans = useItineraryStore((state) => state.plans);
  const found = findSlotById(plans, id);
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const addSlot = useItineraryStore((state) => state.addSlot);
  const routines = useRoutineStore((state) => state.routines);
  const routine = routineForSlot(routines, found?.slot.routineId);
  const updateRoutine = useRoutineStore((state) => state.updateRoutine);
  const addException = useRoutineStore((state) => state.addException);
  const materializeRoutines = useRoutineMaterializer();
  const deleteWithUndo = useDeleteSlotWithUndo();
  // Declared above the `!ready`/`!found` bail-outs — an early return that
  // skipped hooks would change the hook order between the branches.
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = useUnsavedChangesGuard(dirty);
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();

  const { data: weather } = useWeatherForSlot({
    provider: resolveSlotProvider(found?.slot.provider),
    region: (found?.slot.neaRegion ?? "central") as NeaRegion,
    latitude: found?.slot.latitude ?? 0,
    longitude: found?.slot.longitude ?? 0,
    slotStartTime: found?.slot.startTime ?? "",
    enabled: !!found,
  });

  const packingItems =
    !weather || weather.source === "error" || weather.source === "unavailable"
      ? []
      : derivePackingList(weather.forecast);

  // An NEA-only concept — Open-Meteo has no equivalent "upcoming periods"
  // endpoint, and this feeds the dry-window suggestion below, which is an
  // explicit scope cut for overseas slots rather than a silent gap.
  const { data: upcomingPeriods } = useQuery({
    queryKey: ["upcoming-periods", found?.slot.neaRegion],
    queryFn: () => getUpcomingForecast(found!.slot.neaRegion, 24),
    staleTime: 1000 * 60 * 10,
    enabled: !!found && resolveSlotProvider(found.slot.provider) === "nea",
  });

  const dryWindow =
    found && upcomingPeriods
      ? suggestDryWindow(found.slot.startTime, upcomingPeriods)
      : null;

  if (!ready) {
    return (
      <Skeleton
        label="Loading your plan…"
        error={bootstrapError}
        onRetry={retryCloudBootstrap}
      />
    );
  }

  if (!found) {
    // A real 404 shape, because on the web this is a URL someone can arrive at
    // cold — a shared link to a stop that has since been deleted, or a
    // bookmark. The phone could only reach this screen by pushing onto it.
    return (
      <EmptyState
        icon={Icons.search}
        title="This plan no longer exists"
        body="It may have been deleted, or it belongs to a different account."
      />
    );
  }

  const { date, slot } = found;

  const handleDuplicate = (targetDate: Date) => {
    const targetDateString = toDateKey(targetDate);
    // The one action on this page that commits immediately, so it is also the
    // one that most needs to say it landed — nothing else on screen changes
    // when a copy is filed under another day.
    saveWithFeedback(
      () =>
        addSlot(targetDateString, {
          label: slot.label,
          location: slot.location,
          latitude: slot.latitude,
          longitude: slot.longitude,
          startTime: retargetSlotDate(slot.startTime, targetDateString),
          endTime: retargetSlotDate(slot.endTime, targetDateString),
          // Named rather than spread, so this literal has to be kept in step
          // with the slot shape by hand — the same stop on another day is still
          // indoors.
          kind: slot.kind,
        }),
      {
        success: `Copied to ${formatTargetDate(targetDate)}`,
        failure: "Couldn't copy that plan. Try again.",
      },
    );
  };

  // No confirmation. It used to `Alert` here while the row action on the lists
  // deleted outright, which put the friction on the deliberate path and left
  // the accidental one unprotected. Both now delete immediately and offer
  // "Undo" on the toast — and because the toast lives in the store rather than
  // in this page, the one raised here survives the navigation below and
  // finishes on the list, still undoable.
  //
  // `null` is the dismissed answer to a routine's scope prompt: nothing was
  // deleted, so the form stays open.
  const handleDelete = async () => {
    const removed = await deleteWithUndo(date, slot);
    if (removed?.ok) {
      setDirty(false);
      router.push("/plans");
    }
  };

  return (
    <>
      <FormPageHeader title="Edit plan" confirmDiscard={confirmDiscard} />
      <SlotForm
        submitLabel="Save changes"
        onDirtyChange={setDirty}
        // Offered as an edit to the time fields, not as a save of its own —
        // see the prop's note in `SlotForm`.
        dryWindow={
          dryWindow ? { start: dryWindow.suggestedPeriod.start } : undefined
        }
        initialValues={{
          label: slot.label,
          location: slot.location,
          latitude: slot.latitude,
          longitude: slot.longitude,
          countryCode: slot.countryCode,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notificationsMuted: slot.notificationsMuted,
          kind: slot.kind,
          notes: slot.notes,
        }}
        onSubmit={async (values) => {
          const movedToAnotherDay =
            toDateKey(new Date(values.startTime)) !== date;

          if (routine) {
            const scope = await askEditScope({
              title: `Save changes to ${slot.label}?`,
              message: movedToAnotherDay
                ? `${describeRoutine(routine)}. Moving this stop to another day can only apply to this one — the rest of the routine stays where it is.`
                : `${describeRoutine(routine)}.`,
              dayLabel: "This day only",
              // Withheld when the day changed: a routine has no single date, so
              // there is no rule-level reading of "this now happens on Thursday
              // instead".
              seriesLabel: movedToAnotherDay ? undefined : "This and future days",
            });
            if (!scope) return;

            if (scope === "series") {
              const saved = saveWithFeedback(
                () => updateRoutine(routine.id, routineUpdatesFromSlot(values)),
                {
                  success: `Updated ${values.label} and its repeats`,
                  failure: "Couldn't save your changes. Try again.",
                },
              );
              if (!saved.ok) return;
              // The stop on screen is rewritten by this too: the materialiser
              // sees it disagree with its own rule and replaces it, along with
              // every other day still ahead.
              materializeRoutines();
              setDirty(false);
              router.push("/plans");
              return;
            }

            // "This day only" cuts the stop loose. The exception is what stops
            // the next top-up from filling the day back in beside it.
            addException(routine.id, date);
          }

          const saved = saveWithFeedback(
            () =>
              updateSlot(date, slot.id, {
                ...values,
                // Cleared because the handle belongs to a phone's alert queue
                // and the stop it referred to has changed underneath it.
                notificationId: undefined,
                // Detached: an edited day is the user's, not the rule's, and
                // nothing may rewrite or sweep it afterwards.
                routineId: undefined,
              }),
            {
              success: `Updated ${values.label}`,
              failure: "Couldn't save your changes. Try again.",
            },
          );
          // Leaving on a failed save would look like it worked, and the edits
          // would be gone.
          if (!saved.ok || !saved.value) return;

          setDirty(false);
          router.push("/plans");
        }}
        onDelete={handleDelete}
      >
        {routine && (
          <Text variant="small" color="textSecondary">
            {describeRoutine(routine)}
          </Text>
        )}

        {packingItems.length > 0 && (
          <div className="flex flex-col gap-one">
            <Text variant="smallBold" as="h2">
              Pack for this stop
            </Text>
            <ul className="flex flex-col gap-one">
              {packingItems.map((item) => (
                <li key={item.item} className="flex items-center gap-two">
                  <Icon
                    name={Icons.success}
                    size="inline"
                    className="text-text-secondary"
                  />
                  <Text variant="smallBold">{item.item}</Text>
                  <Text variant="small" color="textSecondary">
                    {item.reason}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CopyToDateAction onDuplicate={handleDuplicate} />
      </SlotForm>
    </>
  );
}

/** "Sat, 2 Aug" — enough to recognise the day the copy landed on. */
function formatTargetDate(date: Date): string {
  return date.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
