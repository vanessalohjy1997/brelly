import { toDateKey } from "@/utils/dateKeys";

const DAY = 24 * 60 * 60 * 1000;

export type TimeRange = { start: Date; end: Date };

/** The calendar day from `day`, the time of day from `time`. */
export function combineDateAndTime(day: Date, time: Date): Date {
  const combined = new Date(day);
  combined.setHours(
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );
  return combined;
}

/**
 * How many whole calendar days the end sits after the start — 0 for a normal
 * stop, 1 for one that runs past midnight.
 *
 * Computed from the date keys rather than by dividing the millisecond gap:
 * 23:30–00:30 is a one-hour stop that crosses a day boundary, and dividing
 * would call it zero days.
 */
function dayOffset(start: Date, end: Date): number {
  const startOfStartDay = new Date(start).setHours(0, 0, 0, 0);
  const startOfEndDay = new Date(end).setHours(0, 0, 0, 0);
  return Math.round((startOfEndDay - startOfStartDay) / DAY);
}

/**
 * Moves the whole stop onto `day`, keeping both times of day.
 *
 * This is the point of splitting the day out of the two pickers. Both fields
 * used to be `mode="datetime"`, so moving a plan to another day meant editing
 * the date twice and the handler only carried the end along when it had gone
 * invalid — anyone who moved the start *backwards* was left with a stop whose
 * two halves were on different days and no indication of it.
 *
 * A stop that ran past midnight still does: the offset between the two days is
 * preserved rather than flattened.
 */
export function applyDayToRange(range: TimeRange, day: Date): TimeRange {
  const offset = dayOffset(range.start, range.end);
  const start = combineDateAndTime(day, range.start);
  const endDay = new Date(day);
  endDay.setDate(endDay.getDate() + offset);
  return { start, end: combineDateAndTime(endDay, range.end) };
}

/**
 * Sets the time of day the stop starts, on the day it is already filed under.
 *
 * The end is only touched when the edit would have made the range impossible,
 * and then it is pushed to an hour after the new start — the same rule the
 * form has always used, and the one that keeps a deliberate duration intact.
 */
export function applyStartTime(range: TimeRange, time: Date): TimeRange {
  const start = combineDateAndTime(range.start, time);
  if (range.end.getTime() > start.getTime()) return { start, end: range.end };
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}

/**
 * Sets the time of day the stop ends.
 *
 * An end at or before the start is read as running past midnight and lands on
 * the next day, rather than being rejected. "Ends 00:30" after a 23:00 start is
 * a real itinerary, and the alternative — an error message on a time picker
 * that only offers times — has no move the user can make to satisfy it.
 */
export function applyEndTime(range: TimeRange, time: Date): TimeRange {
  const sameDay = combineDateAndTime(range.start, time);
  if (sameDay.getTime() > range.start.getTime()) {
    return { start: range.start, end: sameDay };
  }

  const nextDay = new Date(range.start);
  nextDay.setDate(nextDay.getDate() + 1);
  return { start: range.start, end: combineDateAndTime(nextDay, time) };
}

/** True when the stop ends on a later calendar day than it starts. */
export function endsOnAnotherDay(range: TimeRange): boolean {
  return toDateKey(range.start) !== toDateKey(range.end);
}
