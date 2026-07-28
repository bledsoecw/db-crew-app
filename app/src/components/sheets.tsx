import React from 'react';
import { Text, View } from 'react-native';

import { CameraIcon, StopIcon } from '../icons';
import { hm } from '../lib/time';
import { BEFORE_PHOTO_GRACE_SECONDS, FOREMAN_CAN_OVERRIDE_PHOTO_GATE } from '../config';
import { useShift } from '../state/shiftStore';
import { FIXED, useTheme } from '../theme/theme';
import { green, radius, white } from '../theme/tokens';
import { archivo, barlow, mono } from '../theme/type';
import { Figures, Tap } from './ui';
import { Sheet } from './Sheet';

/** Picks the sheet that matches the current state. One sheet at a time. */
export function ActiveSheet() {
  const s = useShift();
  const title =
    s.sheet === 'codes'
      ? s.clockedIn
        ? 'Switch code'
        : 'What are you doing?'
      : s.sheet === 'schedule'
        ? 'Schedule'
        : s.sheet === 'out'
          ? 'End of day'
          : 'Photo check';

  return (
    <Sheet open={!!s.sheet} title={title} onClose={s.closeSheet}>
      {s.sheet === 'codes' ? <CodeList /> : null}
      {s.sheet === 'prompt' ? <PhotoPrompt /> : null}
      {s.sheet === 'schedule' ? <ScheduleList /> : null}
      {s.sheet === 'out' ? <ClockOut /> : null}
    </Sheet>
  );
}

/** 82px rows — the code is the thing you switch all day, so it gets the room. */
function CodeList() {
  const { c } = useTheme();
  const s = useShift();
  return (
    <View>
      {s.codes.map((code) => {
        const running = s.clockedIn && s.active?.n === code.n;
        const bankedSecs = s.banked[code.n] ?? 0;
        return (
          <Tap
            key={code.n}
            accessibilityRole="button"
            weight="medium"
            onPress={() => s.pickCode(code.n)}
            style={{
              minHeight: 82,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 20,
              backgroundColor: running ? (s.sun ? 'rgba(60,200,74,.14)' : green[100]) : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
          >
            <Figures style={[mono(14, { track: 0.06, color: c.lab }), { width: 40 }]}>{code.n}</Figures>
            <Text style={[archivo(18, { track: 0.02, lh: 1.15, weight: 700, color: c.fg }), { flex: 1 }]}>
              {code.name}
            </Text>
            <Text style={mono(10, { track: 0.09, color: running ? c.acc : c.lab })}>
              {running ? 'Running' : bankedSecs ? hm(bankedSecs) : ''}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

/**
 * Two questions live here.
 *
 * BEFORE — asked the moment a code starts. Skippable; the escalation handles
 * the rest. AFTER — asked when you switch away: is this code finished? YES
 * requires the photo, NO switches straight through with nothing owed.
 */
function PhotoPrompt() {
  const { c, tap } = useTheme();
  const s = useShift();
  const isAfter = s.promptKind === 'after';

  // Copy follows the config, so changing the grace period never leaves the
  // screen saying "five minutes" when it means something else.
  const graceMinutes = Math.max(1, Math.round(BEFORE_PHOTO_GRACE_SECONDS / 60));

  const eyebrow = isAfter
    ? `Finished? · ${s.active?.n ?? ''}`
    : s.escalated
      ? `${graceMinutes} ${graceMinutes === 1 ? 'minute' : 'minutes'} in · ${s.active?.n ?? ''}`
      : `Code started · ${s.active?.n ?? ''}`;

  const body = isAfter
    ? `Is ${s.active ? `${s.active.n} ${s.active.name.toLowerCase()}` : 'this code'} finished, or are you coming back to it?`
    : s.escalated
      ? `No before photo on this code and you have been on it ${graceMinutes} ${graceMinutes === 1 ? 'minute' : 'minutes'}. The office has been notified. Take it now — it is what protects this job.`
      : 'One before photo of the area before you start. It protects the job and it feeds the DB Cam report.';

  const borderColor = isAfter || s.escalated ? FIXED.warn : s.sun ? 'rgba(126,240,138,.5)' : green[700];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          paddingHorizontal: 15,
          paddingVertical: 16,
          borderRadius: radius.md + 1,
          borderWidth: 2,
          borderColor,
        }}
      >
        <CameraIcon size={30} color={c.fg} strokeWidth={2} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={[mono(10, { track: 0.12, color: c.fg }), { opacity: 0.85 }]}>{eyebrow}</Text>
          <Text style={archivo(21, { track: 0.01, lh: 1.1, color: c.fg })}>
            {isAfter ? `${s.active?.name ?? ''} done?` : (s.active?.name ?? '')}
          </Text>
        </View>
      </View>

      <Text style={barlow(15, { lh: 1.55, color: c.mut })}>{body}</Text>

      {isAfter ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Tap
              accessibilityRole="button"
              weight="medium"
              onPress={s.promptNo}
              style={{
                flex: 1,
                minHeight: 100,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                borderWidth: 2,
                borderColor: c.line2,
                borderRadius: radius.md + 1,
              }}
            >
              <Text style={archivo(30, { track: 0.04, color: c.fg })}>No</Text>
              <Text style={[mono(9.5, { track: 0.09, color: c.fg }), { opacity: 0.75 }]}>Still going</Text>
            </Tap>
            <Tap
              accessibilityRole="button"
              weight="heavy"
              onPress={s.promptYes}
              style={{
                flex: 1,
                minHeight: 100,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                backgroundColor: FIXED.go,
                borderWidth: 2,
                borderColor: FIXED.go,
                borderRadius: radius.md + 1,
              }}
            >
              <Text style={archivo(30, { track: 0.04, color: FIXED.goInk })}>Yes</Text>
              <Text style={[mono(9.5, { track: 0.09, color: FIXED.goInk }), { opacity: 0.75 }]}>
                It's finished
              </Text>
            </Tap>
          </View>
          <Text style={barlow(13.5, { lh: 1.5, color: c.mut })}>
            Yes → one after photo of the finished work, then{' '}
            {s.nextCode ? `${s.nextCode.n} ${s.nextCode.name.toLowerCase()}` : 'the next code'} starts. No →
            switch now, nothing owed.
          </Text>
        </>
      ) : (
        <>
          <Tap
            accessibilityRole="button"
            weight="heavy"
            onPress={s.promptShoot}
            style={{
              minHeight: 88,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backgroundColor: FIXED.go,
              borderRadius: radius.md + 1,
            }}
          >
            <CameraIcon size={26} color={FIXED.goInk} strokeWidth={2.3} />
            <Text style={archivo(21, { track: 0.04, color: FIXED.goInk })}>Take before photo</Text>
          </Tap>
          <Tap
            accessibilityRole="button"
            onPress={s.promptSkip}
            style={{
              minHeight: tap,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: c.line2,
              borderRadius: radius.md + 1,
            }}
          >
            <Text style={mono(12, { track: 0.09, color: c.mut })}>
              {s.escalated ? 'Still not now' : 'Start without a photo'}
            </Text>
          </Tap>
        </>
      )}
    </View>
  );
}

function ScheduleList() {
  const { c } = useTheme();
  const s = useShift();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 12 }}>
      {s.schedule.map((d) => (
        <View
          key={d.id}
          style={{
            padding: 16,
            backgroundColor: c.surf,
            borderWidth: 1,
            borderColor: c.line,
            borderLeftWidth: 3,
            borderLeftColor: d.today ? FIXED.go : s.sun ? 'rgba(255,255,255,.2)' : c.line2,
            borderRadius: radius.md + 1,
            gap: 7,
          }}
        >
          <Text style={mono(10, { track: 0.14, color: d.today ? c.acc : c.lab })}>{d.day}</Text>
          <Text style={archivo(20, { track: -0.01, lh: 1.1, color: c.fg })}>{d.addr}</Text>
          <Text style={barlow(14, { lh: 1.35, color: c.mut })}>{d.detail}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The day's totals, and the one hard block in the app: no after photo of the
 * code you are on, no clock-out. The confirm button stays visible but dimmed
 * and inert, so the reason is obvious rather than mysterious.
 */
function ClockOut() {
  const { c, tap } = useTheme();
  const s = useShift();
  const blocked = s.needAfterForOut;
  const canOverride = FOREMAN_CAN_OVERRIDE_PHOTO_GATE && s.isForeman;

  const summary = Object.keys(s.banked)
    .sort()
    .map((n) => `${(s.codes.find((x) => x.n === n)?.name ?? n).toUpperCase()} ${hm(s.banked[n])}`)
    .join(' · ');

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 16 }}>
      <View
        style={{
          backgroundColor: c.band,
          borderWidth: 1,
          borderColor: c.bandline,
          borderRadius: radius.lg,
          paddingHorizontal: 18,
          paddingVertical: 20,
          gap: 8,
        }}
      >
        <Text style={mono(10, { track: 0.14, color: FIXED.onBandLab })}>
          Total today · JT&nbsp;#{s.job?.number ?? ''}
        </Text>
        <Figures style={archivo(52, { track: -0.03, caps: false, color: white })}>
          {hm(s.totalSeconds)}
        </Figures>
        <Text style={barlow(14, { lh: 1.4, color: 'rgba(255,255,255,.6)' })}>{summary}</Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 15,
          paddingVertical: 14,
          borderRadius: radius.md + 1,
          backgroundColor: blocked ? FIXED.warn : 'transparent',
          borderWidth: 2,
          borderColor: blocked ? FIXED.warn : s.sun ? 'rgba(126,240,138,.5)' : green[500],
        }}
      >
        <CameraIcon size={27} color={blocked ? FIXED.warnInk : c.fg} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={[
              mono(10, { track: 0.12, color: blocked ? FIXED.warnInk : c.fg }),
              { opacity: 0.85 },
            ]}
          >
            {blocked ? 'Required to clock out' : 'After photo · on file'}
          </Text>
          <Text
            style={barlow(14.5, { lh: 1.3, weight: 600, color: blocked ? FIXED.warnInk : c.fg })}
          >
            {blocked
              ? `One after photo of ${s.active ? `${s.active.n} ${s.active.name.toLowerCase()}` : 'the work'}.`
              : s.afterShot
                ? `${s.afterShot.time} · ${s.active ? `${s.active.n} ${s.active.name.toLowerCase()}` : ''}`
                : 'Filed.'}
          </Text>
        </View>
      </View>

      {blocked ? (
        <Tap
          accessibilityRole="button"
          weight="medium"
          onPress={s.goAfterPhoto}
          style={{
            minHeight: tap,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 11,
            backgroundColor: FIXED.go,
            borderRadius: radius.md + 1,
          }}
        >
          <CameraIcon size={24} color={FIXED.goInk} strokeWidth={2.3} />
          <Text style={archivo(18, { track: 0.04, color: FIXED.goInk })}>Take the after photo</Text>
        </Tap>
      ) : null}

      <Text style={barlow(14, { lh: 1.55, color: c.mut })}>
        Hours post to JobTread against each code. You can't edit them after this — tell your foreman if
        something's off.
      </Text>

      <Tap
        accessibilityRole="button"
        weight="heavy"
        disabled={blocked && !canOverride}
        accessibilityState={{ disabled: blocked && !canOverride }}
        onPress={s.confirmClockOut}
        style={{
          minHeight: 88,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          borderRadius: radius.md + 1,
          backgroundColor: blocked ? c.surf2 : c.stop,
          opacity: blocked ? 0.6 : 1,
        }}
      >
        <StopIcon size={24} color={blocked ? c.mut : c.stopfg} />
        <Text style={archivo(21, { track: 0.05, color: blocked ? c.mut : c.stopfg })}>
          Confirm clock out
        </Text>
      </Tap>
    </View>
  );
}
