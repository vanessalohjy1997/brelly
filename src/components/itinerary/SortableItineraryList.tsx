import { useCallback, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ThemedText } from "@/components/themedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { ItinerarySlot } from "@/types/itinerary";
import { moveItem } from "@/utils/reorder";

type Props = {
  slots: ItinerarySlot[];
  onReorder: (slots: ItinerarySlot[]) => void;
  onDeleteSlot: (slotId: string) => void;
};

// Slot cards render a single line of text per field, so real-world row
// heights barely vary — one measured sample is close enough to drive the
// drag-to-swap threshold for every row.
export function SortableItineraryList({ slots, onReorder, onDeleteSlot }: Props) {
  const [order, setOrder] = useState(slots);
  const [syncedKey, setSyncedKey] = useState(() => slots.map((s) => s.id).join(","));
  const [rowHeight, setRowHeight] = useState(0);

  const slotsKey = slots.map((s) => s.id).join(",");
  if (slotsKey !== syncedKey) {
    setOrder(slots);
    setSyncedKey(slotsKey);
  }

  const handleRowLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setRowHeight((current) => current || event.nativeEvent.layout.height);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      setOrder((current) => {
        const reordered = moveItem(current, fromIndex, toIndex);
        onReorder(reordered);
        return reordered;
      });
    },
    [onReorder],
  );

  return (
    <View style={styles.list}>
      {order.map((slot, index) => (
        <SortableRow
          key={slot.id}
          slot={slot}
          index={index}
          rowCount={order.length}
          rowHeight={rowHeight}
          onRowLayout={handleRowLayout}
          onDragEnd={handleDragEnd}
          onDelete={() => onDeleteSlot(slot.id)}
        />
      ))}
    </View>
  );
}

type RowProps = {
  slot: ItinerarySlot;
  index: number;
  rowCount: number;
  rowHeight: number;
  onRowLayout: (event: LayoutChangeEvent) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDelete: () => void;
};

function SortableRow({
  slot,
  index,
  rowCount,
  rowHeight,
  onRowLayout,
  onDragEnd,
  onDelete,
}: RowProps) {
  const colors = useTheme();

  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const height = rowHeight || 1;
      const delta = Math.round(event.translationY / height);
      const targetIndex = Math.min(Math.max(index + delta, 0), rowCount - 1);
      translateY.value = withSpring(0);
      isDragging.value = false;
      runOnJS(onDragEnd)(index, targetIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 1 : 0,
  }));

  return (
    <Animated.View
      layout={LinearTransition}
      style={[styles.row, animatedStyle]}
      onLayout={onRowLayout}
    >
      <View style={styles.card}>
        <ItineraryCard slot={slot} onDelete={onDelete} />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.handle, { backgroundColor: colors.backgroundElement }]}
          hitSlop={8}
        >
          <ThemedText themeColor="textSecondary" style={styles.handleGlyph}>
            ⠿
          </ThemedText>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.one,
  },
  card: {
    flex: 1,
  },
  handle: {
    width: 32,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  handleGlyph: {
    fontSize: 18,
  },
});
