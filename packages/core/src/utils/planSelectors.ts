import type { DayPlan, ItinerarySlot } from "@/types/itinerary";

export type FoundSlot = { date: string; slot: ItinerarySlot };

/**
 * Pure lookups over the plans array.
 *
 * These deliberately do *not* live on the Zustand store. A store method that
 * builds a fresh object (`{ date, slot }`) can't be used as a selector:
 * `useItineraryStore((s) => s.findSlotById(id))` re-runs on every render and
 * returns a new reference each time, which zustand's `useSyncExternalStore`
 * reads as "the store changed" — forever. That's the "Maximum update depth
 * exceeded" crash on opening a plan. Selecting `state.plans` (a stable
 * reference) and calling these against it is safe.
 *
 * The mirror-image trap is a selector that returns something *too* stable:
 * `useItineraryStore((s) => s.getTodaysPlan)` selects the function, whose
 * identity never changes, so the component never re-renders when plans do.
 */
/**
 * A day's slots in the order they happen.
 *
 * This is the app's *only* ordering. Manual drag-to-reorder used to sit
 * alongside it and the two silently disagreed — Today rendered whatever order
 * you dragged rows into while Plans rendered the same slots by start time, so
 * the same day read two different ways. An itinerary is a timeline; an
 * arrangement that contradicts the clock can only mislead.
 *
 * Applied at render as well as on write, because installs that predate the
 * removal still have a hand-dragged order sitting in MMKV.
 */
export function sortSlotsByStart(slots: ItinerarySlot[]): ItinerarySlot[] {
  return [...slots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

export function findSlotById(
  plans: DayPlan[],
  slotId: string,
): FoundSlot | undefined {
  for (const plan of plans) {
    const slot = plan.slots.find((s) => s.id === slotId);
    if (slot) return { date: plan.date, slot };
  }
  return undefined;
}

export function findPlanByDate(
  plans: DayPlan[],
  date: string,
): DayPlan | undefined {
  return plans.find((plan) => plan.date === date);
}

/** Every slot across every plan, each paired with the date it belongs to. */
export function allSlotsWithDates(plans: DayPlan[]): FoundSlot[] {
  return plans.flatMap((plan) =>
    plan.slots.map((slot) => ({ date: plan.date, slot })),
  );
}

/**
 * The slot happening now, or failing that the next one to start.
 *
 * "Happening now" wins over "starts soonest" so that a live reading is
 * attributed to where the user actually is. Falls back to the last slot of
 * the day once they've all ended, so the caller always has somewhere to
 * anchor to when the list isn't empty.
 */
export function findCurrentOrNextSlot(
  slots: ItinerarySlot[],
  now: Date,
): ItinerarySlot | undefined {
  if (slots.length === 0) return undefined;

  const time = now.getTime();
  const byStart = sortSlotsByStart(slots);

  const current = byStart.find(
    (slot) =>
      new Date(slot.startTime).getTime() <= time &&
      new Date(slot.endTime).getTime() > time,
  );
  if (current) return current;

  const next = byStart.find((slot) => new Date(slot.startTime).getTime() > time);
  return next ?? byStart[byStart.length - 1];
}

/** A raw Firestore slot doc — `date` lives on the doc, not on `ItinerarySlot`
 * itself, since the cloud model is a flat collection (see
 * FIREBASE_MIGRATION.md's "Firestore data model"). */
export type CloudSlot = ItinerarySlot & { date: string };

/**
 * Groups a flat list of cloud slot docs back into `DayPlan`s, the shape every
 * screen already reads. The date string doubles as `DayPlan.id` — nothing
 * downstream treats a plan's id as more than a React key.
 */
export function groupSlotsIntoPlans(slots: CloudSlot[]): DayPlan[] {
  const byDate = new Map<string, ItinerarySlot[]>();
  for (const { date, ...slot } of slots) {
    const bucket = byDate.get(date) ?? [];
    bucket.push(slot);
    byDate.set(date, bucket);
  }

  return Array.from(byDate.entries())
    .map(([date, daySlots]) => ({
      id: date,
      date,
      slots: sortSlotsByStart(daySlots),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Slots that start after `now`, soonest first — the only ones whose
 * notifications are still worth scheduling or re-checking.
 */
export function upcomingSlots(plans: DayPlan[], now: Date): FoundSlot[] {
  return allSlotsWithDates(plans)
    .filter(({ slot }) => new Date(slot.startTime).getTime() > now.getTime())
    .sort(
      (a, b) =>
        new Date(a.slot.startTime).getTime() -
        new Date(b.slot.startTime).getTime(),
    );
}
