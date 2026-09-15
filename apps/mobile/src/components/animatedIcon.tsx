import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAppColorScheme } from '@/hooks/useTheme';

const DURATION = 600;

// Matches the native splash configured in app.json (`imageWidth: 180` over the
// theme background), so handing over from the native splash to this overlay is
// invisible — same umbrella, same size, same backdrop.
const IMAGE_SIZE = 180;

export function AnimatedSplashOverlay() {
  const scheme = useAppColorScheme();
  const reduceMotion = useReduceMotion();
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  // With "Reduce Motion" on, the elastic scale is dropped and the overlay just
  // fades. A full-screen overlay that scales and springs is exactly the kind of
  // motion the setting exists to suppress — but leaving the screen abruptly is
  // its own jolt, so this cross-fades rather than cutting.
  const splashKeyframe = reduceMotion
    ? new Keyframe({
        0: { opacity: 1 },
        100: { opacity: 0, easing: Easing.linear },
      })
    : new Keyframe({
        0: {
          transform: [{ scale: 1 }],
          opacity: 1,
        },
        20: {
          opacity: 1,
        },
        70: {
          opacity: 0,
          easing: Easing.elastic(0.7),
        },
        100: {
          opacity: 0,
          transform: [{ scale: 1 }],
          easing: Easing.elastic(0.7),
        },
      });

  const backdrop = [styles.splashOverlay, { backgroundColor: Colors[scheme].background }];
  const image = (
    <Image
      style={styles.image}
      source={
        scheme === 'dark'
          ? require('@/assets/icon/splash-hook-dark.png')
          : require('@/assets/icon/splash-hook.png')
      }
    />
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={backdrop}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={backdrop}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
