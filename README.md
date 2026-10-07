# DB Crew

The crew's one app for **Deitemeyer Brothers Roofing & Construction**: the time
clock, My jobs, the site checks, the day log — and, since T2.0 (Oct 2026),
**Close Out**, the final inspection and punch repairs that used to be a second
app (DB CheckOut). Built from the Claude Design handoff in
`project/Crew App.dc.html` and the design conversation in `chats/chat1.md`.
It was **DB Time Clock** until T2.0; the Firebase project, the Apps Script and
the folder names still say so, and nothing depends on them changing.

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

### Who can open it, and what each person gets (roles, T2.0 · hub levels T2.2 · one store T2.3)

The role decides the tabs. The API decides the role (`roleFor_` in
`Code.gs`), the phone only draws it:

| Role | Tabs | Who |
|---|---|---|
| Crew | Clock · My jobs | everyone, the default |
| Site manager | Clock · My jobs · Day log | anyone whose JobTread role is Site Manager (Tyler, Kenton, Chris Blue) |
| Service | Clock · Close Out | Alberto and Yahir (seeded by membership id), and `carl.bledsoe@deitemeyerbrothers.com` to test their view |
| Operations | all of those, plus **People** | `operations@deitemeyerbrothers.com` — `OPS_EMAILS` in `Code.gs`, nowhere else |

**The store is DB Hub** (T2.3). A person's level is the DB Crew column of
the hub's App access panel, published on the feed this app already reads at
the door. Six levels there, mapped one to one:

| Hub level | People tab choice | What the app does |
|---|---|---|
| (blank) | — | the app's own defaults (the fallback below, then the seeds and JobTread's role) |
| Crew | Crew | role crew |
| Site Manager | Site manager | role siteManager |
| Service | Service | role service |
| Manager | Manager | role crew plus the crew block (the foreman view) |
| Off | Off | the app is blocked before any role matters |

Editing either screen updates that one record: the hub's panel writes its
sheet directly; the People tab posts the choice to the hub (`setRole` →
the hub's `doPost` on its feed deployment, gated by the feed key), the hub
writes its sheet the way its panel does, and the app refreshes its feed copy
so the change shows at once. A change made in the hub reaches the app on the
next feed refresh (five minutes). If the hub refuses or cannot be reached,
`setRole` throws, names the hub, and changes nothing.

Where the answer comes from, first one wins:

1. **The code** — Operations is `OPS_EMAILS`, nowhere else; never on the
   feed, never settable from either screen.
2. **DB Hub** — the level above, when the feed copy has a row for the person
   and it names one. A feed that is missing or stale has no opinion: it never
   changes a role and never locks anyone out.
3. **People** (`ROLES_JSON`) — the fallback `setRole` still writes beside
   every hub write, for a person the hub has no row for (the hub stores a
   level for anyone, but publishes only its Employees roster) or for the
   minutes a feed copy is missing.
4. **The defaults** — the seeds, then JobTread's own Site Manager role.

**People** is where Operations sets levels from the phone: five chips per
person, saved to DB Hub at once, and the API refuses anyone but Operations
(`getPeople`, `setRole`). The card says where the answer in force came from
(the hub, a fallback set here, or the defaults). Nothing on that screen, and
nothing in the hub, can make anyone Operations. The same screen carries
**View the app as**, which lets the Operations account borrow another role's
view — the navy bar names the borrowed view and the way back, and it is
remembered on that phone.

**Sign out** (T2.1) is the last button on the Diagnostics screen (tap the
build line at the foot of the clock). Two taps — the first arms it and says
what happens — and the phone forgets everything it held for that person
(every `dbtc_*` key and the three IndexedDB stores) and lands on the sign-in
screen with Google's account picker rather than the account that just left.
It is refused, with the reason, while a photo, a site-check save, a day log
or a close-out item is still waiting to send: those queues belong to the
person signed in and would go with them. Hours already on the clock live in
JobTread and are untouched. `dev/signout-test.mjs` walks it.

**The service crew's day** (T2.4, Carl 6 Oct 2026). A Service phone opens on
Close Out, not the clock — that tab is their work, and the clock follows it.
**Start** (or Continue) on a queue card puts the clock on that job as well as
opening it: off the clock, the job's labor code is picked (the only one on
the job, or the only one that reads like inspection, service or punch work;
otherwise the same code sheet the Clock tab asks with) and the start photo
opens the entry; on the clock elsewhere, it is the Clock tab's move — end
photo there, code and start photo here. The camera hands back to that job's
Close Out screen, never to the clock, and a refused clock-in (a read-only
build, no labor code on the job, no signal) leaves the inspection open all
the same: the checks never wait on the clock. After **Finish & send**, while
the clock is still running, one row on the send and receipt screens offers
the Stop sheet's choices — a break, another code or job, out for the day.
`dev/closeout-test.mjs` walks it.

**Fast to the finger** (T2.5, Carl 6 Oct 2026: *"the app is laggy — people
tap around while it loads and confuse it; it should react almost instantly,
and if there is a pause the screen should grey out so they know it is working
and can't tap anything else until it resolves or errors out"*). Three things
changed. **The wait curtain**: `busy(true, 'Clocking in…')` greys the whole
screen the instant a tap starts work the phone has to wait on, counts the
seconds after two, blocks every other tap, and comes down in the same
then/catch that ends the work — a clock-in, out or switch, a break, a Close
Out Start fetching its codes, a move fetching the next job's. **The code
list lives on the phone**: the last answer per job is kept for the shift
(`dbtc_codes`, 12 hours, two dozen jobs), so a Start or a pick gets its codes
at once and the API's answer lands behind it; Close Out prefetches the codes
of the inspections that are yours as the queue loads, and the job's when it
opens. **The search draws at once**: every keystroke shows what the phone
already knows (recent jobs, the schedule, Close Out's queue, earlier answers)
with a "Searching JobTread…" line until the API's answer is merged in; a late
answer for an older term is dropped, and Enter picks the one row showing.
The box itself stays put (T2.6): pinned to the top of the sheet while the
results scroll under it, and the sheet holds one height while it is open, so
typing never pushes the box off the screen.
Underneath, a read a finger is waiting on (`lane: 'now'`) goes out at once
instead of queueing behind a cold open's extras — that queue was most of the
"Start, then nothing for twenty seconds". `dev/clock-test.mjs` and
`dev/closeout-test.mjs` walk it.

**The Close Out queue** (T2.7, Carl 7 Oct 2026). The card reads number first:
the JobTread number large, the street under it, then customer · city · type,
and the sales rep (no PM) where the number used to sit. A search box under
**Asignados / Todos** filters the list as you type, the Clock's way (every
word, anywhere in the number, name, customer or address; Enter opens the one
job showing). And the Asignados / Todos chips answer through the row itself:
they were redrawn on every paint and lost their handlers whenever the list
below came out the same, so the toggle went dead after the first switch.
The number shows bare, no "JT #" (T2.8).

**Signing in that holds** (T2.8, Carl 7 Oct 2026: *"Yahir kept getting logged
out; logging in is sketchy — Google sends you to the Gmail app, you come back
and the app sits on the sign-in button; tapping it again makes it worse; then
the read-only bar takes a while to go; close the app and it wants you to log in
again"*). What was behind each, and what changed:

- *Logged out on the next open.* The Google token lasts an hour; the app trades
  it for a 30-day session (`exchangeSession`). That trade was one try with the
  failure swallowed, so a weak signal at sign-in left the phone on the
  hour-long token. Now the app opens on the Google token at once, the trade
  runs beside it and is retried (every two minutes while open, and on every
  return to the app) until it lands, and a session over a week old is renewed
  in the background — a phone that is used stays signed in. Diagnostics has a
  `session` line saying which token the phone holds and how long it has left.
- *Tapping the button again made it worse.* Two answers from Google started
  the app twice over. Now one sign-in runs at a time: "Signing you in…" shows
  the moment Google answers, a second or late answer is dropped, and tapping
  the button again is safe (the gate says so).
- *Sitting on the button after the Gmail app.* The button asks Google through
  FedCM where the phone supports it (Android Chrome: a native sheet, no
  popup), a return to the app asks Google again, and the app no longer reloads
  itself for a new build while the sign-in screen is up — that reload threw
  away a sign-in half done.
- *Couldn't get past the login at all.* A personal Gmail picked by mistake was
  refused as "Session expired", and One Tap quietly picked it again: a loop.
  Now the gate names the account Google used and the next sign-in asks which
  account. On the API, a hiccup in Google's own token check (a 5xx) is retried
  and reported as that, never as a bad token — it used to sign the phone out.
  Google's script not loading (no signal) is fetched again, and said.
- *The read-only bar.* It showed until the first answer. The app now remembers
  who the phone was (name, role, writes on or off) and draws that at once; the
  bar only shows when the API has said writes are off.

`dev/signin-test.mjs` walks it with a fake Google. **The API change needs a
redeploy** (`apps-script/README.md`); the phone's half works without it.

A role grants nothing in JobTread. Who may tick a site checklist is still
JobTread's Site Manager role, enforced by the board on every save; who gets a
final inspection is still the board's roster (the board answers `inspector`
on the assignments call, and Close Out says so beside a Service person the
board would never send one).

Two gates in front of all of that, in order. A Google account on `@deitemeyerbrothers.com` — or on the
short explicit allow-list beside it (`SITE_MANAGER_EMAILS` in `Code.gs`, plus
the optional `EXTRA_ALLOWED_EMAILS` Script Property; two of the three site
managers sign in with Gmail addresses, which are also their JobTread user
emails) — gets you to the sign-in; a JobTread membership on the org gets you
in. Never "any Google account". Past
that, DB Hub's **App access** panel has the final say if `ACCESS_FEED_URL` is
set: `Off` or a status of left/inactive/terminated closes the app with a plain
message, `Manager` is crew plus the foreman's crew block, and a blank row means
the fallbacks and the JobTread role decide as before.

The hub can only ever *change* the answer, never break it. No feed configured,
a feed that 500s, a feed that times out — all read as "no opinion", and the
clock works exactly as it does today. Locking out a crew that is standing on a
roof is worse than letting one extra person in.

---

## How the app behaves

**My jobs.** The second tab is the Production Board's answer to "where am I
today": the Install visits assigned to your crew, resolved from your Google
Workspace account through the JobTread membership id both systems already share.
The header is the crew, today's date, and when the board last answered (tap it
to ask again). Today's card is green — "You're here · day 2 of 3", the street,
customer · city · type, whether the material is on site, not there yet, or
pulled from the shop, the office's note on that visit — and its bottom row is
Directions (one tap to the phone's maps app) beside what the card is for:
"Log not sent · Tap to do it" until today's log has gone, then "Log sent ·
4:52p". Under "Next up", the other cards say "Go here instead" — the end photo
first while on the clock — and a card further out than tomorrow shrinks to a
line. The foot says when the list came from the board.

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
Every save from the phone lands in JobTread as the checklist on that "Roof
install" line — each tick a checked item, the magnet name and the sign-off on
their lines — so the office sees it on the schedule task itself, and the
task's progress moves with it.

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
job"). One story box — a real text box, Talk or Type — and then JobTread's own
questions: the org's daily-log fields, with each list's own options. "Any
delays?" (yes opens Weather · Short Labor · Short Material · Other) and "Anyone
hurt or a close call?" (yes is amber and opens the safety alert, below) come
first, under the story; then the rest in the office's order, today "Any
material pickups or deliveries?" and "Who else was on site?" (Carpentry …
Roofing … Site Manager). The definitions come
from JobTread with the rest of the start-up data and are kept on the phone, so
a field the office adds or renames shows up by itself; the office's free-text
fields (Unplanned Tasks, Internal Notes) are its own and stay blank. One draft
per job per day, kept on the phone and touched by anything that happens on
that roof, so a day with two roofs has two drafts and the tab shows one chip
per roof. "Tell the PM now" sends what is in the box to the PM this minute as
a comment on the job and keeps it in the log as a timestamped line. A normal
day is one tap: "Normal day · nothing to report" answers No to every yes/no
field, no incident, and sends. EN / ES flips the tab's own words, the
questions and the options to the eye; the story posts as spoken and every
answer posts as JobTread spells it.

**Review & send** shows the hours, the photos, every answer under JobTread's
own name for the field, and the story, names who it goes to, and writes one
JobTread daily log on the job, assigned to the job's Project Manager and Sales
Reps with notify on, with the day's photos attached by reference. The story
and the lines are the log's Notes; the answers land on the org's own fields by
id, exactly as picked, and the incident on Safety Incidents, found by name; the
Notes repeat every answer in words, so the notification reads whole. A delay or
an incident also posts a one-line comment assigned to the
same people, so the activity feed only lights up when something needs a
decision. It is sent once — JobTread has no update for daily logs — and a
forgotten line goes on the same log with the time. A dead spot or a JobTread
hiccup keeps the draft and retries (the badge says Queued, and why); the log
also waits for its photos to finish uploading. The moments that ask for it:
clocking out for the day, finishing the "before the site manager leaves"
phase, signing off, and moving to another roof. The morning banner nags for
yesterday's log the way it nags for a missing sign-off.

**Safety alert.** Yes to "anyone hurt or a close call" opens an amber card —
what happened, the words, Hurt or Nobody hurt, a mic and a camera — and "Send
alert now" goes the second it is tapped, apart from the log: a comment on the
job assigned to the PM and a text to everyone in `SAFETY_ALERT_TO`. The log
waits until the alert has gone, then carries it in its Safety field.

**Where am I tomorrow.** My jobs is today's card, then Next up in date order,
with a fourteen-day strip on top, a dot per booked visit, tap to jump.
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
in without saying what you are doing — and the code opens the camera, locked
to the START photo. The shutter is what clocks you in: the entry opens with
the photo's id and the photo lands on the job stamped `#START #TE:<entry>`.
There is no "start without a photo". Back returns to the code list with
nothing created.

**On the clock** the band says when you started, that it was with a start
photo, and how many photos this code has. Two buttons: **Take a photo** (the
camera, unlocked, During, tagged to the running code, back to the clock after
the shot — this is what the Capture tab became) and **Stop the clock**, which
opens Break · Switch code or job · Clock out for the day.

**Break** closes the block with no photo; the band pauses and says when the
break began. **Back to work** re-opens the same code, no start photo. JobTread
has no break entity, so a closed entry and a new one is the honest write.

**Switching codes or jobs** is the END photo first — the camera locked to END,
"you switch when you shoot" — then the code list (or the next job's), then
the START photo of the new code. One call closes the old block and opens the
new one, carrying both photo ids, so a dropped connection cannot leave anyone
clocked out mid-switch. Backing out at the code list leaves the clock running.

**Clock out for the day** is the END photo, then the commit, then the Day log
with "Today's log · not sent / Send it before you go?" at the top if today's
log has not gone.

**The API refuses** a clock-in, clock-out or switch that carries no photo id,
so the gate cannot be skipped by asking it directly. A break is the one
photo-less write, by design.

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
| Send today's log, Review & send | 88 px |
| Stop-sheet rows | 82 px |
| YES / NO on the Day log | 72 px |
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
and the start photo is the clock-in either way.

Two design points worth knowing:

**The server never trusts the client about whether a photo exists.** Every
capture is stamped `#START #TE:<timeEntryId> 04MA Masonry Labor` in its
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
reload), `dev/loaded-test.mjs` drives the material-loaded button (the save,
the material line re-asked from the board afterwards, the "are you sure"
before an undo, the 403 and a 502), `dev/daylog-test.mjs` drives the week strip, today's job from the
schedule, a move between roofs and the day log (the draft, the notes, a photo
by reference, the send and what it carries, yesterday's log, a dead spot, a
JobTread hiccup, a boot the API is too slow to answer, a send that was in
flight when the page reloaded, a send going out while a slow extras call is
still in its own lane, and the status wording while a send is out or waiting
to go again), and `apps-script/code-test.mjs` covers `getMyJobs`,
`saveSiteChecks`, `sendDailyLog` (including the same day sent twice), the
one-round-trip boot and extras, `paveAll_`, the timing every reply carries
and the schedule sweep against a stubbed Apps Script runtime (150
assertions) — every state the Production Board and JobTread can leave them
in, without either to point at.

**Why calls are slow, and what the app does about it.** A JobTread round
trip from Apps Script costs seconds, not the tens of milliseconds a laptop
sees, and the phone's ceiling on a call is fixed. So the API asks its
independent questions together (`paveAll_` on `UrlFetchApp.fetchAll`: boot
is one round trip, extras one or two), every reply carries where its time
went (`ms`: sign-in check, membership lookup, the work, JobTread inside it),
and `getStart` hands back the API's last thirty calls — the only record of a
call the phone gave up on. The phone runs three lanes (boot and writes; the
code list and other reads; the board), so a slow read can never hold a save
or a send behind it, gives the daily-log send sixty seconds and a photo
riding through the API ninety, and shows all of it on the Diagnostics screen:
its own clock and the API's on every call, and the API's memory of the
rest.

**JobTread's own log fields ride along.** The office's custom fields on
daily logs (Trades Onsite, Anticipated Delays, Delay Reason, Safety
Incidents and the rest) are pulled from JobTread with their options, drawn
on the day-log form by type (yes/no, a pick list of one or several, a text
box), kept on the phone, and sent on the log as JobTread's own fields, so
what the office sees is one record. A field added or renamed in JobTread
shows up on the phones by itself. A filled field whose name matches
`safety|incident|delay` (or the `DAILY_LOG_PING_FIELDS` Script Property)
also pings the PM and sales in the activity feed, the way problems do.
