# `GET /api/crew/assignments` — the contract between this app and the Production Board

Two repos build to this file. The board (`bledsoecw/DB_Production_Board`, default
branch `claude/db-production-board-pkk0he`, which **is** production) serves it;
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

      // joined from BoardJob
      "cust":    "Noah Webster",
      "city":    "Van Wert",
      "address": "408 Euclid Ave, Van Wert, OH 45891, USA",
      "status":  "Production",
      "jtype":   "Foundation",

      // materialWords(job, visit)
      "material": { "text": "Material ordered ✓", "cls": "good" },

      // the JOB's site checks — see "Site checks" below. null when the job
      // has none. Added 2026-09-15; additive, so an app built to the earlier
      // contract ignores it.
      "checks": {
        "taskId": "22P…",                      // the task the list is ON — NOT this visit's
        "state": { "done": { "address": true, "…": false }, "magnetBy": null, "signedOff": null },
        "progress": [
          { "phase": "before",   "label": "Before the tear-off",             "done": 1, "total": 11 },
          { "phase": "handover", "label": "Before the site manager leaves",  "done": 0, "total": 7 },
          { "phase": "finished", "label": "Before the crew leaves for good", "done": 0, "total": 10 }
        ],
        "words": "Before tear-off — 1 of 11 done"
      }
    }
  ],

  // how to DRAW any visits[].checks — once per response, see "Site checks"
  "checklist": {
    "phases": [
      { "key": "before",   "label": "Before the tear-off",             "tag": null,           "when": "the morning the crew starts" },
      { "key": "handover", "label": "Before the site manager leaves",  "tag": "HANDING OVER", "when": "only if you leave before the crew does" },
      { "key": "finished", "label": "Before the crew leaves for good", "tag": "FINISHED",     "when": "the last day" }
    ],
    "lines": [
      { "key": "address",  "phase": "before",   "label": "Right address, right roof" },
      { "key": "…",        "phase": "…",        "label": "…" },
      { "key": "magnet",   "phase": "finished", "label": "Magnet run, lawn and beds — by:", "value": "magnetBy" },
      { "key": "signoff",  "phase": "finished", "label": "Signed off:",                     "value": "signedOff" }
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
words, so "Material ordered ✓ / Pull from shop / PART ORDER — check first" stays
defined in one place.

`days` is *m*. Day *n* of *m* is computed in this app from `start` vs today —
the board must **not** expand one row per calendar day. A three-day install is
one visit.

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
("Yesterday's roof at Courtney isn't signed off") has data; `checks` and
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

## Scope boundary

This app reads **only** Install tasks `22Pc9WLVvBn3`. DB CheckOut
(`closeout.deitemeyerbrothers.com`) reads **only** Punch List `22PLePTbJVrQ`.
Install tasks are invisible to CheckOut by design and punch tasks stay invisible
here. Crew App = the working day; CheckOut = closing the job out.

## Site checks (added 2026-09-15)

The site manager's paper checklist ("Roofing Checklist" in the packet) now lives
as a JobTread checklist on the job's roofing install task — the board's
`src/lib/install-checks.ts` is the single home of the 28 lines, the three
phases and the words. The board seeds it when a roofing crew is booked and
sweeps hourly for any it missed; JobTread derives the task's progress from it.

**It rides ONE task per job, and that task is usually not the site manager's
own visit.** Tyler is booked as "Install — Tyler"; the list is on "Roof install
— Platinum …". So `checks` on a visit is the JOB's list, and `checks.taskId` is
the task to write to. `null` means the job has no list (a construction or
gutter visit, or a roofing install booked before the list existed and not yet
swept — the sweep runs hourly).

**Draw the list from `checklist`, never from wording of your own.** `phases`
and `lines` are the board's `PHASES` and `CHECK_LINES` verbatim — 28 lines,
in the order a person reads them (order IS the grouping), each with the
`phase` it belongs to. The two lines with a `value` carry an answer after
their label: `magnetBy` is free text the phone may send; `signedOff` is
written by the board only. A line's `label` is what the site manager reads;
the phase's `tag` is what JobTread's own checklist prefixes the later phases
with, and the app need not show it.

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
    "signOff": true                                    // sign it (false takes a signature off)
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

Every save posts one job comment naming what changed ("📋 Site checks: signed
off by Tyler — via Production Board (Tyler Mohr)"), like every other board
write. Ticking inside JobTread's own app writes no comment and records no
author — the board's route is what makes the tap a signature.
