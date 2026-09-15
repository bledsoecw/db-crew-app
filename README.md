# DB Time Clock

Crew clock-in for **Deitemeyer Brothers Roofing & Construction**, built from the
Claude Design handoff in `project/Crew App.dc.html` and the design conversation
in `chats/chat1.md`.

An installable PWA on Firebase Hosting talking to a Google Apps Script API that
holds the JobTread grant key — the same architecture as **DB Cam Mobile**, which
this app deliberately mirrors so there is one pattern to maintain, not two.

```
dbtimeclock-pwa/     the app: public/ deploys, dev/ is a local preview harness
apps-script/         the API: Code.gs, pushed with clasp or pasted by hand
JOBTREAD-NOTES.md    what the live JobTread org actually looks like
CREW-ASSIGNMENTS-API.md  the contract with the Production Board
project/, chats/     the original design handoff
```

Start with **`dbtimeclock-pwa/SETUP.md`**. Push notification setup is §4b.

---

## It plugs into a time clock that already exists

The crew clocks in through JobTread today. The org has 5,831 time entries and
had 18 people on the clock when this was written. This app is not a new system —
it is a better face on the existing one, and it writes exactly the records
JobTread already keeps:

- **Clocked in** is an open time entry, `endedAt: null`. JobTread counts the
  minutes itself.
- **A code** is a **Labor cost item on the job**, carrying a CSI-style cost code
  (`04MA Masonry Labor`, `02ST-1 Site Prep Labor`). Not the `210 / 240` numbers
  in the prototype — those were placeholders.
- **Photos** land in the same `DB Cam` folder on the job, so one photo report
  covers the job no matter which app shot it.

`JOBTREAD-NOTES.md` has the verified schema, including the two filters that get
a job's 220 cost items down to the ten a crew member actually picks from.

### Writes are off until you turn them on

`WRITE_ENABLED` is a Script Property that defaults to **false**. Every read
works; every write throws a clear error instead of touching payroll. The app
shows a navy "READ-ONLY BUILD" bar while it's off, so a test build can't be
mistaken for the real thing. `WRITE_JOB_ALLOWLIST` narrows writes to specific
jobs for a contained first test. See SETUP.md for the go-live sequence.

### Who can open it, and who sees the crew block

Two gates, in order. A Google account on `@deitemeyerbrothers.com` — or on the
short explicit allow-list beside it (`SITE_MANAGER_EMAILS` in `Code.gs`, plus
the optional `EXTRA_ALLOWED_EMAILS` Script Property; two of the three site
managers sign in with Gmail addresses, which are also their JobTread user
emails) — gets you to the sign-in; a JobTread membership on the org gets you
in. Never "any Google account". Past
that, DB Hub's **App access** panel has the final say if `ACCESS_FEED_URL` is
set: `Off` or a status of left/inactive/terminated closes the app with a plain
message, `Manager` also unlocks the foreman's crew block, and a blank row means
the JobTread role decides as before.

The hub can only ever *change* the answer, never break it. No feed configured,
a feed that 500s, a feed that times out — all read as "no opinion", and the
clock works exactly as it does today. Locking out a crew that is standing on a
roof is worse than letting one extra person in.

---

## How the app behaves

**My jobs.** The second tab is the Production Board's answer to "where am I
today": the Install visits assigned to your crew, resolved from your Google
Workspace account through the JobTread membership id both systems already share.
Each card carries the street address as one tap to the phone's maps app, whether
the material is ordered or you are pulling from the shop, the office's note on
that visit, and *day 2 of 3* on a multi-day stay. Tapping one makes it today's
job — which also opens the right Labor code list with no picking.

The board is a second system, so it is treated as one. If it is unreachable, not
connected yet, or your account isn't linked to a crew, the tab says which of
those it is and falls back to the jobs you have recently clocked into. **The
clock is payroll and never waits on the board.**

**Site checks.** The site manager's checklist, replacing the paper "Roofing
Checklist" in the packet that was meant to be filled in and signed on every
roof and never was. The board owns it — the 28 lines in three phases, where it
lives in JobTread (a checklist on the job's roofing install task), the sign-off
and the write — and this app draws it from what the board sends
(`checklist.phases`, `checklist.lines`) and posts ticks back through the board.
Nothing about the list is hardcoded here, so the board can reword a line
without an app release, and this app never talks to JobTread for any of it.

Each roofing job's card carries the board's own sentence about where the list
stands ("Before tear-off — 6 of 11 done", "Signed off — Tyler · Sep 15"),
coloured neutral / amber / green, and a full-width **Site checks** button. A
job with no list says "No checklist on this job yet". The checklist screen is
three stacked phases with their "when" hint and a *done of total* count; the
first phase with anything unticked opens, the rest are one tap away. Rows are
64px with a box that fills green. The magnet line has a "who ran it?" field
with a one-tap chip for your first name (never prefilled — the paper's "Who"
is a real question). At the bottom, **Sign off as Tyler** confirms with what is
still unticked; the name and date on the signature are the board's, stamped
from the signed-in identity — the app never sends them. Once signed, ticks
stay editable and a small **Unsign** takes the signature off.

Ticks are local-first: a tap flips at once, the whole state is saved once per
burst (1.5s after the last tap, and on leaving the screen — each save writes
JobTread and posts one job comment), and it is kept in localStorage until the
board has taken it, so a dead spot in a driveway loses nothing. The screen says
"Saved", "Saving…" or "Not saved — will retry". Who may tick is JobTread's
call, not this app's: the membership must carry the **Site Manager** role
there. The app has no role table — it tries the save and honours the board's
403 by making the list read-only, with one plain line at the top: "The site
manager ticks these." Everyone else on the crew still sees the list, because
"Homeowner talked to — trailer spot, questions, color confirmed" is a fact the
whole crew wants.

On open, a roof that ended yesterday and was never signed off puts an amber
banner at the top of the clock screen and the day list — "Yesterday's roof at
Courtney isn't signed off" — and tapping it opens that checklist. That is the
sentence the owner has been writing in a daily log by hand.

**Day log.** The site manager's own record of the day, on the job, in place of
the owner's second-hand dictation ("Report via Tyler we were short eight pieces
of drip edge … Tyler left about 430 and so I don't know the condition of the
job"). One draft per job per day, kept on the phone and touched by anything
that happens on that roof — a clock-in, a photo, a tick, a note — so a day with
two roofs has two drafts, and the tab shows one chip per roof. The summary is
what the phone already knows: the hours by code, the site checks in the board's
words, the photos taken there. The three questions are what that dictation has
been reconstructing: what got done; the condition when you left, with chips for
crew still on site or gone, tarped or not, and the time; problems, extras and
returns. Notes during the day collect into the draft; one marked "office needs
this now" also goes straight to the PM as an assigned comment on the job.

**Send today's log** writes one JobTread daily log on the job, assigned to the
job's Project Manager and Sales Reps with notify on, with the day's photos
attached by reference — they stay in DB Cam and the PM opens one thing. A
problem, or a crew left on site without a sign-off, also posts a one-line
comment assigned to the same people, so the activity feed only lights up when
something needs a decision. It is sent once — JobTread has no update for daily
logs — and anything after that is added as a note on the log. A dead spot or a
JobTread hiccup keeps the draft and retries; the log also waits for its photos
to finish uploading. The moments that ask for it: finishing the "before the
site manager leaves" phase, signing off, and moving to another roof. The
morning banner nags for yesterday's log the way it nags for a missing sign-off.

**Where am I tomorrow.** My jobs is grouped by day under Today, Tomorrow, Thu
9/17, with a fourteen-day strip on top, a dot per booked visit, tap to jump.
Each roofing card says which crew you are with ("with Platinum"), read from the
task the site checks sit on. A roof that has not started shows only its Site
checks button, not "not started". When nothing is on the clock, the day's one
booked roof becomes today's job on its own; two roofs put a chooser on the
clock screen, once. On the clock, "Change job" becomes **Move to another job**:
the entry here closes and one opens at the next roof in a single call, after
the same finished-question as any code switch, and the roof you left is owed
its log. With push on, an hourly sweep sends each phone one line the evening
before — "Tomorrow: 812 S Washington St · Lucas · with Platinum · Material
ordered" — and "Schedule changed" when the next few days move. See SETUP.md
§4b for `installSchedulePushTrigger`.

**Clock in.** One green 132px button. It opens the code list — you cannot clock
in without saying what you are doing.

**Before photo.** The moment a code starts, the BEFORE sheet comes up. It is
skippable ("Start without a photo") and one photo clears it. An amber strip on
the clock screen carries the requirement until it's satisfied.

**The 5-minute escalation.** Five minutes on a code with no before photo and a
notification fires — *"04MA Masonry Labor started 5 minutes ago. The office has
been copied."* — and the photo screen reopens on top of whatever you were doing.
Once per code.

**Switching codes** asks one question: *is this code finished?* **NO** switches
straight through, nothing owed. **YES** sends you to the camera locked to AFTER
with an amber bar naming both codes — the switch commits itself the moment you
shoot, and the requirement follows you across tabs.

**Clock out** will not commit without an after photo of the code you're on. The
confirm button stays visible but dimmed and inert, with a green "Take the after
photo" CTA above it.

**After any prompted capture you land back on the running clock.** Tapping
CAPTURE yourself keeps you in the camera.

**Sun mode is the default**, not the exception. Near-black ground with white
type is the highest-contrast, lowest-glare combination on a phone at noon on a
roof. Toggle is top-right, one tap.

**Offline** shows a warning strip and keeps working — captures queue in
IndexedDB and drain when signal returns. The clock itself is server-side, so a
dropped connection can't lose time.

**Foreman** is the same app with a crew block added, driven by the JobTread role
on your membership. No separate build.

**Boot draws the clock before it has everything.** The first call asks only what
the screen can't be drawn without — am I on the clock, on what job, what have I
logged today — and that's three Pave queries at most. The code list, the recent-
jobs picker and the crew block are all behind a tap, so they arrive a few
seconds later in a second call that nothing waits on. Tap faster than it
answers and the sheet says it's still loading, then fills itself in.

This isn't a nicety. Every one of those Pave queries is a sequential round trip
inside a single Apps Script execution, and finding a job's ten budget lines
means paging through its 294 Labor cost items three times. Asking for all of it
at once put boot over the 25-second ceiling and failed it outright. The code
list is cached for 15 minutes and the recent-jobs list for 5, so the second call
is usually nearly free.

### The gloved-thumb budget

| Control | Height |
| --- | --- |
| Clock in | 132 px |
| Shutter | 104 px |
| YES / NO on the finished prompt | 100 px |
| Confirm clock out, before-photo CTA | 88 px |
| Code row | 82 px |
| Tabs, primary buttons | 76 px |
| *(iOS minimum)* | *44 px* |

---

## How the push nudge works

```
every 5 min   Apps Script trigger -> sweepBeforePhotoNudges()
              ├── Pave: open time entries (endedAt null)
              ├── Pave: files whose description contains "#TE:<id>"
              └── entry older than the grace period, no matching photo,
                  not already nudged  ->  FCM HTTP v1  ->  the crew member's phone
```

**Android is reliable. iPhone works on iOS 16.4+ but only when the app is
installed to the Home Screen** — a Safari tab gets nothing. That makes the
install step load-bearing rather than optional. The app detects the case and
says "Add to Home Screen to get photo reminders" instead of failing silently,
and the amber strip on the clock screen carries the requirement either way.

Two design points worth knowing:

**The server never trusts the client about whether a photo exists.** Every
capture is stamped `#BEFORE #TE:<timeEntryId> 04MA Masonry Labor` in its
JobTread description. The sweep greps for that, so a phone that lied, crashed
or never came back online can't suppress the nudge. `fileDescription()` in
`index.html` and `entryIdsWithBeforePhoto_()` in `Code.gs` are the two halves —
keep them in step.

**It costs two Pave calls per sweep no matter how big the crew is.** One for
open entries, one for tagged photos, matched in memory. At a 5-minute cadence
that sits well inside Apps Script's quota.

One push per time entry, ever — a crew member who ignores it isn't pestered
every five minutes, and the marker is deleted when the entry closes so Script
Properties don't grow. If you'd rather it repeat, delete the marker check in
`sweepBeforePhotoNudges`. When the in-app prompt fires first, the app calls
`markNudged` so the sweep doesn't send a duplicate to someone already looking
at it.

---

## Still needs your call

| Question | Shipped as | Where |
| --- | --- | --- |
| Who the 5-minute notification names | "the office" | `ESCALATION_CONTACT` in `index.html` |
| How long the grace period is | 5 minutes | `BEFORE_GRACE_SEC` in `index.html` **and** `PUSH_GRACE_MINUTES` in `Code.gs` — keep them equal |
| Should the push repeat if ignored | no, once per entry | the marker check in `sweepBeforePhotoNudges` |
| When a progress photo is asked for | 45 minutes in | `DURING_AFTER_SEC` |
| Can a foreman override a missing after photo | no, the block is absolute | not implemented — say the word |
| Which job is "today's job" | the Production Board's Install tasks, with the old picker as the fallback | `getMyJobs` in `Code.gs` |

That last one used to read *"if crews are scheduled somewhere I haven't found,
point me at it and 'today's job' can resolve itself with no picking at all."*
They are: the **Production Board**. Since its spreadsheet migration on
2026-08-10 it writes real Install tasks with real dates and the crew lead's
membership as the assignee — the same JobTread `membership.id` this app already
resolves from a Google sign-in. The nulls in the original sample were
pre-migration tasks. See `CREW-ASSIGNMENTS-API.md` for the contract and
`JOBTREAD-NOTES.md` for the corrected schema note.

### Three the Crew App opened, and where each is actually blocked

These came with the assigned-jobs work. Two of them are not policy questions —
they are code, in *this* repo, and the board returning the right answer will not
help until they are changed:

| Question | Where it is blocked |
| --- | --- |
| **Jeff and Chris McGlone have no JobTread user at all.** They can sign in with Google, but nothing resolves to a crew until the office creates memberships. What should they see meanwhile? | `memberFor_` **throws** `"No JobTread user is linked to…"`, and `getBoot` calls it first — so today they don't reach a "no crew yet" screen, they hit a hard error on launch. Whatever they should see has to be handled in `memberFor_` / `getBootFor_`. *(Note: until 2026-09-14 that same message appeared for **everyone**, from a different cause — the membership query asked for a field JobTread doesn't have. That bug is fixed. What remains here is the genuine no-membership case.)* |
| **Subs.** Marcos, Jeremiah and Samuel have memberships and would resolve; the company-level ones don't. Proposed rule: *the job list serves anyone who resolves, the clock stays employees-only*, because clocking in is payroll and subs never had a clock. | `verifyIdToken_` rejects any address that is not `@deitemeyerbrothers.com` or on the explicit allow-list (`emailAllowed_` in `Code.gs`), and a sub's JobTread email is their own company's. The allow-list exists for the two site managers on Gmail, not for subs — widening it further is a security decision, not a UI one. |
| **Language.** This app is English only (`<html lang="en">`, zero Spanish strings). DB CheckOut is Spanish-first. Same crews. | Not blocked — but decide before the crew sees it, not after. The site checks arrive from the board in English; if this app goes bilingual, translate the 28 labels by `key` (not by matching English text) and fall back to the sent label for any key without one, so a new line still shows. |

Two smaller calls I made rather than guess:

- **Notes are typed, not voice.** The prototype showed a voice-note placeholder;
  recording, storage and transcription are real work. A typed note posts as a
  comment on the job.
- **The foreman crew block is read-only.** It shows who is on the clock right
  now, org-wide, from live open time entries. Clocking *another* person in would
  mean writing time entries under someone else's user id, which is a payroll
  decision, not a UI one.

---

## Design fidelity

The heading face is **Archivo**, per the crew app's design system. DB Cam Mobile
uses Oswald; if you'd rather the two field apps read as siblings on the home
screen, it's the `@font-face` block at the top of `index.html` plus swapping the
two `archivo-*.woff2` files.

**Fonts are self-hosted, not from Google's CDN.** DB Cam Mobile links the CDN;
this app serves the six weights it uses from `public/fonts/` (209KB total,
cached by the service worker). A field app that must open with no signal
shouldn't depend on a third-party font host, and the typography *is* the design
here. Same faces, no network.

Every screen was rendered and clicked through against `dev/mock.js` during the
build — clocked out, code picker, before prompt, the amber owed state, the
finished-code prompt, blocked clock-out, capture, day log, day mode, foreman
view, the escalation, the site checks — the card line, the list, a signature,
read-only, and the nudge — the week view, the two-roof morning and the day
log. `dev/push-test.mjs` covers the push-registration branches (14
assertions), `dev/checks-test.mjs` drives the site checks end to end in the
real page (one save per burst, the whole state every time, the sign-off, the
board's 403 going read-only, a dead spot, a 502, the unsaved state surviving a
reload), `dev/daylog-test.mjs` drives the week strip, today's job from the
schedule, a move between roofs and the day log (the draft, the notes, a photo
by reference, the send and what it carries, yesterday's log, a dead spot and a
JobTread hiccup), and `apps-script/code-test.mjs` covers `getMyJobs`,
`saveSiteChecks`, `sendDailyLog` and the schedule sweep against a stubbed Apps
Script runtime (131 assertions) — every state the Production Board and
JobTread can leave them in, without either to point at.
