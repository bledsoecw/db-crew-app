# DB Time Clock

Crew-member clock-in app for **Deitemeyer Brothers Roofing & Construction**, built
from the Claude Design handoff in `../project/Crew App.dc.html` and the design
conversation in `../chats/chat1.md`.

One job a day, many JobTread cost codes against it. The **code** — not the job —
is the thing a crew member switches all day, so the code is the loudest control
on the screen. Photos are asked for at the moments they are actually owed, and
only block when the answer is unambiguous.

Expo (React Native) + TypeScript. iOS and Android from one codebase.

---

## Run it

```bash
cd app
npm install
npx expo start          # then scan the QR with Expo Go, or press i / a
```

The camera, local notifications and the file store all need a real device or
simulator. `npx expo start --web` renders every screen except the live camera
preview, which is useful for design review.

```bash
npx tsc --noEmit        # typecheck
npx expo export --platform ios    # verify it bundles
```

---

## How the app behaves

**Clock in.** One green 132px button. It opens the code list — you cannot clock
in without saying what you are doing.

**Before photo.** The moment a code starts, the BEFORE sheet comes up. It is
skippable ("Start without a photo") and one photo clears it. An amber strip on
the clock screen carries the requirement until it is satisfied.

**The 5-minute escalation.** If a code has been running five minutes with no
before photo, a local notification fires — *"230 dry-in started 5 minutes ago.
Randy has been copied."* — and the photo screen reopens on top of whatever you
were doing. Once per code. Tapping the notification opens straight into the
camera, locked to BEFORE.

**Switching codes.** SWITCH CODE asks one question: *is this code finished?*
**NO** switches straight through, nothing owed. **YES** sends you to the camera
locked to AFTER with an amber bar reading `AFTER PHOTO OF 210 TEAR-OFF REQUIRED
TO START 240` — the switch commits itself the moment you shoot, and the
requirement follows you across tabs.

**Clock out** will not commit without an after photo of the code you are on. The
confirm button stays visible but dimmed and inert, with a green "Take the after
photo" CTA above it, so the reason is obvious rather than mysterious.

**After any prompted capture you land back on the running clock.** Tapping
CAPTURE yourself keeps you in the camera.

**Sun mode is the default**, not the exception — near-black ground with white
type is the highest-contrast, lowest-glare combination on a phone at noon on a
roof. The toggle is top-right, one tap.

**Offline** shows a warning strip and keeps working. Everything is queued and
drained in order when signal returns.

**Foreman** is the same app with a crew block added — no separate build. Role
comes from the session.

### The gloved-thumb budget

| Control | Height |
| --- | --- |
| Clock in | 132 px |
| Shutter | 104 px |
| YES / NO on the finished prompt | 100 px |
| Confirm clock out, before-photo CTA | 88 px |
| Code row | 82 px |
| Tabs, primary buttons | 76 px |
| Qty steppers | 52 px |
| *(iOS minimum)* | *44 px* |

---

## Where things live

```
App.tsx                      shell: fonts, theme, tab switching, overlays
src/config.ts                every policy knob — start here
src/theme/                   design-system tokens, sun/day schemes, type helpers
src/state/shiftStore.tsx     the whole shift: clock, gates, escalation
src/state/persistence.ts     what survives a restart
src/screens/                 Clock, Capture, Day Log
src/components/              header, tabs, sheets, toast, notification banner
src/jobtread/                the JobTread client — see below
src/sync/queue.ts            offline mutation queue
src/notifications/nudge.ts   the 5-minute escalation
src/icons/                   line icons, geometry copied from the design
```

Elapsed time is always recomputed from `startedAt`, never counted up. If the
phone is killed in a pocket for an hour, the clock is still right when it comes
back.

---

## JobTread

Screens never import a concrete client. They talk to the `JobTreadClient`
interface in `src/jobtread/types.ts`:

| Call | When it fires |
| --- | --- |
| `getToday()` | on launch — job, cost codes, schedule, crew, hours already banked |
| `postTimeEntry()` | on switch-code and on clock-out, one closed block per code |
| `uploadPhoto()` | on every capture; these feed the DB Cam photo report |
| `submitDay()` | "Send day to office" — materials and notes |

Today `src/jobtread/index.ts` points at `mockClient`. To go live:

1. Fill in the query bodies and credentials in `src/jobtread/paveClient.ts`.
   The transport is real; the query shapes are marked `TODO` because they depend
   on your account's schema and custom fields.
2. Change one line in `src/jobtread/index.ts` to export `createPaveClient(...)`.

Broker the calls through your own backend if you can, so the grant key never
ships inside the app bundle.

---

## Still needs your call

Each of these is one constant in `src/config.ts`. The shipped default is listed
first.

| Question | Shipped as | Constant |
| --- | --- | --- |
| The real JobTread cost-code list | 9 plausible placeholders | `CODES` in `src/jobtread/mockClient.ts` |
| Who else gets the 5-minute notification | foreman only, named "Randy" | `ESCALATION_CONTACT` |
| Does that notification repeat? | fires once, strip stays | `BEFORE_PHOTO_RENOTIFY_SECONDS` |
| Can a foreman override a missing after photo? | no, the block is absolute | `FOREMAN_CAN_OVERRIDE_PHOTO_GATE` |

Two smaller things I decided rather than guess at, both easy to change:

- **Notes are typed, not voice.** The prototype showed a voice-note placeholder.
  Recording, storage and transcription are a real chunk of work, so the day log
  takes a typed note for now.
- **Crew rows in foreman view are local only.** Toggling a crew member on or off
  does not post anything yet — that needs a JobTread call that can clock in
  another user, which isn't in the interface above.

The dev-only state jumper (bottom right, `__DEV__` builds only) exists so the
foreman view and the 5-minute escalation can be demoed without waiting.
