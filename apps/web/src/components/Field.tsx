import type { ReactNode } from "react";

/**
 * A labelled form field, with its error attached to it rather than piled up
 * somewhere else on the page.
 *
 * A real `<label htmlFor>` rather than the phone's `accessibilityLabel` on the
 * input: the association is what makes the label clickable, and what lets
 * `aria-describedby` point at the error from the input.
 *
 * The error is `role="alert"`, so it is announced when it appears rather than
 * only when focus reaches it. The phone scrolls to the first failing field
 * because the form is taller than a screen; the web equivalent is
 * `SlotForm`'s focus move, which scrolls as a side effect of doing the more
 * useful thing.
 *
 * `Text` is not used for the label and the error. Both need an `id` and one
 * needs `htmlFor`, and threading a handful of DOM attributes through a
 * presentational component is how that component ends up re-implementing the
 * element it wraps. The two variant classes are applied directly instead.
 */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-one">
      <label htmlFor={id} className="text-field-label text-text-secondary uppercase">
        {label}
      </label>
      {children}
      {hint}
      {error && (
        <p role="alert" id={`${id}-error`} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
