"use client";

import { shiftDays, todayKey, type DayPlan } from "@brelly/core";

import { Text } from "../Text";

type DayCell = {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  planCount: number;
  isToday: boolean;
};

export function buildWeek(
  plans: DayPlan[],
  today: string,
  days: number = 7,
): DayCell[] {
  const cells: DayCell[] = [];
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDays(today, i);
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayLabel = date.toLocaleDateString("en-SG", { weekday: "short" });
    const dateLabel = String(date.getDate());
    const plan = plans.find((p) => p.date === dateKey);
    cells.push({
      dateKey,
      dayLabel: i === 0 ? "Today" : dayLabel,
      dateLabel,
      planCount: plan?.slots.length ?? 0,
      isToday: i === 0,
    });
  }
  return cells;
}

/**
 * What a screen reader says for one cell. The badge is a bare number, which
 * reads as "8, 2" out of context — the name spells the count back out so the
 * compact form costs nothing in speech.
 *
 * The name says what pressing does as well as what the cell is, and that is the
 * fix for a real ambiguity rather than a flourish. These cells look like a date
 * picker and are not one: every one of them **adds a plan** on that day. The
 * phone carried that only in an `accessibilityHint`, which is the one part of
 * an accessible name a user can switch off.
 */
export function describeCell(cell: DayCell): string {
  const day = `${cell.dayLabel} ${cell.dateLabel}`;
  const stops =
    cell.planCount === 0
      ? "no stops"
      : `${cell.planCount} ${cell.planCount === 1 ? "stop" : "stops"}`;
  return `Add a plan on ${day}, ${stops}`;
}

/**
 * The week ahead, as seven links that each add a plan on their day.
 *
 * **Links, not buttons**, and that settles the add-versus-select ambiguity the
 * plan flagged rather than porting it. Each cell navigates to
 * `/plan/new?date=…`; on the web that is a real destination with a real URL, so
 * it should be the element that goes to one. Seven ordinary tab stops follow
 * from that — a roving `tabindex` composite would be right for a date *picker*,
 * and this is not one.
 *
 * Horizontally scrollable below the width that fits seven cells. The scroller
 * is focusable so it can be reached by keyboard, which a `div` with
 * `overflow-x` otherwise cannot be.
 */
export function WeekStrip({
  plans,
  renderHref,
}: {
  plans: DayPlan[];
  /** Where a day's cell goes. Passed in so the strip owns no routing. */
  renderHref: (dateKey: string) => string;
}) {
  const cells = buildWeek(plans, todayKey());

  return (
    <nav aria-label="Week ahead" className="overflow-x-auto pt-one pr-one pb-two">
      <ul className="flex gap-two">
        {cells.map((cell) => (
          <li key={cell.dateKey}>
            <a
              href={renderHref(cell.dateKey)}
              aria-label={describeCell(cell)}
              className={`relative flex min-h-[var(--brelly-hit-target)] min-w-[4rem] flex-col items-center justify-center rounded-control bg-background-element px-two py-one ${
                cell.isToday ? "border border-primary" : "border border-transparent"
              }`}
            >
              <Text
                variant="eyebrow"
                color={cell.isToday ? "primary" : "textSecondary"}
              >
                {cell.dayLabel}
              </Text>
              <span aria-hidden="true" className="text-subtitle">
                {cell.dateLabel}
              </span>
              {cell.planCount > 0 && (
                // Pinned outside the cell's own corner, like a notification
                // badge, so it reads as a status flag on the day rather than
                // crowding the date. The ring matches the cell surface so the
                // badge stays a crisp circle instead of merging into whatever
                // is behind it.
                <span
                  aria-hidden="true"
                  className="absolute -top-two -right-two flex min-w-[var(--brelly-icon-control)] items-center justify-center rounded-full border-2 border-background-element bg-primary px-one text-eyebrow text-on-primary"
                >
                  {cell.planCount}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
