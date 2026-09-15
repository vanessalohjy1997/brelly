"use client";

import Link from "next/link";

import {
  saveWithFeedback,
  showToast,
  useSettingsStore,
  type ThemePreference,
} from "@brelly/core";

import { Button } from "@/components/Button";
import { ChipGroup } from "@/components/itinerary/ChipGroup";
import { PageHeader } from "@/components/PageHeader";
import { Surface } from "@/components/Surface";
import { Text } from "@/components/Text";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useDeviceLocationPermission } from "@/hooks/useDeviceLocationPermission";
import { exportBackup } from "@/services/backup";
import { useCacheIsDegraded } from "@/store/localCacheStore";
import type { PermissionState } from "@/store/deviceLocationStore";

const APPEARANCE: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * What the browser's answer means, and what — if anything — is left to do
 * about it.
 *
 * The phone's copy names iOS and system settings. Neither is true here: a
 * browser's refusal is per-site, is undone in a panel behind the padlock, and
 * *can* be re-asked in some browsers after the site data is cleared. So the
 * strings are rewritten rather than ported, and the promise the granted case
 * makes — "only while Brelly is open" — is kept, because it is still true.
 */
const LOCATION_COPY: Record<PermissionState, { state: string; detail: string }> = {
  checking: { state: "Location", detail: "Checking…" },
  granted: {
    state: "Location is on",
    detail:
      "Used only while Brelly is open, to prefill a stop's location and show nearby weather on an empty day.",
  },
  unprompted: {
    state: "Location is off",
    detail:
      "Your plans are forecast from the place on each stop, so this is optional. Turning it on saves typing when you add a stop.",
  },
  denied: {
    state: "Location is off",
    detail:
      "This site is blocked from reading it, which only the browser can undo — look for the padlock beside the address bar. Your plans are forecast from the place on each stop either way.",
  },
  unavailable: {
    state: "Location is on, but no position came back",
    detail:
      "Brelly may read it again on its own. Check that location is switched on for the device, not just for this site.",
  },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-one">
      <Text variant="fieldLabel" color="textSecondary" as="h2">
        {title}
      </Text>
      <Surface className="flex flex-col gap-three p-three">{children}</Surface>
    </section>
  );
}

/**
 * Three sections, where the phone has seven.
 *
 * Notifications, "Check your alerts", Calendar and App updates are all
 * hidden rather than half-built — there is nothing behind them on the web. That
 * is safe for the shared settings document because every write here goes
 * through an individual setter and `writeSettingsFields` merges: a client that
 * never renders those cards never writes their fields, so the phone's alert
 * settings survive a visit from a laptop untouched.
 */
export default function SettingsPage() {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference,
  );
  const { permission, request } = useDeviceLocationPermission();
  const authUser = useAuthUser();
  const linkedAs =
    authUser && !authUser.isAnonymous
      ? (authUser.email ?? authUser.displayName ?? "your account")
      : null;
  const memoryOnlyCache = useCacheIsDegraded();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-four py-three">
        <Section title="Appearance">
          <ChipGroup
            name="appearance"
            legend="Appearance"
            value={themePreference}
            onChange={(value) => {
              const option = APPEARANCE.find((entry) => entry.value === value);
              saveWithFeedback(() => setThemePreference(value), {
                success: `Appearance set to ${option?.label ?? value}`,
                failure: "Couldn't save that. Try again.",
              });
            }}
            options={APPEARANCE}
          />
        </Section>

        {/* Nothing else in the app mentions location until a form needs it, so
            without a row that states the current answer a refusal is a dead end
            — the browser will not ask twice on its own. */}
        <Section title="Location">
          <div className="flex flex-col gap-half">
            <Text variant="default">{LOCATION_COPY[permission].state}</Text>
            <Text variant="small" color="textSecondary">
              {LOCATION_COPY[permission].detail}
            </Text>
          </div>
          {/* Only `unprompted` still has a dialog left to show. Offering "ask
              again" on the two off states is the button that silently does
              nothing, and `granted`/`checking` need no action at all. */}
          {permission === "unprompted" && (
            <div>
              <Button tone="quiet" onClick={() => void request()}>
                Continue
              </Button>
            </div>
          )}
        </Section>

        <Section title="Backup">
          <div className="flex flex-col gap-two">
            <div>
              <Button
                tone="quiet"
                onClick={() => {
                  try {
                    exportBackup();
                    showToast("Backup downloaded", "success");
                  } catch {
                    showToast("Couldn't export backup", "error");
                  }
                }}
              >
                Export data
              </Button>
            </div>
            <Text variant="small" color="textSecondary">
              Downloads all plans, routines, and settings as a JSON file. The
              phone reads the same file.
            </Text>
          </div>

          <div className="flex flex-col gap-two">
            <div>
              {/* The label stays a short, fixed action and the address goes in
                  the hint — an email is status, not an action, and a long one
                  inside a centred button reads as a broken button. */}
              <Link
                href="/account"
                className="inline-flex min-h-[var(--brelly-hit-target)] items-center rounded-control bg-background-element px-three text-small-bold text-text"
              >
                {linkedAs ? "Your account" : "Back up your data"}
              </Link>
            </div>
            <Text variant="small" color="textSecondary">
              {linkedAs
                ? `Backed up as ${linkedAs}. Your plans, routines, and settings follow you to another device.`
                : "Add an account so your plans survive a lost laptop."}
            </Text>
          </div>

          {/* The one browser-specific failure worth a permanent row. Without a
              persistent cache an edit made offline is gone on reload, with no
              error anywhere — see `services/firebase.ts`. */}
          {memoryOnlyCache && (
            <Text variant="small" color="danger">
              This browser wouldn&apos;t let Brelly store anything locally, so
              changes made offline won&apos;t survive a reload. A private window
              and some tracking-protection settings do this.
            </Text>
          )}
        </Section>
      </div>
    </>
  );
}
