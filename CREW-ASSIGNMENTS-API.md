# `GET /api/crew/assignments` — the contract between this app and the Production Board

Two repos build to this file. The board (`bledsoecw/DB_Production_Board`, default
branch `main`, which **is** production) serves it;
this app (`apps-script/Code.gs`, `getMyJobs`) consumes it. It was pinned before
either half was written so the two could be built in parallel.

Everything below was checked against the board's real types on 2026-09-14, not
inferred: `Visit` (`src/lib/types.ts:111`), `BoardJob` (`src/lib/types.ts:64`),
`fetchVisits` (`src/lib/jobtread/schedule.ts:74`), `materialWords`
(`src/components/easy/easy-view.tsx:60`), `crewForTask` (`src/lib/crews.ts:336`).

## Why the board resolves and this app only asks

The join is a JobTread `membership.id` that already exists on both sides:
`memberFor_(email).membershipId` here (`Code.gs:219`), `Crew.leadMembershipId`
there (`crews.ts:67`). Nothing was added to either data model.

Resolving crews *here* would break, for reasons that are not obvious:

- `crewForTask` matches the task-name suffix against `ALL_CREWS` **and their
  aliases**, then falls back to assignee names.
- `ALL_CREWS` is the saved roster in a private Vercel Blob. Apps Script cannot
  see it.
- Renaming a crew in the board's Operations tab **auto-keeps the old name as an
  alias** so existing tasks don't come loose. A naive first-name match against
  task names breaks on exactly that, and breaks silently — the crew member just
  stops seeing their jobs.

So the board resolves, this app asks.

## Request

```
GET /api/crew/assignments?membershipId=…&from=YYYY-MM-DD&to=YYYY-MM-DD
Authorization: Bearer $CREW_APP_SECRET
```

| Param | Required | Notes |
| --- | --- | --- |
| `membershipId` | yes | The JobTread membership id. Resolved server-side here from the verified Google token — **never** a value the phone sent. |
| `from` | yes | Inclusive `YYYY-MM-DD`. |
| `to` | yes | Inclusive. Reject `from > to` with 400, as `api/schedule/route.ts` already does. |

A multi-day install that started before `from` must still come back — `fetchVisits`
already handles this with `SPAN_SLACK_DAYS`, so a crew on day 2 of 3 sees their
job. Don't lose that by filtering the result again on `start >= from`.

## Response — 200

```jsonc
{
  "crew": {
    "id": "c1",
    "name": "Alberto",
    "leadMembershipId": "22PdPUpWzpHy",
    "leadUserName": "Alberto Gonzalez"
  },
  // Added 2026-10-05: this crew is on a division's final-inspection list on
  // the board (Operations → Close-out), i.e. the board assigns them
  // inspections and DB Crew's Close Out tab has something to show. The
  // app's Service ROLE (who sees the tab) and this (who gets the work) are
  // two lists in two places on purpose; Close Out says so beside a person
  // when they disagree. Absent on an older board = unknown, never no.
  "inspector": true,
  "range": { "from": "2026-09-14", "to": "2026-09-27" },
  "visits": [
    {
      // straight off Visit
      "taskId":  "22P…",
      "jobId":   "22P…",
      "jobNum":  "26-0890",
      "jobName": "260890 Webster_Foundation",
      "start":   "2026-09-15",
      "end":     "2026-09-17",
      "days":    3,
      "crewNote": "Dumpster on the north side, gate code 1412",
      // Added 2026-10-29: the JobTread task's own name. The phone says a
      // construction stage off it ("Rough-in · week 2 of 3" for the
      // template's Rough-in / Finishes lines). "" when the sweep did not carry it.
      "taskName": "Roof install — Alberto",

      // joined from BoardJob
      "cust":    "Noah Webster",
      "city":    "Van Wert",
      "address": "408 Euclid Ave, Van Wert, OH 45891, USA",
      "status":  "Production",
      "jtype":   "Foundation",

      // materialWords(job, visit)
      "material": { "text": "Material due today — not confirmed", "cls": "warn" },

      // the WAREHOUSE half of this job's material, and the one tick this app
      // owns — see "The material loaded tick" below. null when the job has no
      // warehouse half at all (ABC booms straight onto the roof). Added
      // 2026-09-19; additive, so an app built to the earlier contract
      // ignores it.
      "warehouse": {
        "delivered": false,       // a drop routed to OUR building has landed there
        "staged":    true,        // pulled AND staged — one step since 2026-09-21
        "pulled":    true,        // MIRRORS "staged" since 2026-09-21 — do not branch
                                  // on it, read staged; removed once T1.23 confirms
                                  // nothing reads it
        "where":     "Bay 3",     // free text the yard typed; null when unanswered
        "loaded":    false,       // THE tick this app records
        "toWarehouse": false,     // the supplier drop lands at the DB warehouse
        "words":     "Staged at Bay 3"   // render as-is, same sentence as the board
      },

      // the JOB's site checks — see "Site checks" below. null when the job
      // has none. Added 2026-09-15; additive, so an app built to the earlier
      // contract ignores it.
      "checks": {
        "taskId": "22P…",                      // the task the list is ON — NOT this visit's
        "state": {
          "done": { "address": true, "…": false },
          "magnetBy": null,
          "coveredBy": null,                   // "Kenton, back by 3:30" — who took the site over (added 2026-09-21)
          "watertightWith": null,              // "Jason Zehr" — the crew leader who confirmed it watertight with the site manager (added 2026-09-21)
          "signedOff": null,
          "notes": { "septic": "Tank lid is under the back deck" },   // per-line notes, keyed like done (added 2026-09-20)
          "na": { "septic": "city sewer" }     // per-line NOT APPLICABLE, with the reason, keyed like done (added 2026-09-21)
        },
        "progress": [                          // done = settled (ticked OR n/a); na = how many of those are n/a
          { "phase": "yard",     "label": "At the yard, before you roll out", "done": 0, "total": 2,  "na": 0 },
          { "phase": "before",   "label": "Before the tear-off",             "done": 2, "total": 12, "na": 1 },
          { "phase": "during",   "label": "While the roof is open",          "done": 0, "total": 5,  "na": 0 },
          { "phase": "handover", "label": "Before the site manager leaves",  "done": 0, "total": 8,  "na": 0 },
          { "phase": "finished", "label": "Before the crew leaves for good", "done": 0, "total": 13, "na": 0 }
        ],
        "words": "Before tear-off — 2 of 12 done",
        "crewLead": "Jeremiah Zehr"            // roster lead of the crew whose task carries the list — the default answer for "Watertight confirmed with:"; null when the roster names nobody (added 2026-09-21)
      }
    }
  ],

  // how to DRAW any visits[].checks — once per response, see "Site checks"
  "checklist": {
    "phases": [                                // FIVE since 2026-09-21 — draw however many come back, never assume three
      { "key": "yard",     "label": "At the yard, before you roll out", "tag": "AT THE YARD",     "when": "while the truck is loaded — the same moment as marking the material loaded" },
      { "key": "before",   "label": "Before the tear-off",             "tag": "BEFORE TEAR-OFF", "when": "the morning the crew starts" },
      { "key": "during",   "label": "While the roof is open",          "tag": "DURING",          "when": "before each stage gets covered — a promise is not an inspection" },
      { "key": "handover", "label": "Before the site manager leaves",  "tag": "HANDING OVER",    "when": "only if you leave before the crew does, and only with the PM's OK" },
      { "key": "finished", "label": "Before the crew leaves for good", "tag": "FINISHED",        "when": "the last day" }
    ],
    "lines": [
      { "key": "tarps",      "phase": "yard",     "label": "Tarps checked and loaded — four sound 20×40s with tie-downs, a torn one swapped out" },
      { "key": "…",          "phase": "…",        "label": "…" },
      { "key": "covered",    "phase": "handover", "label": "Covered by:",                     "value": "coveredBy" },
      { "key": "magnet",     "phase": "finished", "label": "Magnet run, lawn and beds — by:", "value": "magnetBy" },
      { "key": "watertight", "phase": "finished", "label": "Watertight confirmed with:",      "value": "watertightWith" },
      { "key": "signoff",    "phase": "finished", "label": "Signed off:",                     "value": "signedOff" }
    ]
  },
  "fetchedAt": "2026-09-14T11:02:00.000Z"
}
```

`cust` is `BoardJob.cust`. It is here because tapping a visit in this app sets
it as the clock's job, and the clock's job card reads `customer` — without it
the card loses a line the crew already expects to see.

`material` is `materialWords`' own return value — `{ text, cls }` where `cls` is
`good` | `warn` | `bad`, or `null` when no chip applies. This app renders the
text as-is and colours from `cls`; it deliberately does **not** re-derive the
words, so they stay defined in one place.

**The words changed on 18 Sep 2026 and the phone must not paper over it.**
Ordered, booked and delivered used to collapse into one green `Material
ordered ✓`, so a job nobody had rung ABC about read on a crew's phone exactly
like one whose bundles were on the roof. Only two states are `good` now, and
both mean a person said so:

| text | cls | means |
| --- | --- | --- |
| `Material on site ✓` | good | the site manager ticked "Material on site and counted against the order" |
| `Loaded for the crew ✓` | good | the warehouse pull is on the truck |
| `Material due today — not confirmed` | warn | the supplier drop was booked for today or earlier; nobody has confirmed it landed |
| `Ordered — drop booked, not on site yet` | warn | a drop date is set for a later day |
| `Ordered — coming to the shop first` | warn | the drop is routed to the DB warehouse, not the job |
| `Due at the shop today — not confirmed` | warn | that warehouse drop was booked for today or earlier |
| `Ordered — no drop date yet` | warn | ordered, nobody has rung the supplier for a date |
| `Staged at Bay 3 — not loaded` | warn | pulled and staged in OUR warehouse, still not on the truck |
| `At the shop — not staged yet` | warn | a supplier drop routed to the DB warehouse has landed there; nobody has pulled and staged it for the crew (added 2026-09-20 as `At the shop — not pulled yet`, reworded 2026-09-21) |
| `Pull from shop` | warn | a DB inventory pull nobody has been to the shelf for |
| `PART ORDER — check first` | bad | some supplier orders still in draft |
| `NOTHING ORDERED — check first` | bad | no supplier order and no DB inventory pull |

`Pulled — not staged yet` is **gone** (2026-09-21). Pulled and Staged are one
step, so the state it named no longer exists and the board can never send it.

Anything that reworded this into a single "MATERIAL ON SITE" banner is now
wrong twice over — render the text as it arrives. (`matLine()` in the app's
`index.html` did exactly that until T1.17: every `good` line became "Material
on site", so LOADED FOR THE CREW read as material standing on the job. It
renders the board's text as it arrives now, the tick stripped because the
self-hosted face draws U+2713 as a radical sign. Do not put a rewrite back.)

**In Spanish (T2.24) each line has one Spanish line of its own** — `matEs()` in
the app's `index.html`, keyed by the board's exact text (*Ordered — no drop
date yet* → *Pedido — sin fecha de entrega todavía*, *Staged at Bay 3 — not
loaded* → *Apartado en Bay 3 — sin cargar*). A translation, one for one, never
two states folded into one sentence; a line the phone has no Spanish for is
shown in English exactly as the board sent it. So a new or reworded line here
reads in English on a phone set to Spanish until the app learns it — add its
Spanish to the `ES` table there in the same change.

`days` is *m*, and it counts **days on site, not calendar days** (changed 18
Sep 2026): a visit that starts on a Friday and finishes on Monday is `days: 2`,
because nobody is on a roof at the weekend. `start` and `end` are still real
dates and still span the weekend.

Day *n* of *m* is computed in this app from `start` vs today, and must be
counted the **same way** or the two disagree the moment a visit runs over a
weekend: *n* is 1 on the start date whatever day it falls on, and goes up by
one on each weekday after it. Counting calendar days would make that Monday
"day 4 of 2". The board must **not** expand one row per calendar day — a
three-day install is one visit.

## Response — the cases that aren't 200

| Case | Status | Body |
| --- | --- | --- |
| `membershipId` resolves to no crew | **200** | `{ "crew": null, "visits": [] }` |
| Crew resolves, nothing scheduled | 200 | `{ "crew": {…}, "visits": [] }` |
| Missing/short `membershipId`, bad dates, `from > to` | 400 | `{ "error": "…" }` |
| Wrong or missing bearer token | 401 | `{ "error": "Not authorized" }` |
| `CREW_APP_SECRET` unset on the server | 401 | `{ "error": "CREW_APP_SECRET is not set, so this route refuses to run." }` |
| JobTread read failed | 502 | `{ "error": "…" }` |

**An unresolved membership is a 200, not a 404.** Jeff and Chris McGlone have no
JobTread user, and the subs who aren't in the roster won't resolve either — the
app needs to say "no crew assigned to you yet, ask the office" rather than show
a red error, and a 404 makes that indistinguishable from a broken deploy.

## Board-side implementation notes

**Auth: copy `src/app/api/cron/capture/route.ts`.** Shared secret checked in the
route, refusing outright when unset rather than standing open. That route's
comments explain the reasoning; the same reasoning applies here, with one
difference worth writing into the new route's comment — cron is called by
Vercel's scheduler, this is called by an Apps Script deployment that has already
verified a Google Workspace ID token and resolved the membership id from it
(`verifyIdToken_`, `Code.gs:73`). **Don't re-verify the user in the board.** It
trusts this Apps Script the way it trusts the scheduler.

**Add `api/crew` to the matcher exclusion in `src/proxy.ts:16`** — Apps Script
sends no cookie, so the sign-in bounce turns every call into a 307 to Google.
Note in the comment that the exclusion covers the whole `api/crew` prefix, so
every future route under it carries its own secret check or it is open.

**`await loadRoster()` first.** Every board path that touches crew helpers does,
and `ALL_CREWS` is empty until it resolves. Then `fetchVisits(from, to)` and
filter `v.crewId === crew.id`.

**Membership → crew needs a helper that doesn't exist yet.** There is
`crewById`, `crewForUserName`, `crewForTask`, `crewForVendor` — but nothing
keyed on `leadMembershipId`. It's `ALL_CREWS.find(c => c.leadMembershipId === id)`;
put it in `crews.ts` beside `crewForUserName` rather than inline in the route.

**Do not call `fetchBoardJobs()`.** It pages 25×25 over jobs *and* tasks with
nested document queries per job — it is why `api/cron/capture` sets
`maxDuration = 300`. The caches in front of it (`jobs-cache.ts`, 30s, an
in-memory `Map`) are per-instance, so on serverless a crew member's 6:45am
request usually lands cold and pays the entire portfolio sweep. Add a narrowed
variant instead: `jobsQuery` already carries a `where: { and: [...] }`
(`board.ts:93`), so an id filter over the 3–8 job ids on the returned visits is
a small addition and turns ~18 pages into one. Carl's call, 2026-09-14.

**Naming.** `src/app/api/jobs/[jobId]/crew-app/route.ts` already exists and
means **DB CheckOut** (`handToCrewApp` — inspection/punch/service/warranty).
The paths don't collide, but the words do, and the boundary between the two apps
is meant to be structural rather than something a reader has to remember. Call
this one *install assignments* in the code and comments, not "the crew app".

## What this app does with it

`getMyJobs(me, from, to)` in `Code.gs`, registered in the **`WITH_USER`** map in
`doPost` — never `PLAIN`. That file's rule is *"Every write is stamped with the
caller resolved from the verified token, never with a user id sent by the
client"*, and a read of someone else's schedule is the same problem: a crew
member must not be able to ask for another crew's jobs by editing a request.

When the board is unreachable the app falls back to `getJobOptions(userId)`
(`Code.gs:282`) — recent time entries, GPS proximity, remembered last job — and
says so in the UI. **The clock is payroll and must never be blocked by the board
being down.**

`getMyJobs` asks from **yesterday**, not today, so the morning-after nudge
("Yesterday's job at Courtney isn't signed off") has data; `checks` and
`checklist` pass through untouched. The site checks are saved by
`saveSiteChecks(me, taskId, jobId, jobLabel, today, checks)`, also in
`WITH_USER`: it stamps `membershipId` from the verified token, PUTs to the
board, and hands back the board's status and JSON verbatim — never thrown, so
the phone can keep its ticks through a 502 and say "the site manager ticks
these" on a 403. It is not gated on `WRITE_ENABLED`: that flag keeps this
script's grant key off payroll, and the checklist is the board's write under
the board's own gate. `index.html` holds the ticks local-first (one PUT per
burst, kept in localStorage until the board has taken them) and draws every
line and phase from `checklist` — nothing about the list is hardcoded here.

Two labels this app adds to each visit after the GET, from JobTread directly
and never fatally: `alongside`, the crew whose line `checks.taskId` sits on
("Platinum"), read as that task's name minus its "Install —" prefix — a label,
not crew resolution, and suppressed on the visit's own task; and `pm` /
`reps`, the job's Project Manager and Sales Rep fields, which the daily log is
assigned to. If the board ever sends these itself they should replace the
lookups here.

## Scope boundary

This app reads **only** Install tasks `22Pc9WLVvBn3`. DB CheckOut
(`closeout.deitemeyerbrothers.com`) reads **only** Punch List `22PLePTbJVrQ`.
Install tasks are invisible to CheckOut by design and punch tasks stay invisible
here. Crew App = the working day; CheckOut = closing the job out.

## Site checks (added 2026-09-15)

The site manager's paper checklist ("Roofing Checklist" in the packet) now lives
as a JobTread checklist on the job's roofing install task — the board's
`src/lib/install-checks.ts` is the single home of the 40 lines, the five
phases and the words (28 lines and three phases until 2026-09-21 — see
*Shawn's SOP v1.1* below). The board seeds it when a roofing crew is booked and
sweeps hourly for any it missed; JobTread derives the task's progress from it.

**It rides ONE task per job, and that task is usually not the site manager's
own visit.** Tyler is booked as "Install — Tyler"; the list is on "Roof install
— Platinum …". So `checks` on a visit is the JOB's list, and `checks.taskId` is
the task to write to. `null` means the job has no list (a construction or
gutter visit, or a roofing install booked before the list existed and not yet
swept — the sweep runs hourly).

**Draw the list from `checklist`, never from wording of your own.** `phases`
and `lines` are the board's `PHASES` and `CHECK_LINES` verbatim — 40 lines,
in the order a person reads them (order IS the grouping), each with the
`phase` it belongs to. Four lines carry a `value` after their label:
`magnetBy`, `coveredBy` and `watertightWith` are free text the phone may send
(60 characters); `signedOff` is written by the board only. A `value` this
build does not know should render as a tick with the current text read-only
after the label — never as a bare tick, which would hide the name on it. A
line's `label` is what the site manager reads; the phase's `tag` is what
JobTread's own checklist prefixes every phase with, and the app need not show
it.

`words` is `checksWords()`'s own return value — render it as-is, never
re-derive. `state.done` is keyed by `checklist.lines[].key`;
`state.signedOff` is `"Tyler · Sep 15"` once signed, written by the board from
the signed-in identity and never from text the phone sent.

### `PUT /api/crew/checks`

```
PUT /api/crew/checks
Authorization: Bearer $CREW_APP_SECRET
Content-Type: application/json

{
  "membershipId": "22PLtN4cBYPH",   // resolved server-side here, as for GET
  "taskId":  "22P…",                // checks.taskId from the GET — the task the list is on
  "jobId":   "22P…",
  "jobLabel": "26-1490 Courtney",   // optional; the toast/comment wording
  "today":   "2026-09-15",          // the PHONE's date — a UTC server is a day out every evening
  "checks": {
    "done": { "address": true, "homeowner": true },  // only the keys you changed are needed
    "magnetBy": "Kenton",                              // or null
    "coveredBy": "Kenton, back by 3:30",               // or null; LEAVE OUT to keep what is there (added 2026-09-21)
    "watertightWith": "Jason Zehr",                    // or null; LEAVE OUT to keep what is there (added 2026-09-21)
    "signOff": true,                                   // sign it (false takes a signature off)
    "notes": { "septic": "Tank lid is under the back deck", "address": "" },  // a note per line key; "" clears (added 2026-09-20)
    "na": { "septic": "city sewer", "sign": "" }        // NOT APPLICABLE per line key, with the reason; "" clears (added 2026-09-21)
  }
}
```

| Case | Status | Body |
| --- | --- | --- |
| Written | 200 | `{ "human": "…", "api": […], "checks": {…}, "previous": {…} }` — `checks` is the state as written; adopt it. `previous` is what it was, so an Undo is this same call with `previous` posted back. |
| Membership is not a site manager | **403** | `{ "error": "Only a site manager can tick the site checks — ask the office." }` |
| Missing/short ids, no `checks` | 400 | `{ "error": "…" }` |
| Wrong or missing bearer token | 401 | as GET |
| JobTread write failed | 502 | `{ "error": "…" }` |

**Who may tick is decided by JobTread, not by this app**: the membership must
carry the **"Site Manager"** role there (Chris Blue, Tyler, Kenton as of
2026-09-15), or resolve to a roster crew whose trade line reads "Site Manager".
Carl moves people on and off that role in JobTread; nothing needs redeploying.
The same rule gates the board's own route, so the two can never disagree.

**The whole state is posted every time** — `subtasks` REPLACES on JobTread's
`updateTask` — and the board rebuilds only its own 28 lines, carrying every
other item on the checklist across untouched. The sign-off name and date are
stamped by the board from the membership; once signed, re-saving ticks does not
re-sign, and `signOff: false` is the only way a signature comes off.

The ticks are written on every save. The job comment is not (changed
2026-09-20): the phone saves in bursts with no button, and a site manager
who paused between boxes put "4 of 7 done", "5 of 7 done" and "all 7 done"
in the activity feed inside a minute. From this route the board posts one
comment only when a save FINISHES a group — whichever box in the group came
last ("📋 Site checks: before the site manager leaves — all 7 done — via
Production Board (Tyler Mohr)"; two groups finished in one burst are both named) — or signs
or unsigns the list ("📋 Site checks: signed off by Tyler …"). A burst that
finishes nothing posts nothing. The office's own route (a button press) still
comments on every save. Ticking inside JobTread's own app writes no comment
and records no author — the board's route is what makes the tap a signature.

### A note on a line (added 2026-09-20)

The paper checklist had a margin and the list did not: *"the check list has
no way for the site managers to make on the spot notes on the check item"*
(Carl). Every line except the sign-off can carry ONE note now — `state.notes`
on the GET, keyed by `checklist.lines[].key` exactly like `done`, and
`checks.notes` on the PUT.

- **One line of text, 140 characters** (`NOTE_MAX` in the board's
  `install-checks.ts`). The board collapses whitespace and cuts at 140; send
  what was typed. It rides the subtask's NAME in JobTread after ` — note: `,
  the same trick as `magnetBy` and the sign-off, so a PM reading the task in
  JobTread's own app sees *"Well and septic located — note: Tank lid is under
  the back deck"*.
- **Send every key you show, `""` for none** — the PUT's `notes` is merged
  onto what is written: a key present with text sets it, `""` clears it, a key
  left out is left alone. So a phone that sends all 27 keys every burst is
  right, and one that sends only the changed key is also right; what is wrong
  is sending a key with stale text after somebody cleared it in JobTread.
- **A note is the TASK's message, never the job feed's** (Carl, 20 Sep 2026:
  *"notes land on the task's message, not directly on the activity feed"*).
  Every save that changes anything posts ONE comment on the install task
  itself (`createComment` with `targetType: "task"`), and since 2026-09-21 it
  is the whole record of the save, not only the notes — *"📋 Site checks —
  ticked: Decking inspected · Underlayment and ice & water checked; n/a: Well
  and septic located (city sewer); note on Flashing and penetrations checked
  before covering: reused the step flashing — via Production Board (Tyler
  Mohr)"* — every tick, untick, n/a with its reason, changed value and note
  named in list order, a cleared note as *"note taken off …"*, under BOTH
  comment policies, the moment it arrives. That message is the SOP's
  per-check record (who verified, when, what was found): the comment's own
  author line and timestamp carry the when. The group-finished comment on
  the job feed names ticks only.
  **So send a note once, when it is finished**: this app commits a note when
  its box is left (blur, Enter, or the phone going away — T1.21), never per
  keystroke burst, or a pause mid-sentence would post half of one to the
  task.
- **The line reads DB Cam now**: `20–30 photos in DB Cam (8 from the ground,
  each side)` — the company's own photo app, never CompanyCam. The board reads
  the old wording as the same line and rewrites it on the next save, so a list
  seeded before 20 Sep needs nothing. This app draws `checklist.lines[].label`
  verbatim, so it changes on the next GET.

### Shawn's SOP v1.1: five phases, N/A, two more names, the PM tagged (added 2026-09-21)

The "Roofing Site Manager — Responsibilities & Field Checklist" v1.1 (Shawn,
21 Sep 2026; `design/roofing-site-manager-sop-v1.1.md` on the board) widened
the list. Everything below is additive on the wire, and a screen that draws
from `checklist` picks the shape up on its next GET; what needs a build here
is the yard nudge, the N/A control and the two name fields. **All three are
built in the app**: the yard lines are asked on *Before you roll out* when the
truck leaves the shop (T2.20, every morning of a multi-day roof since T2.24),
and the N/A control and the two name boxes with the crew leader offered came
with T2.25 (29 Oct 2026).

- **Five phases, 40 lines**: `yard` (2) · `before` (12) · `during` (5) ·
  `handover` (8) · `finished` (13). Draw `checklist.phases` in the order
  served; `progress` has five entries now and a `na` count on each. Nothing
  about "three" is safe to assume anywhere.
- **The yard phase belongs beside MARK LOADED.** It is the SOP's 4C
  pre-check — tarps and dry-in supplies on the truck — and Carl's call is that
  it happens at the truck (*"a pre-check at the yard the site manager needs to
  do while/after loading materials for the job, before he rolls out"*). Render
  the two `yard` lines on the warehouse panel next to the Loaded button, and
  when Loaded is ticked with either still open say so in a line ("Tarps and
  dry-in supplies not checked yet") — a nudge, never a block. They stay on the
  site checks rather than the material ladder on purpose: every roofing job
  carries the site checks, while an ABC roof boomed straight on has no
  warehouse half and no Loaded button at all, and on that job the tarps ARE
  the truck load. Save them through this route like any other line.
- **Not applicable** (SOP 8C: every check is Verified, Pending or N/A, and an
  N/A is explained). `state.na` is keyed like `done`; a line in it is SETTLED —
  it counts in `progress[].done` and finishes its group — and never done:
  "Material on site" marked n/a confirms nothing. Mark one by sending
  `na: { key: "reason" }`; a reason is REQUIRED and the board drops an n/a
  without one. `""` clears it. A tick sent for a line this save does not
  also send as n/a clears its old n/a — the person plainly did it; both in
  one save is n/a. Draw an n/a line dashed, with the word N/A and the reason,
  never green. The sign-off cannot be n/a. In JobTread the line reads
  `Well and septic located — n/a: city sewer` and is ticked, so the task's own
  progress can reach the end.
- **Two more names ride their lines**: `coveredBy` on the handover line
  "Covered by:" (SOP 7C — who took the site over, and when you are back:
  "Kenton, back by 3:30"), and `watertightWith` on the finished line
  "Watertight confirmed with:" (SOP 4D/7E — the crew leader who walked the
  roof with the site manager; offer `checks.crewLead` as the default). Send
  either only when you draw it: leaving the field out of the PUT keeps the
  current value, `null` clears, 60 characters. "PM notified" became "PM
  approved the coverage plan" the same day; old lists still read.
- **Every save writes one message on the task** — see the note bullet above.
  It is the SOP's per-check record and lands whatever the burst finished; the
  feed policy (group finished, or a signature) is unchanged.
- **The PM is tagged** on the feed comment when the handing-over group
  finishes or the list is signed or unsigned — JobTread's own notification,
  via `createComment.assignees` (`[{ "membershipId": "…" }]`, flat; verified
  live 21 Sep 2026). Nothing for the phone to do.
- **Ask, for the day log:** `createDailyLog` takes the same `assignees`
  (and `notify` defaults on), so the day log this app already posts (*"Site
  manager's log — … — sent from DB Time Clock"*) should carry the job's PM
  too, which is SOP 8A's "tag the people affected, including the PM" made
  literal. The board resolves the PM's name to an internal membership by
  exact user-name match (`membershipForName` in `src/lib/jobtread/whoami.ts`);
  the same query works from Apps Script, or ask for the id on this payload.
- **Words**: the SOP says "site coordinator" in places; it is the same person
  and the app says **site manager** everywhere (Carl, 21 Sep 2026).
- **The wording round, same afternoon** (Carl): "Homeowner talked to" is
  "Homeowner talked to, or texted if away — …" (SOP 2A), "Weather plan —
  tarps on hand" is "Weather call made with the crew leader — proceed, limit
  or hold, tear-off limit in the group text" (SOP 4A), both still reading
  under their old names; and three lines are new — `prephotos` (pre-job
  photos in DB Cam: property, delivered material, DB stock, sign and trailer
  spot) closing the before phase, `pickup` (trailer or buggy ready for pickup,
  yard told) and `corrections` (roof corrections verified, anything left to
  the PM's punch list with an owner) in the finished phase before the
  watertight line. Labels come off the payload, so nothing to draw by hand.

## The material loaded tick (added 2026-09-19)

**2026-09-21: Pulled and Staged are ONE step** (Carl and Kyle, training
session). The yard walks to the shelf and sets the material down; nobody
records half of that. `PullState.pulled` is deleted on the board, the two
checklist lines became one — `Pulled and staged at: Bay 3` — and `staged` IS
the step. On the wire `warehouse.pulled` REMAINS, mirroring `staged`, so an
older build that reads it cannot be told anything false; **stop reading it**,
and key any state chip off `staged` / `loaded` / `delivered` (T1.23). The
board reads an old-shaped POST forgivingly too — a `pulled: true` with
`staged: false` is honoured as the step done, never dropped.

Carl: *"The crew app should be where the site manager checks off the material
is loaded ready to go to site."* And it is the right place — the person who
knows the material is on the truck is standing beside the truck, not at a desk.

This is the **only** material fact this app records. What was ordered, when the
drop is, whether the yard has pulled and staged it: those stay on the board, where
the office and the yard answer them. One tick here, and it is `loaded`.

**Show the tick only when `warehouse` is non-null.** It is null on a job whose
material goes straight to the roof (ABC booms it on the morning the crew
starts), and a button that records something that never happens is worse than
no button.

`warehouse` is present when the job has a DB inventory pull **or** a supplier
drop routed to the DB warehouse (`toWarehouse: true`). The second is new: an
ABC order that comes to the yard instead of the roof still has to be taken in,
pulled and staged, then loaded, like stock, and `delivered` is the yard
recording that it turned up. Render `words` as-is — it is the same sentence
every board screen says about that job.

`warehouse.words` is one of: `Still on the shelf` · `Pulled and staged` ·
`Staged at Bay 3` · `Pulled, staged and loaded for the crew` · `Not delivered
to the warehouse yet` · `Delivered to the warehouse — not staged yet`. Render
it as it arrives; never re-derive it and never reword it.

### `PUT /api/crew/loaded`

```
PUT /api/crew/loaded
Authorization: Bearer $CREW_APP_SECRET
Content-Type: application/json

{
  "membershipId": "22PLtN4cBYPH",   // resolved server-side here, as for GET
  "jobId":   "22P…",
  "jobLabel": "26-1490 Courtney",   // optional; the toast/comment wording
  "loaded":  true                   // false takes it back off the truck
}
```

| Case | Status | Body |
| --- | --- | --- |
| Written | 200 | `{ "human": "…", "api": […] }` — refetch the assignments to pick up the new `warehouse`. |
| Membership is not a site manager | **403** | `{ "error": "Only a site manager can record the material loaded — ask the office." }` |
| Missing ids, or `loaded` is not a boolean | 400 | `{ "error": "…" }` |
| Wrong or missing bearer token | 401 | as GET |
| JobTread write failed | 502 | `{ "error": "…" }` |

**Same door as the site checks**: the shared secret, then the membership has to
carry JobTread's **"Site Manager"** role (or resolve to a roster crew whose
trade line reads "Site Manager"). Ticking this is saying a thing happened,
which is what a site manager is for — it is not scheduling, and it never
becomes scheduling.

**Loading implies the pulled-and-staged step** (one line since 2026-09-21),
the same rule the board's own popup follows: nobody loads material they never
pulled. The board reads the checklist first and writes on top of it, so the
staged LOCATION somebody in the yard typed is never blanked — which is why
this call takes one boolean and not a state object.

**Where it is written**: the job's "Order materials" task in JobTread, as the
`Loaded for the crew` line of the five-line material checklist —

```
Ordered from ABC Supply            ← derived by the board, off the PO
Drop booked: Sep 22 · job site     ← derived by the board, off the drop date
Delivered to the warehouse         ← only when the drop lands at ours
Pulled and staged at: Bay 3
Loaded for the crew                ← this call
```

The two old lines — `Pulled from DB inventory` and `Staged at: …` — are still
READ by the board, for ever, and never written again. A list in the old shape
is rewritten into the new one by the next write of any kind, or by the hourly
sweep.

The first two are derived and nobody ticks them, here or anywhere. One job
comment is posted per save, naming the actor, like every other board write.

**Loaded is not on site.** It is the last thing OUR side can say; the site
manager's own checklist line — *"Material on site and counted against the
order"* — is what says the material reached the roof, and it stays the only
thing that turns anything green.

### This app's half

`saveMaterialLoaded(me, jobId, jobLabel, loaded)` in `Code.gs`, registered in
`WITH_USER` so `membershipId` is stamped from the verified token and never sent
by the phone. It mirrors `saveSiteChecks`: PUTs to the board, hands back the
board's status and JSON verbatim (never thrown), drops the cached job list on a
200 so the card stops saying "staged at Bay 3" under a load that just landed,
and is NOT gated on `WRITE_ENABLED` — that flag keeps this script's grant key
off payroll, and the checklist is the board's write under the board's own gate.

No offline queue, unlike the checks: a tick here is one fact with no ordering
against anything else, and the honest failure is the button staying as it was
with the reason said out loud. `index.html` draws the button only when
`warehouse` is non-null and never to somebody the board has already said cannot
sign the site checks — it is the same door, so a 403 puts both read-only.

## Bench members see the bench's day (added 2026-09-28)

The construction office books the bench as a UNIT: one `Start Date` task on
the job for the whole crew, no assignee, no crew suffix. Since 27 Sep 2026
the board reads that task as the crew `bench`. Since 28 Sep 2026 **a bench
member's job list carries the bench's visits as well as their own**: when
the membership resolves to a construction employee (`isBenchMember` — the
whiteboard's name plates, Neal included), `GET /api/crew/assignments` returns
every visit booked in their own name PLUS every visit booked on `bench` in the
window. Nothing else about the response changes; such a row's `crew` is still
the signed-in member, and the visit's own `taskId` is the bench's line, so
`PUT /api/crew/checks` and `PUT /api/crew/loaded` against it work as they do
for any other task.

A sub, a roofer, a site manager or a trailer gets only what is booked in their
own name, as before. The board does not expand the bench's stay one row per
member on its own screens — the collapsed bench lane is the concept there —
so a bench member's phone is the one place a Start Date reads as *their* day,
which is the point.

## The bench's pre-start list (added 2026-09-28)

Construction has no site checks — the roofing list rides a crew that roofs.
What the bench has is a **pre-start list**: seven boxes on the job's own
`Start Date` line, tagged `PRE-START ·` in JobTread's checklist, written by
the board when the bench is booked and by the hourly sweep for every bench
start still to come. Each `visits[]` row now carries it, additively:

```jsonc
"prestart": {
  "taskId": "22Pe…",                // the Start Date line the list is ON
  "state": { "done": { "precon": true, "permit": true, "utilities": false, "material": false, "debris": false, "photos": false, "customer": false } },
  "progress": { "done": 2, "total": 7 },
  "words": "Pre-start — 2 of 7 done",   // render as-is
  "lines": [ { "key": "precon", "label": "Pre-con meeting held — scope, selections and access agreed with the customer" }, … ]
}
```

`null` on a roofing visit and on a bench start the sweep has not reached
yet. Draw the seven `lines` from the payload in order — the words live in
one place on the board and a reworded line reaches the phone with no build.
Ticks only: no phases, no N/A, no values on the line.

### `PUT /api/crew/prestart`

Same door as the other routes (`Authorization: Bearer $CREW_APP_SECRET`).
The membership has to be on the construction bench (the whiteboard's name
plates, Neal included) or a site manager as the site checks define one; a
sub, a roofer or a trailer gets a 403 with words to show.

```jsonc
{
  "membershipId": "22PLtNLqScx6",
  "taskId": "22Pe…",              // prestart.taskId from the GET
  "jobId": "22PX…",
  "jobLabel": "26-1040 Agler",
  "done": { "precon": true, "permit": true, "utilities": true, "material": false, "debris": false, "photos": false, "customer": false }
}
```

The WHOLE state every time — a key left out reads as unticked, so send every
key you drew. The response is the board's own write result: `prestart` (the
state as written — adopt it), `previous`, `human`, `api`. Every save with a
change posts one job comment naming what moved (*"📋 Bench pre-start 3 of 7
— ticked Utilities located — via Production Board (Zac Deitemeyer)"*), so
save when the box is left, not per tap. Undo is `previous` posted back.

### This app's half (T2.25, 29 Oct 2026)

`savePrestart(me, taskId, jobId, jobLabel, done)` in `Code.gs`, in
`WITH_USER` like `saveSiteChecks`: `membershipId` stamped from the verified
token, the board's status and JSON handed back verbatim (never thrown), the
cached job list dropped on a 200 so the card reads the board's new words. The
phone shows the list on a job that has no site checks, ticks only, in the
payload's order and words; taps stay on the phone and the whole state is sent
once, when the list is left or after a minute and a half of nothing, which is
what keeps the job feed to one comment per visit to the list. A 403 makes the
list read-only with the board's words; offline or a 5xx keeps the ticks and
retries on the next open.

`taskName` is read off each visit for the stage words: a name starting
*Rough-in* or *Finishes* (the construction template's lines, the board's
`isRoughInLine` / `isFinishesLine`) is said on the card — *You’re here ·
Rough-in · week 2 of 3*. Any other name says nothing extra. Over ten days on
site the card counts weeks (five working days from the visit's own first day)
instead of days.
