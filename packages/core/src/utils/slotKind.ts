/**
 * Whether a stop is under a roof.
 *
 * Outdoor is first because it is the default, and the default matters here: it
 * is what every slot created before this existed resolves to, so it has to be
 * the reading that leaves rain alerts behaving exactly as they did.
 */
export const SLOT_KINDS = ["outdoor", "indoor"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const SLOT_KIND_LABELS: Record<SlotKind, string> = {
  outdoor: "Outdoor",
  indoor: "Indoor",
};

/**
 * What the chips promise before either is pressed. The tag's whole point is the
 * rain alert it seeds, so the hint says that rather than restating the word.
 */
export const SLOT_KIND_HINTS: Record<SlotKind, string> = {
  outdoor: "Rain reaches this stop, so it's worth a warning.",
  indoor: "Under cover — rain alerts start off for this stop.",
};

/**
 * Absent means outdoor — see the comment on `ItinerarySlot.kind`.
 *
 * A function rather than a `?? "outdoor"` at each of the read sites: the card,
 * the form and the search index all have to agree about what a slot with no tag
 * is, and four copies of that answer is four chances to disagree.
 */
export function resolveSlotKind(kind: SlotKind | undefined): SlotKind {
  return kind ?? "outdoor";
}
