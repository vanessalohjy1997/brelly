"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import Link from "next/link";

import {
  applyDayToRange,
  applyEndTime,
  applyStartTime,
  computeNotificationTriggerTime,
  endsOnAnotherDay,
  formatLeadTime,
  formatPeriodLabel,
  resolveFrequency,
  resolveSlotKind,
  SLOT_KIND_HINTS,
  SLOT_KIND_LABELS,
  SLOT_KINDS,
  useSettingsStore,
  type RepeatRule,
  type SlotKind,
} from "@brelly/core";

import { Button } from "../Button";
import { Field } from "../Field";
import { Icon } from "../Icon";
import { Icons } from "../icons";
import { Text } from "../Text";
import { ChipGroup } from "./ChipGroup";
import {
  fromDateInputValue,
  fromTimeInputValue,
  toDateInputValue,
  toTimeInputValue,
} from "./dateTimeInputs";
import { RepeatField } from "./RepeatField";
import { useAlertsReachPhone } from "@/hooks/useAlertsReachPhone";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";

export type SlotFormValues = {
  label: string;
  location: string;
  latitude: number;
  longitude: number;
  /**
   * ISO 3166-1 alpha-2 for the chosen place, absent when the lookup did not
   * name one — "Use my location" never does. Carried rather than re-derived so
   * it stays whatever the place lookup actually said.
   */
  countryCode?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  /** Per-stop opt-out from rain alerts. */
  notificationsMuted?: boolean;
  /**
   * Whether the stop is under a roof. Optional so `initialValues` can pass a
   * slot's own (possibly absent) tag straight through; the submitted payload
   * always carries a concrete one.
   */
  kind?: SlotKind;
  /**
   * The days this stop repeats on, or null for a one-off. Only ever set on the
   * add page, and the caller turns it into a stored `Routine`.
   */
  repeat?: RepeatRule | null;
  notes?: string;
};

/** Which field an error belongs under. Errors render at the field, not in a pile. */
type FieldErrors = {
  location?: string;
  label?: string;
  time?: string;
  repeat?: string;
};

/** Checked in the order they appear, so the first failure is the topmost one. */
const ERROR_ORDER = ["location", "label", "time", "repeat"] as const;

type Props = {
  initialValues?: SlotFormValues;
  /**
   * `YYYY-MM-DD` the form was opened for. Only used when there are no
   * `initialValues` — it seeds the Starts/Ends defaults onto that day, so a
   * plan added from another day's page does not default to today.
   */
  initialDate?: string;
  onSubmit: (values: SlotFormValues) => void;
  onDelete?: () => void;
  submitLabel: string;
  /**
   * Told whenever the form starts or stops holding unsaved edits, so the page
   * around it can guard its exits. The form cannot do that itself — the Cancel
   * control, the sidebar and the browser's Back button all belong outside it.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Offer to repeat the stop. Only the add page does: an existing stop either
   * already belongs to a routine — in which case the edit page asks about scope
   * instead — or is a one-off, and turning one of those into a routine from
   * here would be indistinguishable from editing it.
   */
  allowRepeat?: boolean;
  /**
   * A dry period the stop could move onto, offered beside the time fields.
   * Pressing it *edits the fields* rather than saving: it used to write the
   * new time straight to the store and leave, which threw away every other
   * edit on the form without a word. Now it is one more change to Save.
   */
  dryWindow?: { start: string };
  /** Extra actions rendered between the fields and the submit button. */
  children?: ReactNode;
};

export function SlotForm({
  initialValues,
  initialDate,
  onSubmit,
  onDelete,
  submitLabel,
  onDirtyChange,
  allowRepeat = false,
  dryWindow,
  children,
}: Props) {
  const ids = useId();
  const field = (name: string) => `${ids}-${name}`;

  const { suggestions, isSearching, error, search, selectPlace } =
    usePlaceSearch();
  // The suggestion list is an overlay, so it has to close on its own — an
  // inline list could sit there harmlessly, one hanging over the Label field
  // cannot. Focus opens and closes it; the suggestions themselves survive a
  // blur so coming back to the field does not re-search.
  const [locationFocused, setLocationFocused] = useState(false);
  const {
    getCurrentLocation,
    isLocating,
    error: locationError,
    permissionDenied: locationDenied,
  } = useCurrentLocation();
  const rainAlertsEnabled = useSettingsStore((state) => state.rainAlertsEnabled);
  const rainLeadMinutes = useSettingsStore((state) => state.rainLeadMinutes);
  const alertsReachPhone = useAlertsReachPhone();

  const [label, setLabel] = useState(initialValues?.label ?? "");
  // Whether the label is the user's words or ours. A label prefilled from the
  // chosen place has to keep following the place while it is still ours, and
  // stop the moment it is not — silently overwriting something someone typed is
  // worse than not prefilling at all.
  const [labelIsMine, setLabelIsMine] = useState(!initialValues?.label);
  const [locationQuery, setLocationQuery] = useState(
    initialValues?.location ?? "",
  );
  const [selectedPlace, setSelectedPlace] = useState<{
    location: string;
    latitude: number;
    longitude: number;
    countryCode?: string;
  } | null>(
    initialValues
      ? {
          location: initialValues.location,
          latitude: initialValues.latitude,
          longitude: initialValues.longitude,
          countryCode: initialValues.countryCode,
        }
      : null,
  );
  const [range, setRange] = useState(() =>
    initialValues
      ? {
          start: new Date(initialValues.startTime),
          end: new Date(initialValues.endTime),
        }
      : defaultRange(initialDate),
  );
  const [notificationsMuted, setNotificationsMuted] = useState(
    initialValues?.notificationsMuted ?? false,
  );
  const [kind, setKind] = useState<SlotKind>(
    resolveSlotKind(initialValues?.kind),
  );
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // Whether the reader has chosen a time yet. A blank form defaults Starts to
  // the next whole hour, which is inside the alert lead window for most of
  // every hour — so the lead-time note would greet a form nobody had touched.
  const [timeTouched, setTimeTouched] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const dirty = initialValues
    ? label !== initialValues.label ||
      selectedPlace?.location !== initialValues.location ||
      range.start.toISOString() !== initialValues.startTime ||
      range.end.toISOString() !== initialValues.endTime ||
      notificationsMuted !== (initialValues.notificationsMuted ?? false) ||
      // Normalised on both sides: an untagged slot resolves to "outdoor", and
      // comparing that against `undefined` would read as dirty on mount.
      kind !== resolveSlotKind(initialValues.kind) ||
      notes !== (initialValues.notes ?? "")
    : label.trim().length > 0 || locationQuery.trim().length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleLocationChange = (text: string) => {
    setLocationFocused(true);
    setLocationQuery(text);
    setSelectedPlace(null);
    search(text);
  };

  const applyPlace = (place: {
    location: string;
    latitude: number;
    longitude: number;
    // Absent from "Use my location", which reverse-geocodes an address and
    // nothing else. Replacing a place therefore *clears* any code the previous
    // one carried, rather than leaving a stale country on new coordinates.
    countryCode?: string;
  }) => {
    setLocationQuery(place.location);
    setSelectedPlace(place);
    setErrors((current) => ({ ...current, location: undefined }));
    // Most stops are "the place". Asking for a label first and leaving it blank
    // made every plan a two-field chore for a name the app already knew.
    if (labelIsMine) setLabel(placeNameOf(place.location));
  };

  const handleSelectSuggestion = async (placeId: string) => {
    const details = await selectPlace(placeId);
    if (!details) return;
    applyPlace({
      location: details.displayName,
      latitude: details.latitude,
      longitude: details.longitude,
      countryCode: details.countryCode,
    });
  };

  const handleUseCurrentLocation = async () => {
    const current = await getCurrentLocation();
    if (current) applyPlace(current);
  };

  // Picking a kind sets the Rain alerts switch below it, and then lets go: the
  // switch is the user's from that point on, so an indoor stop they *do* want
  // warning for keeps it. That is also why the coupling lives here and not in
  // an effect — reopening such a stop to edit it must not re-apply the default
  // and undo the choice.
  //
  // Symmetric on purpose. If only Indoor moved the switch, correcting a mis-tap
  // by pressing Outdoor would leave alerts silently off, which is the worse of
  // the two ways to be wrong: a missing warning says nothing about itself.
  const handleKindChange = (next: SlotKind) => {
    if (next === kind) return;
    setKind(next);
    setNotificationsMuted(next === "indoor");
  };

  const clearPlace = () => {
    setSelectedPlace(null);
    setLocationQuery("");
    search("");
  };

  const handleSubmit = () => {
    const nextErrors: FieldErrors = {};
    if (!selectedPlace) {
      nextErrors.location = locationQuery.trim()
        ? "Pick one of the suggestions so we know where this is"
        : "Where is this stop?";
    }
    if (!label.trim()) nextErrors.label = "Give this plan a label";
    if (range.end.getTime() <= range.start.getTime()) {
      nextErrors.time = "End time must be after start time";
    }
    // A weekly repeat with no day selected has no meaning, and silently saving
    // it as a one-off would drop a choice the user made on purpose. A monthly
    // repeat needs no such check — its day comes from the stop's own date.
    if (
      allowRepeat &&
      repeat &&
      resolveFrequency(repeat.frequency) === "weekly" &&
      repeat.weekdays.length === 0
    ) {
      nextErrors.repeat = "Pick at least one day";
    }

    setErrors(nextErrors);

    const firstError = ERROR_ORDER.find((name) => nextErrors[name]);
    if (firstError) {
      // The phone scrolls to the first failing field, because the form is
      // taller than a screen and an error nobody can see says nothing. Moving
      // *focus* is the better web answer: it scrolls as a side effect and also
      // puts the caret where the fix has to be typed.
      formRef.current
        ?.querySelector<HTMLElement>(`#${CSS.escape(field(firstError))}`)
        ?.focus();
      return;
    }
    if (!selectedPlace) return; // narrowing; the check above already returned

    onSubmit({
      label: label.trim(),
      location: selectedPlace.location,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      countryCode: selectedPlace.countryCode,
      startTime: range.start.toISOString(),
      endTime: range.end.toISOString(),
      notificationsMuted,
      kind,
      repeat: allowRepeat ? repeat : null,
      notes: notes.trim() || undefined,
    });
  };

  // A longer lead time silently produces *fewer* alerts on near-term plans: the
  // trigger has already passed, so nothing is scheduled and nothing says so.
  // The form is the only place that can tell someone before they rely on it.
  // Muted stops and a global opt-out are not surprises, so they say nothing;
  // nor does a form whose time is still the default, or a session whose
  // alerts reach no phone at all.
  const tooSoonToWarn =
    alertsReachPhone &&
    rainAlertsEnabled &&
    !notificationsMuted &&
    (timeTouched || !!initialValues) &&
    computeNotificationTriggerTime(
      range.start.toISOString(),
      rainLeadMinutes,
    ) === null;

  // Offered until it is taken: once Starts sits on the suggested period there
  // is nothing left to move.
  const dryWindowStart = dryWindow ? new Date(dryWindow.start) : null;
  const dryWindowOffered =
    dryWindowStart && dryWindowStart.getTime() !== range.start.getTime();

  const moveToDryWindow = () => {
    if (!dryWindowStart) return;
    const duration = range.end.getTime() - range.start.getTime();
    setRange({
      start: dryWindowStart,
      end: new Date(dryWindowStart.getTime() + duration),
    });
    setTimeTouched(true);
  };

  // The messages the Location field has to show, in the order they appear.
  const locationMessages = [error, locationError].filter(
    (message): message is string => !!message,
  );
  const showSuggestions =
    locationFocused && suggestions.length > 0 && !selectedPlace;

  return (
    <form
      ref={formRef}
      // `noValidate` because the validation here says more than the browser's
      // can: "pick one of the suggestions" is not a shape a required field can
      // express, and a native bubble would say "please fill in this field"
      // about a control the user did fill in.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-four pb-six"
    >
      {/* Location first. It used to come second, under a Label field that had
          nothing to prefill it — so the app asked for a name before it knew the
          one thing that could supply one. */}
      <Field
        id={field("location")}
        label="Location"
        error={errors.location}
        hint={
          <div className="flex flex-col gap-half">
            <div className="flex flex-wrap items-center justify-between gap-two">
              <button
                type="button"
                onClick={() => void handleUseCurrentLocation()}
                disabled={isLocating}
                className="flex min-h-[var(--brelly-hit-target)] items-center gap-one rounded-control text-text-secondary"
              >
                {!isLocating && <Icon name={Icons.location} size="metadata" />}
                <Text variant="small" color="inherit">
                  {isLocating ? "Finding you…" : "Use my location"}
                </Text>
              </button>
              {/* Rides in this row rather than on a line of its own: it appears
                  on nearly every keystroke, and a line that comes and goes
                  under the field is a line that shifts the form. */}
              {isSearching && (
                <Text variant="small" color="textSecondary">
                  Searching…
                </Text>
              )}
            </div>
            {locationMessages.map((message) => (
              <Text key={message} variant="small" color="danger">
                {message}
              </Text>
            ))}
            {/* A refusal is the one message here with somewhere to go — and on
                the web that somewhere is not a link. The browser's permission
                panel cannot be opened by a page, so this names it. */}
            {locationDenied && (
              <Text variant="small" color="textSecondary">
                Allow location again from the padlock beside the address bar.
              </Text>
            )}
          </div>
        }
      >
        {selectedPlace ? (
          // A picked place used to render as ordinary text in the same input,
          // so "typed but not chosen" and "resolved to real coordinates" were
          // indistinguishable — and only the second one can be submitted.
          <div className="flex min-h-[var(--brelly-hit-target)] items-center gap-two rounded-control border border-primary bg-background-element px-three py-two">
            <Icon name={Icons.success} size="inline" className="text-primary" />
            <Text variant="default" className="flex-1 line-clamp-2">
              {selectedPlace.location}
            </Text>
            <button
              type="button"
              onClick={clearPlace}
              aria-label="Clear location"
              className="flex min-h-[var(--brelly-hit-target)] items-center px-two text-text-secondary"
            >
              <Icon name={Icons.clear} size="inline" />
            </button>
          </div>
        ) : (
          // The input and its dropdown are one unit: the list is absolutely
          // positioned against this wrapper so it hangs over whatever is below
          // rather than pushing the rest of the form down the page on every
          // keystroke.
          <div className="relative z-[var(--brelly-z-field)]">
            <input
              id={field("location")}
              type="text"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={field("location-suggestions")}
              aria-autocomplete="list"
              aria-describedby={
                errors.location ? `${field("location")}-error` : undefined
              }
              aria-invalid={!!errors.location}
              value={locationQuery}
              onChange={(event) => handleLocationChange(event.target.value)}
              onFocus={() => setLocationFocused(true)}
              // Deferred past the click that caused it: a mousedown on a
              // suggestion blurs the input, and closing the list in that same
              // tick removes the element the click was headed for.
              onBlur={() => window.setTimeout(() => setLocationFocused(false), 150)}
              placeholder="Search for a place"
              autoComplete="off"
              className={`min-h-[var(--brelly-hit-target)] w-full rounded-control bg-background-element px-three text-default text-text placeholder:text-text-secondary ${
                errors.location ? "border border-danger" : ""
              }`}
            />

            {showSuggestions && (
              <ul
                id={field("location-suggestions")}
                aria-label="Location suggestions"
                className="absolute inset-x-0 top-full z-[var(--brelly-z-dropdown)] mt-one overflow-hidden rounded-control border border-border bg-background-element shadow-dropdown"
              >
                {suggestions.map((suggestion) => (
                  <li key={suggestion.placeId}>
                    <button
                      type="button"
                      onClick={() => void handleSelectSuggestion(suggestion.placeId)}
                      className="flex w-full flex-col items-start px-three py-two text-left"
                    >
                      <Text variant="default" className="truncate">
                        {suggestion.displayName}
                      </Text>
                      <Text variant="small" color="textSecondary" className="truncate">
                        {suggestion.secondaryText}
                      </Text>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      <Field id={field("label")} label="Label" error={errors.label}>
        <input
          id={field("label")}
          type="text"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            // From here the label is theirs, and picking another place must not
            // overwrite it.
            setLabelIsMine(false);
            if (event.target.value.trim()) {
              setErrors((current) => ({ ...current, label: undefined }));
            }
          }}
          aria-describedby={errors.label ? `${field("label")}-error` : undefined}
          aria-invalid={!!errors.label}
          placeholder="e.g. Lunch with Sam"
          className={`min-h-[var(--brelly-hit-target)] w-full rounded-control bg-background-element px-three text-default text-text placeholder:text-text-secondary ${
            errors.label ? "border border-danger" : ""
          }`}
        />
      </Field>

      {/* One date, then two times. Both fields used to be a combined
          date-and-time, so moving a plan to another day meant editing the same
          date twice and the two could silently end up on different days. */}
      <Field id={field("time")} label="Day" error={errors.time}>
        <input
          id={field("time")}
          type="date"
          value={toDateInputValue(range.start)}
          onChange={(event) => {
            const day = fromDateInputValue(event.target.value);
            if (day) setRange((r) => applyDayToRange(r, day));
            setTimeTouched(true);
          }}
          className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background-element px-three text-default text-text"
        />
      </Field>

      {/* Side by side where there is room, stacked where there is not. The
          breakpoint is CSS rather than `useWindowDimensions`, but the *reason*
          is the same one `shouldStackDateTimeFields` documents: two time
          controls below a certain width overlap rather than wrap. */}
      <div className="flex flex-col gap-four sm:flex-row sm:gap-three">
        <Field id={field("starts")} label="Starts">
          <input
            id={field("starts")}
            type="time"
            value={toTimeInputValue(range.start)}
            onChange={(event) => {
              const time = fromTimeInputValue(event.target.value, range.start);
              if (time) setRange((r) => applyStartTime(r, time));
              setTimeTouched(true);
            }}
            className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background-element px-three text-default text-text"
          />
        </Field>

        <Field
          id={field("ends")}
          label="Ends"
          hint={
            endsOnAnotherDay(range) ? (
              <Text variant="small" color="textSecondary">
                Next day
              </Text>
            ) : undefined
          }
        >
          <input
            id={field("ends")}
            type="time"
            value={toTimeInputValue(range.end)}
            onChange={(event) => {
              const time = fromTimeInputValue(event.target.value, range.end);
              if (time) setRange((r) => applyEndTime(r, time));
              setTimeTouched(true);
            }}
            className="min-h-[var(--brelly-hit-target)] w-fit rounded-control bg-background-element px-three text-default text-text"
          />
        </Field>
      </div>

      {dryWindowOffered && (
        <button
          type="button"
          onClick={moveToDryWindow}
          className="flex items-center gap-two rounded-control border border-umbrella-sun p-three text-left"
        >
          <Icon name={Icons.uv} size="inline" className="text-umbrella-sun" />
          <span className="flex flex-1 flex-col gap-half">
            <Text variant="smallBold">
              {formatPeriodLabel(dryWindowStart.toISOString())} looks dry
            </Text>
            <Text variant="small" color="textSecondary">
              Move this stop, then save
            </Text>
          </span>
        </button>
      )}

      {allowRepeat && (
        <div id={field("repeat")} tabIndex={-1}>
          <RepeatField
            value={repeat}
            onChange={setRepeat}
            anchor={range.start}
            error={errors.repeat}
          />
        </div>
      )}

      {/* Directly above the switch it seeds, so pressing a chip and the switch
          moving are one thing seen at once rather than a change somewhere off
          screen. Unlike Repeat this renders on the edit page too — a stop can
          turn out to be indoor after it was added. */}
      <div className="flex flex-col gap-one">
        <ChipGroup
          name="slot-kind"
          legend="Indoor or outdoor"
          value={kind}
          onChange={handleKindChange}
          options={SLOT_KINDS.map((option) => ({
            value: option,
            label: SLOT_KIND_LABELS[option],
          }))}
        />
        {/* Says what the tag is *for*. Without it the two chips look like
            filing, and nothing on screen connects them to the switch below. */}
        <Text variant="small" color="textSecondary">
          {SLOT_KIND_HINTS[kind]}
        </Text>
      </div>

      <div className="flex items-center justify-between gap-three">
        <div className="flex flex-col">
          <label htmlFor={field("alerts")} className="text-default text-text">
            Rain alerts
          </label>
          <Text variant="small" color="textSecondary">
            {/* Rain matters for a park and not for a mall — muting per stop is
                what keeps the alerts worth reading. The web sends none itself:
                the switch is honoured by the phone app, and only when it reads
                the same account, so the copy says which of the two is true. */}
            {alertsReachPhone ? (
              "Get a heads-up on your phone if this stop looks wet"
            ) : (
              <>
                Sent by the Brelly app on your phone.{" "}
                <Link href="/account" className="text-primary underline">
                  Add an account
                </Link>{" "}
                to share your plans with it.
              </>
            )}
          </Text>
        </div>
        {/* A checkbox, not a switch: CSS has no switch, and an
            `role="switch"` checkbox is the same control with a different word
            for it. The look is the affordance; the semantics stay the ones the
            browser already gives a keyboard. */}
        <input
          id={field("alerts")}
          type="checkbox"
          checked={!notificationsMuted}
          onChange={(event) => setNotificationsMuted(!event.target.checked)}
          className="size-[var(--brelly-icon-control-emphasis)] shrink-0 accent-[var(--brelly-primary)]"
        />
      </div>

      {tooSoonToWarn && (
        <Text variant="small" color="textSecondary">
          This starts too soon for a rain alert — they go out{" "}
          {formatLeadTime(rainLeadMinutes)} ahead.
        </Text>
      )}

      <Field id={field("notes")} label="Notes">
        <textarea
          id={field("notes")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Anything to remember for this stop"
          className="w-full rounded-control bg-background-element p-three text-default text-text placeholder:text-text-secondary"
        />
      </Field>

      {children}

      {/* Last in the form rather than pinned below a scroll view. The phone
          fixes its footer because a modal's scroll could leave the primary
          action off screen; a page scrolls as one, and a sticky bar on a phone
          browser fights the URL bar for the same strip of screen. */}
      <div className="flex flex-col gap-two border-t border-border pt-three">
        <Button type="submit">{submitLabel}</Button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="min-h-[var(--brelly-hit-target)] rounded-control"
          >
            <Text variant="smallBold" color="danger">
              Delete plan
            </Text>
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * The bit of a Google display name worth using as a label — "Singapore Botanic
 * Gardens" out of "Singapore Botanic Gardens, Cluny Road, Singapore".
 *
 * Everything after the first comma is address, and an address is what the
 * Location field already says. A label repeating it would leave both rows of
 * the card saying the same thing.
 */
export function placeNameOf(displayName: string): string {
  const [name] = displayName.split(",");
  return name.trim() || displayName.trim();
}

function nextHour(): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

/**
 * What "Starts" defaults to on a blank form: the next whole hour, shifted onto
 * `dateKey` when the form was opened from a specific day. A plan is filed under
 * the day its start time falls on, so leaving the default on today would land
 * plans added from another day's page on the wrong day.
 */
export function defaultStartTime(dateKey?: string): Date {
  const start = nextHour();
  if (!dateKey) return start;

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return start;

  // Set all three at once — setting the month alone can roll the date over
  // (31 January with the month set to February lands in March).
  start.setFullYear(year, month - 1, day);
  return start;
}

function defaultRange(dateKey?: string) {
  const start = defaultStartTime(dateKey);
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}
