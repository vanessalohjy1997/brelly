import { Text } from "../Text";

/**
 * A row of mutually exclusive chips.
 *
 * `role="radiogroup"` plus `role="radio"` is the phone's markup, and the phone
 * gets away with a plain container because iOS builds the grouping from the
 * roles. A browser does not: an ARIA radiogroup needs its own keyboard model —
 * arrow keys move between the options and only the selected one is a tab stop —
 * and half-implementing that is worse than not claiming the role at all, since
 * a screen reader then promises a widget the keyboard does not deliver.
 *
 * So these are real `<input type="radio">`s in a `<fieldset>`. The browser
 * supplies the roving focus, the arrow keys, the grouping and the label
 * association; the chip look is CSS on the label. Nothing here re-implements
 * anything the platform already does.
 */
export function ChipGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  /** Unique per group on the page — it is what makes the radios one set. */
  name: string;
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-one border-0 p-0">
      <legend className="text-field-label text-text-secondary uppercase">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-two">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              // `primary` rather than `backgroundSelected` for the fill: the
              // latter is 1.26:1 on `backgroundElement` in dark and 1.19:1 in
              // light, so a selected chip and an unselected one looked the same
              // and the bold label was the only cue.
              //
              // The unselected chip has the opposite problem, and takes the
              // same answer as `Button`'s `quiet` tone: its fill *is* the card
              // it sits on, so without the `border` token it has no edge and
              // reads as a word rather than a choice. The selected chip keeps
              // the border box and hides the line, so the row does not shift
              // by 2px as the selection moves along it.
              className={`flex min-h-[var(--brelly-hit-target)] cursor-pointer items-center rounded-control border px-three transition-colors duration-[var(--brelly-duration-fade)] ${
                selected
                  ? "border-transparent bg-primary"
                  : "border-border bg-background-element hover:bg-background-selected"
              } has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                // Visually hidden, not `display: none` — a hidden input is not
                // focusable, which would take the group's whole keyboard model
                // with it.
                className="sr-only"
              />
              {/* Pairs are pairs: a `primary` fill takes `onPrimary`, which is
                  white in light and near-black in dark. */}
              <Text variant="small" color={selected ? "onPrimary" : "text"}>
                {option.label}
              </Text>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
