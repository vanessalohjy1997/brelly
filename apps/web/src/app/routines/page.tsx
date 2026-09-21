"use client";

import Link from "next/link";

import {
  describeRoutine,
  resolveSlotKind,
  SLOT_KIND_LABELS,
  useCloudBootstrapError,
  useCloudReady,
  useItineraryStore,
  useRoutineStore,
  type Routine,
} from "@brelly/core";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Icons } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";
import { Text } from "@/components/Text";
import { retryCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useDeleteRoutineWithUndo } from "@/hooks/useDeleteRoutineWithUndo";
import { nextRoutineStop } from "@/utils/nextRoutineStop";

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

function RoutineRow({
  routine,
  nextStopId,
  onDelete,
}: {
  routine: Routine;
  /** The rule's next stop, which is where it is edited from. */
  nextStopId: string | null;
  onDelete: () => void;
}) {
  const repeat = describeRoutine(routine);

  return (
    <Surface as="li" radius="control" className="flex items-center gap-two p-three">
      <div className="flex min-w-0 flex-1 flex-col gap-half">
        <Text variant="smallBold" as="h2" className="truncate">
          {/* A rule is edited from one of its own stops — that is where "this
              day or the rule?" can be asked with a date in hand — so the title
              goes to the next one. Until the materialiser has filled one in
              there is nowhere to go, and the title stays text. */}
          {nextStopId ? (
            <Link href={`/plan/${nextStopId}`} className="hover:underline">
              {routine.label}
            </Link>
          ) : (
            routine.label
          )}
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
        {routine.exceptions.length > 0 && (
          <Text variant="small" color="textSecondary">
            {routine.exceptions.length} skipped
          </Text>
        )}
      </div>
      {/* The one delete here has no day to name, so it can only mean the whole
          series — which is why it was withheld before. The undo on the toast
          is what makes offering it safe: the rule and its days come back under
          the same ids. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${routine.label} and its repeats`}
        className="flex min-h-[var(--brelly-hit-target)] shrink-0 items-center gap-one rounded-control px-two text-danger"
      >
        <Icon name={Icons.delete} size="inline" />
        <Text variant="eyebrow" color="inherit">
          Delete
        </Text>
      </button>
    </Surface>
  );
}

/**
 * Every repeating plan, as the rules they actually are.
 *
 * Editing still happens from a stop, as on the phone, because that is where
 * "this day or the rule?" can be asked. What this page adds over the phone's
 * is the way *to* that stop, and a delete of the whole rule — the two things
 * that made it a dead end: a list of rules with nothing to press.
 */
export default function RoutinesPage() {
  const routines = useRoutineStore((state) => state.routines);
  const plans = useItineraryStore((state) => state.plans);
  const ready = useCloudReady();
  const bootstrapError = useCloudBootstrapError();
  const deleteWithUndo = useDeleteRoutineWithUndo();
  const now = new Date();

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
            <RoutineRow
              key={routine.id}
              routine={routine}
              nextStopId={nextRoutineStop(plans, routine.id, now)?.id ?? null}
              onDelete={() => deleteWithUndo(routine)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
