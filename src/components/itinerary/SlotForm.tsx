import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Icon } from "@/components/icon";
import { RepeatField } from "@/components/itinerary/RepeatField";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { IconSize, Spacing } from "@/constants/theme";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useAppColorScheme, useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import type { RepeatRule } from "@/types/routine";
import { computeNotificationTriggerTime } from "@/utils/computeNotificationTriggerTime";
import { formatLeadTime } from "@/utils/formatLeadTime";
import {
  DatePickerWidth,
  shouldStackDateTimeFields,
} from "@/utils/shouldStackDateTimeFields";
import {
  resolveSlotKind,
  SLOT_KIND_HINTS,
  SLOT_KIND_LABELS,
  SLOT_KINDS,
  type SlotKind,
} from "@/utils/slotKind";
import {
  applyDayToRange,
  applyEndTime,
  applyStartTime,
  endsOnAnotherDay,
} from "@/utils/slotTimeFields";

export type SlotFormValues = {
  label: string;
  location: string;
  latitude: number;
  longitude: number;
  /**
   * ISO 3166-1 alpha-2 for the chosen place, absent when the lookup didn't
   * name one — "Use my location" never does. Carried rather than re-derived so
   * it stays whatever the place lookup actually said; see
   * `ItinerarySlot.countryCode`.
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
   * The days this stop repeats on, or null/absent for a one-off. Only ever set
   * on the add screen, and the caller turns it into a stored `Routine` — see
   * `planRoutineMaterialization` for how a rule becomes stops.
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

type Props = {
  initialValues?: SlotFormValues;
  /**
   * `YYYY-MM-DD` the form was opened for. Only used when there are no
   * `initialValues` — it seeds the Starts/Ends defaults onto that day so a plan
   * added from another day's screen doesn't default to today.
   */
  initialDate?: string;
  onSubmit: (values: SlotFormValues) => void;
  onDelete?: () => void;
  submitLabel: string;
  /**
   * Told whenever the form starts or stops holding unsaved edits, so the
   * screen around it can guard its dismiss paths. The form can't do that
   * itself — the Cancel button and the modal's swipe-down both belong to the
   * screen, not to the fields.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Offer to repeat the stop. Only the add screen does: an existing stop either
   * already belongs to a routine — in which case the edit screen asks about
   * scope instead — or is a one-off, and turning one of those into a routine
   * from here would be indistinguishable from editing it.
   */
  allowRepeat?: boolean;
  /** Extra actions rendered between the submit button and delete button. */
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
  children,
}: Props) {
  const theme = useTheme();
  // The pickers are real UIKit/SwiftUI views, so they read the *system*
  // appearance and know nothing about the in-app theme preference. On the dark
  // theme over a light system that gave a translucent light chip with black
  // label text over the dark form — see `pickerScheme` below.
  const colorScheme = useAppColorScheme();
  const { width } = useWindowDimensions();
  const stackDateTimeFields = shouldStackDateTimeFields(
    width - FormPadding * 2,
    FormGap,
  );
  const { suggestions, isSearching, error, search, selectPlace } =
    usePlaceSearch();
  // The suggestion list is an overlay now, so it has to close on its own —
  // an inline list could sit there harmlessly, one hanging over the Label
  // field cannot. Focus is what opens and closes it; the suggestions
  // themselves survive a blur so coming back to the field doesn't re-search.
  const [locationFocused, setLocationFocused] = useState(false);
  const {
    getCurrentLocation,
    isLocating,
    error: locationError,
  } = useCurrentLocation();
  const rainAlertsEnabled = useSettingsStore(
    (state) => state.rainAlertsEnabled,
  );
  const rainLeadMinutes = useSettingsStore((state) => state.rainLeadMinutes);

  const [label, setLabel] = useState(initialValues?.label ?? "");
  // Whether the label is the user's words or ours. A label prefilled from the
  // chosen place has to keep following the place while it is still ours, and
  // stop the moment it isn't — silently overwriting something someone typed is
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

  const scrollRef = useRef<ScrollView>(null);
  // Where each field sits in the scroll view, filled in by `onLayout`. Without
  // this the first failing field can be off screen when Save is pressed — the
  // form is taller than a phone — and the error says nothing to someone who
  // can't see it.
  const fieldOffsets = useRef<Record<keyof FieldErrors, number>>({
    location: 0,
    label: 0,
    time: 0,
    repeat: 0,
  });

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
    // Typing implies the field is focused, and saying so here rather than
    // relying on `onFocus` alone keeps the dropdown from depending on the
    // order two native events happen to arrive in.
    setLocationFocused(true);
    setLocationQuery(text);
    setSelectedPlace(null);
    search(text);
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
    if (!current) return;
    applyPlace(current);
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
    // Most stops are "the place". Asking for a label first and leaving it
    // blank made every plan a two-field chore for a name the app already knew.
    if (labelIsMine) setLabel(placeNameOf(place.location));
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
    // A repeat with no day selected has no meaning, and silently saving it as a
    // one-off would drop a choice the user made on purpose.
    if (allowRepeat && repeat && repeat.weekdays.length === 0) {
      nextErrors.repeat = "Pick at least one day";
    }

    setErrors(nextErrors);
    // Fields are checked in the order they appear, so the first failure is
    // also the topmost one — scrolling to it is what makes an error on a
    // field below the fold reachable at all.
    const firstError = (["location", "label", "time", "repeat"] as const).find(
      (field) => nextErrors[field],
    );
    if (firstError) {
      scrollRef.current?.scrollTo({
        y: Math.max(fieldOffsets.current[firstError] - Spacing.four, 0),
        animated: true,
      });
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

  // A longer lead time silently produces *fewer* alerts on near-term plans:
  // the trigger has already passed, so nothing is scheduled and nothing says
  // so. The form is the only place that can tell someone before they rely on
  // it. Muted stops and a global opt-out are not surprises, so they say nothing.
  const tooSoonToWarn =
    rainAlertsEnabled &&
    !notificationsMuted &&
    computeNotificationTriggerTime(
      range.start.toISOString(),
      rainLeadMinutes,
    ) === null;

  // A `useCallback` rather than a factory built during render: the compiler's
  // ref rule reads "make a closure over a ref while rendering" as a possible
  // render-time read of `.current`, which this isn't but can't prove inline.
  const handleFieldLayout = useCallback(
    (field: keyof FieldErrors, y: number) => {
      fieldOffsets.current[field] = y;
    },
    [],
  );

  // The messages the Location field has to show, in the order they appear.
  const locationMessages = [errors.location, error, locationError].filter(
    (message): message is string => !!message,
  );
  const showSuggestions =
    locationFocused && suggestions.length > 0 && !selectedPlace;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Location first. It used to come second, under a Label field that had
          nothing to prefill it — so the app asked for a name before it knew
          the one thing that could supply one. */}
        <ThemedView
          style={[styles.field, styles.locationField]}
          onLayout={(e) =>
            handleFieldLayout("location", e.nativeEvent.layout.y)
          }
        >
          <ThemedText type="fieldLabel" themeColor="textSecondary">
            Location
          </ThemedText>

          {selectedPlace ? (
            // A picked place used to render as ordinary text in the same input,
            // so "typed but not chosen" and "resolved to real coordinates" were
            // indistinguishable — and only the second one can be submitted.
            <ThemedView
              type="backgroundElement"
              style={[styles.chip, { borderColor: theme.primary }]}
              accessibilityLabel={`Location set to ${selectedPlace.location}`}
            >
              <Icon
                name={{ ios: "checkmark.circle.fill", android: "check_circle" }}
                size={IconSize.inline}
                tintColor={theme.primary}
              />
              <ThemedText style={styles.chipText} numberOfLines={2}>
                {selectedPlace.location}
              </ThemedText>
              <Pressable
                onPress={clearPlace}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear location"
              >
                <Icon
                  name={{ ios: "xmark.circle.fill", android: "cancel" }}
                  size={IconSize.inline}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </ThemedView>
          ) : (
            <>
              {/* The input and its dropdown are one unit: the list is absolutely
                positioned against this wrapper so it hangs over whatever is
                below rather than pushing the rest of the form down the screen
                every time someone types. */}
              <View style={styles.inputAnchor}>
                <TextInput
                  value={locationQuery}
                  onChangeText={handleLocationChange}
                  onFocus={() => setLocationFocused(true)}
                  onBlur={() => setLocationFocused(false)}
                  placeholder="Search for a place"
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel="Location"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.backgroundElement,
                    },
                    errors.location ? { borderColor: theme.danger } : null,
                    errors.location ? styles.inputInvalid : null,
                  ]}
                />

                {showSuggestions && (
                  <ThemedView
                    type="backgroundElement"
                    style={[
                      styles.suggestionsList,
                      { borderColor: theme.border },
                    ]}
                    accessibilityLabel="Location suggestions"
                  >
                    {suggestions.map((s) => (
                      <Pressable
                        key={s.placeId}
                        onPress={() => handleSelectSuggestion(s.placeId)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          pressed && {
                            backgroundColor: theme.backgroundSelected,
                          },
                        ]}
                      >
                        <ThemedText numberOfLines={1}>
                          {s.displayName}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={styles.suggestionSecondary}
                          numberOfLines={1}
                        >
                          {s.secondaryText}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ThemedView>
                )}
              </View>
              {/* "Searching…" rides in this row rather than on a line of its
                own. It is the one message that appears on nearly every
                keystroke, and a line that comes and goes under the field is a
                line that shifts the form — which is what a reserved blank was
                previously holding 16pt open to prevent, on every form, forever,
                for a message most of them never show. */}
              <ThemedView style={styles.assistRow}>
                <Pressable
                  onPress={handleUseCurrentLocation}
                  disabled={isLocating}
                  style={styles.useLocationRow}
                  accessibilityRole="button"
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                >
                  {!isLocating && (
                    <Icon
                      name={{ ios: "location.fill", android: "my_location" }}
                      size={IconSize.metadata}
                      tintColor={theme.textSecondary}
                    />
                  )}
                  <ThemedText
                    themeColor="textSecondary"
                    style={[styles.hint, styles.useLocationLink]}
                  >
                    {isLocating ? "Finding you…" : "Use my location"}
                  </ThemedText>
                </Pressable>
                {isSearching && (
                  <ThemedText themeColor="textSecondary" style={styles.hint}>
                    Searching…
                  </ThemedText>
                )}
              </ThemedView>
            </>
          )}

          {/* Errors, and only when there are errors. They render as a group
            rather than one at a time because `error ?? locationError` hid one
            of the two whenever both were real — but they are rare enough that
            reserving a line against them cost more space than the shift they
            cause is worth. */}
          {locationMessages.length > 0 && (
            <ThemedView style={styles.status}>
              {locationMessages.map((message) => (
                <ThemedText
                  key={message}
                  style={[styles.hint, { color: theme.danger }]}
                >
                  {message}
                </ThemedText>
              ))}
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView
          style={styles.field}
          onLayout={(e) => handleFieldLayout("label", e.nativeEvent.layout.y)}
        >
          <ThemedText type="fieldLabel" themeColor="textSecondary">
            Label
          </ThemedText>
          <TextInput
            value={label}
            onChangeText={(text) => {
              setLabel(text);
              // From here the label is theirs, and picking another place must
              // not overwrite it.
              setLabelIsMine(false);
              if (text.trim()) {
                setErrors((current) => ({ ...current, label: undefined }));
              }
            }}
            placeholder="e.g. Lunch with Sam"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Label"
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement },
              errors.label ? { borderColor: theme.danger } : null,
              errors.label ? styles.inputInvalid : null,
            ]}
          />
          {errors.label && (
            <ThemedText style={[styles.hint, { color: theme.danger }]}>
              {errors.label}
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView
          style={styles.field}
          onLayout={(e) => handleFieldLayout("time", e.nativeEvent.layout.y)}
        >
          <ThemedText type="fieldLabel" themeColor="textSecondary">
            Day
          </ThemedText>
          {/* One date, then two times. Both fields used to be `mode="datetime"`,
            so moving a plan to another day meant editing the same date twice
            and the two could silently end up on different days. */}
          <DateTimePicker
            value={range.start}
            mode="date"
            style={styles.datePicker}
            themeVariant={colorScheme}
            accentColor={theme.primary}
            onValueChange={(_, day) => setRange((r) => applyDayToRange(r, day))}
          />
        </ThemedView>

        <View style={[styles.row, stackDateTimeFields && styles.rowStacked]}>
          <ThemedView
            style={[styles.field, !stackDateTimeFields && styles.flex1]}
          >
            <ThemedText type="fieldLabel" themeColor="textSecondary">
              Starts
            </ThemedText>
            <DateTimePicker
              value={range.start}
              mode="time"
              style={styles.timePicker}
              themeVariant={colorScheme}
              accentColor={theme.primary}
              onValueChange={(_, time) =>
                setRange((r) => applyStartTime(r, time))
              }
            />
          </ThemedView>

          <ThemedView
            style={[styles.field, !stackDateTimeFields && styles.flex1]}
          >
            <ThemedText type="fieldLabel" themeColor="textSecondary">
              Ends
            </ThemedText>
            <DateTimePicker
              value={range.end}
              mode="time"
              style={styles.timePicker}
              themeVariant={colorScheme}
              accentColor={theme.primary}
              onValueChange={(_, time) =>
                setRange((r) => applyEndTime(r, time))
              }
            />
            {endsOnAnotherDay(range) && (
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Next day
              </ThemedText>
            )}
          </ThemedView>
        </View>
        {errors.time && (
          <ThemedText style={[styles.hint, { color: theme.danger }]}>
            {errors.time}
          </ThemedText>
        )}

        {allowRepeat && (
          <ThemedView
            style={styles.field}
            onLayout={(event) =>
              handleFieldLayout("repeat", event.nativeEvent.layout.y)
            }
          >
            <RepeatField
              value={repeat}
              onChange={setRepeat}
              anchor={range.start}
              error={errors.repeat}
            />
          </ThemedView>
        )}

        {/* Directly above the switch it seeds, so pressing a chip and the switch
          moving are one thing seen at once rather than a change somewhere off
          screen. Unlike Repeat this renders on the edit screen too — a stop can
          turn out to be indoor after it was added. */}
        <ThemedView style={styles.field}>
          <ThemedText type="fieldLabel" themeColor="textSecondary">
            Indoor or outdoor
          </ThemedText>
          <ThemedView
            style={styles.repeatRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Indoor or outdoor"
          >
            {SLOT_KINDS.map((option) => {
              const isSelected = option === kind;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleKindChange(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.repeatChip,
                    {
                      backgroundColor: isSelected
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.hint,
                      isSelected && styles.repeatChipSelected,
                    ]}
                  >
                    {SLOT_KIND_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>
          {/* Says what the tag is *for*. Without it the two chips look like
            filing, and nothing on screen connects them to the switch below. */}
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {SLOT_KIND_HINTS[kind]}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.muteRow}>
          <ThemedView style={styles.muteLabel}>
            <ThemedText>Rain alerts</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {/* Rain matters for a park and not for a mall — muting per stop is
                what keeps the alerts worth reading. */}
              Get a heads-up if this stop looks wet
            </ThemedText>
          </ThemedView>
          <Switch
            value={!notificationsMuted}
            onValueChange={(enabled) => setNotificationsMuted(!enabled)}
            accessibilityLabel="Rain alerts for this stop"
          />
        </ThemedView>

        {tooSoonToWarn && (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            This starts too soon for a rain alert — they go out{" "}
            {formatLeadTime(rainLeadMinutes)} ahead.
          </ThemedText>
        )}

        <ThemedView style={styles.field}>
          <ThemedText type="fieldLabel" themeColor="textSecondary">
            Notes
          </ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember for this stop"
            placeholderTextColor={theme.textSecondary}
            multiline
            accessibilityLabel="Notes"
            style={[
              styles.input,
              styles.notesInput,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />
        </ThemedView>

        {children}

        {onDelete && (
          <Pressable onPress={onDelete} style={styles.deleteButton}>
            <ThemedText style={{ color: theme.danger }}>Delete plan</ThemedText>
          </Pressable>
        )}
      </ScrollView>

      {/* Fixed below the scroll rather than the last thing in it — a form this
          long could otherwise leave the primary action scrolled out of view.
          Left at the plain screen background rather than `backgroundElement`
          — a tinted footer would end at the screen's own SafeAreaView inset
          and leave a mismatched strip of plain background below its border. */}
      <ThemedView style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
        >
          <ThemedText
            style={[styles.submitButtonText, { color: theme.onPrimary }]}
          >
            {submitLabel}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
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
 * plans added from another day's screen on the wrong day.
 */
export function defaultStartTime(dateKey?: string): Date {
  const start = nextHour();
  if (!dateKey) return start;

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return start;

  // Set all three at once — setting the month alone can roll the date over
  // (e.g. 31 Jan with month set to February lands in March).
  start.setFullYear(year, month - 1, day);
  return start;
}

function defaultRange(dateKey?: string) {
  const start = defaultStartTime(dateKey);
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}

/** Kept out of `styles` so the stacking calculation can read the same values. */
const FormPadding = Spacing.three;
const FormGap = Spacing.three;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: FormPadding,
    gap: Spacing.four,
  },
  // Sits below the scroll rather than inside it, so the primary action stays
  // reachable without scrolling to the bottom of a long form.
  footer: {
    padding: FormPadding,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  field: {
    gap: Spacing.one,
  },
  // See `DateTimePickerWidth` — a content-sized box is what puts the picker
  // flush left with the field labels and text inputs above.
  //
  // `themeVariant` on the pickers themselves is the other half: it sets
  // SwiftUI's `colorScheme` environment value, which is what decides the chip
  // fill and the label colour. Without it the picker follows the device while
  // the rest of the form follows `themePreference`, and the two disagree the
  // moment someone picks an explicit theme in Settings — the label stays black
  // on a form that has gone dark. `accentColor` is passed for the same reason:
  // the selection tint would otherwise be the system blue rather than ours.
  datePicker: {
    width: DatePickerWidth,
  },
  // A time capsule is narrower than the date + time pair these fields used to
  // render, which is what makes two of them fit side by side on a phone.
  timePicker: {
    width: 96,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  // Colour alone can't carry "this field is the problem" — the message under
  // it does that — but an outline is what points at *which* field once the
  // message has been scrolled to.
  inputInvalid: {
    borderWidth: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  chipText: {
    flex: 1,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
  },
  // Only present when there is something to say. It stacks rather than picks
  // when two messages are live at once, which is rare and better than hiding
  // one of two real problems.
  status: {
    gap: 2,
  },
  assistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  useLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    // 12pt text with a 12px icon is well under the 44pt minimum on its own.
    // The box carries 24 and the `hitSlop` on the Pressable carries the other
    // 24 — the target clears 44 without the row itself holding open a band of
    // empty space between the field and the one below it.
    minHeight: 24,
  },
  useLocationLink: {
    fontWeight: "600",
  },
  // Lifts the whole Location field above the fields that follow it. Without
  // it the dropdown is drawn under the Label input: siblings later in the tree
  // paint on top, and no amount of `zIndex` inside this field changes that.
  locationField: {
    zIndex: 10,
  },
  // Lifts the input *and its dropdown* above the "Use my location" row, which
  // is a later sibling inside this same field and would otherwise paint
  // straight through the list — the row's text on top of the first result.
  inputAnchor: {
    position: "relative",
    zIndex: 1,
  },
  // A dropdown rather than a block in the flow. As a block it sat between the
  // Location and Label inputs and shoved the rest of the form down the screen
  // on every keystroke — the fields you were heading for moved while you typed.
  suggestionsList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    overflow: "hidden",
    // It floats over the form, so it needs to look like it: a hairline and a
    // shadow are what separate it from the input it covers. `elevation` is
    // Android's shadow *and* its stacking order — a dropdown without it draws
    // underneath the next field there.
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  suggestionRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  suggestionSecondary: {
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    gap: FormGap,
  },
  // The native pickers render at their own intrinsic width, so when there
  // isn't room for two of them side by side they overlap rather than shrink —
  // stack them instead (Starts above, Ends below).
  rowStacked: {
    flexDirection: "column",
    gap: Spacing.four,
  },
  flex1: {
    flex: 1,
  },
  repeatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  repeatChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    minHeight: 36,
    justifyContent: "center",
  },
  repeatChipSelected: {
    fontWeight: "700",
  },
  muteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  muteLabel: {
    flexShrink: 1,
    gap: 2,
  },
  submitButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  submitButtonText: {
    fontWeight: "600",
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: Spacing.two,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
