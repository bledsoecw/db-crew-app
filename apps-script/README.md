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

Required Script Properties are listed in `../dbtimeclock-pwa/SETUP.md`.
`WRITE_ENABLED` is the important one — it defaults to off, and the app cannot
post anything to JobTread until you turn it on. `PUSH_ENABLED` plus
`installNudgeTrigger` turn on the notification sweep.
