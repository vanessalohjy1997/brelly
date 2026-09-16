"use client";

import { useEffect, useRef } from "react";

import { useDialogStore, type DialogTone } from "@/store/dialogStore";
import { Text } from "./Text";

/**
 * Renders whatever question `askDialog` has raised.
 *
 * A native `<dialog>` element, opened with `showModal()`, rather than a
 * hand-rolled overlay — it brings the focus trap, the Escape key, the inert
 * background and the top layer with it, and every one of those is a thing that
 * is normally reimplemented badly. The `cancel` event is what Escape fires, and
 * it is answered with the request's own `dismissKey` so an unanswered question
 * commits nothing.
 *
 * Mounted once at the root. There is exactly one question at a time by
 * construction — `askDialog` settles an open one before raising the next.
 */
export function DialogHost() {
  const dialog = useDialogStore((state) => state.dialog);
  const answer = useDialogStore((state) => state.answer);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (dialog && !element.open) element.showModal();
    if (!dialog && element.open) element.close();
  }, [dialog]);

  if (!dialog) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
      onCancel={(event) => {
        // Let the store close it, so the promise settles first and the two
        // cannot disagree about whether the question is still open.
        event.preventDefault();
        answer(dialog.dismissKey);
      }}
      onClose={() => answer(dialog.dismissKey)}
      className="m-auto w-[min(28rem,calc(100vw-var(--brelly-space-four)))] rounded-card border border-border bg-background-element p-three text-text backdrop:bg-[rgb(0_0_0/0.4)]"
    >
      <Text variant="subtitle" as="h2" id="dialog-title">
        {dialog.title}
      </Text>
      <Text
        as="p"
        color="textSecondary"
        id="dialog-message"
        className="mt-two mb-three"
      >
        {dialog.message}
      </Text>

      {/*
        Column on narrow screens, row on wide. Three buttons side by side at
        360px puts each under the 44px target the rest of the app holds to.
        `flex-row-reverse` so the affirmative sits at the right-hand end, where
        a confirm belongs on the web, while staying first in DOM order — which
        is the order a screen reader and the Tab key follow.
      */}
      <div className="flex flex-col gap-two sm:flex-row-reverse">
        {dialog.actions.map((action) => (
          <button
            key={action.key}
            type="button"
            autoFocus={action.key === dialog.dismissKey}
            onClick={() => answer(action.key)}
            className={`min-h-[var(--brelly-hit-target)] flex-1 rounded-control px-three py-two ${toneClass(action.tone)}`}
          >
            <Text variant="smallBold" color={toneTextColor(action.tone)}>
              {action.label}
            </Text>
          </button>
        ))}
      </div>
    </dialog>
  );
}

/**
 * The dismissing action takes focus, not the affirmative one. Every dialog here
 * is raised in front of something destructive or irreversible, and Enter on a
 * dialog the user has not read yet should do the harmless thing.
 */
function toneClass(tone: DialogTone = "default"): string {
  switch (tone) {
    case "destructive":
      return "bg-danger";
    case "cancel":
      return "bg-background";
    default:
      return "bg-primary";
  }
}

function toneTextColor(tone: DialogTone = "default") {
  switch (tone) {
    case "destructive":
      return "onDanger" as const;
    case "cancel":
      return "text" as const;
    default:
      return "onPrimary" as const;
  }
}
