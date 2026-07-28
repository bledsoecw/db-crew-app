import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNetworkState } from 'expo-network';

import {
  BEFORE_PHOTOS_REQUIRED,
  BEFORE_PHOTO_GRACE_SECONDS,
  BEFORE_PHOTO_RENOTIFY_SECONDS,
  DURING_PHOTO_AFTER_SECONDS,
} from '../config';
import { jobtread } from '../jobtread';
import type { TodayBundle } from '../jobtread/types';
import { clockLabel, hm, pad2 } from '../lib/time';
import { keepCapture } from '../lib/media';
import { beforePhotoBody, cancelNudge, scheduleBeforePhotoNudge } from '../notifications/nudge';
import { drain, enqueue, loadQueue, setOnline, subscribeQueue } from '../sync/queue';
import type {
  Capture,
  CostCode,
  CrewMember,
  Job,
  Material,
  Note,
  PhotoTag,
  PromptKind,
  Role,
  ScheduleDay,
  SheetKind,
  Tab,
} from '../types';
import { loadShift, saveShift } from './persistence';

/**
 * The whole shift, in one place.
 *
 * The rule the design is built on: the app asks for photos at the moments they
 * are actually owed, and only blocks when the answer is unambiguous — you said
 * the code was finished, or you are ending the day. Everything else is a
 * nudge, not a wall.
 */

type State = {
  ready: boolean;
  sun: boolean;
  role: Role;
  tab: Tab;

  job: Job | null;
  codes: CostCode[];
  schedule: ScheduleDay[];
  crew: CrewMember[];
  userName: string;
  userId: string;

  clockedIn: boolean;
  activeCode: string | null;
  startedAt: number | null;
  banked: Record<string, number>;

  sheet: SheetKind;
  promptKind: PromptKind;
  /** the code we are switching TO, held while we settle the after photo */
  pendingSwitch: string | null;
  /** an after photo of the current code is blocking the pending switch */
  afterRequired: boolean;

  nudged: boolean;
  /** when the escalation last fired, so it can repeat if configured to */
  nudgedAt: number | null;
  escalated: boolean;
  nudgeId: string | null;
  notif: { body: string } | null;
  /** a prompted capture returns to the clock; a self-directed one does not */
  returnToClock: boolean;

  capture: PhotoTag;
  mode: 'photo' | 'video';
  recStartedAt: number | null;

  photos: Capture[];
  materials: Material[];
  notes: Note[];
  sent: boolean;

  toast: string | null;
};

const INITIAL: State = {
  ready: false,
  sun: true,
  role: 'crew',
  tab: 'job',
  job: null,
  codes: [],
  schedule: [],
  crew: [],
  userName: '',
  userId: '',
  clockedIn: false,
  activeCode: null,
  startedAt: null,
  banked: {},
  sheet: null,
  promptKind: null,
  pendingSwitch: null,
  afterRequired: false,
  nudged: false,
  nudgedAt: null,
  escalated: false,
  nudgeId: null,
  notif: null,
  returnToClock: false,
  capture: 'before',
  mode: 'photo',
  recStartedAt: null,
  photos: [],
  materials: [],
  notes: [],
  sent: false,
  toast: null,
};

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type Shift = ReturnType<typeof useShiftValue>;

const ShiftContext = createContext<Shift | null>(null);

function useShiftValue() {
  const [s, setS] = useState<State>(INITIAL);
  const [now, setNow] = useState(() => Date.now());
  const [queued, setQueued] = useState(0);

  const net = useNetworkState();
  const offline = net.isInternetReachable === false || net.isConnected === false;

  const stateRef = useRef(s);
  stateRef.current = s;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback((next: Partial<State> | ((prev: State) => Partial<State>)) => {
    setS((prev) => ({ ...prev, ...(typeof next === 'function' ? next(prev) : next) }));
  }, []);

  const say = useCallback(
    (msg: string) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      patch({ toast: msg });
      toastTimer.current = setTimeout(() => patch({ toast: null }), 2600);
    },
    [patch],
  );

  // ── boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadQueue();
      const [bundle, saved] = await Promise.all([
        jobtread.getToday().catch(() => null),
        loadShift(),
      ]);
      if (!alive) return;
      const b: TodayBundle | null = bundle;
      patch({
        ready: true,
        job: b?.job ?? null,
        codes: b?.codes ?? [],
        schedule: b?.schedule ?? [],
        crew: b?.crew ?? [],
        userName: b?.session.name ?? '',
        userId: b?.session.userId ?? '',
        role: b?.session.role ?? 'crew',
        materials: saved?.materials ?? b?.materials ?? [],
        banked: saved?.banked ?? b?.banked ?? {},
        notes: saved?.notes ?? [],
        photos: saved?.photos ?? [],
        sun: saved?.sun ?? true,
        clockedIn: saved?.clockedIn ?? false,
        activeCode: saved?.activeCode ?? null,
        startedAt: saved?.startedAt ?? null,
        sent: saved?.sent ?? false,
        nudged: saved?.nudged ?? false,
        escalated: saved?.escalated ?? false,
        afterRequired: saved?.afterRequired ?? false,
        pendingSwitch: saved?.pendingSwitch ?? null,
        capture: saved?.capture ?? 'before',
        nudgeId: saved?.nudgeId ?? null,
      });
    })();
    return () => {
      alive = false;
    };
  }, [patch]);

  // ── persist ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!s.ready) return;
    void saveShift({
      sun: s.sun,
      clockedIn: s.clockedIn,
      activeCode: s.activeCode,
      startedAt: s.startedAt,
      banked: s.banked,
      photos: s.photos,
      materials: s.materials,
      notes: s.notes,
      sent: s.sent,
      nudged: s.nudged,
      escalated: s.escalated,
      afterRequired: s.afterRequired,
      pendingSwitch: s.pendingSwitch,
      capture: s.capture,
      nudgeId: s.nudgeId,
    });
  }, [
    s.ready, s.sun, s.clockedIn, s.activeCode, s.startedAt, s.banked, s.photos,
    s.materials, s.notes, s.sent, s.nudged, s.escalated, s.afterRequired,
    s.pendingSwitch, s.capture, s.nudgeId,
  ]);

  // ── the second hand ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Recompute the moment the app comes back, so a phone that spent an hour in
  // a pocket shows the right number immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(Date.now());
        void drain();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => subscribeQueue(setQueued), []);
  useEffect(() => setOnline(!offline), [offline]);

  // ── derived ─────────────────────────────────────────────────────────────
  const elapsed = s.clockedIn && s.startedAt ? Math.max(0, Math.floor((now - s.startedAt) / 1000)) : 0;
  const recSeconds = s.recStartedAt ? Math.max(0, Math.floor((now - s.recStartedAt) / 1000)) : 0;

  const active = useMemo(
    () => s.codes.find((c) => c.n === s.activeCode) ?? null,
    [s.codes, s.activeCode],
  );
  const nextCode = useMemo(
    () => s.codes.find((c) => c.n === s.pendingSwitch) ?? null,
    [s.codes, s.pendingSwitch],
  );

  /** Banked seconds including the block currently running. */
  const banked = useMemo(() => {
    if (!s.clockedIn || !s.activeCode) return s.banked;
    return { ...s.banked, [s.activeCode]: (s.banked[s.activeCode] ?? 0) + elapsed };
  }, [s.banked, s.clockedIn, s.activeCode, elapsed]);

  const totalSeconds = useMemo(
    () => Object.values(banked).reduce((a, v) => a + v, 0),
    [banked],
  );

  const codePhotos = useMemo(
    () => s.photos.filter((p) => p.code === s.activeCode),
    [s.photos, s.activeCode],
  );
  const hasTag = useCallback(
    (t: PhotoTag) => codePhotos.filter((p) => p.tag === t).length >= (t === 'before' ? BEFORE_PHOTOS_REQUIRED : 1),
    [codePhotos],
  );
  const afterShot = useMemo(
    () => codePhotos.filter((p) => p.tag === 'after').slice(-1)[0] ?? null,
    [codePhotos],
  );

  const needBefore = s.clockedIn && !hasTag('before');
  const needDuring = s.clockedIn && !needBefore && elapsed > DURING_PHOTO_AFTER_SECONDS && !hasTag('during');
  /** Clock-out is blocked until the active code has an after photo. */
  const needAfterForOut = !afterShot;

  // ── the 5-minute escalation ─────────────────────────────────────────────
  const fireNudge = useCallback(
    (minutesOverride?: number) => {
      const st = stateRef.current;
      const code = st.codes.find((c) => c.n === st.activeCode);
      const mins = Math.max(
        1,
        minutesOverride ??
          Math.max(
            Math.round(BEFORE_PHOTO_GRACE_SECONDS / 60),
            st.startedAt ? Math.floor((Date.now() - st.startedAt) / 60000) : 5,
          ),
      );
      patch({
        nudged: true,
        nudgedAt: Date.now(),
        escalated: true,
        tab: 'job',
        sheet: 'prompt',
        promptKind: 'before',
        notif: {
          body: code
            ? beforePhotoBody(code.n, code.name, mins)
            : 'A code has been running without a before photo.',
        },
      });
      if (notifTimer.current) clearTimeout(notifTimer.current);
      notifTimer.current = setTimeout(() => patch({ notif: null }), 7000);
    },
    [patch],
  );

  useEffect(() => {
    if (!s.clockedIn || !s.activeCode) return;
    if (elapsed < BEFORE_PHOTO_GRACE_SECONDS) return;
    if (hasTag('before')) return;
    if (s.nudged) {
      // Fires once per code by default; set BEFORE_PHOTO_RENOTIFY_SECONDS to
      // keep reminding until the shot exists.
      if (BEFORE_PHOTO_RENOTIFY_SECONDS == null) return;
      if (s.nudgedAt && Date.now() - s.nudgedAt < BEFORE_PHOTO_RENOTIFY_SECONDS * 1000) return;
    }
    fireNudge();
  }, [s.clockedIn, s.nudged, s.nudgedAt, s.activeCode, elapsed, hasTag, fireNudge]);

  // Tapping the OS notification opens straight onto the photo screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      if (res.notification.request.content.data?.kind !== 'before-photo') return;
      patch({ tab: 'cam', capture: 'before', sheet: null, notif: null, returnToClock: true, escalated: true, nudged: true });
    });
    return () => sub.remove();
  }, [patch]);

  // ── actions ─────────────────────────────────────────────────────────────

  /** Close the running block and hand it to the sync queue. */
  const bankActive = useCallback((): Record<string, number> => {
    const st = stateRef.current;
    if (!st.clockedIn || !st.activeCode || !st.startedAt) return st.banked;
    const secs = Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000));
    void enqueue({
      id: rid(),
      kind: 'time',
      payload: {
        id: rid(),
        jobId: st.job?.id ?? '',
        costCode: st.activeCode,
        userId: st.userId,
        startedAt: st.startedAt,
        endedAt: Date.now(),
        seconds: secs,
      },
    });
    return { ...st.banked, [st.activeCode]: (st.banked[st.activeCode] ?? 0) + secs };
  }, []);

  const startCode = useCallback(
    async (code: string) => {
      const st = stateRef.current;
      const c = st.codes.find((x) => x.n === code);
      if (!c) return;
      const wasOn = st.clockedIn;
      const nextBanked = bankActive();
      await cancelNudge(st.nudgeId);
      const nudgeId = await scheduleBeforePhotoNudge(c.n, c.name);
      patch({
        clockedIn: true,
        activeCode: code,
        startedAt: Date.now(),
        banked: nextBanked,
        sent: false,
        pendingSwitch: null,
        afterRequired: false,
        nudged: false,
        nudgedAt: null,
        escalated: false,
        notif: null,
        returnToClock: false,
        nudgeId,
        // A code starting is the moment a before photo is owed. Ask now.
        sheet: 'prompt',
        promptKind: 'before',
        tab: 'job',
        capture: 'before',
      });
      setNow(Date.now());
      say(`${wasOn ? 'Now on ' : 'On the clock · '}${c.n} ${c.name}`);
    },
    [bankActive, patch, say],
  );

  const pickCode = useCallback(
    (code: string) => {
      const st = stateRef.current;
      if (st.clockedIn && st.activeCode === code) {
        patch({ sheet: null });
        return;
      }
      if (st.clockedIn) {
        // One question before a switch: is the code you're leaving finished?
        patch({ sheet: 'prompt', promptKind: 'after', pendingSwitch: code });
        return;
      }
      void startCode(code);
    },
    [patch, startCode],
  );

  /** "YES — it's finished": an after photo is now required to start the next code. */
  const promptYes = useCallback(() => {
    const st = stateRef.current;
    patch({ sheet: null, tab: 'cam', capture: 'after', afterRequired: true });
    const next = st.codes.find((c) => c.n === st.pendingSwitch);
    say(`After photo required to start ${next ? next.n : 'the next code'}`);
  }, [patch, say]);

  /** "NO — still going": switch straight through, nothing owed. */
  const promptNo = useCallback(() => {
    const st = stateRef.current;
    if (st.pendingSwitch) void startCode(st.pendingSwitch);
    else patch({ sheet: null, promptKind: null });
  }, [patch, startCode]);

  const promptShoot = useCallback(() => {
    patch({ sheet: null, tab: 'cam', capture: 'before', notif: null, returnToClock: true });
  }, [patch]);

  const promptSkip = useCallback(() => {
    patch({ sheet: null, promptKind: null, notif: null });
  }, [patch]);

  /** After a prompted capture we go back to the running clock. */
  const settleAfterShot = useCallback(
    (shot: Capture) => {
      const st = stateRef.current;
      if (shot.tag === 'after' && st.pendingSwitch) {
        const target = st.pendingSwitch;
        setTimeout(() => void startCode(target), 520);
        return;
      }
      if (st.returnToClock) {
        setTimeout(() => patch({ tab: 'job', returnToClock: false }), 640);
      }
    },
    [patch, startCode],
  );

  const record = useCallback(
    async (uri: string | null, kind: 'photo' | 'video') => {
      const st = stateRef.current;
      const id = rid();
      const at = Date.now();
      const stored = uri ? await keepCapture(uri, id, kind) : null;
      const shot: Capture = {
        id,
        tag: st.capture,
        uri: stored,
        kind,
        time: clockLabel(at),
        at,
        code: st.activeCode,
      };
      patch((prev) => ({ photos: [...prev.photos, shot], sent: false }));
      if (stored) {
        void enqueue({
          id: rid(),
          kind: 'photo',
          payload: {
            id,
            jobId: st.job?.id ?? '',
            costCode: st.activeCode,
            tag: shot.tag,
            kind,
            uri: stored,
            takenAt: at,
            userId: st.userId,
          },
        });
      }
      // The before requirement is satisfied — call off the escalation.
      if (shot.tag === 'before' && shot.code === st.activeCode) {
        void cancelNudge(st.nudgeId);
        patch({ nudgeId: null, escalated: false, notif: null });
      }
      settleAfterShot(shot);
      return shot;
    },
    [patch, settleAfterShot],
  );

  const startRecording = useCallback(() => {
    patch({ recStartedAt: Date.now() });
    setNow(Date.now());
  }, [patch]);

  const stopRecording = useCallback(() => patch({ recStartedAt: null }), [patch]);

  const confirmClockOut = useCallback(() => {
    if (needAfterForOut) {
      say('After photo required before clock-out');
      return;
    }
    const total = totalSeconds;
    const nextBanked = bankActive();
    void cancelNudge(stateRef.current.nudgeId);
    patch({
      banked: nextBanked,
      clockedIn: false,
      activeCode: null,
      startedAt: null,
      sheet: null,
      promptKind: null,
      pendingSwitch: null,
      afterRequired: false,
      nudgeId: null,
      nudged: false,
      nudgedAt: null,
      escalated: false,
    });
    say(`Clocked out · ${hm(total)} sent to JobTread`);
  }, [bankActive, needAfterForOut, patch, say, totalSeconds]);

  const sendDay = useCallback(() => {
    const st = stateRef.current;
    void enqueue({
      id: rid(),
      kind: 'day',
      payload: {
        jobId: st.job?.id ?? '',
        userId: st.userId,
        date: new Date().toISOString().slice(0, 10),
        materials: st.materials.map((m) => ({ name: m.name, unit: m.unit, qty: m.qty })),
        notes: st.notes.map((n) => ({ meta: n.meta, body: n.body })),
      },
    });
    patch({ sent: true });
    say(offline ? 'Queued · sends when you have signal' : 'Sent · photos to DB Cam, hours to JobTread');
  }, [offline, patch, say]);

  const value = {
    // status
    ready: s.ready,
    sun: s.sun,
    role: s.role,
    isForeman: s.role === 'foreman',
    tab: s.tab,
    offline,
    queuedCount: queued,

    // job
    job: s.job,
    codes: s.codes,
    schedule: s.schedule,
    crew: s.crew,
    userName: s.userName,
    whoLabel: `${s.userName} · ${s.role === 'foreman' ? 'Foreman' : 'Crew'}`,

    // clock
    clockedIn: s.clockedIn,
    active,
    nextCode,
    elapsed,
    startedAt: s.startedAt,
    banked,
    totalSeconds,

    // photo gates
    photos: s.photos,
    codePhotos,
    afterShot,
    needBefore,
    needDuring,
    needAfterForOut,
    afterRequired: s.afterRequired,
    escalated: s.escalated,

    // capture
    capture: s.capture,
    mode: s.mode,
    recording: s.recStartedAt !== null,
    recSeconds,

    // chrome
    sheet: s.sheet,
    promptKind: s.promptKind,
    pendingSwitch: s.pendingSwitch,
    notif: s.notif,
    toast: s.toast,
    sent: s.sent,
    materials: s.materials,
    notes: s.notes,

    // actions
    setTab: (tab: Tab) =>
      patch((prev) => ({
        tab,
        sheet: null,
        // a self-directed trip to the camera keeps you in the camera
        returnToClock: tab === 'cam' ? false : prev.returnToClock,
      })),
    toggleSun: () => patch((prev) => ({ sun: !prev.sun })),
    openCodes: () => patch({ sheet: 'codes' }),
    openSchedule: () => patch({ sheet: 'schedule' }),
    askClockOut: () => patch({ sheet: 'out' }),
    closeSheet: () => patch({ sheet: null }),
    pickCode,
    promptYes,
    promptNo,
    promptShoot,
    promptSkip,
    confirmClockOut,
    goAfterPhoto: () => patch({ sheet: null, tab: 'cam', capture: 'after', returnToClock: true }),
    reminderAction: () =>
      patch((prev) => ({
        tab: 'cam',
        returnToClock: true,
        capture: needBefore && !prev.afterRequired ? 'before' : needDuring ? 'during' : 'after',
      })),
    setCapture: (tag: PhotoTag) => patch({ capture: tag }),
    toggleMode: () => patch((prev) => ({ mode: prev.mode === 'photo' ? 'video' : 'photo', recStartedAt: null })),
    record,
    startRecording,
    stopRecording,
    dismissNotif: () => patch({ notif: null }),
    openNotif: () =>
      patch({ notif: null, tab: 'cam', capture: 'before', sheet: null, returnToClock: true }),

    incMaterial: (id: string) =>
      patch((prev) => ({
        materials: prev.materials.map((m) => (m.id === id ? { ...m, qty: m.qty + 1 } : m)),
        sent: false,
      })),
    decMaterial: (id: string) =>
      patch((prev) => ({
        materials: prev.materials.map((m) => (m.id === id ? { ...m, qty: Math.max(0, m.qty - 1) } : m)),
        sent: false,
      })),
    addNote: (body: string) => {
      const st = stateRef.current;
      const meta = `${clockLabel()} · ${st.activeCode ? `${active?.n} ${active?.name}` : 'No code'}`;
      patch((prev) => ({ notes: [...prev.notes, { id: rid(), meta, body }], sent: false }));
      say('Note added to the day log');
    },
    sendDay,

    toggleCrew: (id: string) =>
      patch((prev) => ({
        crew: prev.crew.map((m) =>
          m.id === id ? { ...m, on: !m.on, code: m.on ? null : '210', secs: m.on ? 0 : 60 } : m,
        ),
      })),
    clockInWholeCrew: () => {
      patch((prev) => ({
        crew: prev.crew.map((m) => (m.on ? m : { ...m, on: true, code: '210', secs: 60 })),
      }));
      say('Whole crew on 210 tear-off');
    },

    say,
    photoCountLabel: pad2(s.photos.length),

    // dev-only affordances, mirroring the prototype's "jump to a state" strip
    dev: {
      setRole: (role: Role) => patch({ role, tab: 'job', sheet: null }),
      fireNudge: () => {
        const st = stateRef.current;
        if (!st.clockedIn) return;
        patch({ nudged: false });
        setTimeout(() => fireNudge(5), 250);
      },
    },
  };

  return value;
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const value = useShiftValue();
  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift(): Shift {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used inside <ShiftProvider>');
  return ctx;
}
