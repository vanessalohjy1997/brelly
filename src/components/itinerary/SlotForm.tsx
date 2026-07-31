import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { type ReactNode, useState } from "react";
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
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useTheme } from "@/hooks/useTheme";
import {
  DateTimePickerWidth,
  shouldStackDateTimeFields,
} from "@/utils/shouldStackDateTimeFields";

export type SlotFormValues = {
  label: string;
  location: string;
  latitude: number;
  longitude: number;
  startTime: string; // ISO
  endTime: string; // ISO
  /** Per-stop opt-out from rain alerts. */
  notificationsMuted?: boolean;
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
  /** Extra actions rendered between the submit button and delete button. */
  children?: ReactNode;
};

export function SlotForm({
  initialValues,
  initialDate,
  onSubmit,
  onDelete,
  submitLabel,
  children,
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const stackDateTimeFields = shouldStackDateTimeFields(
    width - FormPadding * 2,
    FormGap,
  );
  const { suggestions, isSearching, error, search, selectPlace } =
    usePlaceSearch();
  const {
    getCurrentLocation,
    isLocating,
    error: locationError,
  } = useCurrentLocation();

  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [locationQuery, setLocationQuery] = useState(
    initialValues?.location ?? "",
  );
  const [selectedPlace, setSelectedPlace] = useState<{
    location: string;
    latitude: number;
    longitude: number;
  } | null>(
    initialValues
      ? {
          location: initialValues.location,
          latitude: initialValues.latitude,
          longitude: initialValues.longitude,
        }
      : null,
  );
  const [startTime, setStartTime] = useState(
    initialValues
      ? new Date(initialValues.startTime)
      : defaultStartTime(initialDate),
  );
  const [endTime, setEndTime] = useState(
    initialValues
      ? new Date(initialValues.endTime)
      : plusOneHour(defaultStartTime(initialDate)),
  );
  const [notificationsMuted, setNotificationsMuted] = useState(
    initialValues?.notificationsMuted ?? false,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleLocationChange = (text: string) => {
    setLocationQuery(text);
    setSelectedPlace(null);
    search(text);
  };

  const handleSelectSuggestion = async (placeId: string) => {
    const details = await selectPlace(placeId);
    if (!details) return;
    setLocationQuery(details.displayName);
    setSelectedPlace({
      location: details.displayName,
      latitude: details.latitude,
      longitude: details.longitude,
    });
  };

  const handleUseCurrentLocation = async () => {
    const current = await getCurrentLocation();
    if (!current) return;
    setLocationQuery(current.location);
    setSelectedPlace(current);
  };

  const handleSubmit = () => {
    if (!label.trim()) {
      setSubmitError("Give this plan a label");
      return;
    }
    if (!selectedPlace) {
      setSubmitError("Pick a location from the list");
      return;
    }
    if (endTime.getTime() <= startTime.getTime()) {
      setSubmitError("End time must be after start time");
      return;
    }
    setSubmitError(null);
    onSubmit({
      label: label.trim(),
      location: selectedPlace.location,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      notificationsMuted,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedView style={styles.field}>
        <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
          Label
        </ThemedText>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Lunch with Sam"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
        />
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
          Location
        </ThemedText>
        <TextInput
          value={locationQuery}
          onChangeText={handleLocationChange}
          placeholder="Search for a place in Singapore"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
        />
        <Pressable
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
          style={styles.useLocationRow}
        >
          {!isLocating && (
            <Icon
              name={{ ios: "location.fill", android: "my_location" }}
              size={12}
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
        {(error || locationError) && (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {error ?? locationError}
          </ThemedText>
        )}
        {suggestions.length > 0 && (
          <ThemedView type="backgroundElement" style={styles.suggestionsList}>
            {suggestions.map((s) => (
              <Pressable
                key={s.placeId}
                onPress={() => handleSelectSuggestion(s.placeId)}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText numberOfLines={1}>{s.displayName}</ThemedText>
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
      </ThemedView>

      <View style={[styles.row, stackDateTimeFields && styles.rowStacked]}>
        <ThemedView
          style={[styles.field, !stackDateTimeFields && styles.flex1]}
        >
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Starts
          </ThemedText>
          <DateTimePicker
            value={startTime}
            mode="datetime"
            style={styles.picker}
            onValueChange={(_, date) => {
              setStartTime(date);
              if (endTime.getTime() <= date.getTime()) {
                setEndTime(plusOneHour(date));
              }
            }}
          />
        </ThemedView>

        <ThemedView
          style={[styles.field, !stackDateTimeFields && styles.flex1]}
        >
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Ends
          </ThemedText>
          <DateTimePicker
            value={endTime}
            mode="datetime"
            minimumDate={startTime}
            style={styles.picker}
            onValueChange={(_, date) => setEndTime(date)}
          />
        </ThemedView>
      </View>

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

      {submitError && (
        <ThemedText style={[styles.error, { color: theme.danger }]}>
          {submitError}
        </ThemedText>
      )}

      <Pressable
        onPress={handleSubmit}
        style={[styles.submitButton, { backgroundColor: theme.text }]}
      >
        <ThemedText style={[styles.submitButtonText, { color: theme.background }]}>
          {submitLabel}
        </ThemedText>
      </Pressable>

      {children}

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <ThemedText style={{ color: theme.danger }}>Delete plan</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
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

function plusOneHour(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000);
}

/** Kept out of `styles` so the stacking calculation can read the same values. */
const FormPadding = Spacing.three;
const FormGap = Spacing.three;

const styles = StyleSheet.create({
  container: {
    padding: FormPadding,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  // See `DateTimePickerWidth` — a content-sized box is what puts the picker
  // flush left with the field labels and text inputs above.
  picker: {
    width: DateTimePickerWidth,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
  },
  useLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  useLocationLink: {
    fontWeight: "600",
  },
  suggestionsList: {
    borderRadius: Spacing.two,
    overflow: "hidden",
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
  // The native datetime pickers render at their own intrinsic width, so when
  // there isn't room for two of them side by side they overlap rather than
  // shrink — stack them instead (Starts above, Ends below).
  rowStacked: {
    flexDirection: "column",
    gap: Spacing.four,
  },
  flex1: {
    flex: 1,
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
  error: {
    fontSize: 13,
  },
  submitButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  submitButtonText: {
    fontWeight: "600",
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
