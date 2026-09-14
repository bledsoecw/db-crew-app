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
      "material": { "text": "Material ordered ✓", "cls": "good" }
    }
  ],
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

## Scope boundary

This app reads **only** Install tasks `22Pc9WLVvBn3`. DB CheckOut
(`closeout.deitemeyerbrothers.com`) reads **only** Punch List `22PLePTbJVrQ`.
Install tasks are invisible to CheckOut by design and punch tasks stay invisible
here. Crew App = the working day; CheckOut = closing the job out.
