import { Pressable, StyleSheet, TextInput } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedView } from "@/components/themedView";
import { IconSize, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

/**
 * Below this many stops, a list is one or two screens and scanning it beats
 * typing at it — so the field doesn't render at all and the header keeps its
 * space. The threshold is on stops rather than days because a day holding six
 * stops is exactly the case worth searching.
 */
export const SearchThreshold = 6;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** "Search plans" / "Search past plans" — says which list is being narrowed. */
  placeholder: string;
};

/**
 * Filters a list of stops as you type.
 *
 * Shared by the Plans tab and the archive: they render the two halves of one
 * `splitPlansByTime` call, and a search that worked on only one of them would
 * be the kind of split the archive was built to remove. Deliberately not
 * debounced — `filterPlans` is a substring scan over an array already in
 * memory, so the work per keystroke is far below a frame, and a debounce would
 * only add lag between the character and the result.
 */
export function PlanSearchField({ value, onChange, placeholder }: Props) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.field}
      accessibilityRole="search"
    >
      <Icon
        name={{ ios: "magnifyingglass", android: "search" }}
        size={IconSize.inline}
        tintColor={theme.textSecondary}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        // `while-editing` would be the native iOS clear button, but it is
        // iOS-only and sits inside the input's own metrics — a 16pt glyph with
        // no way to give it a tap target. This one is ours on both platforms.
        clearButtonMode="never"
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon
            name={{ ios: "xmark.circle.fill", android: "cancel" }}
            size={IconSize.inline}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    // The row, not the input, carries the height: a bare `TextInput` is about
    // 20pt tall on Android and the whole control has to clear 44.
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    // Android's TextInput ships with its own vertical padding on top of the
    // row's `minHeight`, which makes the field taller on one platform only.
    paddingVertical: 0,
  },
});
