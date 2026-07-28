import React, { useState } from 'react';
import { Image, ScrollView, Text, TextInput, View } from 'react-native';

import { Figures, MonoLabel, Tap } from '../components/ui';
import { MinusIcon, PlusIcon, SendIcon } from '../icons';
import { dayTitle, pad2 } from '../lib/time';
import { useShift } from '../state/shiftStore';
import { FIXED, useTheme } from '../theme/theme';
import { green, ink, navy, radius, white } from '../theme/tokens';
import { archivo, barlow, mono } from '../theme/type';
import type { PhotoTag } from '../types';

/** Photos, material counts and notes. One send at the end of the day. */
export function DayLogScreen() {
  const { c, tap } = useTheme();
  const s = useShift();
  const [draft, setDraft] = useState('');

  const syncLabel = s.offline ? 'Queued' : s.sent ? 'Sent' : 'Not sent';
  const syncBg = s.offline ? FIXED.warn : s.sent ? FIXED.go : c.chip;
  const syncFg = s.offline ? FIXED.warnInk : s.sent ? FIXED.goInk : s.sun ? 'rgba(255,255,255,.62)' : ink[600];

  const tagStyle: Record<PhotoTag, { bg: string; fg: string }> = {
    before: { bg: 'rgba(255,255,255,.9)', fg: ink[900] },
    during: { bg: navy[700], fg: white },
    after: { bg: green[500], fg: ink[900] },
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ gap: 5, flexShrink: 1 }}>
          <MonoLabel size={10}>Day log · JT&nbsp;#{s.job?.number ?? ''}</MonoLabel>
          <Text numberOfLines={1} style={archivo(25, { track: -0.01, color: c.fg })}>
            {dayTitle()}
          </Text>
        </View>
        <Text
          style={[
            mono(10, { track: 0.09, color: syncFg }),
            {
              backgroundColor: syncBg,
              paddingHorizontal: 9,
              paddingVertical: 7,
              borderRadius: radius.xs,
              overflow: 'hidden',
            },
          ]}
        >
          {syncLabel}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <MonoLabel size={10} numberOfLines={1}>
            Photos · {pad2(s.photos.length)}
          </MonoLabel>
          <Tap
            accessibilityRole="button"
            onPress={() => s.setTab('cam')}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderWidth: 1,
              borderColor: c.line2,
              borderRadius: radius.sm + 1,
            }}
          >
            <PlusIcon size={17} color={c.fg} />
            <Text style={mono(10, { track: 0.09, color: c.fg })}>Add</Text>
          </Tap>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...s.photos].reverse().map((p) => (
            <View
              key={p.id}
              style={{
                width: '31.7%',
                aspectRatio: 1,
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: FIXED.camTile,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              {p.uri ? <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} /> : null}
              <Text
                style={[
                  mono(9, { track: 0.09, color: tagStyle[p.tag].fg }),
                  {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: tagStyle[p.tag].bg,
                    paddingHorizontal: 6,
                    paddingVertical: 5,
                    overflow: 'hidden',
                  },
                ]}
              >
                {p.tag}
              </Text>
              <Text
                style={[
                  mono(9, { track: 0.02, color: white }),
                  {
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,.6)',
                    paddingHorizontal: 6,
                    paddingVertical: 5,
                    overflow: 'hidden',
                  },
                ]}
              >
                {p.time}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 26 }} />
        <MonoLabel size={10} style={{ marginBottom: 10 }}>
          Materials used
        </MonoLabel>
        <View style={{ gap: 9 }}>
          {s.materials.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 15,
                paddingRight: 10,
                paddingVertical: 10,
                backgroundColor: c.surf,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: radius.md + 1,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={barlow(14, { lh: 1.15, weight: 600, color: c.fg })}>{m.name}</Text>
                <Text style={mono(10, { track: 0.09, color: c.lab })}>{m.unit}</Text>
              </View>
              <Stepper label={`Less ${m.name}`} onPress={() => s.decMaterial(m.id)}>
                <MinusIcon size={22} color={c.fg} />
              </Stepper>
              <Figures
                style={[archivo(22, { track: -0.01, color: c.fg }), { minWidth: 46, textAlign: 'center' }]}
              >
                {m.qty}
              </Figures>
              <Stepper label={`More ${m.name}`} onPress={() => s.incMaterial(m.id)}>
                <PlusIcon size={22} color={c.fg} strokeWidth={2.6} />
              </Stepper>
            </View>
          ))}
        </View>

        <View style={{ height: 26 }} />
        <MonoLabel size={10} style={{ marginBottom: 10 }}>
          Notes to the office
        </MonoLabel>
        <View style={{ gap: 9 }}>
          {s.notes.map((n) => (
            <View
              key={n.id}
              style={{
                paddingHorizontal: 15,
                paddingVertical: 14,
                backgroundColor: c.surf,
                borderWidth: 1,
                borderColor: c.line,
                borderLeftWidth: 3,
                borderLeftColor: c.navline,
                borderRadius: radius.md + 1,
                gap: 7,
              }}
            >
              <Text style={mono(10, { track: 0.09, color: c.lab })}>{n.meta}</Text>
              <Text style={barlow(14, { lh: 1.5, color: c.fg })}>{n.body}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            marginTop: 11,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: c.line2,
            borderRadius: radius.md + 1,
            padding: 12,
            gap: 12,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What does the office need to know?"
            placeholderTextColor={c.lab}
            multiline
            style={[barlow(15, { lh: 1.45, color: c.fg }), { minHeight: 52, textAlignVertical: 'top' }]}
          />
          <Tap
            accessibilityRole="button"
            disabled={!draft.trim()}
            onPress={() => {
              s.addNote(draft.trim());
              setDraft('');
            }}
            style={{
              minHeight: tap - 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              borderRadius: radius.md,
              backgroundColor: draft.trim() ? FIXED.go : c.surf2,
            }}
          >
            <Text
              style={archivo(16, { track: 0.04, weight: 700, color: draft.trim() ? FIXED.goInk : c.mut })}
            >
              Add note
            </Text>
          </Tap>
        </View>

        <View style={{ height: 22 }} />
        <Tap
          accessibilityRole="button"
          weight="medium"
          onPress={s.sendDay}
          style={{
            minHeight: tap,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 11,
            backgroundColor: c.nav,
            borderRadius: radius.md + 1,
          }}
        >
          <SendIcon size={23} color={white} />
          <Text style={archivo(16, { track: 0.04, weight: 700, color: white })}>Send day to office</Text>
        </Tap>
        <Text style={[barlow(12, { lh: 1.5, color: c.mut }), { textAlign: 'center', marginTop: 10 }]}>
          Photos flow into the DB&nbsp;Cam report. Hours post to JobTread.
        </Text>
      </ScrollView>
    </View>
  );

  function Stepper({
    children,
    onPress,
    label,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    label: string;
  }) {
    return (
      <Tap
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          width: 52,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surf2,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.md,
        }}
      >
        {children}
      </Tap>
    );
  }
}
