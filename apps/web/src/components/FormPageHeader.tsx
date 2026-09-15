"use client";

import { useRouter } from "next/navigation";

import { Icon } from "./Icon";
import { Icons } from "./icons";
import { Text } from "./Text";

/**
 * The header of a form page, with the exit that asks.
 *
 * On the phone this is `headerDismissButton` — a native bar-button item, with
 * a whole component's worth of comment about Liquid Glass capsules and
 * `Stack.Toolbar`. None of that ports: Next has no header-options API at all,
 * so the native navbar action becomes ordinary in-page chrome.
 *
 * A `<button>` rather than a `Link`, deliberately. Where this goes depends on
 * where the reader came from, and the answer the phone gave — the screen
 * underneath the modal — is `router.back()`. The guard runs first, and only a
 * "discard" lets the navigation through.
 */
export function FormPageHeader({
  title,
  cancelLabel = "Cancel",
  confirmDiscard,
}: {
  title: string;
  cancelLabel?: string;
  confirmDiscard: () => Promise<boolean>;
}) {
  const router = useRouter();

  return (
    <header className="flex min-h-[var(--brelly-header-height)] items-center justify-between gap-two py-two">
      <Text variant="title" as="h1">
        {title}
      </Text>
      <button
        type="button"
        onClick={() =>
          void confirmDiscard().then((discard) => {
            if (discard) router.back();
          })
        }
        className="flex min-h-[var(--brelly-hit-target)] items-center gap-one rounded-control px-two"
      >
        <Icon name={Icons.close} size="inline" />
        <Text variant="linkPrimary">{cancelLabel}</Text>
      </button>
    </header>
  );
}
