import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useAppColorScheme, useTheme } from "@/hooks/useTheme";
import type { RepeatRule } from "@/types/routine";
import { parseDateKey, shiftDays, toDateKey } from "@/utils/dateKeys";
import { describeRoutine, WEEKDAY_INITIALS, WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/utils/describeRoutine";
import { DatePickerWidth } from "@/utils/shouldStackDateTimeFields";

/**
 * One tap for the two shapes a week almost always takes. Everything else is
 * reachable through the day toggles underneath, which is the right split: the
 * common cases shouldn't cost five taps, and the uncommon ones shouldn't be
 * unreachable to save four.
 */
const PRESETS: { label: string; weekdays: number[] }[] = [
  { label: "Mon–Fri", weekdays: [1, 2, 3, 4, 5] },
  { label: "Every day", weekdays: [0, 1, 2, 3, 4, 5, 6] },
];

/** How far out the end-date picker opens when "On a date" is first chosen. */
const DefaultEndOffsetDays = 28;

type Props = {
  /** The rule, or null for a one-off. */
  value: RepeatRule | null;
  onChange: (rule: RepeatRule | null) => void;
  /** The day the stop sits on. Seeds the first selected weekday and the end date. */
  anchor: Date;
  error?: string;
};

/**
 * The repeat control on the add-plan form.
 *
 * A rule, not a count. The chips this replaces offered "Weekly", which wrote
 * four stops and then stopped being anything — there was no rule left to edit,
 * extend or turn off, and a commitment that renews every week had to be
 * re-entered every month. What's collected here is stored as a `Routine` and
 * filled in a fortnight at a time; see `planRoutineMaterialization`.
 */
export function RepeatField({ value, onChange, anchor, error }: Props) {
  const theme = useTheme();
  // The picker is a real native view and reads the *system* appearance, so the
  // in-app theme has to be handed to it — the same reason every other picker in
  // the form passes these two props.
  const colorScheme = useAppColorScheme();

  const repeating = value !== null;

  const chipStyle = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected
        ? theme.backgroundSelected
        : theme.backgroundElement,
    },
  ];

  const setRepeating = (next: boolean) => {
    if (next === repeating) return;
    // Starting from the day the stop is already on: a routine that repeats on
    // some *other* day than the one you just picked would be a surprise.
    onChange(next ? { weekdays: [anchor.getDay()] } : null);
  };

  const toggleWeekday = (day: number) => {
    if (!value) return;
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day];
    onChange({ ...value, weekdays });
  };

  const setEndDate = (endDate: string | undefined) => {
    if (!value) return;
    onChange({ ...value, endDate });
  };

  return (
    <ThemedView style={styles.field}>
      <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
        Repeat
      </ThemedText>

      <ThemedView
        style={styles.chipRow}
        accessibilityRole="radiogroup"
        accessibilityLabel="Repeat"
      >
        {/* Not "Once"/"Repeat": the section is already labelled Repeat, and a
            chip with the same word as its heading reads as the heading. */}
        {[
          { label: "Just once", on: !repeating },
          { label: "Every week", on: repeating },
        ].map((option) => (
          <Pressable
            key={option.label}
            onPress={() => setRepeating(option.label === "Every week")}
            accessibilityRole="radio"
            accessibilityState={{ selected: option.on }}
            style={chipStyle(option.on)}
          >
            <ThemedText style={[styles.hint, option.on && styles.chipSelected]}>
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      {value && (
        <>
          <ThemedView
            style={styles.chipRow}
            accessibilityRole="none"
            accessibilityLabel="Days"
          >
            {WEEKDAY_ORDER.map((day) => {
              const selected = value.weekdays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleWeekday(day)}
                  accessibilityRole="checkbox"
                  // Two days share the letter "T" and two share "S", so the
                  // glyph can't be the accessible name.
                  accessibilityLabel={WEEKDAY_LABELS[day]}
                  accessibilityState={{ checked: selected }}
                  style={[chipStyle(selected), styles.dayChip]}
                >
                  <ThemedText
                    style={[styles.hint, selected && styles.chipSelected]}
                  >
                    {WEEKDAY_INITIALS[day]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.chipRow}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.label}
                onPress={() => onChange({ ...value, weekdays: preset.weekdays })}
                accessibilityRole="button"
                style={chipStyle(false)}
              >
                <ThemedText style={styles.hint}>{preset.label}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
            Ends
          </ThemedText>
          <ThemedView
            style={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Ends"
          >
            {[
              { label: "Never", on: !value.endDate },
              { label: "On a date", on: !!value.endDate },
            ].map((option) => (
              <Pressable
                key={option.label}
                onPress={() =>
                  setEndDate(
                    option.label === "Never"
                      ? undefined
                      : shiftDays(toDateKey(anchor), DefaultEndOffsetDays),
                  )
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: option.on }}
                style={chipStyle(option.on)}
              >
                <ThemedText
                  style={[styles.hint, option.on && styles.chipSelected]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          {value.endDate && (
            <DateTimePicker
              value={parseDateKey(value.endDate)}
              mode="date"
              style={styles.datePicker}
              themeVariant={colorScheme}
              accentColor={theme.primary}
              onValueChange={(_, day) => setEndDate(toDateKey(day))}
            />
          )}
        </>
      )}

      {error ? (
        <ThemedText style={[styles.hint, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : (
        // Says what the rule means in words, because a row of seven letters
        // with three of them lit is a pattern you have to decode.
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          {describeRoutine(value ?? { weekdays: [] }) ?? "Just this one."}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    minHeight: 36,
    justifyContent: "center",
  },
  chipSelected: {
    fontWeight: "700",
  },
  // Square-ish, so seven of them fit a phone without wrapping into a second
  // row that would read as two separate weeks.
  dayChip: {
    paddingHorizontal: 0,
    minWidth: 40,
    alignItems: "center",
  },
  datePicker: {
    width: DatePickerWidth,
    height: 40,
  },
});
