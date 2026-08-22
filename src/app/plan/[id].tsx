import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { HeaderDismissButton } from "@/components/headerDismissButton";
import { CopyToDateAction } from "@/components/itinerary/CopyToDateAction";
import { SlotForm } from "@/components/itinerary/SlotForm";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { ToastHost } from "@/components/toast";
import { IconSize, Spacing } from "@/constants/theme";
import { useDeleteSlotWithUndo } from "@/hooks/useDeleteSlotWithUndo";
import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { useRoutineMaterializer } from "@/hooks/useRoutineMaterializer";
import { useTheme } from "@/hooks/useTheme";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWeatherForSlot } from "@/hooks/useWeatherForSlot";
import { cancelNotification } from "@/services/notifications";
import { getUpcomingForecast } from "@/services/weather";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useCloudBootstrapError, useCloudReady } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { askEditScope } from "@/utils/askEditScope";
import { toDateKey } from "@/utils/dateKeys";
import { derivePackingList } from "@/utils/derivePackingList";
import { describeRoutine } from "@/utils/describeRoutine";
import { formatPeriodLabel } from "@/utils/formatPeriodLabel";
import { findSlotById } from "@/utils/planSelectors";
import { retargetSlotDate } from "@/utils/retargetSlotDate";
import { routineUpdatesFromSlot } from "@/utils/routineOccurrences";
import { routineForSlot } from "@/utils/routineSelectors";
import { saveWithFeedback } from "@/utils/saveWithFeedback";
import { suggestDryWindow } from "@/utils/suggestDryWindow";
import { resolveSlotProvider } from "@/utils/weatherProvider";

export default function EditSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Select the (stable) plans array and do the lookup here — selecting the
  // result of a lookup instead returns a new object every render, which
  // zustand reads as an endless stream of store changes.
  const plans = useItineraryStore((state) => state.plans);
  const found = useMemo(() => findSlotById(plans, id), [plans, id]);
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const addSlot = useItineraryStore((state) => state.addSlot);
  const routines = useRoutineStore((state) => state.routines);
  const routine = routineForSlot(routines, found?.slot.routineId);
  const updateRoutine = useRoutineStore((state) => state.updateRoutine);
  const deleteRoutine = useRoutineStore((state) => state.deleteRoutine);
  const addException = useRoutineStore((state) => state.addException);
  const materializeRoutines = useRoutineMaterializer();
  const scheduleRainNotificationForSlot = useRainNotificationScheduler();
  const deleteWithUndo = useDeleteSlotWithUndo();
  // Declared above the `!ready`/`!found` bail-outs — an early return that
  // skips hooks would change the hook order between the branches.
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = useUnsavedChangesGuard(dirty);
  const theme = useTheme();
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();

  const { data: weather } = useWeatherForSlot({
    provider: resolveSlotProvider(found?.slot.provider),
    region: found?.slot.neaRegion ?? ("" as any),
    latitude: found?.slot.latitude ?? 0,
    longitude: found?.slot.longitude ?? 0,
    slotStartTime: found?.slot.startTime ?? "",
    enabled: !!found,
  });

  const packingItems = useMemo(() => {
    if (
      !weather ||
      weather.source === "error" ||
      weather.source === "unavailable"
    )
      return [];
    return derivePackingList(weather.forecast);
  }, [weather]);

  // NEA-only concept — Open-Meteo has no equivalent "upcoming periods"
  // endpoint, and this feeds the dry-window suggestion below, which is an
  // explicit v1 scope cut for overseas slots rather than a silent gap.
  const { data: upcomingPeriods } = useQuery({
    queryKey: ["upcoming-periods", found?.slot.neaRegion],
    queryFn: () => getUpcomingForecast(found!.slot.neaRegion, 24),
    staleTime: 1000 * 60 * 10,
    enabled: !!found && resolveSlotProvider(found.slot.provider) === "nea",
  });

  const dryWindow = useMemo(() => {
    if (!found || !upcomingPeriods) return null;
    return suggestDryWindow(found.slot.startTime, upcomingPeriods);
  }, [found, upcomingPeriods]);

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
    return (
      <ThemedView style={styles.missing}>
        <ThemedText>This plan no longer exists.</ThemedText>
      </ThemedView>
    );
  }

  const { date, slot } = found;

  const handleDuplicate = (targetDate: Date) => {
    const targetDateString = toDateKey(targetDate);
    // This is the one action on the form that commits immediately, so it's
    // also the one that most needs to say it landed — nothing else on screen
    // changes when a copy is filed under another day.
    const saved = saveWithFeedback(
      () =>
        addSlot(targetDateString, {
          label: slot.label,
          location: slot.location,
          latitude: slot.latitude,
          longitude: slot.longitude,
          startTime: retargetSlotDate(slot.startTime, targetDateString),
          endTime: retargetSlotDate(slot.endTime, targetDateString),
          // Named rather than spread, so this literal has to be kept in step
          // with the slot shape by hand — the same stop on another day is
          // still indoors.
          kind: slot.kind,
        }),
      {
        success: `Copied to ${formatTargetDate(targetDate)}`,
        failure: "Couldn't copy that plan. Try again.",
      },
    );
    if (!saved.ok) return;

    scheduleRainNotificationForSlot(targetDateString, saved.value);
  };

  // No confirmation dialog. It used to `Alert` here while the swipe action on
  // the lists deleted outright, which put the friction on the deliberate path
  // and left the accidental one unprotected. Both now delete immediately and
  // offer "Undo" on the toast — and because the toast lives in the store
  // rather than in this modal's host, the one raised here survives the
  // `router.back()` below and finishes on the tab underneath, still undoable.
  //
  // A routine's stop is the one exception, and not for confirmation's sake:
  // "delete this" is genuinely two different deletes, and no undo can guess
  // which was meant. `deleteWithUndo` already handles the single day — it
  // records the exception so the top-up can't resurrect it — so all this adds
  // is the whole-routine reading.
  const handleDelete = async () => {
    if (routine) {
      const scope = await askEditScope({
        title: `Delete ${slot.label}?`,
        message: `${describeRoutine(routine)}.`,
        dayLabel: "Delete this day",
        seriesLabel: "Delete all future days",
        destructive: true,
      });
      if (!scope) return;

      if (scope === "series") {
        // Only the *rule* is deleted. The days it already produced and that
        // have been and gone stay in the archive, because they happened.
        const removed = saveWithFeedback(() => deleteRoutine(routine.id), {
          success: `Deleted ${slot.label} and its repeats`,
          failure: "Couldn't delete that routine. Try again.",
        });
        if (!removed.ok) return;
        materializeRoutines();
        router.back();
        return;
      }
    }

    const removed = deleteWithUndo(date, slot);
    if (removed.ok) router.back();
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HeaderDismissButton
        label="Cancel"
        onPress={() => confirmDiscard(() => router.back())}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <SlotForm
          submitLabel="Save changes"
          onDirtyChange={setDirty}
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
                // Withheld when the day changed: a routine has no single date,
                // so there is no rule-level reading of "this now happens on
                // Thursday instead".
                seriesLabel: movedToAnotherDay
                  ? undefined
                  : "This and future days",
              });
              if (!scope) return;

              if (scope === "series") {
                const saved = saveWithFeedback(
                  () => {
                    updateRoutine(routine.id, routineUpdatesFromSlot(values));
                  },
                  {
                    success: `Updated ${values.label} and its repeats`,
                    failure: "Couldn't save your changes. Try again.",
                  },
                );
                if (!saved.ok) return;
                // The stop on screen is rewritten by this too: the materialiser
                // sees it disagree with its own rule and replaces it, along
                // with every other day still ahead.
                materializeRoutines();
                router.back();
                return;
              }

              // "This day only" cuts the stop loose. The exception is what
              // stops the next top-up from filling the day back in beside it.
              addException(routine.id, date);
            }

            if (slot.notificationId) {
              cancelNotification(slot.notificationId);
            }
            const saved = saveWithFeedback(
              () =>
                updateSlot(date, slot.id, {
                  ...values,
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
            // Dismissing on a failed save would look like it worked, and the
            // edits would be gone. `!saved.value` shouldn't happen — `slot`
            // was just confirmed present above — but `updateSlot` types its
            // return as possibly-missing for the general case, so this stays
            // an honest guard rather than a non-null assertion.
            if (!saved.ok || !saved.value) return;

            // `saved.value` is the actual persisted slot, not a manually
            // reconstructed one — load-bearing when this was a "this day
            // only" detach: `updateSlot` re-keys the slot to a fresh id in
            // that case, and `slot.id` from this render's closure is stale.
            // Editing the start date re-files the slot under that day, so the
            // notification has to be scheduled against the new day, not the
            // one this screen was opened from.
            scheduleRainNotificationForSlot(
              toDateKey(new Date(values.startTime)),
              saved.value,
            );
            router.back();
          }}
          onDelete={handleDelete}
        >
          {routine && (
            <ThemedText themeColor="textSecondary" style={styles.repeatNote}>
              {describeRoutine(routine)}
            </ThemedText>
          )}
          {packingItems.length > 0 && (
            <ThemedView style={styles.packingList}>
              <ThemedText type="smallBold">Pack for this stop</ThemedText>
              {packingItems.map((item) => (
                <ThemedView key={item.item} style={styles.packingRow}>
                  <Icon
                    name={{
                      ios: "checkmark.circle",
                      android: "check_circle_outline",
                    }}
                    size={IconSize.inline}
                    tintColor={theme.textSecondary}
                  />
                  <ThemedText style={styles.packingItem}>
                    {item.item}
                  </ThemedText>
                  <ThemedText
                    themeColor="textSecondary"
                    style={styles.packingReason}
                  >
                    {item.reason}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          )}
          {dryWindow && (
            <Pressable
              style={[
                styles.dryWindowBanner,
                { borderColor: theme.umbrellaSun },
              ]}
              onPress={() => {
                const target = new Date(dryWindow.suggestedPeriod.start);
                const endOffset =
                  new Date(slot.endTime).getTime() -
                  new Date(slot.startTime).getTime();
                const newEnd = new Date(target.getTime() + endOffset);
                updateSlot(date, slot.id, {
                  startTime: target.toISOString(),
                  endTime: newEnd.toISOString(),
                });
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Move to ${formatPeriodLabel(dryWindow.suggestedPeriod.start)}`}
            >
              <Icon
                name={{ ios: "sun.max.fill", android: "wb_sunny" }}
                size={IconSize.inline}
                tintColor={theme.umbrellaSun}
              />
              <ThemedView style={styles.dryWindowText}>
                <ThemedText style={{ fontWeight: "600", fontSize: 13 }}>
                  {formatPeriodLabel(dryWindow.suggestedPeriod.start)} looks dry
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>
                  Tap to move this stop
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
          <CopyToDateAction onDuplicate={handleDuplicate} />
        </SlotForm>
      </SafeAreaView>
      {/* Duplicate commits without leaving this screen, so its confirmation
          has to be visible from inside the modal. */}
      <ToastHost />
    </ThemedView>
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

const styles = StyleSheet.create({
  repeatNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  packingList: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  packingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  packingItem: {
    fontWeight: "600",
    fontSize: 13,
  },
  packingReason: {
    fontSize: 12,
  },
  dryWindowBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  dryWindowText: {
    flex: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
});
