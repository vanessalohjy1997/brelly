"use client";

import { Icon } from "../Icon";
import { Icons } from "../icons";

/**
 * Below this many stops, a list is one or two screens and scanning it beats
 * typing at it — so the field does not render at all and the header keeps its
 * space. The threshold is on stops rather than days because a day holding six
 * stops is exactly the case worth searching.
 */
export const SearchThreshold = 6;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** "Search plans" / "Search past plans" — says which list is being narrowed. */
  placeholder: string;
};

/**
 * Filters a list of stops as you type.
 *
 * Shared by Plans and History: they render the two halves of one
 * `splitPlansByTime` call, and a search that worked on only one of them would
 * be the kind of split the archive was built to remove. Deliberately not
 * debounced — `filterPlans` is a substring scan over an array already in
 * memory, so the work per keystroke is far below a frame, and a debounce would
 * only add lag between the character and the result.
 *
 * `type="search"` rather than `type="text"`, but the clear control is ours:
 * the browser's own is unstyleable, absent in Firefox, and in Safari sits
 * inside the input's metrics with no way to give it a 44px target.
 */
export function PlanSearchField({ value, onChange, placeholder }: Props) {
  return (
    <div className="flex min-h-[var(--brelly-hit-target)] items-center gap-two rounded-control bg-background-element px-three">
      <Icon name={Icons.search} size="inline" className="text-text-secondary" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-default text-text outline-none placeholder:text-text-secondary [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="-mx-two flex min-h-[var(--brelly-hit-target)] items-center px-two"
        >
          <Icon name={Icons.clear} size="inline" className="text-text-secondary" />
        </button>
      )}
    </div>
  );
}
