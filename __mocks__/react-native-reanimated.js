// Reanimated 4's own `mock.js` re-imports the real entry point, which loads
// react-native-worklets, which constructs `NativeWorklets` at module scope and
// throws ("Cannot read properties of undefined (reading 'loadUnpackers')")
// because the TurboModule isn't registered under Jest. So this stands in for
// the library instead — just the surface this app uses.
//
// Animations are identity functions here: the tests assert on behaviour
// (what's rendered, what a press calls), never on animated values.

const React = require("react");
const { View, Text, ScrollView, Image } = require("react-native");

const createAnimatedComponent = (Component) => {
  const AnimatedComponent = React.forwardRef((props, ref) =>
    React.createElement(Component, { ...props, ref }),
  );
  AnimatedComponent.displayName = `Animated(${Component.displayName || Component.name || "Component"})`;
  return AnimatedComponent;
};

const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  ScrollView: createAnimatedComponent(ScrollView),
  Image: createAnimatedComponent(Image),
  createAnimatedComponent,
};

const makeSharedValue = (initial) => ({ value: initial });

const identityTransition = {
  duration: () => identityTransition,
  springify: () => identityTransition,
  damping: () => identityTransition,
  delay: () => identityTransition,
  easing: () => identityTransition,
  build: () => () => ({ initialValues: {}, animations: {} }),
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: makeSharedValue,
  useAnimatedStyle: (factory) => {
    try {
      return factory() ?? {};
    } catch {
      // A style factory that reads a shared value mid-gesture can throw here;
      // an empty style keeps the tree rendering.
      return {};
    }
  },
  useDerivedValue: (factory) => makeSharedValue(factory()),
  useAnimatedRef: () => ({ current: null }),
  withSpring: (toValue) => toValue,
  withTiming: (toValue) => toValue,
  withDelay: (_delay, value) => value,
  withSequence: (...values) => values[values.length - 1],
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  cancelAnimation: () => {},

  // Gesture Handler's GestureDetector reaches into Reanimated directly for
  // these, so they have to exist even though nothing here animates.
  useEvent: () => () => {},
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  setGestureState: () => {},
  isSharedValue: (value) =>
    typeof value === "object" && value !== null && "value" in value,
  makeMutable: makeSharedValue,
  enableLayoutAnimations: () => {},
  isConfigured: () => true,
  LinearTransition: identityTransition,
  // `ReanimatedSwipeable` builds its spring config with `ReduceMotion.System`,
  // so closing a row from a test reads this — the enum's real string values.
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
  FadeIn: identityTransition,
  FadeOut: identityTransition,
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    inOut: (fn) => fn,
    out: (fn) => fn,
    bezier: () => (t) => t,
  },
};
