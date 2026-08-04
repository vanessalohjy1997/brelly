import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = "default",
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        // `linkPrimary` has no colour of its own in `styles` — it takes the
        // theme's primary, so it adapts per theme instead of being one
        // hardcoded violet that was marginal for contrast in both.
        { color: theme[themeColor ?? (type === "linkPrimary" ? "primary" : "text")] },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "linkPrimary" && styles.linkPrimary,
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  // Screen headers ("Today", "Plans") and empty-state headlines. Both were a
  // step larger (48/52 and 32/44) and read as oversized on a phone — 48pt is
  // wider than the platform's own large title, and the empty state's headline
  // was competing with it. These sit at roughly one step down each; the floor
  // for any size in this file is 11 (see the Dynamic Type note in UX.md).
  title: {
    fontSize: 34,
    fontWeight: 600,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 600,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
