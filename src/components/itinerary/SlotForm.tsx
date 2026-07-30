import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useTheme } from "@/hooks/useTheme";

export type SlotFormValues = {
  label: string;
  location: string;
  latitude: number;
  longitude: number;
  startTime: string; // ISO
  endTime: string; // ISO
};

type Props = {
  initialValues?: SlotFormValues;
  onSubmit: (values: SlotFormValues) => void;
  onDelete?: () => void;
  submitLabel: string;
};

export function SlotForm({
  initialValues,
  onSubmit,
  onDelete,
  submitLabel,
}: Props) {
  const theme = useTheme();
  const { suggestions, isSearching, error, search, selectPlace } =
    usePlaceSearch();

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
    initialValues ? new Date(initialValues.startTime) : nextHour(),
  );
  const [endTime, setEndTime] = useState(
    initialValues ? new Date(initialValues.endTime) : plusOneHour(nextHour()),
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
        {isSearching && (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Searching…
          </ThemedText>
        )}
        {error && (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {error}
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

      <View style={styles.row}>
        <ThemedView style={[styles.field, styles.flex1]}>
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Starts
          </ThemedText>
          <DateTimePicker
            value={startTime}
            mode="datetime"
            onValueChange={(_, date) => {
              setStartTime(date);
              if (endTime.getTime() <= date.getTime()) {
                setEndTime(plusOneHour(date));
              }
            }}
          />
        </ThemedView>

        <ThemedView style={[styles.field, styles.flex1]}>
          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Ends
          </ThemedText>
          <DateTimePicker
            value={endTime}
            mode="datetime"
            minimumDate={startTime}
            onValueChange={(_, date) => setEndTime(date)}
          />
        </ThemedView>
      </View>

      {submitError && (
        <ThemedText style={[styles.error, { color: "#D64545" }]}>
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

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <ThemedText style={{ color: "#D64545" }}>Delete plan</ThemedText>
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

function plusOneHour(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000);
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
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
    gap: Spacing.three,
  },
  flex1: {
    flex: 1,
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
