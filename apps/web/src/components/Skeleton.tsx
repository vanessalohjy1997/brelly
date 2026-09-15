import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  /** What the user is waiting for — "Loading your plans", not "Loading…". */
  label?: string;
  /**
   * Set once cloud bootstrap has failed outright (`useCloudBootstrapError()`) —
   * swaps the spinner for the error and a retry, rather than leaving the reader
   * staring at "Loading…" with no way out.
   */
  error?: string | null;
  onRetry?: () => void;
};

/**
 * The gap between mount and a store's first cloud snapshot landing.
 *
 * Gated on `useCloudReady()`, not on the network, so it clears from the local
 * Firestore cache even offline — on a browser that has one. Where the cache
 * fell back to memory there is nothing to clear it, which is what
 * `useCloudBootstrap`'s timeout exists to say out loud.
 */
export function Skeleton({ label = "Loading…", error, onRetry }: Props) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-two px-four py-six text-center"
      >
        <Text variant="smallBold" color="danger">
          {error}
        </Text>
        {onRetry && (
          <Button tone="quiet" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-two px-four py-six"
    >
      {/* A ring rather than a bar, because there is no progress to report —
          this is a wait of unknown length. `motion-safe:` because a spinner is
          exactly the kind of perpetual movement "reduce motion" is about; what
          is left without it is the label, which is the part that says
          anything. */}
      <span
        aria-hidden="true"
        className="size-[var(--brelly-icon-hero)] rounded-full border-2 border-border border-t-primary motion-safe:animate-spin"
      />
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
    </div>
  );
}
