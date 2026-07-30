/**
 * Moves the item at `fromIndex` to `toIndex`, shifting everything between.
 * Out-of-range indices are clamped rather than throwing, since drag gestures
 * can easily overshoot past the first/last row.
 */
export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (items.length === 0) return items;

  const clampedFrom = clamp(fromIndex, 0, items.length - 1);
  const clampedTo = clamp(toIndex, 0, items.length - 1);
  if (clampedFrom === clampedTo) return items;

  const next = [...items];
  const [moved] = next.splice(clampedFrom, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
