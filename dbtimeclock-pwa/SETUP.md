# DB Time Clock — installable PWA setup (one-time, ~15 min)

Same shape as DB Cam Mobile, so most of this will look familiar. The Apps
Script project is the API and holds the JobTread grant key; the PWA is static
files on Firebase Hosting.

> **Before you start.** This org's time clock is live — 5,831 real entries,
> people on the clock right now, and these records are payroll. The app ships
> with `WRITE_ENABLED` off: everything reads, nothing posts. Leave it off until
> you have watched it read correctly on a real phone.

## 1. Apps Script (the API)

1. script.google.com > New project > paste `apps-script/Code.gs` as `Code.gs`.
2. Deploy > **New deployment** > Web app > Execute as: **Me** > Who has access:
   **Anyone**.
   (Yes, "Anyone" — every request is rejected unless it carries a verified
   `@deitemeyerbrothers.com` Google sign-in token. The grant key never leaves
   the script.)
3. Copy the `/exec` URL.

## 2. Firebase project

1. console.firebase.google.com > Add project (e.g. `db-time-clock`), Analytics off.
2. Note the project id; the app will live at `https://<project-id>.web.app`.
3. Put that id in `.firebaserc` (it currently says `db-time-clock`).

## 3. OAuth client (sign-in)

1. console.cloud.google.com > select the SAME project > APIs & Services >
   OAuth consent screen > User type **Internal** > App name "DB Time Clock".
2. Credentials > Create Credentials > **OAuth client ID** > Web application.
   Authorized JavaScript origins: `https://<project-id>.web.app` and
   `https://<project-id>.firebaseapp.com`.
3. Copy the Client ID (ends in `.apps.googleusercontent.com`).

## 4. Wire the pieces

Create `public/config.js` from the template — it is git-ignored, so it is yours
alone and no branch switch, pull or merge can disturb it:

```
Copy-Item config.example.js public\config.js
```

Then fill in the two values that matter:

```js
window.DBTC_CONFIG = {
  apiUrl:   'https://script.google.com/macros/s/.../exec',
  clientId: '....apps.googleusercontent.com'
};
```

In Apps Script > Project Settings > **Script Properties**:

| Property | Value |
| --- | --- |
| `GRANT_KEY` | the JobTread Pave grant key — the same one DB Cam Mobile uses |
| `OAUTH_CLIENT_ID` | the client id from step 3 |
| `SESSION_SECRET` | a long random string (`openssl rand -hex 32`). Signs the 30-day app session so the crew isn't re-prompted every hour. Rotating it invalidates every session immediately. |
| `SESSION_TTL_DAYS` | optional, defaults to 30 |
| `APP_URL` | optional, `https://<project-id>.web.app` — makes the bare `/exec` link redirect to the app |
| `WRITE_ENABLED` | **leave unset until you are ready.** `true` lets the app post time entries, photos and notes to JobTread. |
| `WRITE_JOB_ALLOWLIST` | optional, a comma-separated list of job ids. While set, writes are refused for any other job — useful for a contained first test. |
| `BOARD_API_URL` | for the My jobs tab — the Production Board origin, e.g. `https://ops.deitemeyerbrothers.com`. Leave unset and the tab falls back to recent jobs (see 4c). |
| `CREW_APP_SECRET` | for the My jobs tab — the shared secret the board checks. Same value on both sides. |
| `FCM_PROJECT_ID` | for push — the Firebase project id (see 4b) |
| `FCM_SERVICE_ACCOUNT` | for push — the service account JSON key, pasted whole |
| `PUSH_ENABLED` | for push — `true` to actually send |
| `ACCESS_FEED_URL` | optional — DB Hub's access feed (the access-"Anyone" hub deployment's `/exec` URL; `?accessfeed=1` in the hub prints it). With it set, the hub's **App access** panel controls who may use the clock: blank = JobTread membership decides (as before), `Manager` also unlocks the crew block, `Off` blocks the person. Unset or unreachable = everything works as before. **Then run `installAccessFeedRefresh` once in the Apps Script editor** — a trigger refreshes the feed every 5 minutes and the API only ever reads that copy. Without the trigger the gate has no opinion (everyone JobTread admits gets in), and it is never fetched while a phone waits: the hub is another Apps Script, and fetching it inline on a cold cache is what put the clock past its 25-second boot ceiling on every reopen. |
| `ACCESS_FEED_KEY` | the feed key `?accessfeed=1` prints (skip if the key is already baked into `ACCESS_FEED_URL`) |

### Keep a copy of config.js outside the repo

`public/config.js` is git-ignored, so git will not touch it. But a Firebase
Hosting deploy **replaces the entire site**, so if that file is ever missing or
blank when you deploy, the live app loses its settings and every phone lands on
*"config.js is not filled in yet"*.

Worse, it does not look broken straight away: config.js sits in the service
worker's cached shell and the fetch handler is cache-first, so phones keep
serving the last good copy for hours. The outage surfaces long after the deploy
that caused it, with a working app in between.

So keep a copy somewhere outside the repo:

```
curl.exe -s https://db-time-clock.web.app/config.js -o C:\dev\config-live-backup.js
```

`check-config.mjs` runs as a Firebase **predeploy** hook and refuses the deploy
if `public/config.js` is missing, if `apiUrl` or `clientId` is empty, or if
`apiUrl` is not an Apps Script `/exec` URL. It prints the command to fix
whichever case it hit.

## 4b. Push notifications — the nudge that reaches a pocketed phone

Without this, the 5-minute reminder only fires while the app is open. With it,
it reaches a phone asleep in a pocket.

**Delivery, honestly:** Android is reliable. iPhone works on **iOS 16.4+ and
only when the app is installed to the Home Screen** — a Safari tab gets
nothing. That makes step 6 below load-bearing, not optional. The app detects
this case and says "Add to Home Screen to get photo reminders" rather than
failing silently.

*(Why FCM and not raw Web Push: VAPID needs ES256 signing and Apps Script has
no ECDSA. It does have `computeRsaSha256Signature`, so it can mint a
service-account token and call FCM HTTP v1 — the whole stack stays in Apps
Script, no Cloud Functions and no Blaze plan.)*

1. Firebase console > Project settings > **Cloud Messaging** > Web Push
   certificates > **Generate key pair**. Copy the public key — that is the
   `vapidKey`.
2. Project settings > **General** > your web app > Config. Copy `apiKey`,
   `projectId`, `messagingSenderId`, `appId` into `public/config.js`:

   ```js
   firebase: { apiKey: '…', projectId: '…', messagingSenderId: '…', appId: '…' },
   vapidKey: '…'
   ```

3. Project settings > **Service accounts** > Generate new private key. That
   downloads a JSON file. Paste its **entire contents** into a Script Property
   named `FCM_SERVICE_ACCOUNT`, and the project id into `FCM_PROJECT_ID`.
4. Set `PUSH_ENABLED` to `true`.
5. In the Apps Script editor, run **`installNudgeTrigger`** once. It creates a
   time-driven trigger that runs `sweepBeforePhotoNudges` every 5 minutes.
   (Authorize it when prompted.) `removeNudgeTrigger` undoes it.
6. Test the chain: open the app on your phone, clock in, allow notifications
   when asked. Then run **`testPushToMe`** from the editor — it pushes to your
   own device, ignoring grace periods. If it lands on your lock screen, you're
   done.

**How the sweep decides.** Every 5 minutes it asks JobTread for open time
entries, and for photos whose description contains `#TE:<timeEntryId>` — the
app stamps that onto every capture, so the server never has to trust the
client about whether the photo owed for a given block of time exists. An entry
older than the grace period with no matching before photo gets one push, once,
ever. The marker is cleared when the entry closes.

Two Pave calls per sweep regardless of crew size, so this stays well inside
Apps Script's quota at a 5-minute cadence.

**Keep the grace periods in step.** `PUSH_GRACE_MINUTES` in `Code.gs` and
`BEFORE_GRACE_SEC` in `index.html` should agree, or the in-app prompt and the
push will disagree about when the clock started ticking.

## 4c. Assigned jobs — connecting the Production Board

Without this the **My jobs** tab still works; it shows the jobs you have
recently clocked into and says the board is not connected. With it, the tab
shows the Install visits the office actually scheduled for your crew.

This is a **read-only** connection. Nothing this app sends can change the board.

1. Generate one secret and use the same value in both places:

   ```
   openssl rand -hex 32
   ```

2. In the Production Board's Vercel project: **Settings > Environment
   Variables**, add `CREW_APP_SECRET` with that value, and redeploy. (The route
   refuses to run when the variable is unset, rather than standing open.)
3. In Apps Script > Project Settings > Script Properties, add the same
   `CREW_APP_SECRET`, plus `BOARD_API_URL` set to the board's origin with no
   trailing path — `https://ops.deitemeyerbrothers.com`.
4. Open the app, go to **My jobs**, tap refresh. A crew with work booked shows
   its visits; the header shows the crew name rather than yours.

**If the tab says "Could not reach the production board":**

| What you see | Usually means |
| --- | --- |
| Not connected yet | `BOARD_API_URL` or `CREW_APP_SECRET` is unset in Script Properties |
| Could not reach it | the board is down, or the URL has a typo or a trailing path |
| No crew is linked to your account | your Google account resolves to a JobTread membership that no crew in the board's roster lists as its lead — the office fixes this in the board's Operations tab |

A 307 answer means `api/crew` is missing from the matcher exclusion in the
board's `src/proxy.ts` — Apps Script sends no cookie, so the sign-in bounce
catches the call. The app reports that case separately rather than calling it
unreachable.

The full request and response shape is in `../CREW-ASSIGNMENTS-API.md`.

## 5. Publish

From `dbtimeclock-pwa/` (needs Node):

```
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
firebase deploy --only hosting
```

## 6. Install on phones

Open `https://<project-id>.web.app`, sign in with the work Google account, then
**Install app** (Android) or Share > **Add to Home Screen** (iPhone). Real icon,
full screen, and the camera asks for permission like a normal app.

## Going live with writes

1. Set `WRITE_JOB_ALLOWLIST` to one job id you don't mind touching — the
   `250011 DB INTERNAL` job already has an "Uncategorized Clock In" cost item
   and is the natural candidate.
2. Set `WRITE_ENABLED` to `true`, publish a new deployment version.
3. Clock in, switch a code, clock out on that job. Check the entries in
   JobTread and delete them.
4. Clear `WRITE_JOB_ALLOWLIST`. The app is live.

The read-only state is visible in the app itself — a navy bar reading
"READ-ONLY BUILD · HOURS ARE NOT POSTING YET" sits under the header, so nobody
can mistake a test build for the real thing.

## Updating later

New builds are new files in `public/`. Run `firebase deploy --only hosting`.
Bump `CACHE` in `public/sw.js` when you change the shell, or phones will keep
serving the old one. For server changes, publish a new Apps Script deployment
**version** on the SAME deployment so the `/exec` URL stays stable.

## Previewing without JobTread

`dev/` holds a mock harness that fakes sign-in and the API so every screen can
be opened locally. Nothing in `dev/` deploys — Firebase only publishes `public/`.

```
cd public && python3 -m http.server 8100     # in one shell
node dev/preview.mjs ./shots                 # in another (needs playwright)
node dev/push-test.mjs                       # exercises the push paths
node ../apps-script/code-test.mjs            # getMyJobs, no deps, no network
```

`push-test.mjs` fakes the browser push stack and the Firebase SDK, then checks
each branch: permission granted registers a token with the right VAPID key,
denied and unconfigured stay silent, an iPhone in a Safari tab reports
`needs-install`, and the `#TE:` description tag matches the regex the server
sweep uses.

The mock takes flags on `window`, set before the page loads, to reach the states
that are otherwise hard to produce:

| Flag | State |
| --- | --- |
| `__MOCK_FOREMAN` | the foreman crew block |
| `__MOCK_READONLY` | the navy READ-ONLY BUILD bar |
| `__MOCK_NOBOARD` | My jobs with the board unreachable — the fallback list |
| `__MOCK_NOCREW` | My jobs with the board up but no crew linked to the account |

The last two matter more than they look: the fallback is what a crew member sees
on the morning the board is down, and it is the path that proves the clock is
not blocked by it.
