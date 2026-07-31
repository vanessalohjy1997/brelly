/**
 * Width a single `mode="datetime"` `DateTimePicker` needs to render without
 * clipping. The native picker draws a date capsule ("30 Jul 2026") next to a
 * time capsule ("7:00 PM") at its own intrinsic size — it does *not* shrink to
 * fit its container, so a container narrower than this makes the two pickers
 * visually overlap instead of wrapping.
 */
export const MinDateTimePickerWidth = 240;

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
  return availableWidth < MinDateTimePickerWidth * 2 + gap;
}
