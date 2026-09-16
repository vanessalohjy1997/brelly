import type { ReactNode } from "react";

import { Text } from "./Text";

/**
 * The title row every screen opens with.
 *
 * On the phone this is a fixed-height block, sized so switching tabs does not
 * shift the content below it — `HeaderHeight` exists for that one reason. The
 * same token holds it here as a *minimum* rather than a fixed height: a browser
 * window can be narrow enough that a title and its actions wrap, and a fixed
 * height there clips them.
 *
 * The title is the page's `<h1>`. There is no heading hierarchy to port —
 * nothing in `src/app` uses `accessibilityRole="header"` — so it is invented
 * here, and this is the top of it.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-[var(--brelly-header-height)] flex-wrap items-center justify-between gap-two py-two">
      <div>
        <Text variant="title" as="h1">
          {title}
        </Text>
        {subtitle && (
          <Text variant="default" color="textSecondary" as="p">
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div className="flex items-center gap-two">{actions}</div>}
    </header>
  );
}
