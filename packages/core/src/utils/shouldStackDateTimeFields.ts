/**
 * Width a single `mode="time"` `DateTimePicker` needs to render without
 * clipping. The native picker draws a time capsule ("7:00 PM") at its own
 * intrinsic size — it does *not* shrink to fit its container, so a container
 * narrower than this makes two of them side by side visually overlap instead
 * of wrapping. Starts and Ends are both `mode="time"` — the day they share
 * lives in its own `mode="date"` picker above them — so this only has to fit
 * a time capsule, not a date-and-time pair.
 */
export const MinTimePickerWidth = 110;

/**
 * Width to render the pickers at.
 *
 * The SwiftUI host the picker lives in doesn't size itself to its content
 * horizontally — it centres the picker inside whatever width it's given, and
 * reports no intrinsic width to the layout engine. So the only way to get a
 * picker to sit flush left is to hand it a box that's already about as wide as
 * its content; anything wider shows up as an indent, anything narrower clips.
 * These are measured from rendered pickers at the default locale and text size.
 */
export const DateTimePickerWidth = 208;
export const DatePickerWidth = 116;

/**
 * Height to pin the picker box at — the vertical twin of the width workaround
 * above. The SwiftUI host reports no intrinsic *height* to Yoga either, so a
 * box that sets `width` only has no stable height: the capsule floats, centred
 * in a box the layout engine can't size, and drifts upward over the field's
 * caption on any relayout (e.g. every keystroke in the Label field). Giving the
 * box a fixed height keeps the capsule parked. Measured to clear a rendered
 * time/date capsule at the default locale and text size.
 */
export const DateTimePickerHeight = 40;

/**
 * Whether the Starts/Ends pickers have to be laid out one above the other.
 *
 * @param availableWidth width the two pickers share, i.e. the form's content
 *   width (screen width minus its horizontal padding)
 * @param gap horizontal gap between the two pickers when side by side
 */
export function shouldStackDateTimeFields(
  availableWidth: number,
  gap: number,
): boolean {
  return availableWidth < MinTimePickerWidth * 2 + gap;
}
