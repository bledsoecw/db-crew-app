# JobTread facts, verified live against the Deitemeyer Brothers org

Everything here was read from the live Pave API on 2026-07-28, not inferred.
Read-only queries only — nothing was created, updated or deleted.

The **Schedule** section was corrected on 2026-09-14 from the Production Board's
source (`src/lib/jobtread/schedule.ts`, `src/lib/crews.ts`) rather than from a
fresh Pave read — provenance noted so the difference is visible.

## The headline

**The crew already clocks in through JobTread today.** The org has 5,831 time
entries and 18 people were on the clock while I was looking. This app is not
introducing a time clock; it is putting a better face on the one that exists,
and it has to interoperate with that data exactly.

## Identifiers

| Thing | Value |
| --- | --- |
| Organization id | `22PBAjem8SSC` ("Deitemeyer Brothers") |
| Pave endpoint | `https://api.jobtread.com/pave` |
| Grant key | Script Property `GRANT_KEY` — same one DB Cam Mobile uses |

## Time entries

`createTimeEntry` accepts:

```
organizationId, jobId, userId, costItemId,
startedAt, endedAt, type, notes,
startCoordinates, endCoordinates, isApproved
```

A `timeEntry` reads back as: `id, type, startedAt, endedAt, minutes, notes,
cost, hourlyRate, isApproved, user, job, costItem, organization,
startCoordinates, endCoordinates`.

**Clocked in is represented as an open entry: `endedAt: null`.** `minutes`
counts up on its own. So:

- clock in → `createTimeEntry` with `startedAt: now`, no `endedAt`
- clock out → `updateTimeEntry` setting `endedAt: now`
- switch code → close the open entry, then create the next one

Find who is on the clock with `where: ["endedAt", null]` — this works and is
cheap.

`type` is a free string; the values in real use are **`Standard`** for worked
time and **`PTO`**. Everything this app writes is `Standard`.

## Operators — a trap worth writing down

Pave's comparison operators are the **symbols**, not names. `{ gte: [...] }` is
rejected outright with a list of valid operators; it wants `{ '>=': [...] }`.
Same for `<=`, `<`, `>`, `=`, `!=`. Equality against a field path is the short
form `[['user','id'], userId]`, and null is `['endedAt', null]`.

This bit the first version of `getMyDay` — worth checking any new `where`
clause against the live API before trusting it.

## Cost codes — the important correction

There is no flat global code list. A crew member clocks into a **cost item on
the job**, and each cost item carries a `costCode` with a `number` and `name`:

```
costItem { id, name, costType { name }, costCode { number, name, fullName } }
```

Real cost codes look like `01GR`, `01GR-1`, `02ST-1`, `02ST-5`, `04MA`,
`99TM-6` — CSI-style, not the `210 / 240` in the prototype.

Two filters matter, because a real job carries far too many items to show:

1. **`costType.name === 'Labor'`.** Materials and Other are not clock-in-able.
   On the sample job that cut 220 items to 77.
2. **Job-level items only** — the ones with `document: null` and
   `jobCostItem: null`. The remaining 77 are mostly the same ten lines
   duplicated once per estimate and change order. Deduping to job-level items
   gets a real job down to about ten. **`document` is not queryable in a
   `where` clause**, so select the field and filter in code.

A real job's Labor lines, for shape: Project Management (C), Sales On-Site
Support, Equipment Operation, Site Prep Labor, Demolition, Hauling & Disposal,
Hand Excavation, Crew Labor, Masonry Labor, Final Clean.

## People — the field is `emailAddress`, not `email`

**Corrected 2026-09-14 against the live API.** The query written here before was
wrong and had never worked:

```
organization.memberships
  $: { where: [['user','emailAddress'], email], size: 1 }
  nodes { id, role { name }, user { id, name } }
```

`['user','email']` does not exist. Pave does not return an empty result for it —
it **rejects the whole query**:

```
The field "email" does not exist at "membership"."user"
```

`memberFor_` wraps that call in a `try/catch` that falls through, so the thrown
error became `userId === ''` and every single sign-in died on *"No JobTread user
is linked to &lt;you&gt;. Ask the office to add you to the organization."* — a
message that blames the org for a typo in the query. Nobody could use the app.

The selectable field is `user.emailAddress`; there is no `user.email` to select
or to filter on. `emailAddress` works in both positions.

`user.id` is what `createTimeEntry.userId` wants; `membership.id` is what comment
assignees and the Production Board's `Crew.leadMembershipId` want.
`currentGrant.user` exposes neither address.

JobTread keeps the address as it was typed, so a capital letter in there misses
an exact match against the lowercased token email. `memberFor_` tries `=` and
then `like` (case-insensitive) — the same two tries as the board's
`membershipForEmail` (2026-09-15). Two of the three site managers' JobTread
users are on Gmail (`tylermohr94@gmail.com`, `kentonmccomas@gmail.com`,
verified live); those addresses are on the sign-in allow-list in `Code.gs`.

**If DB Cam Mobile was copied from the same source, check it for the same line.**

## Photos

Unchanged from DB Cam Mobile, and already proven in production:

```
createUploadRequest { organizationId, type, size } -> { id, url, method, headers }
   -> client PUTs the blob straight to the signed URL
createFile { uploadRequestId, targetType: 'job', targetId: jobId, name, folder }
```

`file.description` supports `like` in a `where` clause, which is what makes the
push sweep possible: captures are stamped `#BEFORE #TE:<timeEntryId>` and the
server greps for that instead of trusting the client.

## Schedule

**Corrected 2026-09-14. The note that used to be here was written two weeks too
early and sent the next reader down a dead end — it is kept below so the same
sampling isn't repeated.**

> ~~There is a `tasks` collection (2,314 of them) but the ones I sampled had null
> `startDate`/`endDate`, so it is not a reliable source for "today's job"
> without more digging.~~

The schedule is the **Production Board** (`bledsoecw/DB_Production_Board`,
`ops.deitemeyerbrothers.com`). Since its spreadsheet migration on **2026-08-10**
it writes real Install tasks:

| Field | Value |
| --- | --- |
| `taskType` | Install `22Pc9WLVvBn3` |
| `name` | `Install — {crew name}` |
| `startDate` / `endDate` | real dates, inclusive |
| `description` | the office's note to the crew on that visit |
| `assignedMembershipIds` | the crew lead's membership |

The nulls sampled on 2026-07-28 were the *pre-migration* tasks, which are still
in the collection. Those two weeks are the whole explanation.

**Do not resolve crews from task names here.** The board matches a task's name
suffix against its saved roster **and that crew's aliases** — renaming a crew in
the board's Operations tab auto-keeps the old name so existing tasks don't come
loose — and the roster lives in a private Vercel Blob that Apps Script cannot
read. A first-name match would work until the first rename and then quietly stop
finding jobs. The board resolves, this app asks: see `CREW-ASSIGNMENTS-API.md`.

The join needs nothing added to either data model. `memberFor_(email).membershipId`
here is the same JobTread `membership.id` the board stores as `Crew.leadMembershipId`.

`getJobOptions` — recent time entries, GPS proximity, a remembered last job — is
**kept as the fallback**, not replaced. The clock is payroll and cannot be
blocked by the board being down.

## Site checks

**Added 2026-09-15, from the Production Board's source** (`src/lib/install-checks.ts`,
`src/lib/jobtread/install-check-writes.ts`), not from a fresh Pave read.

The site manager's paper "Roofing Checklist" lives as a JobTread **checklist**
(`task.subtasks`, `{ name, isComplete }` and nothing else — no author, no
timestamp; capped at 50 per task) on the job's roofing install task. One list
per job, on the install line — usually the roofing crew's task, not the site
manager's own "Install — Tyler" visit. `subtasks` REPLACES on `updateTask`, so
the board always writes the whole list and carries the office's own items
across untouched. The two values the sheet asks for ride the line's name
("FINISHED · Magnet run, lawn and beds — by: Kenton", "FINISHED · Signed off:
Tyler · Sep 15"); the sign-off is stamped by the board from the signed-in
membership and never from typed text.

**This app never touches any of that.** It reads the list off
`GET /api/crew/assignments` (`checks`, `checklist`) and writes ticks with
`PUT /api/crew/checks`, both on the board, through `saveSiteChecks` in
`Code.gs`. Who may tick is the JobTread role **Site Manager** on the
membership; the board answers 403 for anyone else. See `CREW-ASSIGNMENTS-API.md`.
