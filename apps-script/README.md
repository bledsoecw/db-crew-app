# Apps Script backend (DB Time Clock)

Source of truth on the git side for the Apps Script project that powers
`dbtimeclock-pwa`'s API. The live copy lives at script.google.com and only
changes when someone pushes to it — same arrangement as DB Cam Mobile.

Copy `.clasp.json.example` to `.clasp.json` and fill in the script id, then:

```
npm install -g @google/clasp
clasp login
clasp push          # uploads Code.gs and appsscript.json
```

(Enable the Apps Script API once for that account at
https://script.google.com/home/usersettings.)

Or paste `Code.gs` into the editor by hand.

Either way, after a code change: **Deploy > Manage deployments > edit the
existing deployment > new version**, so the `/exec` URL the app is pointed at
stays stable.

## Tests

```
node code-test.mjs      # 150 assertions, no dependencies, no network
```

Covers `getMyJobs` and `saveSiteChecks` — the functions here that depend on
the Production Board — plus the sign-in allow-list, the membership lookup, the
daily log (`sendDailyLog`, `addDailyLogNote`, the PM-assigned note) and the
schedule sweep (`sweepSchedulePushes`), with JobTread and FCM stubbed by URL.
Code.gs is evaluated in a `vm` context with stubbed Apps Script services, so
every branch the Production Board can put it in (unconfigured, 502, a 307
sign-in bounce, a thrown request, an absurd date range) is reachable without a
board to point at. The rule it exists to protect: **a board problem must never
reach the clock.**

Required Script Properties are listed in `../dbtimeclock-pwa/SETUP.md`.
`WRITE_ENABLED` is the important one — it defaults to off, and the app cannot
post anything to JobTread until you turn it on. `PUSH_ENABLED` plus
`installNudgeTrigger` turn on the notification sweep. If `ACCESS_FEED_URL` is set,
`installAccessFeedRefresh` keeps DB Hub's access feed warm — required, or the gate
has no opinion; `removeAccessFeedRefresh` undoes it.
