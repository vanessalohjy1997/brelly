import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing, type ThemeColor } from "@/constants/theme";
import { useAppColorScheme, useTheme } from "@/hooks/useTheme";
import type { RepeatRule } from "@/types/routine";
import { parseDateKey, shiftDays, toDateKey } from "@/utils/dateKeys";
import { describeRoutine, WEEKDAY_INITIALS, WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/utils/describeRoutine";
import { resolveFrequency } from "@/utils/routineFrequency";
import { DatePickerWidth, DateTimePickerHeight } from "@/utils/shouldStackDateTimeFields";

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
/**
 * A monthly rule at `+28d` would barely reach one occurrence, so its end-date
 * picker opens a few months out instead — far enough that "On a date" reads as
 * a real bound rather than "next month".
 */
const DefaultMonthlyEndOffsetMonths = 3;

/** Where the "On a date" picker opens, seeded to the rule's own cadence. */
function seedEndDate(anchor: Date, monthly: boolean): string {
  if (!monthly) return shiftDays(toDateKey(anchor), DefaultEndOffsetDays);
  const end = new Date(anchor);
  end.setMonth(end.getMonth() + DefaultMonthlyEndOffsetMonths);
  return toDateKey(end);
}

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
  const frequency = value ? resolveFrequency(value.frequency) : null;
  const isMonthly = frequency === "monthly";

  // A monthly rule falls on the stop's own date, so it tracks the Day field:
  // move the stop to the 20th and the rule repeats on the 20th, no separate
  // control. Guarded to monthly and to an actual change, so it can't loop.
  const anchorDayOfMonth = anchor.getDate();
  useEffect(() => {
    if (!value || resolveFrequency(value.frequency) !== "monthly") return;
    if (value.dayOfMonth === anchorDayOfMonth) return;
    onChange({ ...value, dayOfMonth: anchorDayOfMonth });
  }, [anchorDayOfMonth, value, onChange]);

  // `primary` rather than `backgroundSelected`: the latter is 1.26:1 on
  // `backgroundElement` in dark and 1.19:1 in light, so a selected chip and an
  // unselected one looked the same and the bold label was the only cue.
  const chipStyle = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundElement },
  ];

  // Pairs are pairs — a `primary` fill takes `onPrimary`, which is white in
  // light and near-black in dark.
  const chipTextColor = (selected: boolean): ThemeColor =>
    selected ? "onPrimary" : "text";

  const selectOnce = () => {
    if (!repeating) return;
    onChange(null);
  };

  // Both cadences start from the day the stop is already on — a routine that
  // repeated on some *other* day than the one you just picked would be a
  // surprise. Re-tapping the current cadence is a no-op, so it doesn't wipe the
  // days you've toggled.
  const selectWeekly = () => {
    if (frequency === "weekly") return;
    onChange({
      frequency: "weekly",
      weekdays: [anchor.getDay()],
      endDate: value?.endDate,
    });
  };

  const selectMonthly = () => {
    if (frequency === "monthly") return;
    onChange({
      frequency: "monthly",
      weekdays: [],
      dayOfMonth: anchorDayOfMonth,
      endDate: value?.endDate,
    });
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
          { label: "Just once", on: !repeating, onPress: selectOnce },
          { label: "Weekly", on: frequency === "weekly", onPress: selectWeekly },
          {
            label: "Monthly",
            on: frequency === "monthly",
            onPress: selectMonthly,
          },
        ].map((option) => (
          <Pressable
            key={option.label}
            onPress={option.onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected: option.on }}
            style={chipStyle(option.on)}
          >
            <ThemedText
              themeColor={chipTextColor(option.on)}
              style={[styles.hint, option.on && styles.chipSelected]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      {value && (
        <>
          {/* Weekly picks which days; monthly falls on the stop's own date, so
              it has no day controls at all — moving the Day field above moves
              the recurrence date with it. */}
          {!isMonthly && (
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
                        themeColor={chipTextColor(selected)}
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
                    onPress={() =>
                      onChange({ ...value, weekdays: preset.weekdays })
                    }
                    accessibilityRole="button"
                    style={chipStyle(false)}
                  >
                    <ThemedText style={styles.hint}>{preset.label}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            </>
          )}

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
                      : seedEndDate(anchor, isMonthly),
                  )
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: option.on }}
                style={chipStyle(option.on)}
              >
                <ThemedText
                  themeColor={chipTextColor(option.on)}
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
  // Weight on top of the `primary` fill, not instead of it — see the fill note
  // on `chipStyle` for why weight alone was not enough.
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
  // Height pinned for the same reason as the width — see `DateTimePickerHeight`.
  datePicker: {
    width: DatePickerWidth,
    height: DateTimePickerHeight,
  },
});
