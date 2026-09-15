"use client";

import { useCloudBootstrap } from "@/hooks/useCloudBootstrap";

/**
 * Runs the cloud bootstrap once, at the root, and renders nothing.
 *
 * A component rather than a call inside the layout because the layout is a
 * server component. It is also the reason the hook's return value is ignored
 * here: readiness is read where it is needed, from the store, rather than
 * threaded down through a tree that would then re-render whole on every flag.
 *
 * What the phone's root additionally mounts — `useRoutineSync` and
 * `useNotificationSync` — is absent on purpose. Notifications are one of the
 * features web does not have, and routine materialisation writes plans: running
 * it from a browser tab alongside a phone doing the same thing is two writers
 * for one job, with no ordering field in the sync layer to resolve them. The
 * phone stays the materialiser; the web reads what it produced.
 */
export function Bootstrap() {
  useCloudBootstrap();
  return null;
}
