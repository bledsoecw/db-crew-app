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

In `public/config.js` — this file is deliberately separate from `index.html`
so app updates never clobber your settings:

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
| `FCM_PROJECT_ID` | for push — the Firebase project id (see 4b) |
| `FCM_SERVICE_ACCOUNT` | for push — the service account JSON key, pasted whole |
| `PUSH_ENABLED` | for push — `true` to actually send |

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
```

`push-test.mjs` fakes the browser push stack and the Firebase SDK, then checks
each branch: permission granted registers a token with the right VAPID key,
denied and unconfigured stay silent, an iPhone in a Safari tab reports
`needs-install`, and the `#TE:` description tag matches the regex the server
sweep uses.
