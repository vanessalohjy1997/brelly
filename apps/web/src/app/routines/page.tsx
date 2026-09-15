"use client";

import {
  describeRoutine,
  resolveSlotKind,
  SLOT_KIND_LABELS,
  useCloudBootstrapError,
  useCloudReady,
  useRoutineStore,
  type Routine,
} from "@brelly/core";

import { EmptyState } from "@/components/EmptyState";
import { Icons } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";
import { Text } from "@/components/Text";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";

/**
 * What a rule does, on one line: when it runs, whether it is under cover, and
 * whether it says anything when it rains.
 *
 * Built as a list of parts and joined, rather than a run of conditional
 * fragments in the markup — the separator is then the join's problem rather
 * than each fragment's, which is how the phone's version ended up rendering a
 * leading "·" for an indoor routine with alerts already on.
 */
function describeSchedule(routine: Routine): string {
  const parts = [`${routine.startTime} – ${routine.endTime}`];
  if (resolveSlotKind(routine.kind) === "indoor") {
    parts.push(SLOT_KIND_LABELS.indoor);
  }
  if (routine.notificationsMuted) parts.push("Alerts off");
  return parts.join(" · ");
}

function RoutineRow({ routine }: { routine: Routine }) {
  const repeat = describeRoutine(routine);

  return (
    <Surface as="li" radius="control" className="flex items-center gap-two p-three">
      <div className="flex min-w-0 flex-1 flex-col gap-half">
        <Text variant="smallBold" as="h2" className="truncate">
          {routine.label}
        </Text>
        <Text variant="small" color="textSecondary" className="truncate">
          {routine.location}
        </Text>
        {repeat && (
          <Text variant="small" color="textSecondary">
            {repeat}
          </Text>
        )}
        <Text variant="small" color="textSecondary">
          {describeSchedule(routine)}
        </Text>
      </div>
      {routine.exceptions.length > 0 && (
        <Text variant="small" color="textSecondary">
          {routine.exceptions.length} skipped
        </Text>
      )}
    </Surface>
  );
}

/**
 * Every repeating plan, as the rules they actually are.
 *
 * Read-only, exactly as on the phone. A routine is edited from one of its own
 * stops — that is where "this day or the rule?" can be asked with a date in
 * hand — and a delete offered from here would have no such day to name, so it
 * could only mean the whole series. The one thing added is the `<h1>`: the
 * phone reaches this screen through a pushed navbar title, and a web page has
 * to name itself.
 */
export default function RoutinesPage() {
  const routines = useRoutineStore((state) => state.routines);
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();

  return (
    <>
      <PageHeader title="Routines" />
      {!ready ? (
        <Skeleton
          label="Loading your routines…"
          error={bootstrapError}
          onRetry={retryCloudBootstrap}
        />
      ) : routines.length === 0 ? (
        <EmptyState
          icon={Icons.repeat}
          title="No routines"
          body="Add a repeating plan and it will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-two py-three">
          {routines.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} />
          ))}
        </ul>
      )}
    </>
  );
}
