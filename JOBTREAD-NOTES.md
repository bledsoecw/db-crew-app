# JobTread facts, verified live against the Deitemeyer Brothers org

Everything here was read from the live Pave API on 2026-07-28, not inferred.
Read-only queries only — nothing was created, updated or deleted.

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

## People

Google email → JobTread user, the same way DB Cam Mobile does it:

```
organization.memberships
  $: { where: [['user','email'], email], size: 1 }
  nodes { id, user { id, name } }
```

`user.id` is what `createTimeEntry.userId` wants; `membership.id` is what
comment assignees want. Note `currentGrant.user` has no `email` field.

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

There is a `tasks` collection (2,314 of them) but the ones I sampled had null
`startDate`/`endDate`, so it is not a reliable source for "today's job" without
more digging. This app resolves the job the way DB Cam Mobile does instead:
recent jobs the user has clocked into, plus GPS proximity, plus a remembered
last job — and the crew member can always pick.
