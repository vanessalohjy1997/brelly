import type { ReactNode } from "react";

import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { Text } from "./Text";

/**
 * The shape every "there is nothing here" panel takes.
 *
 * One component rather than five copies because the phone's five say slightly
 * different things for the same reason, and the differences that matter are the
 * *words* — "Nothing upcoming" for someone whose plans have all happened,
 * "Nothing planned" for someone with none — not the layout.
 *
 * The icon is optional, and the caller drops it when a forecast card is already
 * above: with one, this icon is repetition; without one, the empty state needs
 * its own visual anchor.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-two px-four py-six text-center">
      {icon && (
        <Icon name={icon} size="hero" className="mb-two text-text-secondary" />
      )}
      <Text variant="subtitle" as="h2">
        {title}
      </Text>
      <Text variant="default" color="textSecondary">
        {body}
      </Text>
      {action}
    </div>
  );
}
