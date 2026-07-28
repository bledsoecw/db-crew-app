import React from 'react';
import { Image, Text, View } from 'react-native';

import { SunIcon, WifiOffIcon } from '../icons';
import { useShift } from '../state/shiftStore';
import { useTheme } from '../theme/theme';
import { radius } from '../theme/tokens';
import { archivo, mono } from '../theme/type';
import { FIXED } from '../theme/theme';
import { Tap } from './ui';

const LOGO = require('../../assets/db-timeclock.png');

/**
 * App tile + wordmark on the left, sun toggle on the right.
 *
 * The toggle is top-right and one tap — no menu. Someone squinting at a phone
 * on a roof should not have to go looking for it.
 */
export function AppHeader() {
  const { c } = useTheme();
  const { whoLabel, toggleSun } = useShift();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 8,
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 }}>
        <Image
          source={LOGO}
          accessibilityLabel="DB Time Clock"
          style={{ width: 55, height: 55, borderRadius: 12 }}
        />
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text numberOfLines={1} style={archivo(15, { track: 0.01, color: c.fg })}>
            DB Time Clock
          </Text>
          <Text numberOfLines={1} style={mono(10, { track: 0.12, color: c.lab })}>
            {whoLabel}
          </Text>
        </View>
      </View>

      <Tap
        accessibilityRole="button"
        accessibilityLabel="Toggle sun mode"
        onPress={toggleSun}
        style={{
          width: 62,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.chip,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.md,
        }}
      >
        <SunIcon size={26} color={c.sunico} />
      </Tap>
    </View>
  );
}

/** "No signal · N items queued" — a warning, never a blocker. */
export function OfflineBanner() {
  const { offline, queuedCount } = useShift();
  if (!offline) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: FIXED.warn,
      }}
    >
      <WifiOffIcon size={17} color={FIXED.warnInk} />
      <Text style={mono(11, { track: 0.09, color: FIXED.warnInk })}>
        No signal ·{' '}
        {queuedCount === 0
          ? 'nothing waiting'
          : `${queuedCount} ${queuedCount === 1 ? 'item' : 'items'} queued`}
      </Text>
    </View>
  );
}
