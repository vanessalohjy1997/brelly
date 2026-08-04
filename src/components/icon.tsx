import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import type { StyleProp, ViewStyle } from "react-native";

// Every icon in the app is expressed this way (SF Symbols on iOS, Material
// Symbols on Android/web) rather than as emoji or Unicode glyphs, so
// appearance doesn't depend on the OS's emoji font.
export type IconName = {
  ios: SFSymbol;
  android: AndroidSymbol;
};

type Props = {
  name: IconName;
  size?: number;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Set when the icon is the only thing carrying a piece of information (a
   * muted-alerts bell, say). Left unset the icon stays decorative, which is
   * right when adjacent text already says the same thing.
   */
  accessibilityLabel?: string;
};

export function Icon({
  name,
  size = 24,
  tintColor,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={tintColor}
      type="hierarchical"
      style={style}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : "none"}
    />
  );
}
