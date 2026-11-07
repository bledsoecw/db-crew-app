# DB Crew — installable PWA setup (one-time, ~15 min)

(The Firebase project and the Apps Script still carry the DB Time Clock name from before T2.0; nothing here depends on renaming them.)

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
   Google sign-in token for an `@deitemeyerbrothers.com` account or one of the
   few explicitly allow-listed addresses. The grant key never leaves the
   script.)
3. Copy the `/exec` URL.

## 2. Firebase project

1. console.firebase.google.com > Add project (e.g. `db-time-clock`), Analytics off.
2. Note the project id and put it in `.firebaserc` (it says `db-time-clock`).
3. The app lives on a Hosting SITE inside the project, named in `firebase.json`
   (`"site": "db-crews"` → `https://db-crews.web.app`). A project's own
   `<project-id>.web.app` site cannot be renamed, which is why DB Crew is a
   second site in the DB Time Clock project rather than a new project: push
   notifications belong to the project and keep working across the move.
   The project's own site, `db-time-clock.web.app`, is a second entry in
   `firebase.json` that serves only a redirect to the new address (the
   `redirect/` folder), so an old link or icon lands on the real app;
   `firebase deploy --only hosting` deploys both sites every time.

## 3. OAuth client (sign-in)

1. console.cloud.google.com > the sign-in project > Google Auth Platform
   (APIs & Services > OAuth consent screen on older screens) > App name
   "DB Time Clock". **The live sign-in client is not in the Firebase
   project.** It is in its own Google Cloud project, "DB Time Clock"
   (`db-time-clock-503815`, number 1079373004925 — a client ID starts with
   its project's number), while the Firebase project `db-time-clock` (number
   78821137181, the Firebase config's `messagingSenderId`) has no sign-in
   screen at all (found 7 Nov 2026). carlbledsoe@deitemeyerbrothers.com
   opens the sign-in project and is refused on the Firebase one; operations@
   (the Firebase CLI's account) opens the Firebase one. A fresh setup can
   keep both in one project.
   **User type: Internal** — it read Internal on 7 Nov 2026, after Carl
   followed the steps to make it so (until then this step asked for
   External). Only @deitemeyerbrothers.com accounts can sign in: Google
   refuses a personal Gmail before the API sees it, which ends T2.43's
   personal-address way in. Every crew member has a company account (6 Nov
   2026). A company account JobTread does not have is found through DB Hub's
   link to their JobTread user (T2.44); someone DB Hub still has under a
   personal address needs their company account in its **Company Account**
   column (DB Hub v1.38), or the API finds no JobTread user for them. Lexi
   and Drew, part-time summer help, were left without one for now (Carl,
   7 Nov 2026). **Make external** on the same page undoes it; External then
   needs the app published, or every personal address has to be a test user.
   Either way the API still rejects every address that is not on the company
   domain, on its explicit allow-list, or an internal JobTread membership.
2. Credentials > Create Credentials > **OAuth client ID** > Web application.
   Authorized JavaScript origins: `https://db-crews.web.app` and
   `https://db-crews.firebaseapp.com` (every site the app is served from —
   Google refuses the sign-in button from an origin not on this list).
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
| `SIGNIN_MAX_DAYS` | optional, defaults to 365 (T2.41, audit D39; Carl: *"As long as possible 90+"*, then *"1 year"*). A session renews itself for at most this many days after the last real Google sign-in; after that the phone asks for Google again, once. Every renewal also re-checks the allow-list and DB Hub, so **taking somebody off** is DB Hub's App access set to `Off` (or a left status) — their next renewal, within 30 days, is refused — and rotating `SESSION_SECRET` signs **everybody** out at once. |
| `APP_URL` | optional, `https://db-crews.web.app` — makes the bare `/exec` link redirect to the app, and is where a tapped push notification opens |
| `WRITE_ENABLED` | **leave unset until you are ready.** `true` lets the app post time entries, photos and notes to JobTread. |
| `WRITE_JOB_ALLOWLIST` | optional, a comma-separated list of job ids. While set, writes are refused for any other job — useful for a contained first test. |
| `SAFETY_ALERT_TO` | for the safety alert — comma-separated addresses the alert is texted to the second it is sent: an email address, or a carrier's SMS gateway address (`4195551234@vtext.com`). See "Safety alerts" under 4c. The JobTread comment assigned to the PM goes either way. |
| `DAILY_LOG_PING_FIELDS` | optional. A regular expression matched against the names of JobTread's daily-log fields; a filled one pings the PM and sales in the feed, like a problem. Default `safety|incident|delay|material`; a yes/no field pings only on Yes. If you set this property, add `material` to it too (T2.29). |
| `BOARD_API_URL` | for the My jobs tab — the Production Board origin, e.g. `https://ops.deitemeyerbrothers.com`. Leave unset and the tab falls back to recent jobs (see 4c). |
| `CREW_APP_SECRET` | for the My jobs tab and the site checks — the shared secret the board checks. Same value on both sides. |
| `CLOSEOUT_API_URL` | for the Close Out tab (T2.0) — the DB CheckOut server's origin, `https://closeout.deitemeyerbrothers.com`. Unset and the tab says it is not connected yet; the clock is untouched. |
| `CLOSEOUT_SECRET` | the same value as that server's `CREW_APP_SECRET` env var on Vercel (`openssl rand -hex 24`, set it on both sides). The script forwards each Close Out call with it plus who is asking. |
| `ROLES_JSON`, `PEOPLE_JSON` | written by the app itself from the Operations account's People tab. Never edit by hand. Since T2.3 the level lives in DB Hub and `ROLES_JSON` is only the fallback for a person the hub has no row for; deleting it puts those people back on the defaults. |
| `EXTRA_ALLOWED_EMAILS` | optional — comma-separated Google addresses let through the sign-in beside the company domain, without a code change. The two site managers on Gmail are already in `SITE_MANAGER_EMAILS` in `Code.gs`; this is for the next one. It is an explicit list, never a domain. |
| `FCM_PROJECT_ID` | for push — the Firebase project id, `db-time-clock` (see 4b). With it alone the script sends on its own sign-in. |
| `FCM_SERVICE_ACCOUNT` | optional — a service account JSON key, pasted whole, for an organization that allows keys. Deitemeyer's does not; leave it unset (see 4b). |
| `PUSH_ENABLED` | for push — `true` to actually send. Gates every push the triggers send (the photo nudge, the evening push, the break reminders, the schedule and Close Out pushes); `testPushToMe` ignores it. On since 2 Nov 2026; before that it had never been set, so no push had been sent (see 4b). |
| `ACCESS_FEED_URL` | optional — DB Hub's access feed (the access-"Anyone" hub deployment's `/exec` URL; `?accessfeed=1` in the hub prints it). With it set, the hub's **App access** panel is the store for who may use the clock and as what: blank = the app's own defaults, `Crew` / `Site Manager` / `Service` = that role, `Manager` = crew plus the crew block, `Off` blocks the person. The People tab writes its choices back through the hub with this same URL and key (the hub's `doPost` on the feed deployment, v1.29 or later), so nothing extra is needed for that. Unset or unreachable = roles can only be set in the hub's panel, and the clock itself works as before. **Then run `installAccessFeedRefresh` once in the Apps Script editor** — a trigger refreshes the feed every 5 minutes and the API only ever reads that copy. Without the trigger the gate has no opinion (everyone JobTread admits gets in), and it is never fetched while a phone waits: the hub is another Apps Script, and fetching it inline on a cold cache is what put the clock past its 25-second boot ceiling on every reopen. Since T2.44 the feed is also how a company account JobTread does not have finds its JobTread user (DB Hub's JT User ID column, sent as `jt` from DB Hub v1.37): without it set, such an account cannot sign in. |
| `ACCESS_FEED_KEY` | the feed key `?accessfeed=1` prints (skip if the key is already baked into `ACCESS_FEED_URL`) |
| `SHOP_CODES` | optional (T2.17) — the cost code numbers At the shop offers on 25-0011 DB INTERNAL, comma-separated, in order. Default `99TM-1, 99TM-2, 99TM-3, 99TM-5, 99TM-4, 02ST-5` (Morning Clock-In, Training, Crew Labor – Monroe St., Crew Labor – Bonnewitz Ave., Shop Work/Maintenance, Hauling & Disposal (Direct) for the haulers). Where two shop lines share a number, the shop's own line shows, not the CLOCK IN ITEMS one. |
| `OPS_DIRECTOR` | optional (T2.23) — the Ops Director's name(s), comma-separated, told beside the job's PM when someone left a site without clocking out, rolled out without the shop checks, clocked in for the day away from the shop and the office, or moved a clock-in back with Started earlier (T2.24). Default `Carl Bledsoe`. A name must match a JobTread user's name exactly. |
| `LEFT_SITE_NOTIFY` | legacy (T2.19, T2.20) — read only when `OPS_DIRECTOR` is not set. |
| `SHOP_RADIUS_M` | optional (T2.23) — how close, in metres, the day's first clock-in at the shop must be to the shop (701 Monroe St) or the office (224 Bonnewitz Ave) for nothing to be said. Default `400`. |
| `PARTNERS_JSON` | optional (T2.21) — who may clock whom in with them: `{"<membership id>":"<membership id>"}`. Unset is Yahir → Alberto (`{"22PdPTwMdkzj":"22PdPUpWzpHy"}`). Set, it is the whole answer: `{}` partners nobody. |
| `EVENING_NUDGE_HOUR` | optional (T2.24) — the hour (12–23, the script's time zone) from which the five-minute sweep sends one "Still on the clock" push per block begun that day and still running; the tap opens When did you leave?. Default `19` (7pm). Rides on `PUSH_ENABLED` like the other pushes. |

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
curl.exe -s https://db-crews.web.app/config.js -o C:\dev\config-live-backup.js
```

The push keys (the `firebase` block and `vapidKey`) live in config.js too. A
config.js restored from an old backup deploys fine and silently turns push off
on every phone: Diagnostics reads "Push: not set up" and the Turn on
notifications button is hidden. Because config.js sits in the service worker's
cached shell, getting the corrected file onto the phones takes a new build
(bump `CACHE` in `public/sw.js`), not just a redeploy. The phones' own choice
survives: one that granted permission before turns push back on by itself.

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
no ECDSA. It can call FCM HTTP v1 on its own Google sign-in, or mint a token
from a service account key with `computeRsaSha256Signature` — either way the
whole stack stays in Apps Script, no Cloud Functions and no Blaze plan.)*

1. Firebase console > Project settings > **Cloud Messaging** > Web Push
   certificates > **Generate key pair**. Copy the public key — that is the
   `vapidKey`.
2. Project settings > **General** > your web app > Config. Copy `apiKey`,
   `projectId`, `messagingSenderId`, `appId` into `public/config.js`:

   ```js
   firebase: { apiKey: '…', projectId: '…', messagingSenderId: '…', appId: '…' },
   vapidKey: '…'
   ```

3. Set the Script Property `FCM_PROJECT_ID` to the Firebase project id
   (`db-time-clock`). That is all the sending needs: the script sends on its
   own Google sign-in — the account it runs as, the one that deploys it and
   installs its triggers — with the Firebase messaging permission
   `appsscript.json` asks for. That account must be an **Owner or Editor of
   the Firebase project**.

   **Approve the permission before you deploy.** The first `clasp push` that
   brings a new permission in `appsscript.json` needs one approval: in the
   editor, run any function (step 4's `testPushToMe` is the one) and allow it
   when Google asks. Only then `clasp deploy` — a deployment the account has
   not approved answers every phone with "Authorization is required", which
   stops the clock. Between the push and the approval the triggers fail and
   Google may email about it; that is expected and harmless.

   *A service account key is the other way in*, for an organization that
   allows one: Project settings > Service accounts > Generate new private
   key, and paste the whole JSON into `FCM_SERVICE_ACCOUNT`. Set, it wins.
   Deitemeyer's organization refuses to make keys ("Key creation is not
   allowed on this service account" — Google's default for newer
   organizations), which is why the script's own sign-in exists (2 Nov
   2026). Don't lift that block to get one.
4. Test the chain before anyone else gets anything: open the app on your
   phone signed in as the same Google account as the editor, and on
   Diagnostics tap **Turn on notifications** (it is hidden once they are
   on). Then run **`testPushToMe`** from the editor. It ignores
   `PUSH_ENABLED`, so it reaches your phone and nobody else's, and its log
   says "Sent to the phone registered for …" or why not: no device
   registered for that account, or FCM's own refusal (`FCM 403: …` —
   `cloudmessaging.messages.create` denied means the account is not an Owner
   or Editor of the Firebase project; an API that "has not been used … or it
   is disabled" comes with a link to switch it on). If it lands on your lock
   screen, the chain works.
5. Set `PUSH_ENABLED` to `true`. From then on every push whose trigger is
   installed goes to everyone — so tell the crew first.
6. In the Apps Script editor, run **`installNudgeTrigger`** once. It creates a
   time-driven trigger that runs `sweepBeforePhotoNudges` every 5 minutes:
   the before-photo nudge, and from `EVENING_NUDGE_HOUR` the "Still on the
   clock" push. `removeNudgeTrigger` undoes it. **`installBreakReminderTrigger`**
   is the break reminders (every minute) — the phone already promises them
   on a break.
7. Run **`installSchedulePushTrigger`** once as well. Hourly, for every
   registered phone, it asks the board for the next three days and sends one
   line the evening before — "Tomorrow: 812 S Washington St · Lucas · with
   Platinum · Material ordered" — after 4pm, once a day, only when something
   is booked; and "Schedule changed" when those days differ from the last look
   (added, moved, removed). Tapping either opens My jobs.
   `removeSchedulePushTrigger` undoes it. Phones registered before this build
   re-register on their next launch; until then the sweep skips them. The
   same run carries the Close Out pushes (T2.34), and each run leaves one
   line of counts on the **Executions** page (`schedule pushes: {…}`) — the
   only place a run that failed for every phone says so.

**How the sweep decides.** Every 5 minutes it asks JobTread for open time
entries, and for photos whose description contains `#TE:<timeEntryId>` — the
app stamps that onto every capture, so the server never has to trust the
client about whether the photo owed for a given block of time exists. An entry
older than the grace period with no matching before photo gets one push, once,
ever. The marker is cleared when the entry closes.

Two Pave calls per sweep regardless of crew size, so this stays well inside
Apps Script's quota at a 5-minute cadence.

**Keep the grace periods in step.** `PUSH_GRACE_MINUTES` in `Code.gs` and
`BEFORE_GRACE_SEC` in `app.js` should agree, or the in-app prompt and the
push will disagree about when the clock started ticking.

## 4c. Assigned jobs — connecting the Production Board

Without this the **My jobs** tab still works; it shows the jobs you have
recently clocked into and says the board is not connected. With it, the tab
shows the Install visits the office actually scheduled for your crew.

The job list is read-only. The one thing this app writes *through* the board is
the site manager's checklist (`PUT /api/crew/checks`), and the board's own gate
decides who may — the JobTread membership must carry the **Site Manager** role.
Nothing here can change the schedule.

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

### Safety alerts

A crew member answering **Anyone hurt or a close call?** with yes on the Day
log gets an alert card that goes out the second it is sent, apart from the
log: a comment on the job assigned to the PM, and a text. Set the Script
Property `SAFETY_ALERT_TO` to the comma-separated addresses the text goes to
— an email address, or a carrier's SMS gateway address such as
`4195551234@vtext.com` (Verizon), `@txt.att.net` (AT&T), `@tmomail.net`
(T-Mobile), which lands on the phone as a text. Without it the comment still
goes and the alert still counts as sent.

## 5. Publish

From `dbtimeclock-pwa/` (needs Node):

```
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
firebase deploy --only hosting
```

**How a build reaches the phones.** An installed app checks for a new
service worker when it is opened and again when it is brought back from the
app switcher (at most every ten minutes). The new worker takes over as soon as
it has installed, and the page reloads itself once, when no call is out and no
video is recording. The Check for update button on the Diagnostics screen (the
footer line at the bottom of the Clock tab) forces that check and reloads. Phones running a build older than T1.13 have neither and
can sit on a stale page for as long as iOS keeps it alive: one Check for
update (or removing and re-adding the app to the Home Screen) moves them on,
and from then on they keep themselves current.

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
Every deploy is a new build, written the same in four places (T2.32): the
`APP_BUILD` in `public/app.js`, `data-build` and the script's `app.js?b=` in
`public/index.html`, and `BUILD` in `public/sw.js` (the cache is named from
it). The service worker keeps the page and its script as a pair and serves
the script from its cache, so a changed `app.js` under the same build would
never reach a phone that already has it. `check-build.mjs` runs before every
deploy and stops one whose build differs between the four, or whose `app.js`
changed while the build stayed the same as the live site's. The Apps
Script carries the build too, as `APP_BUILD` in `apps-script/Code.gs`, which
Diagnostics shows as the API: bump it with the four, or every phone warns
that the app is newer than the API (`apps-script/code-test.mjs` fails when it
is older). For server changes, publish a new Apps Script deployment
**version** on the SAME deployment so the `/exec` URL stays stable.

## Previewing without JobTread

`dev/` holds a mock harness that fakes sign-in and the API so every screen can
be opened locally. Nothing in `dev/` deploys — Firebase only publishes `public/`.

```
cd public && python3 -m http.server 8100     # in one shell
node dev/preview.mjs ./shots                 # in another (needs playwright)
node dev/push-test.mjs                       # exercises the push paths
node dev/checks-test.mjs                     # the site checks, end to end in the page
node dev/loaded-test.mjs                     # material loaded for the crew: the save, the re-asked line, the undo that asks first
node dev/daylog-test.mjs                     # the week view, today's job and the day log, end to end
node ../apps-script/code-test.mjs            # getMyJobs + saveSiteChecks, no deps, no network
```

The dev tests import `playwright`, so run `npm install playwright` in
`dbtimeclock-pwa/` (or link a global install) before `node dev/checks-test.mjs`
and friends.

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
| `__MOCK_NOTMANAGER` | the site checks for someone JobTread says is not a site manager — the board's 403, and the list read-only |
| `__MOCK_PUTFAIL` | the board's 502 on a site-checks save — ticks kept, retried |
| `__MOCK_SLOWPUT` | hold a site-checks save this many ms, to watch "Saving…" and tap during it |
| `__MOCK_STARTFAIL` | the first N boot calls answer 500 as a web page, the way an overloaded `/exec` does — the app's own boot retry carries it |
| `__MOCK_LOGFAIL` / `__MOCK_SLOWLOG` | a JobTread hiccup on the day-log send (kept, retried) / hold the send this many ms |
| `__MOCK_SLOWEXTRAS` | hold the extras call this many ms — the read lane: a send must still go at once |

The last two matter more than they look: the fallback is what a crew member sees
on the morning the board is down, and it is the path that proves the clock is
not blocked by it.
