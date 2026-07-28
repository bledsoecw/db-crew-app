import React from 'react';
import { Image, Text, View } from 'react-native';

import { CameraIcon, ClockIcon, LogIcon } from '../icons';
import { useShift } from '../state/shiftStore';
import { FIXED, useTheme } from '../theme/theme';
import { navy, radius, white } from '../theme/tokens';
import { barlow, mono } from '../theme/type';
import type { Tab } from '../types';
import { Rise, Tap } from './ui';

const LOGO = require('../../assets/db-timeclock.png');

/** Three tabs. No hamburger, no settings, no search. */
export function TabBar({ bottomInset }: { bottomInset: number }) {
  const { c, tap } = useTheme();
  const s = useShift();

  const items: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'job', label: 'Clock', icon: <ClockIcon size={26} /> },
    { key: 'cam', label: 'Capture', icon: <CameraIcon size={26} strokeWidth={2} /> },
    { key: 'log', label: 'Day log', icon: <LogIcon size={26} /> },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.tabbg,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: bottomInset,
      }}
    >
      {items.map((it) => {
        const on = s.tab === it.key;
        const fg = on ? white : 'rgba(255,255,255,.74)';
        return (
          <Tap
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            onPress={() => s.setTab(it.key)}
            style={{
              flex: 1,
              minHeight: tap,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderTopWidth: 3,
              borderTopColor: on ? FIXED.go : 'transparent',
              marginTop: -1,
            }}
          >
            {React.isValidElement(it.icon)
              ? React.cloneElement(it.icon as React.ReactElement<{ color?: string }>, { color: fg })
              : it.icon}
            <Text style={mono(10, { track: 0.09, color: fg })}>{it.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

/**
 * The in-app form of the 5-minute push. It looks like the OS banner on purpose
 * — same message, same weight, whether the app was open or not.
 */
export function NotifBanner({ topInset }: { topInset: number }) {
  const s = useShift();
  if (!s.notif) return null;
  return (
    <View style={{ position: 'absolute', top: topInset, left: 10, right: 10, zIndex: 95 }}>
      <Rise from={-22} duration={280}>
        <Tap
          accessibilityRole="button"
          weight="medium"
          onPress={s.openNotif}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
            padding: 14,
            backgroundColor: 'rgba(24,28,32,.96)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.18)',
            borderRadius: 18,
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
        >
          <Image source={LOGO} style={{ width: 42, height: 42, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={mono(9.5, { track: 0.12, color: navy[200] })}>DB Time Clock · Now</Text>
            <Text style={barlow(15, { lh: 1.2, weight: 700, color: white })}>Before photo not taken</Text>
            <Text style={barlow(13, { lh: 1.35, color: 'rgba(255,255,255,.72)' })}>{s.notif.body}</Text>
          </View>
        </Tap>
      </Rise>
    </View>
  );
}

/** Confirmations, never questions. Gone in 2.6 seconds. */
export function Toast({ bottomInset }: { bottomInset: number }) {
  const s = useShift();
  if (!s.toast || s.sheet) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: bottomInset + 96,
        zIndex: 90,
        alignItems: 'center',
      }}
    >
      <Rise from={10} duration={180}>
        <Text
          style={[
            mono(11, { track: 0.09, lh: 1.3, color: FIXED.goInk }),
            {
              backgroundColor: FIXED.go,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: radius.md,
              textAlign: 'center',
              overflow: 'hidden',
            },
          ]}
        >
          {s.toast}
        </Text>
      </Rise>
    </View>
  );
}
