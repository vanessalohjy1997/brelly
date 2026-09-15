"use client";

import type { PermissionState } from "@/store/deviceLocationStore";

import { Button } from "../Button";
import { Icon } from "../Icon";
import { Icons } from "../icons";
import { Surface } from "../Surface";
import { Text } from "../Text";

type Props = {
  permission: PermissionState;
  onRequest: () => void;
};

/**
 * Asks for location *before* the browser does, and says where the way back is
 * after a refusal.
 *
 * The prompt used to fire from a mount effect on the phone, so the system sheet
 * appeared with no explanation and a "Don't Allow" removed nearby weather
 * permanently. Explaining first is what makes the grant an informed one.
 *
 * The denied branch is where the web and the phone genuinely part. The phone
 * deep-links into Settings; `openAppSettings()` returns `false` here and always
 * will, because a page cannot open the browser's own permission UI — it is the
 * one control a site is not allowed to drive. So the copy names the control
 * instead, and there is no button pretending otherwise. The padlock is where it
 * is in every desktop browser; on iOS Safari it is the "aA" menu, which is why
 * the wording says "site settings" rather than naming one place.
 */
export function NearbyWeatherPrompt({ permission, onRequest }: Props) {
  if (permission === "granted" || permission === "checking") return null;

  const denied = permission === "denied";
  const unavailable = permission === "unavailable";

  return (
    <Surface as="section" className="flex flex-col items-center gap-two p-three text-center">
      <Icon name={Icons.location} size="lead" className="text-primary" />
      <Text variant="default" as="h2" className="font-semibold">
        {denied
          ? "Location is blocked"
          : unavailable
            ? "Couldn't find you"
            : "Weather where you are"}
      </Text>
      <Text variant="small" color="textSecondary">
        {denied
          ? "This site is blocked from reading your location, so we can't show the forecast near you. Allow it again from the padlock beside the address bar — a page can't open that panel itself."
          : unavailable
            ? "Location is on, but no position came back. Moving somewhere with a clearer view of the sky usually fixes it."
            : "See the next few hours for your area. Brelly only reads your location while you have this page open."}
      </Text>
      {!denied && (
        <Button onClick={onRequest} className="mt-one">
          {unavailable ? "Try again" : "Show weather near me"}
        </Button>
      )}
    </Surface>
  );
}
