import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useAppColorScheme, useTheme } from "@/hooks/useTheme";
import { DatePickerWidth, DateTimePickerHeight } from "@/utils/shouldStackDateTimeFields";

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
      {/* The caption and the picker are one field, spaced like every other
          field in the form around it — `SlotForm`'s own `field` gap. They were
          8 apart here and 4 apart there, which read as this section sitting
          slightly looser than the form it is inside. */}
      <ThemedView style={styles.field}>
        {/* Moving a plan is just editing its start date — the slot re-files
            itself under the new day on save. Copying it has no such
            equivalent, so duplicating is the only action that needs to live
            here. */}
        <ThemedText type="fieldLabel" themeColor="textSecondary">
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
      </ThemedView>
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
  // `Spacing.three` between the field and the button it acts on, against
  // `Spacing.four` between sections in the form: the button reads as belonging
  // to the date above it rather than as the next thing down. At the flat
  // `Spacing.two` this used to be, the caption, the picker and the button were
  // three equally spaced rows with nothing saying which two went together.
  container: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  // See `DatePickerWidth` — a content-sized box is what puts the picker flush
  // left rather than centred.
  //
  // `themeVariant` is what stops the chip rendering in the device's appearance
  // while the modal around it renders in the app's — the same fix `SlotForm`
  // carries, and this picker sits on the same screen as those two.
  // `height` pinned as well as `width` — see `DateTimePickerHeight`. The host
  // reports no intrinsic height, so a width-only box lets the capsule float.
  picker: {
    width: DatePickerWidth,
    height: DateTimePickerHeight,
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
