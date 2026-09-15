"use client";

import { useEffect } from "react";

import {
  describeRoutine,
  resolveFrequency,
  shiftDays,
  toDateKey,
  WEEKDAY_INITIALS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  type RepeatRule,
} from "@brelly/core";

import { Text } from "../Text";
import { ChipGroup } from "./ChipGroup";

/**
 * One press for the two shapes a week almost always takes. Everything else is
 * reachable through the day toggles underneath, which is the right split: the
 * common cases should not cost five presses, and the uncommon ones should not
 * be unreachable to save four.
 */
const PRESETS: { label: string; weekdays: number[] }[] = [
  { label: "Mon–Fri", weekdays: [1, 2, 3, 4, 5] },
  { label: "Every day", weekdays: [0, 1, 2, 3, 4, 5, 6] },
];

/** How far out the end-date field opens when "On a date" is first chosen. */
const DefaultEndOffsetDays = 28;
/**
 * A monthly rule at `+28d` would barely reach one occurrence, so its end date
 * opens a few months out instead — far enough that "On a date" reads as a real
 * bound rather than "next month".
 */
const DefaultMonthlyEndOffsetMonths = 3;

/** Where "On a date" starts, seeded to the rule's own cadence. */
function seedEndDate(anchor: Date, monthly: boolean): string {
  if (!monthly) return shiftDays(toDateKey(anchor), DefaultEndOffsetDays);
  const end = new Date(anchor);
  end.setMonth(end.getMonth() + DefaultMonthlyEndOffsetMonths);
  return toDateKey(end);
}

type Cadence = "once" | "weekly" | "monthly";

type Props = {
  /** The rule, or null for a one-off. */
  value: RepeatRule | null;
  onChange: (rule: RepeatRule | null) => void;
  /** The day the stop sits on. Seeds the first selected weekday and the end date. */
  anchor: Date;
  error?: string;
};

/**
 * The repeat control on the add-plan form.
 *
 * A rule, not a count. The chips this replaces offered "Weekly", which wrote
 * four stops and then stopped being anything — there was no rule left to edit,
 * extend or turn off, and a commitment that renews every week had to be
 * re-entered every month. What is collected here is stored as a `Routine` and
 * filled in a fortnight at a time; see `planRoutineMaterialization`.
 *
 * The weekday toggles are checkboxes rather than the chips they look like, for
 * the reason `ChipGroup` gives about radios: a multi-select set of buttons has
 * to announce its state, and `aria-pressed` on seven buttons is a worse
 * description of "which days" than seven checkboxes are.
 */
export function RepeatField({ value, onChange, anchor, error }: Props) {
  const repeating = value !== null;
  const frequency = value ? resolveFrequency(value.frequency) : null;
  const isMonthly = frequency === "monthly";
  const cadence: Cadence = !repeating ? "once" : (frequency as Cadence);

  // A monthly rule falls on the stop's own date, so it tracks the Day field:
  // move the stop to the 20th and the rule repeats on the 20th, with no
  // separate control. Guarded to monthly and to an actual change, so it cannot
  // loop.
  const anchorDayOfMonth = anchor.getDate();
  useEffect(() => {
    if (!value || resolveFrequency(value.frequency) !== "monthly") return;
    if (value.dayOfMonth === anchorDayOfMonth) return;
    onChange({ ...value, dayOfMonth: anchorDayOfMonth });
  }, [anchorDayOfMonth, value, onChange]);

  // Both cadences start from the day the stop is already on — a routine that
  // repeated on some *other* day than the one just picked would be a surprise.
  // Re-choosing the current cadence is a no-op, so it does not wipe the days
  // already toggled.
  const selectCadence = (next: Cadence) => {
    if (next === cadence) return;
    if (next === "once") {
      onChange(null);
      return;
    }
    if (next === "weekly") {
      onChange({
        frequency: "weekly",
        weekdays: [anchor.getDay()],
        endDate: value?.endDate,
      });
      return;
    }
    onChange({
      frequency: "monthly",
      weekdays: [],
      dayOfMonth: anchorDayOfMonth,
      endDate: value?.endDate,
    });
  };

  const toggleWeekday = (day: number) => {
    if (!value) return;
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day];
    onChange({ ...value, weekdays });
  };

  const setEndDate = (endDate: string | undefined) => {
    if (!value) return;
    onChange({ ...value, endDate });
  };

  return (
    <div className="flex flex-col gap-two">
      <ChipGroup
        name="repeat-cadence"
        // Not "Once"/"Repeat" on the chips: the group is already labelled
        // Repeat, and a chip carrying the same word as its heading reads as the
        // heading.
        legend="Repeat"
        value={cadence}
        onChange={selectCadence}
        options={[
          { value: "once", label: "Just once" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ]}
      />

      {value && (
        <>
          {/* Weekly picks which days; monthly falls on the stop's own date, so
              it has no day controls at all — moving the Day field above moves
              the recurrence date with it. */}
          {!isMonthly && (
            <>
              <fieldset className="flex flex-col gap-one border-0 p-0">
                <legend className="text-field-label text-text-secondary uppercase">
                  Days
                </legend>
                <div className="flex flex-wrap gap-two">
                  {WEEKDAY_ORDER.map((day) => {
                    const selected = value.weekdays.includes(day);
                    return (
                      <label
                        key={day}
                        className={`flex size-[var(--brelly-hit-target)] cursor-pointer items-center justify-center rounded-control ${
                          selected ? "bg-primary" : "bg-background-element"
                        } has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleWeekday(day)}
                          // Two days share the letter "T" and two share "S", so
                          // the glyph cannot be the accessible name.
                          aria-label={WEEKDAY_LABELS[day]}
                          className="sr-only"
                        />
                        <Text
                          variant="small"
                          color={selected ? "onPrimary" : "text"}
                        >
                          {WEEKDAY_INITIALS[day]}
                        </Text>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-two">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...value, weekdays: preset.weekdays })}
                    className="flex min-h-[var(--brelly-hit-target)] items-center rounded-control bg-background-element px-three"
                  >
                    <Text variant="small">{preset.label}</Text>
                  </button>
                ))}
              </div>
            </>
          )}

          <ChipGroup
            name="repeat-ends"
            legend="Ends"
            value={value.endDate ? "on-a-date" : "never"}
            onChange={(next) =>
              setEndDate(
                next === "never" ? undefined : seedEndDate(anchor, isMonthly),
              )
            }
            options={[
              { value: "never", label: "Never" },
              { value: "on-a-date", label: "On a date" },
            ]}
          />

          {value.endDate && (
            <div className="flex flex-col gap-one">
              <label
                htmlFor="repeat-end-date"
                className="text-field-label text-text-secondary uppercase"
              >
                Last day
              </label>
              <input
                id="repeat-end-date"
                type="date"
                value={value.endDate}
                onChange={(event) => setEndDate(event.target.value || undefined)}
                className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background-element px-three text-default text-text"
              />
            </div>
          )}

          {/* The rule read back in words. The chips say what was pressed; this
              says what it means, which is the thing a routine is easy to be
              wrong about. */}
          <Text variant="small" color="textSecondary">
            {describeRoutine(value)}
          </Text>
        </>
      )}

      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
