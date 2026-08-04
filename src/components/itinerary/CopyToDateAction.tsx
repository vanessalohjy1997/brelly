import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useAppColorScheme, useTheme } from "@/hooks/useTheme";
import { DatePickerWidth } from "@/utils/shouldStackDateTimeFields";

type Props = {
  onDuplicate: (targetDate: Date) => void;
};

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

export function CopyToDateAction({ onDuplicate }: Props) {
  const theme = useTheme();
  // The native picker follows the device appearance unless told otherwise —
  // see the note on `picker` below.
  const colorScheme = useAppColorScheme();
  const [targetDate, setTargetDate] = useState(tomorrow());

  return (
    <ThemedView style={styles.container}>
      {/* Moving a plan is just editing its start date — the slot re-files
          itself under the new day on save. Copying it has no such equivalent,
          so duplicating is the only action that needs to live here. */}
      <ThemedText style={styles.label} themeColor="textSecondary">
        Duplicate to another day
      </ThemedText>
      <DateTimePicker
        value={targetDate}
        mode="date"
        style={styles.picker}
        themeVariant={colorScheme}
        accentColor={theme.primary}
        onValueChange={(_, date) => setTargetDate(date)}
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}
          onPress={() => onDuplicate(targetDate)}
        >
          <ThemedText style={styles.buttonText}>Duplicate</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // See `DatePickerWidth` — a content-sized box is what puts the picker flush
  // left rather than centred.
  //
  // `themeVariant` is what stops the chip rendering in the device's appearance
  // while the modal around it renders in the app's — the same fix `SlotForm`
  // carries, and this picker sits on the same screen as those two.
  picker: {
    width: DatePickerWidth,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  button: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
});
