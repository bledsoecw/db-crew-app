import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { useShift } from '../state/shiftStore';
import { useTheme } from '../theme/theme';
import { radius } from '../theme/tokens';
import { mono } from '../theme/type';
import { Tap } from './ui';

/**
 * Dev-only state jumper, the app-side equivalent of the prototype's
 * "JUMP TO A STATE" strip. Never rendered in a release build.
 *
 * It exists so the states that are hard to reach on demand — foreman view, the
 * 5-minute escalation — can be shown to the client without waiting five
 * minutes on a roof.
 */
export function DevPanel() {
  const { c } = useTheme();
  const s = useShift();
  const [open, setOpen] = useState(false);

  if (!__DEV__) return null;

  return (
    <View style={{ position: 'absolute', right: 8, bottom: 92, zIndex: 70, alignItems: 'flex-end', gap: 6 }}>
      {open ? (
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Pill label={s.isForeman ? 'Crew view' : 'Foreman view'} onPress={() => s.dev.setRole(s.isForeman ? 'crew' : 'foreman')} />
          <Pill label="5-min nudge" onPress={s.dev.fireNudge} />
          <Pill label={s.sun ? 'Day mode' : 'Sun mode'} onPress={s.toggleSun} />
        </View>
      ) : null}
      <Pill label={open ? 'Hide dev' : 'Dev'} onPress={() => setOpen((v) => !v)} />
    </View>
  );

  function Pill({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Tap
        accessibilityRole="button"
        onPress={onPress}
        style={{
          paddingHorizontal: 11,
          paddingVertical: 9,
          backgroundColor: c.surf2,
          borderWidth: 1,
          borderColor: c.line2,
          borderRadius: radius.sm + 1,
          opacity: 0.9,
        }}
      >
        <Text style={mono(9.5, { track: 0.09, color: c.fg })}>{label}</Text>
      </Tap>
    );
  }
}
