import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { DayPlan } from "@/types/itinerary";
import { todayKey, shiftDays } from "@/utils/dateKeys";

type DayCell = {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  planCount: number;
  isToday: boolean;
};

function buildWeek(
  plans: DayPlan[],
  today: string,
  days: number = 7,
): DayCell[] {
  const cells: DayCell[] = [];
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDays(today, i);
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayLabel = date.toLocaleDateString("en-SG", { weekday: "short" });
    const dateLabel = String(date.getDate());
    const plan = plans.find((p) => p.date === dateKey);
    cells.push({
      dateKey,
      dayLabel: i === 0 ? "Today" : dayLabel,
      dateLabel,
      planCount: plan?.slots.length ?? 0,
      isToday: i === 0,
    });
  }
  return cells;
}

/**
 * What a screen reader says for one cell (the accessibilityHint separately
 * covers what tapping it does). The badge is a bare number, which reads as
 * "8, 2" out of context — the label spells the count back out so the compact
 * form costs nothing in speech.
 */
function describeCell(cell: DayCell): string {
  const day = `${cell.dayLabel} ${cell.dateLabel}`;
  if (cell.planCount === 0) return `${day}, no stops`;
  return `${day}, ${cell.planCount} ${cell.planCount === 1 ? "stop" : "stops"}`;
}

export function WeekStrip({
  plans,
  onSelectDate,
}: {
  plans: DayPlan[];
  onSelectDate: (dateKey: string) => void;
}) {
  const theme = useTheme();
  const today = todayKey();
  const cells = buildWeek(plans, today);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {cells.map((cell) => (
        <Pressable
          key={cell.dateKey}
          accessible
          accessibilityRole="button"
          accessibilityLabel={describeCell(cell)}
          accessibilityHint="Adds a plan on this day"
          hitSlop={4}
          onPress={() => onSelectDate(cell.dateKey)}
        >
          <ThemedView
            type="backgroundElement"
            style={[
              styles.cell,
              cell.isToday && { borderColor: theme.primary, borderWidth: 1 },
            ]}
          >
            <ThemedText
              style={[
                styles.dayLabel,
                { color: cell.isToday ? theme.primary : theme.textSecondary },
              ]}
            >
              {cell.dayLabel}
            </ThemedText>
            <ThemedText style={styles.dateLabel}>{cell.dateLabel}</ThemedText>
            {cell.planCount > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.badgeText, { color: theme.onPrimary }]}
                >
                  {cell.planCount}
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: Spacing.two,
    // Top and right clear the badge's overhang (see `badge` below) so it
    // isn't clipped by the scroll view on the first row or the last cell.
    paddingTop: Spacing.one,
    paddingRight: Spacing.one,
    paddingBottom: Spacing.two,
  },
  // Two lines, not three: the stop count moved into a corner badge, so a cell
  // is a day label over a date and nothing else. That plus the tighter
  // padding is what keeps the strip out of the way of the list it sits above.
  cell: {
    alignItems: "center",
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    minWidth: 64,
    // The badge overhangs this corner, so it needs to be the positioning
    // parent rather than sitting in flow beside the date.
    position: "relative",
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  // Pinned outside the cell's own corner, like a notification badge, so it
  // reads as a status flag on the day rather than crowding the date number.
  // The `borderColor` matches the cell surface so the badge stays a crisp
  // circle instead of merging into whatever's behind it.
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
});
