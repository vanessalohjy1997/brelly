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
};

export function Icon({ name, size = 24, tintColor, style }: Props) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={tintColor}
      type="hierarchical"
      style={style}
    />
  );
}
