import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { FIGURES, mono } from '../theme/type';
import { useTheme } from '../theme/theme';

/**
 * Shared primitives. Everything a gloved hand touches goes through `Tap`, so
 * the feedback (opacity + a short haptic) is identical everywhere — on a roof
 * you often feel the press before you see it.
 */

type TapProps = PressableProps & {
  style?: ViewStyle | ViewStyle[];
  /** heavier confirmation for the irreversible controls */
  weight?: 'light' | 'medium' | 'heavy';
  children?: React.ReactNode;
};

export function Tap({ style, weight = 'light', onPress, disabled, children, ...rest }: TapProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={(e) => {
        if (disabled) return;
        void Haptics.impactAsync(
          weight === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : weight === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
        );
        onPress?.(e);
      }}
      style={({ pressed }) => [style as ViewStyle, pressed && !disabled ? { opacity: 0.72 } : null]}
    >
      {children}
    </Pressable>
  );
}

/** The signature uppercase wide-tracked mono label. */
export function MonoLabel({
  size = 10,
  track = 0.14,
  color,
  style,
  children,
  ...rest
}: TextProps & { size?: number; track?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Text {...rest} style={[mono(size, { track, color: color ?? c.lab }), style]}>
      {children}
    </Text>
  );
}

/** Tabular figures, so columns line up. */
export function Figures({ style, children, ...rest }: TextProps) {
  return (
    <Text {...rest} style={[FIGURES, style]}>
      {children}
    </Text>
  );
}

/** The live dot — green, and it breathes so you can tell it is running. */
export function LiveDot({ size = 11, color = '#3cc84a' }: { size?: number; color?: string }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: o }}
    />
  );
}

/** Content that rises into place — 220ms, nothing bounces. */
export function Rise({
  children,
  from = 14,
  duration = 220,
  style,
}: {
  children: React.ReactNode;
  from?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [v, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export const hairline = StyleSheet.hairlineWidth;

/** A one-line horizontal divider in the current scheme. */
export function Rule({ color }: { color?: string }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: color ?? c.line }} />;
}
