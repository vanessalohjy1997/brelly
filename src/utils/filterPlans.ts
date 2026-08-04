import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { resolveSlotKind } from "@/utils/slotKind";

/**
 * The text a search runs against: what the stop is called, where it is, which
 * NEA region that falls in, and whether it is under a roof.
 *
 * The region is in here because it is the one thing about a stop the user never
 * typed — it is derived from the coordinates at creation — and it is the only
 * way to ask a question like "what have I got in the east this week" without a
 * separate filter control. It costs nothing: "east" also matches "East Coast
 * Park" in the location, which is the same answer by a different route.
 *
 * The kind is here for the same reason, and it is the *resolved* kind rather
 * than the stored one: a slot from before the tag existed is outdoors, and
 * searching "outdoor" has to find it or the query quietly means "tagged
 * outdoor" instead of "outdoors".
 */
function searchableText(slot: ItinerarySlot): string {
  return `${slot.label} ${slot.location} ${slot.neaRegion} ${resolveSlotKind(
    slot.kind,
  )}`.toLowerCase();
}

/**
 * Splits a raw query into the terms every result has to satisfy.
 *
 * Exported so a caller can tell "the user typed nothing meaningful" (no terms)
 * from "the user typed something that matched nothing" — the two want different
 * empty states, and re-deriving it by trimming at the call site would put the
 * definition of "meaningful" in two places.
 */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Every term must appear somewhere in the stop, in any order — so "botanic
 * lunch" finds "Lunch" at "Singapore Botanic Gardens" and the word order the
 * user happened to type doesn't decide whether they find it. Terms are matched
 * as substrings rather than whole words: half-typed queries are the normal case
 * in a field that filters as you type.
 *
 * Terms are lowercased here as well as in `searchTerms`. The redundant pass is
 * deliberate: an exported predicate whose correctness depends on the caller
 * having normalised its input silently returns `false` when they haven't, and
 * there are only ever a handful of terms.
 */
export function slotMatches(slot: ItinerarySlot, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = searchableText(slot);
  return terms.every((term) => haystack.includes(term.toLowerCase()));
}

/**
 * Narrows plans to the stops matching `query`, dropping days left with nothing.
 *
 * A blank query returns the *same array reference*, not a copy. This screen
 * renders it straight into a `SectionList`, and handing back a fresh array on
 * every keystroke-free render would rebuild every section for nothing.
 */
export function filterPlans(plans: DayPlan[], query: string): DayPlan[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return plans;

  const filtered: DayPlan[] = [];
  for (const plan of plans) {
    const slots = plan.slots.filter((slot) => slotMatches(slot, terms));
    if (slots.length > 0) filtered.push({ ...plan, slots });
  }
  return filtered;
}

/** How many stops (not days) are in a set of plans — what a result count means. */
export function countSlots(plans: DayPlan[]): number {
  return plans.reduce((total, plan) => total + plan.slots.length, 0);
}
