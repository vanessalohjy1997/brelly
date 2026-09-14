/**
 * How often a routine recurs.
 *
 * Weekly is first because it is the default, and the default matters here for
 * the same reason `resolveSlotKind`'s does: every routine created before
 * monthly existed has no `frequency` field, so absent has to resolve to the
 * weekly behaviour those rules were written under — no migration, the stored
 * shape just gains an optional field.
 */
export const ROUTINE_FREQUENCIES = ["weekly", "monthly"] as const;
export type RoutineFrequency = (typeof ROUTINE_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<RoutineFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
};

/**
 * Absent means weekly — see the comment above.
 *
 * A function rather than a `?? "weekly"` at each read site: the occurrence
 * engine, the wording and the form all have to agree what a rule with no
 * frequency is, and three copies of that answer is three chances to disagree.
 */
export function resolveFrequency(
  frequency: RoutineFrequency | undefined,
): RoutineFrequency {
  return frequency ?? "weekly";
}
