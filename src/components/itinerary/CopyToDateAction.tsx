import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  onDuplicate: (targetDate: Date) => void;
  onMove: (targetDate: Date) => void;
};

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

export function CopyToDateAction({ onDuplicate, onMove }: Props) {
  const theme = useTheme();
  const [targetDate, setTargetDate] = useState(tomorrow());

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.label} themeColor="textSecondary">
        Duplicate or move to another day
      </ThemedText>
      <DateTimePicker
        value={targetDate}
        mode="date"
        onValueChange={(_, date) => setTargetDate(date)}
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}
          onPress={() => onDuplicate(targetDate)}
        >
          <ThemedText style={styles.buttonText}>Duplicate</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}
          onPress={() => onMove(targetDate)}
        >
          <ThemedText style={styles.buttonText}>Move</ThemedText>
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
