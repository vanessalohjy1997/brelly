"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Duration } from "@/constants/theme";
import { dismissToast, useToastStore, type ToastVariant } from "@brelly/core";

import { Icon } from "./Icon";
import { Icons } from "./icons";
import { Text } from "./Text";

/**
 * One host, at the root, and that is the whole difference from the phone.
 *
 * `toastStore` keeps a list of *modal* hosts because on iOS a modal is a real
 * view controller presented over the window: a host at the root is behind it,
 * so a toast raised from a form would never be seen. A web portal has no such
 * barrier — `<dialog>` puts itself in the top layer and a fixed-position toast
 * can sit above it — so the list stays empty here and the root host renders
 * unconditionally.
 *
 * The behaviour that list was protecting survives for free: the toast lives in
 * the store rather than in the host, so one raised just before a route change
 * finishes its life on the page underneath.
 */
export function ToastHost() {
  const toast = useToastStore((state) => state.toast);

  useEffect(() => {
    if (!toast) return;
    // A toast carrying an action gets longer, because it is now the only way
    // back: the reading time is the same, what is added is time to decide.
    const lifetime = toast.action ? Duration.toastWithAction : Duration.toast;
    const timer = setTimeout(() => dismissToast(toast.id), lifetime);
    return () => clearTimeout(timer);
  }, [toast]);

  // Portalled to `document.body` so no ancestor's `overflow`, `transform` or
  // stacking context can clip or trap it. `useEffect` has already run by the
  // time this matters, so there is no server render to guard against — the
  // store is empty on the server and this returns null there.
  if (!toast || typeof document === "undefined") return null;

  return createPortal(
    <div
      // `status`, not `alert`: an alert interrupts whatever the screen reader
      // is saying, and a confirmation that a plan was saved is not worth
      // cutting someone off for. Errors here are the same kind of message.
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-three z-[var(--brelly-z-overlay)] flex justify-center px-three motion-safe:animate-[toast-in_var(--brelly-duration-fade)_ease-out]"
    >
      <div
        className={`flex max-w-[var(--brelly-max-content-width)] items-center gap-two rounded-control border bg-background-element px-three py-two ${outlineClass(toast.variant)}`}
      >
        <Icon
          name={toast.variant === "success" ? Icons.success : Icons.warning}
          size="inline"
          className={toast.variant === "success" ? "text-success" : "text-danger"}
        />
        <Text variant="small" className="flex-1">
          {toast.message}
        </Text>
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              // Pressing the action dismisses the toast, so no handler has to.
              toast.action?.onPress();
              dismissToast(toast.id);
            }}
            className="min-h-[var(--brelly-hit-target)] rounded-control px-two"
          >
            <Text variant="linkPrimary">{toast.action.label}</Text>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
            className="min-h-[var(--brelly-hit-target)] rounded-control px-two"
          >
            <Icon name={Icons.close} size="inline" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The outline carries the variant, alongside the glyph and the words. Green and
 * red is the colour-vision-unsafe axis, and this is the one place it is
 * acceptable: only one toast is on screen at a time, so the two never have to
 * be told apart side by side, and the checkmark-versus-triangle and the message
 * both say it without the hue.
 */
function outlineClass(variant: ToastVariant): string {
  return variant === "success" ? "border-success" : "border-danger";
}
