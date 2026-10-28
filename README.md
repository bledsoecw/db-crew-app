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

**A finished punch list is the PM's, and the screen says so** (T2.8.2, Carl
13 Oct 2026, on 25-0001: the rep had inspected on site, so the board sent the
job straight to Punch List; Carl finished the three repairs, the job moved to
PM Review — *"but I never actually reviewed or sent it because the app is
waiting on me to finish all the other checklists"*). Moving to PM Review was
right: the server does it the moment the last punch to-do closes, and from
there the PM reviews and the sales rep's final check-off closes the job. What
was wrong was this screen. A PM Review job fell into the same branch as one
waiting to be inspected, so it drew Inspection, Cleanup, Problems and Visit
photos and a **Review & send** asking for all thirteen checks — on a job the
crew had finished, with an inspection nobody owed. Now a PM Review job opens on
**PM Review · waiting on the PM** and "Nothing left for the crew on this job",
with the repairs (all ticked) below, and the header names it PM Review; a
Punch List job's header reads Repairs. The checklists show only on a Final
Inspection job, or on a visit this phone already started — that one keeps its
send and the card says sending it moves nothing. Operations no longer sees the
checklists on a Punch List job either: an inspection sent there moves nothing,
and above the repairs it read as a step still owed. The mock's `coComplete`
now flips the job like the server does, and `dev/closeout-test.mjs` walks the
last repair into PM Review and Operations on each kind of job.

**The last repair says what it does, and says when it has** (T2.8.3, Carl 13
Oct 2026: *"is there any indication given to the user they are done in the
app, or asked to review before sending for PM review?"* — there was not; the
last repair landed with the same "Repair finished" toast as every other one).
When the repair open on screen is the job's LAST open one — every other punch
to-do on the job, anybody's, is done or already queued — its button reads
**Finish & send to PM** / **Terminar y mandar al PM**, with "This is the last
repair on the job. Finishing it sends the job to the PM for review" under it.
Only a Punch List job moves on, so only there. And once it lands, the repairs
list and the job screen open on **All repairs done · 6:38P · Sent to the PM
for review. Nothing left for the crew on this job.** That card is built from
the server's own answer (`flipped: "PM Review"` on the completion), never from
the phone's guess, so a repair still waiting to send, or a job the server did
not move, never claims to have gone. There is no second "send to PM" step on
purpose: the to-dos closing is the fact, and a step the crew can forget would
leave a finished job sitting at Punch List with nobody told.

**Photos from the phone's own gallery** (T2.9, Carl 13 Oct 2026 — Yahir
asked to send photos he took with the phone's own camera). Every photo button
in the app now has a **From my photos** / **De mis fotos** twin — the Clock
camera (Take a photo, the safety alert's photo), Close Out's problem reports,
visit photos, and a repair's before and after photos — **except the clock's
START and END photos**, which stay camera-only: that photo IS the punch, and
the API refuses a clock-in or out without one, so a picked photo would let
yesterday's picture clock someone in. The button is not drawn while the
camera is locked to a gate, and `captured()` refuses a gallery photo there
even if asked.

- **The time it was taken comes from the photo itself** (EXIF
  DateTimeOriginal, with the zone tag where the phone writes one), read
  BEFORE the app shrinks it — the canvas the shrink draws through throws that
  data away. `photoTakenAt` / `exifTakenAt` / `exifIso`, no library. A photo
  with no time in it (a screenshot, a copy saved out of WhatsApp) says **No
  time** / **Sin hora**; the file's own date is when it was downloaded, so it
  is never used as a guess. Location is not read at all: both phones strip it
  from a gallery pick often enough to be worthless.
- **It says so everywhere it shows.** A Close Out tile wears an amber PHONE
  badge and the day it was taken; a before/after tile says "Phone · Oct 12
  2:10p". In JobTread a Clock photo is named `20261012-141005-PHONE-DURING-YG.jpg`
  and described `#PHONE DURING #TE:… 04MA Masonry Labor · picked from the
  phone's photos, taken Oct 12, 2026 2:10p`. The tag is a bare word after
  `#PHONE` on purpose: the photo-nudge sweep looks for `#START` to know a
  clock-in has its photo, and a picked photo must never be what satisfies it.
  A Close Out photo goes to the CheckOut server with `source: "phone"` and
  `takenAt`, which names and describes the file the same way (that server's
  half, `bledsoecw/DB-CheckOut`, ships with this build; an older server
  ignores the two fields and the photo still lands).
- **An AFTER photo must postdate the repair** (Carl's rule). One taken before
  the repair was asked for cannot show the fix, and one with no date cannot
  show anything, so both are refused on the spot with the reason under the
  tiles, and the camera is always the way out. The repair's created time
  comes from the CheckOut server (`createdAt` on each punch task); against an
  older server only the no-date rule applies. A BEFORE photo, a problem photo
  and a visit photo take any picture, dated or not — they show a condition,
  not a fix.
- **Several at once** where a list of photos fits (a problem, the visit, the
  Clock camera), one where only one belongs (before, after). HEIC, which
  Chrome on Android cannot draw, is refused in words that say what to do.
- `dev/closeout-test.mjs` and `dev/clock-test.mjs` pick real JPEGs carrying
  EXIF through the phone's file chooser, check the badge, the payload, the
  refusals, the JobTread name and description, and that the gated camera has
  no gallery button.

**Each work area on its own** (T2.10, Carl 23 Oct 2026 — *"I want all of
this on the crew app. The checkout app is retired"*). A roofing job's roof,
gutters and siding are now inspected, repaired and approved one at a time,
each reviewed by its own PM on the Production Board (Dave the shingle roof,
Neal the gutters, the job's PM the rest), and **the board moves the job's
Status** — the area furthest behind decides, forward only, ending at *Sales
Rep > Cust Final Contact*. The CheckOut SERVER stays up behind this tab and
does the telling; its Expo app is what retired. What changed on the phone:

- **The job screen lists the work areas** when there is more than the one
  roof: each area with where it stands — *Booked Fri, Oct 23 · Alberto*,
  *Inspected · 1 repair open*, *Inspected ✓ · with the PM*, *Not booked yet —
  the PM books it on the board*. A plain shingle job reads exactly as before.
- **The roof keeps its checklist**, offered while the roof is booked (a day
  or somebody on it) or the job is at Final Inspection, and never once it is
  inspected — the board, not Close Out, now moves the Status, so a job can sit
  at Final Inspection for a moment after its roof went in, and the checklist
  must not ask for it twice.
- **The gutters and the siding are notes and photos** (Carl: *"for now"*):
  their own tile opens one screen — at least one photo, a note dictated or
  typed in either language and sent in English with what was said beside it,
  and problems of their own. One send, the same outbox as the roof's: the
  findings, their photos, the area's photos, then `coCloseArea` →
  `POST /jobs/:id/close-area-inspection`. Offered once the area is booked or
  the job is at Final Inspection; an area not booked yet is a fact on the
  list, not a button.
- **Every finding says which area it is about** (`area` on the report and on
  its photos), so the repair lands on that area's punch list and the board
  reads it as that area's. A report from the roof checklist carries none and
  the server files it under the roof, as every build before this did.
- **The receipt says who it went to and where the job is**, from the
  server's answer, never the phone's guess: *Sent to Neal Deitemeyer · The job
  moved to Punch List*, or *The job is still at Final Inspection* when another
  area is behind it. Repairs carry their area too (`area` on each punch task),
  so the last repair on the gutters reads *Finish & send to PM — this is the
  last repair on the gutters* and lands as *Repairs on the gutters done · Sent
  to Neal Deitemeyer*, while the roof goes on.
- **Jobs outside the three stages.** The queue now lists close-out work
  assigned to you whatever the job's Status (a gutters inspection booked while
  the roof is still going on), so a job at Production reads as an inspection
  or as repairs from what is assigned, and its Start button no longer counts
  "0 of 13" roof checks.
- Two things fixed on the way: a problem report nobody saved (a Falla tapped
  and changed back) was sent with the visit and refused by the server, and a
  roof send never cleared its own "sending" mark, so a second visit on the same
  phone could not be sent. Neither happens now.
- A job with no work areas — a service call, construction — is untouched,
  and the server still moves those itself.

**Needs, in this order:** the CheckOut server on its `claude/closeout-areas`
branch (the area list, the area route and `sentTo`; an older server sends no
areas and the phone reads as T2.9), then the Apps Script (`coCloseArea` is a
new door — until it is deployed an area send waits in the outbox, nothing is
lost), then `firebase deploy --only hosting`. `dev/closeout-test.mjs` walks it
on a two-area job (`__MOCK_CO_AREAS`).

**Close Out files your work under its days** (T2.11, Carl 26 Oct 2026 —
*"I see the 25-0001 job listed under assigned, but no date … I do not know
when this inspection is scheduled for"*, then *"adding more text to the cards
is expanding the size of the cards"* and *"the crew may want to look at a
calendar or scroll through days"*). The cards are unchanged, word for word
and pixel for pixel; the day lives above them instead:

- **A strip of the next fourteen days** under Assigned / All — the one My
  jobs has, which the Service role never sees — with a dot for each of your
  jobs booked that day. A tap brings that day's heading up (a two-day
  booking is listed once, under its first day), switching to Assigned if All
  was showing and clearing a search that would hide it. The strip stays on
  All so switching the list never moves the search box under a thumb.
- **The Assigned list is filed under day headings**: *Earlier · still open*
  first and in amber (booked for a day that has gone, and still yours),
  *Today*, *Tomorrow*, then each day ahead, and *No day set yet* last, so
  nothing assigned ever drops off the list. All stays one list as before —
  most of it is booked to nobody.
- The days come from CheckOut's queue (`booked`: each of your jobs' booked
  stretches, `{ start, end, kind }`, read off the same inspection and punch
  tasks that already decide what is yours — no extra JobTread request). A
  server older than that sends none, and the tab reads exactly as T2.10:
  no strip, no headings.

**Needs, in this order:** the CheckOut server on `claude/closeout-days`, then
`firebase deploy --only hosting`. No Apps Script change — `coQueue` hands
CheckOut's answer through untouched. `dev/closeout-test.mjs` walks it
(`__MOCK_CO_DAYS`).

**Review & send says why it is waiting** (T2.12, Carl 26 Oct 2026 — every
list done, eight visit photos, and the button grey with nothing on screen
saying why). Two things, both on the roof's send:

- **The real cause: a "sending" mark nothing cleared.** A visit is marked as
  sending when its items go into the outbox, and the mark came off on one
  road only — the close landing. A close refused and then taken off, or an
  outbox the phone lost (site data cleared, the app reinstalled), left it set
  on that job for good, so Review & send stayed grey on that job forever and
  the line under it, with nothing missing, read as if all was well. Now a
  visit counts as sending only while its close is actually in the outbox:
  every outbox read heals a mark with nothing behind it (`coHealSending`),
  with fifteen seconds' grace for a send whose items are still being written.
- **A grey button answers now.** Blocked, it still looks off but a tap opens
  *Before you send*: one row for each thing left — *Inspection · 2 left*,
  *Report the problem on item 5*, *Your last send for this job is still going
  out* or *…was refused* — each going straight to where it is dealt with,
  and a line saying the visit photos are optional (they never hold it up).
  The line under the button adds *Tap Review & send to see what is left*.

**Needs:** `firebase deploy --only hosting` only. A phone that already has the
stuck mark heals the first time it opens Close Out on the new build.

**Breaks, the JobTread way** (T2.13) — see *Break* under the clock below.
**Needs:** the Apps Script deployed FIRST (`clasp push`, then a new version of
the web app deployment), `installBreakReminderTrigger()` run once from the
editor, then `firebase deploy --only hosting`. In the other order a phone on
the new build asks for a 30-minute break and gets the old one (the block
closes, Back to work), which is safe, just not the new thing.

**Two things found filming the crews' training video** (T2.14, 28 Oct 2026):

- **Stop takes one tap in Close Out.** A problem's note and a gutters or
  siding note re-drew the screen the moment the box lost focus (to put the
  English under it). A press on any button takes the focus first, so the
  screen was re-drawn under the finger and the tap went nowhere: Record kept
  listening after Stop, and Save report or Not fixed right after typing
  needed a second tap. The English and the re-draw now wait a quarter of a
  second, for the tap to land (`coAfterTap`). `dev/closeout-test.mjs` presses
  Stop the way a finger does, with new words in the box, and fails on the old
  code.
- **A repair's due day reads as a day.** The repair screen printed CheckOut's
  `endDate` as it arrived — *Due 2026-08-06* — under What to do. It goes
  through `coDay` now, like every other day on Close Out: *Due Thu, Aug 6*,
  or *jue, 6 ago* in Spanish.

**Needs:** `firebase deploy --only hosting` only.

**A work area's Start puts the clock on the job** (T2.15, 28 Oct 2026, also
found filming). Start on a Close Out card has moved the clock to that job since
T2.4, but a roof's gutters or siding booked while the job sits at Punch List
are reached from inside the job (the card reads "1 repairs", not Start), and
the area's own tile also reads **Start** — without moving anything. So an
inspector who came from another job inspected the gutters with the clock still
running on the last one, and the hours landed there. Now the area's Start does
what the card's does (`coClockHere`): on the clock somewhere else, the end
photo there, this job's code, the start photo here; off the clock, the code and
the start photo; already on the clock here, the area simply opens. Only a Start
that has not been started counts — an area with a photo or a note, or one
already inspected, opens as before. The hand-back is the area's own screen,
not the job's, and a refused clock-in leaves the area open all the same.
`dev/closeout-test.mjs` takes the gutters' Start off the clock and fails on
the old code. **Needs:** `firebase deploy --only hosting` only.

**Repairs start the clock too** (T2.16, Carl 28 Oct 2026, watching chapter 8
of the training video — *"for a repair … you have to clock in via clock screen
only … they should be able to clock these types of jobs from their close out
side just like punch and final inspections"*). A job at Punch List — a service
call, a warranty call, a roof's punch repairs — drew "2 repairs" on its card,
and that button only opened the job, so the video sent Yahir to the Clock tab
first. Now a repairs card that is yours reads **Start** / **Empezar** with the
count under it, and does what an inspection's Start does (`coClockHere`): the
end photo where you are, this job's code, the start photo here; already on the
clock here, it reads **Continue** and just opens. Which code: a repair on a
warranty job takes the warranty line, one on a service job the service line
(never the warranty one), when there is exactly one; the travel line is never
picked as the work; otherwise the code sheet, as before (`coPreferredCode`).
Someone else's repairs keep the plain opener, and **every** Close Out job
screen not on the clock carries one row — **Clock in here**, or **Move the
clock here · on the clock at Okafor** — for a job reached by its card, a
search or the All list. The queue fetches the codes of your repair jobs behind
it, as it does your inspections'. `dev/closeout-test.mjs` walks it.
**Needs:** `firebase deploy --only hosting` only.

**The codes are the job's CLOCK IN ITEMS, and the day starts At the shop**
(T2.17, Carl 28 Oct 2026). Two things, both from what the crews do in
JobTread every morning (`JOBTREAD-NOTES.md` has the live read):

- **Which lines a job offers.** New jobs carry a `CLOCK IN ITEMS` cost group
  whose lines are cost type *Clock In*, not Labor — the code list here never
  showed one of them. Carl: *"they should only have the options listed in the
  Clock in Items cost group. If the cost group is missing from the job, then
  and only then offer other clock in options so they can at least clock in."*
  So `getJobCodes` offers the group's Clock In lines when the job has them
  (a line added twice shows once) and every budget-level Labor or Clock In
  line when it does not. Each code says whether it is the job's **travel**
  line and whether it is an **office** code: Administrative (`99TM-7`) is
  kept off the code sheet for everyone but Operations — Carl's call, an
  office code wherever it appears. The API's cache key and the phone's kept
  lists are versioned, so a list from before this is never offered again.
- **At the shop.** *"All crew members typically start their day at the
  Monroe Street production building. When they get there they are on the
  clock and need to clock in."* Off the clock, under Clock in: **At the shop
  · Morning clock-in** — one tap puts the clock on 25-0011 DB INTERNAL's
  Morning Clock-In (`99TM-1`) and opens the camera on the start photo (Carl:
  keep it). **Other shop work** is the shop's own list and nothing else:
  Morning Clock-In, Training, Crew Labor – Monroe St., Crew Labor – Bonnewitz
  Ave., Shop Work/Maintenance and — for the haulers, Kodey and Rick, who log
  whole days on it — Hauling & Disposal (Direct) (`SHOP_CODES`; the Script
  Property of that name, a comma list of code numbers, changes it without a
  release). The shop has two `02ST-5` lines, its own and the CLOCK IN ITEMS
  one; the haulers see one, the shop's own, which is the one they use. On the clock there,
  the job card reads *At the shop · JT #25-0011 / The shop*. The shop's job
  comes from the API on boot (`getStart.shop`); an older API sends none and
  the row is not drawn.

`apps-script/code-test.mjs` (a job with the group, one without, the shop,
`SHOP_CODES`) and `dev/clock-test.mjs` (the one tap, the shop's list,
Administrative by role, an API that names no shop) walk it. **Needs:** the
Apps Script (`clasp push`, a new version of the web app deployment), then
`firebase deploy --only hosting`. A new phone on the old script draws no shop
row and reads the old code list; the old phone on the new script reads the
new list.

**The drive** (T2.18, Carl 28 Oct 2026 — *"we need a process to switch the
clock from wherever they are to something when they are traveling, whether
that is from the shop in the morning to when they get to the job site"*).
The something is the job's own **Travel Related Labor** line (`01GR-9`, in
CLOCK IN ITEMS):

- **Leaving** is Stop the clock · **Leave for the job** (at the shop) or
  **Leave for another job**: the end photo where you still are — at the shop,
  the loaded truck — then **Where are you going?**: today's booked jobs from
  the board, today's Close Out work, **Another job** (the job search), and,
  away from the shop, **Back to the shop · end of the day**. One call
  (`startTravel`) closes the block with its end photo and opens the drive on
  the travel line of the job you are going to; the entry's notes say *Drive to
  26-0890 Noah Webster · from the shop*. The drive back goes on the travel line
  of the job just left (*Drive back · end of the day · from …*) — Carl: the drive
  at the end of the day counts as paid travel.
- **On the drive** the band reads *Driving to Noah Webster* with the travel
  line under it, and the buttons are the arrival: **I'm here · start work**,
  **Going somewhere else**, **Clock out · done for the day**. Driving back:
  **At the shop · shop work** and **Clock out · I'm back**.
- **Arriving** is the job's code and its **start photo on site** — one switch,
  with no end photo for the drive: it ends in a truck. Start on a Close Out
  card for the job you are driving to is the same arrival, and its job screen
  says *I'm here · start work*. Clocking out from a drive takes no photo.
  `switchCode` and `clockOut` drop the end-photo rule only when the running
  block is a drive, and the drive owes no start photo (marked nudged, as a
  break's block is).
- **A job with no travel line** (CLOCK IN ITEMS from before 16 Oct, or none):
  the phone asks which of that job's lines to drive on — Carl's "then and
  only then" — and the drive is known as one by its notes (*Drive to …*), on
  the phone and in the API alike, so it still ends with the start photo on
  site. The line must be the job's travel line when it has one, or one of its
  own lines when it has none (`assertDriveLine_`). The travel line is never on
  the ordinary code sheet, and never picked by Start.

`apps-script/code-test.mjs` and `dev/clock-test.mjs` (the shop to a job and
back, a job without the line) and `dev/closeout-test.mjs` (Start as the
arrival) walk it. **Needs:** the Apps Script first (`startTravel` is a new
door, and the switch and the clock-out from a drive are refused by an older
one), then `firebase deploy --only hosting`.

**Already left the job** (T2.19, Carl 28 Oct 2026 — *"if they leave a site
without clocking out of the site and picture, and try to clock into a new job,
they have to snap a picture to clock out of the job they left, but they aren't
there anymore to take a meaningful picture"*). The end-photo camera of a move,
a drive or the end of the day carries one amber line: **Already left Noah
Webster? Say when — no photo**. (Never on a code switch at the same job: you
are standing there.) It asks **When did you leave?** — Just now, 15, 30, 45
minutes or an hour or two ago, only times after the block began, or another
time — and one call (`leftSite`) does the rest:

- the block ends at that time, with no photo, and its notes say *No end photo
  — left the site. Ended from DB Crew at 4:12p, said they left at 3:45p.*;
- a comment on that job is assigned to its **PM and Carl** (Carl's call;
  `LEFT_SITE_NOTIFY`, a Script Property of names, changes who besides the PM):
  *⏱ Tyler Mohr left 26-1490 Courtney_Roof without clocking out. The block on
  07TM-1 Roofing was ended at 3:45p, the time given, from DB Crew at 4:12p — no
  end photo.*;
- then what was under way carries on. A move: the next job's code and its
  start photo, with **the drive from when they left until now on that job's
  travel line**. The drive: it starts when they left. The end of the day: out,
  at that time.

A block still open from **a day before** puts *Still on the clock · Since Tue
Oct 27 at Noah Webster — when did you leave?* at the top of the clock screen;
the question then asks only the time, on the day it began — a drive left running
overnight too (*When did the drive end?*). A block from a day before always
ends on its day and carries nothing on: the move it was asked from is a plain
clock-in at the next job, never a drive from last night, and the API refuses a
drive or a move from a time over 12 hours ago. It is never a way round the
start photo: the work after it still opens with one. Who else is named in the
notice, or kept quiet, is the API's own (`withPartner_`), never the phone's.
`apps-script/code-test.mjs` (out, the drive, the work, the notes, the comment,
the refusals) and `dev/clock-test.mjs` (a move, the end of the day, on the
road, yesterday's block) walk it. **Needs:** the Apps Script first (`leftSite`
is a new door), then `firebase deploy --only hosting`.

**Before you roll out** (T2.20, Carl 28 Oct 2026 — *"the video didn't really
show much about what the site manager checks for before leaving the shop in
the morning, I thought we set something up in the app they have to check"*).
It was there: the board's checklist opens with **At the yard, before you roll
out** (phase `yard`: *Tarps checked and loaded*, *Dry-in supplies loaded* —
"while the truck is loaded, the same moment as marking the material loaded"),
and My jobs carries **Material loaded**. But both sat one tap down inside each
roof's Site checks, nothing asked for them, and not one real October roof had a
tick on any line. Carl: **a hard stop**.

- A site manager leaving the shop — **Leave for the job**, or **Move to another
  job** off the shop's block — gets **Before you roll out** instead of the
  camera: each of today's roofs from the board, its yard lines as boxes
  (ticked through the same local-first save as the checklist screen, one PUT
  per burst) and, where the material comes through the shop, **Material loaded
  for the crew** (the board's `PUT /api/crew/loaded`). The button reads *3 left
  to check* until all are done, then **All done · start the drive** — and only
  then the end photo, the loaded truck. Backing out stays at the shop.
- **Forgot** (*"if they forget, need to let them clock in later with the same
  guidelines as before"*): starting work at a roof whose yard is still owed —
  clocked straight in there, or left the shop without the app (**Already left
  the shop? Say when** is on the sheet) — shows **Yard checks not done** with
  what is missing, and **Clock in · the PM and Carl are told** goes on to the
  start photo; once the start photo has clocked in, `rollForgot` posts one
  comment on the job assigned to its PM and Carl (`LEFT_SITE_NOTIFY`), once per
  roof per day (kept across a reload). Backing out before the shutter tells
  nobody.
- Only for a site manager the board lets tick, and only off the board's own
  answer: a board that is down, a fallback job list, or a 403 holds nothing —
  the clock is payroll — nor a board copy gone stale. The lines are drawn from `checklist`, phase `yard`; a
  board without that phase holds only for Material loaded.

`dev/clock-test.mjs` walks the hold, the ticks and the load, a move held and
backed out of, the forgot path, and a crew member who is never held;
`dev/daylog-test.mjs` now meets the forgot step on its move to Lucas, whose
shop material was never loaded. **Needs:** the Apps Script (`rollForgot` is a
new door), then `firebase deploy --only hosting`.

**Yahir can clock Alberto in too** (T2.21, Carl 28 Oct 2026 — *"for just Yahir,
he can have a Clock in Alberto Too option. May change later."*). The two work
as a pair, and in JobTread one phone clocks both — their entries start within
milliseconds of each other. On Yahir's phone a box sits at the top of Close
Out and under the clock's job card: **Clock Alberto Gonzalez in and out with
you** / *Marcar a Alberto Gonzalez contigo*, remembered on the phone. Ticked,
every clock write the phone makes — a clock-in, a switch, a drive, a break,
End break, a clock-out, Already left — goes for Alberto too (`partner: true`
on the request; `withPartner_` in `Code.gs`): the same job, code, photo ids and
times, **but only when Alberto's clock stands where Yahir's did** (both off,
or both on the same job and code, on a break or not). Alberto somewhere else
is left alone, and the phone says so: *Alberto Gonzalez was not changed — on
the clock at 26-0890 · 04MA*. Alberto's half never fails Yahir's. The photo is
on the job once, under Yahir's entry, so Alberto's block is marked nudged;
Already left together sends one notice naming both. Who partners whom is
`PARTNERS` in the code (Yahir's membership → Alberto's), and the Script
Property `PARTNERS_JSON` (`{"<membership id>":"<membership id>"}`, `{}` for
nobody) replaces it without a release — Carl: "may change later". A partner
lookup that fails says nothing to the phone, which keeps the box as it was. The README's old line, *"the
foreman crew block is read-only … clocking another person in is a payroll
decision"*, still holds for everyone else; this is that decision, for one pair.
`apps-script/code-test.mjs` (both off, the same block, Alberto elsewhere,
already left together, nobody partnered) and `dev/closeout-test.mjs` (the box,
the flag, box off, Alberto elsewhere) walk it. **Needs:** the Apps Script, then
`firebase deploy --only hosting`.

**Two words on the drive, found re-recording the training video** (T2.22,
28 Oct 2026). Driving to a repair job, its Close Out card read **Continue**
(the clock was on that job, on its travel line), so the arrival looked like
work already begun; it reads **Start** until the start photo there.
Arriving with I'm here, the code sheet was titled **Switch code**; it reads
**What are you doing?**, as at a clock-in, because the drive is not a code
being switched away from. Words only: the taps and the writes are as before.
`dev/closeout-test.mjs` and `dev/clock-test.mjs` carry a check each.
**Needs:** `firebase deploy --only hosting` (no Apps Script change; the API
still says T2.21).

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

**Break** works the way JobTread's own app takes one (T2.13, Carl 26 Oct
2026 — *"it should use the pause and select the break time 0:15, 0:30, 0:45,
1:00 … should function just as the JobTread app works"*). It asks **how
long** — 0:15 · 0:30 · 0:45 · 1:00, each tile saying when the clock restarts —
and makes ONE call: `updateTimeEntry` with `endNow: { breakDuration }`.
JobTread closes the running block now and puts the next one in, same job and
code, starting when the break ends (floored to the minute, no location).
Measured live the same day: Carla Voltz's noon break in the JobTread app ended
her block at 17:00:03Z and created one starting 17:30:00Z, 41ms apart. If a
JobTread ever answers without the second block, `startBreak` writes it
itself, the same shape.

- **On a break** is an open entry whose start is still ahead, so a break
  taken in the JobTread app reads the same here, and a reload finds it.
  The band pauses and counts DOWN to the restart (*On break · back at
  12:30p*), says how long and what was saved (*30-minute break · started
  12:00p · 2:31 on 04MA saved*), and the job can't be changed until it ends.
- **The clock restarts by itself** at the planned minute, exactly as in
  JobTread. The phone then reads *Break over · clock on since 12:30p*
  until **End break** is tapped — which writes nothing, the hours already
  run from 12:30. Coming back late is paid from the break's end, as
  JobTread pays it.
- **End break early** deletes the waiting block and opens one now, where
  they are standing — what JobTread's End break does. Starting work on
  another code or job during a break ends it the same way, on the server
  whatever the phone sends.
- **Clock out for the day from a break** deletes the waiting block, no photo
  (the block before the break closed when it began). Once the break has run
  out it is an ordinary clock-out with its end photo, because the clock is
  running.
- **Two reminders**: *Break ends in 5 minutes* and *Break's over — tap End
  break when you're back*, in the phone's language. A phone in a pocket gets
  them as pushes from `sweepBreakReminders` (below); a phone in a hand also
  gets a toast and a buzz. A 15-minute break gets both; nothing is sent for
  a break already ended.
- **The activity log is JobTread's own**: every step above is an ordinary
  time-entry write (updated, created, deleted), so the job's activity reads
  the way it does for the JobTread app.
- The block after a break needs no start photo, so `startBreak` and End
  break mark it nudged and the before-photo sweep leaves it alone.
- The foreman's crew list names a break (*On break · back 12:30p*) and does
  not count it as on.

An Apps Script older than T2.13 only closes the block; the phone falls back
to the old break (**Back to work** re-opens the code) when that is the
answer, and an older phone on the new script gets the old behaviour too.

**Switching codes or jobs** is the END photo first — the camera locked to END,
"you switch when you shoot" — then the code list (or the next job's), then
the START photo of the new code. One call closes the old block and opens the
new one, carrying both photo ids, so a dropped connection cannot leave anyone
clocked out mid-switch. Backing out at the code list leaves the clock running.

**Clock out for the day** is the END photo, then the commit, then the Day log
with "Today's log · not sent / Send it before you go?" at the top if today's
log has not gone.

**The API refuses** a clock-in, clock-out or switch that carries no photo id,
so the gate cannot be skipped by asking it directly. A break, and a
clock-out from one, are the photo-less writes, by design.

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

**Break reminders** (T2.13) need a minute's resolution, so they have their
own trigger:

```
every 1 min   Apps Script trigger -> sweepBreakReminders()
              ├── Script Properties: brk_<userId>, one per person on a break
              │   (written by startBreak, cleared by End break / clock-out)
              ├── nothing due  ->  done (no Pave call at all)
              └── due: one Pave call — is the waiting block still there?
                  5 min left  ->  "Break ends in 5 minutes"
                  start passed ->  "Break's over"  (record removed)
```

Each person writes only their own key, so two breaks starting together never
race. A break ended in the JobTread app, or by the office, has no waiting
block left and gets nothing. Install once with `installBreakReminderTrigger()`
from the editor; tapping a break push opens the clock.

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
