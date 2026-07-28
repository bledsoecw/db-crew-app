import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { OfflineBanner } from '../components/AppHeader';
import { Figures, LiveDot, MonoLabel, Tap } from '../components/ui';
import {
  CameraIcon,
  ChevronRightIcon,
  ClockIcon,
  StopIcon,
  SwitchIcon,
  UserCheckIcon,
} from '../icons';
import { DURING_PHOTO_AFTER_SECONDS } from '../config';
import { clockLabel, hm, hms } from '../lib/time';
import { useShift } from '../state/shiftStore';
import { FIXED, useTheme } from '../theme/theme';
import { green, radius, white } from '../theme/tokens';
import { archivo, barlow, mono } from '../theme/type';

/**
 * The home screen. One job, many codes — the code is the thing a crew member
 * switches all day, so the code is the loudest control here.
 */
export function ClockScreen() {
  const { c, tap } = useTheme();
  const s = useShift();

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 26 }}
      >
        <JobCard />
        {s.clockedIn ? <RunningBlock /> : <ClockInButton />}
        <TodayTable />
        {s.isForeman ? <CrewBlock /> : null}
      </ScrollView>
    </View>
  );

  function JobCard() {
    const job = s.job;
    if (!job) return null;
    const todayCount = Math.max(1, s.schedule.filter((d) => d.today).length);
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View
          style={{
            backgroundColor: c.surf,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 15, gap: 9 }}>
            <MonoLabel size={10}>Today's job · JT&nbsp;#{job.number}</MonoLabel>
            <Text style={archivo(27, { track: -0.01, lh: 1.05, color: c.fg })}>{job.address}</Text>
            <Text style={barlow(15, { color: c.mut })}>
              {job.customer} · {job.location}
            </Text>
            <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 3 }}>
              <Chip>{job.scope}</Chip>
              <Chip>{job.dayLabel}</Chip>
            </View>
          </View>

          <Tap
            accessibilityRole="button"
            onPress={s.openSchedule}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingHorizontal: 18,
              backgroundColor: c.surf2,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Text style={mono(11, { track: 0.09, color: c.mut })}>
              {todayCount} {todayCount === 1 ? 'job' : 'jobs'} today · Schedule
            </Text>
            <ChevronRightIcon size={22} color={c.fg} />
          </Tap>
        </View>
      </View>
    );
  }

  function Chip({ children }: { children: React.ReactNode }) {
    return (
      <View
        style={{
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: radius.xs,
          backgroundColor: c.chip,
        }}
      >
        <Text style={mono(10, { track: 0.09, color: c.mut })}>{children}</Text>
      </View>
    );
  }

  function RunningBlock() {
    return (
      <>
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View
            style={{
              backgroundColor: c.band,
              borderWidth: 1,
              borderColor: c.bandline,
              borderRadius: radius.lg,
              paddingHorizontal: 18,
              paddingTop: 20,
              paddingBottom: 18,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <LiveDot size={11} color={FIXED.live} />
              <Text style={mono(11, { track: 0.14, color: FIXED.liveText })}>On the clock</Text>
            </View>
            <Figures style={archivo(62, { track: -0.03, color: white })}>{hms(s.elapsed)}</Figures>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Figures style={mono(15, { track: 0.06, color: FIXED.onBandLab })}>
                {s.active?.n ?? ''}
              </Figures>
              <Text style={archivo(17, { track: 0.02, lh: 1.1, weight: 700, color: white })}>
                {s.active?.name ?? ''}
              </Text>
            </View>
            <Text style={barlow(13, { lh: 1.4, color: FIXED.onBandMut })}>
              Started {clockLabel(s.startedAt ?? Date.now())} · syncs to JobTread on clock-out
            </Text>
          </View>
        </View>

        <ReminderStrip />

        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
          <Tap
            accessibilityRole="button"
            weight="medium"
            onPress={s.openCodes}
            style={{
              minHeight: tap,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 11,
              borderWidth: 2,
              borderColor: c.line2,
              borderRadius: radius.md + 1,
            }}
          >
            <SwitchIcon size={24} color={c.fg} />
            <Text style={archivo(17, { track: 0.04, weight: 700, color: c.fg })}>Switch code</Text>
          </Tap>

          <Tap
            accessibilityRole="button"
            weight="heavy"
            onPress={s.askClockOut}
            style={{
              minHeight: tap,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backgroundColor: c.stop,
              borderRadius: radius.md + 1,
            }}
          >
            <StopIcon size={22} color={c.stopfg} />
            <Text style={archivo(20, { track: 0.05, color: c.stopfg })}>Clock out</Text>
          </Tap>
        </View>
      </>
    );
  }

  /**
   * The one strip that carries every photo requirement.
   *
   * Amber while something is owed, quiet green once it is clear. It is a
   * button: tapping it takes you to the camera already set to the right tag.
   */
  function ReminderStrip() {
    const owed = s.needBefore || s.needDuring || s.afterRequired;
    const bg = owed ? FIXED.warn : 'transparent';
    const fg = owed ? FIXED.warnInk : c.fg;
    const borderColor = owed
      ? FIXED.warn
      : s.needAfterForOut
        ? c.line2
        : s.sun
          ? 'rgba(126,240,138,.4)'
          : green[700];

    const label = s.afterRequired
      ? 'After photo · blocking the switch'
      : s.needBefore
        ? 'Before photo · required'
        : s.needDuring
          ? 'Progress photo · due'
          : s.needAfterForOut
            ? 'After photo · due when done'
            : 'Photo check · clear';

    const body = s.afterRequired
      ? `Shoot the finished work to start ${
          s.nextCode ? `${s.nextCode.n} ${s.nextCode.name.toLowerCase()}` : 'the next code'
        }.`
      : s.needBefore
        ? 'One shot of the area before you start.'
        : s.needDuring
          ? `${Math.round(DURING_PHOTO_AFTER_SECONDS / 60)} minutes in — grab a during shot.`
          : s.needAfterForOut
            ? `${s.codePhotos.length} on file. You can't clock out without the after shot.`
            : `${s.codePhotos.length} photos on this code. Nothing owed.`;

    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Tap
          accessibilityRole="button"
          onPress={s.reminderAction}
          style={{
            minHeight: tap,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
            paddingHorizontal: 15,
            paddingVertical: 14,
            borderRadius: radius.md + 1,
            backgroundColor: bg,
            borderWidth: 2,
            borderColor,
          }}
        >
          <CameraIcon size={27} color={fg} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[mono(10, { track: 0.12, color: fg }), { opacity: 0.85 }]}>{label}</Text>
            <Text style={barlow(14.5, { lh: 1.3, weight: 600, color: fg })}>{body}</Text>
          </View>
          <View style={{ opacity: 0.8 }}>
            <ChevronRightIcon size={22} color={fg} />
          </View>
        </Tap>
      </View>
    );
  }

  /** You cannot clock in without saying what you are doing. */
  function ClockInButton() {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Tap
          accessibilityRole="button"
          weight="heavy"
          onPress={s.openCodes}
          style={{
            minHeight: 132,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            backgroundColor: FIXED.go,
            borderRadius: radius.lg,
          }}
        >
          <ClockIcon size={34} color={FIXED.goInk} strokeWidth={2.4} />
          <Text style={archivo(30, { track: 0.03, color: FIXED.goInk })}>Clock in</Text>
          <Text style={[mono(10, { track: 0.14, color: FIXED.goInk }), { opacity: 0.7 }]}>
            Pick a code to start
          </Text>
        </Tap>
      </View>
    );
  }

  function TodayTable() {
    const rows = Object.keys(s.banked)
      .sort()
      .map((n) => {
        const code = s.codes.find((x) => x.n === n);
        const live = s.clockedIn && s.active?.n === n;
        const name = (code ? code.name : n).toUpperCase();
        return { n, name: `${name}${live ? ' ·' : ''}`, dur: hm(s.banked[n]) };
      });

    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
        <MonoLabel size={10} style={{ marginBottom: 11 }}>
          Today on this job
        </MonoLabel>
        <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.md + 1, overflow: 'hidden' }}>
          {rows.map((r) => (
            <View
              key={r.n}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 58,
                paddingHorizontal: 15,
                backgroundColor: c.surf,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <Figures style={[mono(12, { track: 0.06, color: c.lab }), { width: 34 }]}>{r.n}</Figures>
              <Text numberOfLines={1} style={[barlow(14, { lh: 1.2, weight: 600, color: c.fg }), { flex: 1 }]}>
                {r.name}
              </Text>
              <Figures style={archivo(15, { track: 0.01, weight: 700, caps: false, color: c.fg })}>
                {r.dur}
              </Figures>
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 58,
              paddingHorizontal: 15,
              backgroundColor: c.total,
            }}
          >
            <Text style={[mono(11, { track: 0.14, color: c.acc }), { flex: 1 }]}>Total today</Text>
            <Figures style={archivo(19, { track: -0.01, caps: false, color: c.acc })}>
              {hm(s.totalSeconds)}
            </Figures>
          </View>
        </View>
      </View>
    );
  }

  /** Foreman is the same app with a crew block added — no separate build. */
  function CrewBlock() {
    const on = s.crew.filter((m) => m.on).length;
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 11,
          }}
        >
          <Text style={mono(10, { track: 0.14, color: c.lab })}>
            Crew · <Text style={{ color: c.acc }}>{on} on</Text>
          </Text>
          <MonoLabel size={10} track={0.09}>
            Foreman view
          </MonoLabel>
        </View>

        <View style={{ gap: 10 }}>
          {s.crew.map((m) => (
            <Tap
              key={m.id}
              accessibilityRole="button"
              onPress={() => s.toggleCrew(m.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                minHeight: 70,
                paddingHorizontal: 15,
                backgroundColor: c.surf,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: radius.md + 1,
              }}
            >
              <View
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: m.on ? FIXED.live : s.sun ? 'rgba(255,255,255,.45)' : c.line2,
                }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={archivo(16, { track: 0.01, weight: 700, color: c.fg })}>{m.name}</Text>
                <Text style={mono(10, { track: 0.09, color: c.lab })}>
                  {m.on
                    ? `On · ${m.code} ${s.codes.find((x) => x.n === m.code)?.name ?? ''}`
                    : 'Not clocked in'}
                </Text>
              </View>
              <Figures style={archivo(15, { weight: 700, caps: false, color: c.mut })}>
                {m.on ? hm(m.secs) : '—'}
              </Figures>
            </Tap>
          ))}
        </View>

        <Tap
          accessibilityRole="button"
          weight="medium"
          onPress={s.clockInWholeCrew}
          style={{
            marginTop: 12,
            minHeight: tap,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 11,
            backgroundColor: c.nav,
            borderRadius: radius.md + 1,
          }}
        >
          <UserCheckIcon size={24} color={white} />
          <Text style={archivo(16, { track: 0.04, weight: 700, color: white })}>
            Clock in whole crew
          </Text>
        </Tap>
      </View>
    );
  }
}
