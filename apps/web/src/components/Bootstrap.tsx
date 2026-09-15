"use client";

import { useRoutineSync } from "@/hooks/useRoutineMaterializer";
import { useCloudBootstrap } from "@/hooks/useCloudBootstrap";

/**
 * Runs the app's two root-mounted jobs once, and renders nothing.
 *
 * A component rather than calls inside the layout, because the layout is a
 * server component. Rendering nothing is also what keeps readiness out of the
 * tree: screens read it from the store, so a flag flipping does not re-render
 * everything under the root.
 *
 * Two of the phone's three root hooks are here. `useRoutineSync` fills in the
 * next fortnight of every routine — deterministic ids make that idempotent
 * across clients, and skipping it would mean a routine deleted from a browser
 * left its stops standing until the phone next opened.
 *
 * `useNotificationSync` is absent, and that is not an oversight: notifications
 * are one of the features web does not have at all, so there is no queue to
 * bring back in line with the forecast.
 */
export function Bootstrap() {
  useCloudBootstrap();
  useRoutineSync();
  return null;
}
