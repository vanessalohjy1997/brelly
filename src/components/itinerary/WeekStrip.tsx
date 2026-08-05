import { ScrollView, StyleSheet } from "react-native";

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

export function WeekStrip({ plans }: { plans: DayPlan[] }) {
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
        <ThemedView
          key={cell.dateKey}
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
            <ThemedText themeColor="textSecondary" style={styles.count}>
              {cell.planCount} {cell.planCount === 1 ? "stop" : "stops"}
            </ThemedText>
          )}
        </ThemedView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  cell: {
    alignItems: "center",
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 64,
    gap: 2,
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
  count: {
    fontSize: 10,
  },
});
