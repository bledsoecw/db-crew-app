# DB Crew — notes for Claude sessions

The project's notes live in `README.md` (how the app behaves, roles, the
Close Out tab, the clock), `dbtimeclock-pwa/SETUP.md` (deploying),
`CREW-ASSIGNMENTS-API.md` (the contract with the Production Board) and
`JOBTREAD-NOTES.md` (what the live org looks like). Read those first. This
file holds only what does not fit there.

## The crews' training video (`docs/training-video/`, Oct 2026)

*"I want a similar video for the crew app. with sections for production crew,
service repair warranty and close out crews. with chapters. and how to read the
production board also. same voice as the video"* (Carl, 28 Oct 2026) — the
"video" being the Production Board's service-PM training video
(`bledsoecw/DB_Production_Board`, `docs/guides/service-pm-video/`). In
four parts: production crews (signed in as Tyler, a site manager),
service/repair/warranty and close out (signed in as Yahir), and the war-room
TV. Carl's calls before it was scripted: the phone big
on the left with the words on the right (two stills were shown), English
narration with **English or Spanish subtitles** (so it is made twice), one full
video **plus each part on its own**, and Tyler throughout the production part.
The MP4s are not committed; the folder's `README.md` has the whole
regeneration, Linux only.

- **The same pipeline as the board's video, adapted to a phone.** The app runs
  at 402×874 in an iframe on a 1920×1080 stage (`stage.html`), so the touch
  dot, the ripple and the highlight boxes are drawn on the stage; the board's
  TV is shown full frame in a second iframe for its chapter. Same Kokoro voice
  (`am_michael`, 0.94), same pauses, same -16 LUFS steady gain and limiter,
  same voice check (2.1% → 1.3% of words misheard after the lexicon, the rest
  homophones the recogniser spells its own way).
- **`dev/mock.js` takes a fixture set from outside** — `window.__MOCK_FIX`,
  set by `docs/training-video/fixtures.js`. Anything it names replaces the
  demo data; with nothing set the mock behaves exactly as before (the dev
  suites were run both ways: closeout (149/152 with the T2.14 and T2.15
  checks) and push 10/14 fail the same three and four checks on the untouched
  code — this container, not the app).
  The mock's own demo data uses real jobs (26-1490 Courtney); the video's
  never does.
- **The board's dev fixtures are real customers' names** (26-1035 is the real
  `261035 Mock_Roof`; 25-8089, Rahrig, Lucas…), and the PM video shows them.
  So the video's TV is handed only its own made-up jobs
  (`board-world.mjs`), and refuses to film if any name the dev board served
  reaches it.
- **Found while recording, fixed first** (T2.14 and T2.15, README has all
  three): Stop in Close Out needed two taps — leaving a note box re-drew the
  screen under the finger, so the press that took the focus lost its click
  (`coAfterTap` now waits for it); a repair's due day read `2026-08-06`
  (`coDay` now); and a work area's **Start** (gutters on a job at Punch List)
  opened the area without moving the clock, so the hours stayed on the last
  job (`coClockHere`, T2.15 — the same move Start on a card makes).
- **The mock shares cost-item ids across jobs; JobTread does not.** So a code
  running at one job read "Running" on the next job's code list, beside the
  last job's hours. `FX.codesPerJob` (the video sets it) gives each job its own
  ids (`ci4@co-fair`); with it unset the mock is unchanged.
- **Drawn as plain ticks in the October cut**: the board's "Covered by:" and
  "Watertight confirmed with:" lines and its N/A state. T2.25 drew them (name
  boxes, the crew leader offered, Doesn’t apply here with its reason), so the
  re-record shows them.
- **Chromium refuses to frame localhost from a page the recorder answers**
  (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`); the stage is launched with
  `--disable-features=LocalNetworkAccessChecks`.
- The narration names buttons by their words, so a rename in the app, a change
  to a flow the video walks, or a change to the checklist the board sends is a
  re-record. `node record.mjs debug` shows what broke.
- **Re-recorded for T2.16–T2.22 (28 Oct 2026)**, off Carl's notes from
  watching the first cut: about twenty-two minutes, nineteen chapters.
  Tyler's day now starts **At the shop** (Morning Clock-In), a new chapter 4
  walks leaving the shop (Stop → Leave for the job → Before you roll out with
  the yard lines → end photo → Where are you going? → the drive on Travel
  Related Labor → I'm here, the job's code, start photo), the site checks
  open with the yard already ticked, the Stop sheet has four choices, the
  clock-out photo shows **Already left**, and Yahir's part goes shop → drive
  → **Start on the repairs card** as the arrival (no Clock tab detour),
  drives Castellano → Abernathy with Leave for another job, and uses Already
  left at Fairbanks — the pointless end photo Carl hit, filmed where it
  happens. Yahir's phone carries the Clock Alberto too box (`FX.partner`;
  `fixtures.js` gives the service role no board visits, so the drive's
  destinations are Close Out's own). Every job's code list carries the travel
  line (`TRAVEL`, `travel: true`). **Each of Parts 1–3 ends on a "your day"
  chapter** (Carl: *"I like how the Service Repair Managers video ended, with
  a quick what your day looks like"*): a card listing the day's steps
  (`chapter(…, { day: true, sub })`, one step a line — `stage.html`'s
  `#card.day`) while the narration walks them. Per part rather than once at
  the end because each part also goes out as its own file.
- **Recording it found two words wrong on the drive**, fixed first (T2.22,
  README): a repair card read Continue while driving to it, and the arrival's
  code sheet was titled Switch code.

## Leaving the site (T2.23, 29 Oct 2026) — what the README does not say

- **The training video is out of date as of T2.23** and is re-recorded last
  (Carl agreed the order: the clock flow first, then multi-day checks, the
  daily roll-out, Spanish and forgot in/out, then construction, then the
  videos). It still shows Stop the clock, the end photo on every move, the
  shop photo, "the PM and Carl are told" and "At the yard"
  (`docs/training-video/script.mjs`, `fixtures.js`). Carl: *"Do not use
  Carl. use Ops Director instead"* applies to the new narration too.
- **The mock's sample day starts at the shop** (Morning Clock-In, then the
  drive on Webster's travel line), so whether Webster "was worked today" no
  longer depends on the hour the suite runs. A test that needs the day's first
  clock-in boots with `window.__MOCK_FIX={entries:function(){return [];}}`;
  `dev/daylog-test.mjs` puts the old two codes at Webster back for its hours.
- The board renamed its checklist the same day (`bledsoecw/DB_Production_Board`,
  branch `claude/zealous-hopper-j7xy98`, not merged to `main` by the session —
  `main` is production there). `shopText` on the phone covers the gap.

## Phase 2 (T2.24, 29 Oct 2026) — what the README does not say

- **Spanish is a lookup by the English, not a second copy of the screens.**
  `L('Clock out')` and `Lf('Driving to {p}', { p })` in `app.js`; the
  Spanish lives in the `esAdd({...})` blocks beside `L10N`. English output is
  byte-identical to before (Lf in English only fills the `{}`), which is why no
  English test changed. Static words carry `data-l` and `renderLang()` fills
  them; never put `data-l` on an element a render function also writes, or the
  two fight. `pw(j)` is placeWord for the middle of a Spanish sentence ("el
  taller"), and Lf contracts *a el* / *de el*. `dev/spanish-test.mjs` reads the
  whole file for every literal handed to `L`/`Lf` and fails on one with no
  Spanish — add the Spanish in the same change as the sentence.
- **The service crew open in Spanish, so their English expectations moved.**
  `closeout-test` (the header role, the partner toast) and `signin-test` (the
  reopened header) now expect *Servicio* and the Spanish toast; that is the
  rule (`appRole === 'service'` and no choice made → `es`), not a regression.
- **The training video is now further out of date**: on top of T2.23, Yahir's
  phone (service) now opens on a Spanish Clock tab and Spanish sheets, so the
  recorder has to set the language for each cut (English narration, English or
  Spanish subtitles) rather than inherit the default, and the subtitles name
  buttons by the words on screen. Re-recorded in phase 3.
- **Not translated on purpose**: what goes to JobTread (notes, comments, logs),
  the board's checklist lines and phase names, the office's crew notes, server
  error messages, Diagnostics, the sign-in gate and People. The schedule pushes
  ("Tomorrow", "Schedule changed") are still English; the evening push and the
  missing-start-photo push follow the language the phone registered with.

## Phase 3 (T2.25, 29 Oct 2026) — what the README does not say

- **The two copies of `CREW-ASSIGNMENTS-API.md` had drifted** — the board's had
  the SOP v1.1 section, the bench and the pre-start; this one had `inspector`,
  the Spanish material lines and the app-half paragraphs. They were merged into
  one file and copied into both repos; keep them byte-identical (`diff` them)
  and change both in the same session.
- **Close Out's form is the server's now** (`bledsoecw/DB-CheckOut`,
  `packages/shared/src/forms.ts`). The phone's `CO_FORM_ROOF` is the fallback
  for a server too old to send one and must stay equal to the server's roof
  form; it was built from it. `coForm(jobId)` is the one reader: the job's
  served form, then the cached one (`dbtc_co_forms`), then the built-in.
  `coSecScreen` maps the roof's `inspection` / `cleanup` sections to the old
  screen names (`inspect`, `cleanup`) so nothing that keyed off them moved;
  any other section is `sec:<key>`. A construction walk-through is a server
  change (a form in `CLOSEOUT_FORMS`, `jobFormKey()` choosing it, and the
  write path in close-inspection), which is Neal's to write with Carl.
- **`ckSettled(st, key)` is the count** wherever a group, a nudge or a
  sign-off asks "is this line dealt with": a tick OR an n/a. `ckDone` is still
  the tick alone, and material-on-site reads the tick, never the n/a.
- **The pre-start reuses the checks screen** (`S.checksKind` `'site'` or
  `'prestart'`); `ckLeave` flushes whichever is open. Its store is
  `dbtc_prestart`, kept apart from the site checks' so the two never share a
  dirty flag.
- **The trade lists were measured, not guessed** (October's time entries by
  Job Type, 29 Oct). 01GR (Crew Labor) is used on the odd roofing job too but
  stays under All codes there; 01GR-2 Design is the designer's and is not a
  crew code. `TRADE_CODES_JSON` is the lever if Carl wants it otherwise.
- **The board half of T2.25 is one field** (`taskName` on the assignment).
  It reached the board's `main` on 29 Oct 2026 and deployed that afternoon.
  DB CheckOut's served form reached its `main` the same day but **did not go
  live**: that deploy shipped a stale prebuilt bundle (see T2.29 below). A
  board older than that answers no `taskName` and the phone simply says no
  stage.
- **The training video was re-recorded after this** (phase 3's last step, 29
  Oct 2026) — see *The re-record by role* below.

## The re-record by role (29 Oct 2026) — what the README does not say

- **Five parts, two takes, not one take with two caption files.** Carl's
  phase-3 call was a Spanish-voiced version, so the October "English voice,
  Spanish subtitles" cut is gone: a Spanish voice describing an English phone
  would name buttons the viewer cannot see. `VIDEO_LANG=es` makes the Spanish
  take (voice `em_alex`, `es-419` phonemes, the phone set to Spanish by
  `loadApp`); each take lands under `VIDEO_WORK/<lang>`, the voices and the
  photos are shared. Every line in `script.mjs` carries its `es`, and
  `record.mjs` refuses to run with one missing.
- **By role** (Carl): every crew member (Zac, the construction bench — no site
  managers on construction), site managers (Tyler, roofing), service (Yahir),
  close out (Yahir), the war-room TV. Part 1 is the clock everyone uses and
  the others do not repeat it.
- **Recording it in Spanish found the day log still English** under a Spanish
  phone, about forty strings — fixed first as T2.26 (README).
  `spanish-test`'s whole-file scan could not catch it: those strings were
  never handed to `L`/`Lf` at all. The scan only proves a literal that IS
  looked up has Spanish; a screen built from bare strings has to be walked.
- **The board's TV and checklist lines stay English in the Spanish take** —
  that is the board's, and the narration says the tags by their English names
  in both.
- **Run the recogniser over the Spanish take before handing it over.** The
  Spanish phonemizer read every `·` in a button name aloud as "punto medio";
  nothing on screen or in the English take shows it. `tts.py` speaks it as a
  comma in Spanish now. The fix shortened four clips and was laid into the
  recorded take without re-recording — a shorter clip only leaves a longer
  pause after it. A LONGER one would run into the next line, and then it is a
  re-record.
- **The mock's `crewLead`** follows `FX.crewLead` (the video names Jeremiah on
  the watertight line); unset it is what it was.


## T2.27 (29 Oct 2026) — what the README does not say

- **The training videos are out of date again, and Carl said not to remake
  them yet** ("Do not recreate videos yet"). They show the old Leave sheet,
  Clock out at the job, the drive-back buttons, an optional before photo and
  note on a repair, visit photos optional, no final notes, the old Review &
  send, *Close Out ›* after a send, and gutters as notes and photos. Re-record
  once this round is signed off.
- **`coCtx()` is the one inspection** — the roof's (`CO.ctxArea` null) or a
  work area's with its own checklist (`CO.ctxArea` the area's key). The list
  screens, Problems, the site photos, the final notes, Review & send and the
  blockers all read it, so the gutters' checklist is the roof's screens with
  its answers in `v.areas[key].answers`. `coGo('job')` clears it, `coGo('area')`
  sets it when the area has a form the phone holds; a form it does not hold
  reads as notes and photos. The final notes live in `v.fin` for the roof and
  in the area's `note` for an area (the old notes area's "what you saw").
- **Review & send still opens *Before you send* while anything is left** —
  the T2.12 list with a row per missing thing. The cards are only reached
  once nothing is; Send re-checks.
- **Two vocab sets, two collisions to avoid.** `L()`/`Lf()` with `esAdd` for
  the clock and the log, `co()` with `coAdd({en,es})` for Close Out. A
  `coAdd` key that already exists in `CO_L10N` silently replaces it —
  `reviewSub` did, and the PM Review card read "Tap a card to open it".
- **`dbtc_where` stops saving before the sign-out wipe** (`S.whereReady`),
  or the page's own leaving writes it back for the next person.
- **Gutter Crew, Siding Crew and PM were added to the Trades Onsite list in
  JobTread on 30 Oct 2026** (Carl: "add them from there"; field
  `22PC7jNshbiK`, appended after Sales Rep through `updateCustomField`, which
  REPLACES the options, so the whole list was sent back). The phone matches a
  button to the field's own option by name (`dlTradesSplit`), so they became
  real picks with no build; until then they went as Other plus words
  (`fieldText`), and still do for anything typed. The Apps Script caches the
  field list for six hours (`LOG_FIELDS_CACHE_SEC`) and the phone takes its
  copy from there, so the two switch over together within that window. A
  pave `update…` returns `root`: select the record under it with its own
  `$: { id }`, or the call is refused before it writes.

## T2.28 (30 Oct 2026) — ten photos on an inspection

- **"10 photo minimum, that includes 1 start and the 1 end"** (Carl) is read
  as the CLOCK's start and end photos — the app's own words for them — not as
  two labelled shots inside the inspection. The send comes before the end
  photo (it is taken leaving the site, `endPhotoOwed`), so the inspection
  asks for 10 − 1 (end) − 1 (start, if the clock took one at that job today)
  and says so in a sentence. A visit with no start photo (clocked in
  elsewhere first) needs nine. If Carl meant ten inside the inspection, it is
  `coPhotosNeed` returning `CO_PHOTOS_TOTAL`, and the two tiles come out.
- **The start photo counts only from `S.photos` on that phone** (tag
  `before`, the job's id, today). A start photo taken on a partner's phone,
  or before a sign-out wipe, is not seen and the crew are asked for nine.
- The suites seed nine site photos now (`seedSite` default); the container's
  clock at 1–2am UTC makes clock-test's "2 hours earlier" fall before
  midnight and drop — the time of day, not the app.

## The audit and T2.29 (30 Oct 2026) — what the README does not say

- **The audit report** is a private page on Carl's account:
  https://claude.ai/artifact/AAcARP8W9V2hjkdRutYvPK — defects D1–D19 and
  improvements I1–I9, by id. Step 1 (D1, D5, D2, D3, D4, D9, D10, D11, D12,
  D13, D17, D18, I4, I7) is T2.29 here and DB CheckOut's 30 Oct commit; Step 2
  (D6, D7, D8, D14, D16, I3) is T2.30; the first half of Step 3 (I2, D15,
  I1) is T2.31, live 30 Oct; the second half (I5, I6, I9, with D13
  report-only, D19 and D20) is T2.32, live 30 Oct. What is left: switching
  the security policy on, once Diagnostics on phones in use shows nothing it
  would block.
- **A correction the earlier notes needed.** DB CheckOut's served form
  (41a843f) and its gutter/siding checklists, `REPAIR` photos and final notes
  (6c6d5d1) were merged and "deployed" on 29 Oct but never ran: its
  `vercel.json` had `"buildCommand": ""`, so Vercel shipped the committed
  `api/index.mjs`, last rebuilt at 7deba50 (26 Oct). Production ran the 26 Oct
  server until the 30 Oct deploy. The T2.25 and T2.27 notes said otherwise.
  Since then Vercel builds the bundle on every deploy, and `GET /health` on
  closeout.deitemeyerbrothers.com shows `build.on: "vercel"` with the commit —
  **read that after any Close Out deploy** rather than trusting the merge.
  That deploy went live at 12:51Z on 30 Oct 2026 (Carl: *"go, deploy the
  server now"*), `dpl_FZqdWNtdudKHKYk5NZNqf1swmZ3X`, a fast-forward of `main`
  to 9a4dfd9: `/health` answered `{"source":"fe1dbffda4aa","on":"vercel",
  "commit":"9a4dfd9"}`, `/jobs` and `/queue` answer 401 with no token or an
  old session token, and the next JobTread webhook ran on it without an
  error. The 6c6d5d1 deployment is the rollback if one is ever needed.
  **T2.29 is live on the phones too**: Carl ran the one Git Bash chain (pull,
  `clasp push -f`, `clasp deploy -i … -d "T2.29"`, `firebase deploy --only
  hosting`); db-crews.web.app has served it since 13:03Z, after the server,
  and his Diagnostics read App and API both `T2.29 (2026-10-30)`. T2.27 and
  T2.28 reached the phones in the same deploy.
- **Carl's calls on 30 Oct.** (1) The phone's own time is acceptable for
  payroll, so I1 — clock in with no signal, queued with the phone's time — is
  approved; build it after D15, so a resent clock-in cannot make two entries.
  (2) A Yes on material pickups alerts the PM (done, `LOG_PING_DEFAULT`).
  (3) "Normal day" logs stay: JobTread is the source of truth. (4) The T2.28
  reading of ten photos is right. (5) The Type button goes (done).
- **Not done on purpose.** D13's Content-Security-Policy: the app's script is
  inline, so a CSP that protects anything needs the script out of the page
  first (I5); one with `'unsafe-inline'` would not. D14's zoom: the lock has a
  reason — iOS zooms into any input under 16px and stays zoomed, which broke
  the camera layout in the retired Close Out app (its `fix-web-html.mjs` said
  so) — so allowing zoom needs every input at 16px or more first. (T2.30 did
  exactly that: every box was already 16px or more, which t230-test pins.)
- **D9 reads the phone's role** (site manager or Operations); the board's own
  sign rule also admits a roster crew flagged Site Manager. If that ever
  differs, the board sending `canSign` on `checks` is the fix (both repos'
  contract).
- **DB CheckOut's retired door**: `/auth/google`, `/auth/config` and session
  tokens are gone; `SESSION_SECRET` and `GOOGLE_CLIENT_ID` are no longer read
  and Carl deleted both from its Vercel project on 30 Oct 2026 (no redeploy:
  the live deployment never read them). `GOOGLE_ALLOWED_EMAILS` still is
  read — it gates who DB Crew may act for. **Not to be confused with DB
  Crew's own `SESSION_SECRET`**, a Script Property on the Apps Script that
  signs every crew member's 30-day session (SETUP.md): same name, different
  system, and deleting that one signs everybody out. `public/` is a notice plus a
  service worker that clears the old app off any phone that installed it.
- **Two tests fail here and on T2.26 alike**, in this container: push-test
  (6/14, the test setup serves no Firebase files) and code-test's "…and back
  to work opens a new one". Not the app; checked by running both against
  T2.26.

## T2.30 (30 Oct 2026) — Step 2 of the audit, what the README does not say

- **The photo counter is not the truth; the store is.** `S.queued` is only
  what the upload loop last saw. Anything that decides on it (sign-out, the
  no-signal bar at start) calls `qCount()` first. `signout-test` used to fake
  a queue by setting `S.queued = 2`; it now puts two real items in the store,
  because faking the counter is the very thing D6 stopped trusting.
- **Each photo has its own tries, beside the queue** (`qRetry`, saved as
  `dbtc_qretry`), never written into the queued item — a failure must not
  rewrite a video. `pumpFails` and `PUMP_RETRY_MS` are gone; the next run is
  the soonest photo's due time. `qWake()` (signal back, app in front) makes
  everything due without forgetting the tries, so a stuck photo stays said.
- **Every write to localStorage goes through `storeSet(key, value, quiet)`**
  — `quiet` for copies the phone can fetch again (codes, the schedule, job
  copies, the queue, `me`, forms, where-you-were, the token), never for work.
  A new `localStorage.setItem` in a try/catch is the bug D8 removed; only the
  sign-in gate's `PICK_ACCOUNT_KEY` writes stay direct.
- **Sheets own a history entry while open** (`sheetHistPush` / `sheetHistPop`,
  `popstate` → `backOutOfSheet`). `closeSheet()` calls `history.back()` at
  once, and **nothing is pushed while that Back is still travelling**
  (`sheetBackPending`): a sheet opened in the gap gets its entry when the
  Back lands (`sheetBackLanded`). The first cut took the entry back on a
  timeout instead, and clock-test hung on it: Already left → an API call →
  the code sheet pushed while the Back was on its way, the entries drifted,
  and the next close went back past the app's own entry (to about:blank in
  the test; a phone opened from a link would leave the app). t230-test pins
  the gap at 0, 1 and 20 ms. A test can press Back with `page.goBack()`.
  Focus goes back to the opener only when it is not a text box — iOS leaves
  focus in a textarea under a tapped button, and restoring it would raise the
  keyboard after every sheet.
- **An update never reloads mid-step** (`swQuiet`): the old 15-second cap is
  gone on purpose. A sheet left open forever only means the new build waits
  for the next open, which navigation already serves fresh.
- **The Close Out contract level.** DB CheckOut's `/health` reports
  `contract` (`PHONE_CONTRACT` in `apps/sync/src/routes.ts`, 1 since 30 Oct);
  the phone carries `CO_CONTRACT_NEED`. Raise the server's in the change that
  gives the phone something new to depend on, and the phone's when it starts
  using it — Diagnostics warns while the server is behind. A server that
  reports no level is only called behind once the phone needs more than 1.
  **The server half is live**: at 14:19Z on 30 Oct 2026 (Carl: *"go, deploy
  the server now"*) `main` was fast-forwarded to 4387f3f,
  `dpl_2aGXqxaGeoKH1gpwt7irLFCFnrQR`, and `/health` answered
  `{"source":"d6a0b17cca5b","on":"vercel","commit":"4387f3f"}` with
  `"contract":1`; `/jobs` and `/queue` still 401 with no token, and no runtime
  errors. The 9a4dfd9 deployment (`dpl_FZqdWNtdudKHKYk5NZNqf1swmZ3X`) is the
  rollback. **T2.30 is live on the phones too**: Carl ran the one chain
  (`clasp deploy … -d "T2.30"`, `firebase deploy --only hosting`);
  db-crews.web.app served `T2.30 (2026-10-30)` with cache `dbtc-t2-30` and
  the `sheetBackPending` fix by 14:22Z, and his Diagnostics read App and API
  both T2.30.
- **The server half of the shared-phone fix** reads every Script Property
  (`getProperties()`) to find the same token under someone else. Fine at this
  size; it is O(properties) per registration.
- **The mock grew switches**: `__MOCK_PUTFAIL` (a pattern on the file name:
  the PUT answers 500 and the API path refuses), `__MOCK_PUTSTALL` (the PUT
  never answers until aborted), `__UPLOAD_TIMEOUT_MS`, `__PUTS` (the order
  files arrive), `__MOCK_BUILDS` (what `getBuilds` answers), `__UNREG`.

## T2.31 (30 Oct 2026) — Step 3's first half, what the README does not say

- **Request ids are a list on both sides**: `RID_FNS` in `app.js` and in
  `Code.gs` must stay in step. A write left off the phone's list carries no
  id and is simply done again; one left off the server's list is ignored.
  Reads never carry one. The key is the signed-in email and the id, never the
  function: a photo's id (`photoRid`, `ph-<photo id>`) is the same whether it
  is filed by `finalizeCaptureUpload` or `uploadCapture`, so the second path
  hands back the first filing. Only `{ ok: true }` answers are remembered;
  `ridDone_` frees the id on a failure. `ridLook_` takes the script lock with
  `tryLock(5000)` around a cache read and write only, and goes on without the
  lock if it cannot get it rather than refuse a clock write. The phone reads
  the "still at work" answer as `err.busy`, which the outbox lanes retry and
  never treat as a refusal.
- **`kept`, never `queued`, on the phone's placeholder.** The API's answer to
  a kept clock-in carries `queued: { start, waited }`; the first cut flagged
  the phone's own placeholder `queued` too, and the landed entry went on
  reading as a placeholder ("saved on this phone") for good. t231-test pins
  the label after landing.
- **A photo waiting on its clock-in is never sent from the pump's list.** The
  pump reads the queue once and walks it; a clock-in landing mid-walk stamps
  the photo and saves it again, but the walk still held the old copy and
  uploaded it without `#TE:`. Any item with `waitRid` is skipped, full stop:
  the landing (`cqReleasePhoto`) puts the stamped copy back and runs the pump.
  `cqOrphans()` at start lets go of a photo whose clock-in is no longer on the
  phone.
- **The send time is stamped as the request leaves** (`co.beforeSend`, called
  in `apiAttempt` on every try). Stamped when the call joined its lane, a kept
  clock-in sent behind a boot call that was retrying landed four seconds late
  in the test; behind a slow call it would be more.
- **What is kept and what is not.** A clock-in and an arrival's switch with no
  answer (no signal, a dropped connection, a timeout, the API still busy) are
  kept. Already left is not (its time is the person's answer). Clocking out, a
  break and a move are not kept: while a clock-in waits they are held by
  `openSheet` (`CQ_HOLDS` → the `clockq` sheet), because each needs the entry
  the clock-in makes; with signal they go as they always did. If Carl wants a
  clock-out kept too, it is the same store with `leftSite`'s past-time door.
- **The roll-out notes are outbox items now**: `rollStore[job|day].daily` and
  `.forgot`, each `{ args, rid, tries, next, sent, refused }`. The 3-day prune
  at load still applies to them.
- **A refused kept clock-in is the one server error the phone translates.**
  `queuedNo_` throws the reason in English words with `refuse: { why, at }`
  beside them (`since` · `until` · `clock` · `old` · `notime`), doPost copies
  it onto the reply, and `cqWhy` says it in the phone's language; a reason it
  has no name for is shown in the API's words. The words are the reason and
  nothing else: the sheet adds "Tell the office when you started" once. The
  first cut had the server say what to do too, so the sheet said "not added"
  and "tell the office" twice each, in English on a Spanish phone.
- **Close Out's first retry is 20 seconds** (was 15), the one backoff; the
  pre-start's wake-up now sends a list waiting out its backoff (it skipped any
  list with a timer set).
- **The mock grew switches**: `__MOCK_NONET` (no signal: every call and
  upload fails before it reaches anything), `__MOCK_LOSTREPLY = N` (the next
  N writes with an id are done and their answers lost), `__MOCK_QREFUSE` (a
  kept clock-in refused: words alone, or `{ why, at }` as Code.gs sends it;
  `open: true` also puts them on the clock at `at`, as the office would have),
  and records `__RIDS` ([fn,
  rid] per call) and `__QUEUED` (each kept clock-in the API was sent). It
  dedupes by id the way Code.gs does, from a snapshot of the first answer.
- t230-test no longer pins the app's build to T2.30; it reads `APP_BUILD`.
- **T2.31 is live**: Carl ran the one chain (`clasp deploy … -d "T2.31"`,
  `firebase deploy --only hosting`); db-crews.web.app has served it since
  16:56Z on 30 Oct 2026, `index.html` and `sw.js` byte-identical to the branch
  (cache `dbtc-t2-31`), and his Diagnostics read App and API both T2.31.
- **The root address is cached for an hour, found after the deploy.**
  `firebase.json` sets `no-cache` on `/index.html` but not on `/`, which is
  the installed app's `start_url`; `/` answers `max-age=3600`. The service
  worker's navigation fetch can take that copy, so a new build can take up to
  an hour to reach a phone that has signal. A header rule for `/` is the fix
  (proposed with I5, which needs the page and its script to stay in step).

## T2.32 (30 Oct 2026) — Step 3's second half, what the README does not say

- **The script is `public/app.js`; `index.html` is markup and styles.** The
  split was mechanical: the one inline `<script>` body moved byte for byte,
  the tag became `<script src="app.js?b=T2.32"></script>` at the same place
  (end of body, no `defer`, so it runs exactly when the inline one did).
  Code references in these notes, the README and SETUP.md now say `app.js`;
  `CREW-ASSIGNMENTS-API.md` still says `index.html` in four narrative places
  and was left alone, because it must stay byte-identical with the board's
  copy.
- **One build, four places, every deploy**: `APP_BUILD` in `app.js`,
  `data-build` and `?b=` in `index.html`, `BUILD` in `sw.js` (the cache name
  is derived from it). `check-build.mjs` (predeploy) refuses a mismatch, an
  inline `<script>` in the page, or an `app.js` that changed while the build
  stayed the live site's — it fetches the live `sw.js` and `app.js?b=` to
  compare (line endings normalized), and only warns when the live site is out
  of reach. `DBC_LIVE_URL` points it elsewhere (an emulator). The old habit of
  redeploying a fix under the same build (the T2.30 Back fix did) is exactly
  what it now stops: the worker serves `app.js` cache-first by that URL.
- **The pairing guard** at the top of `app.js` compares `PAGE_BUILD` with
  `APP_BUILD`; a mismatch sets `sessionStorage.dbtc_buildfix` to
  `"<page>><script>"`, reloads and throws to stop the stale script. A second
  mismatch of the same pair carries on and `buildWarnings()` says so.
- **`#gateSlow`** is in the page markup and shown by CSS alone after six
  seconds; the script's second statement removes it. Never give it `data-l`
  or a render function: it exists for when no script runs.
- **The security policy's `connect-src` does not name the photo upload
  host.** JobTread's `createUploadRequest` answers it, and finding it out
  would mean creating an upload request in the live org. Report-only will name
  it (Diagnostics → Security: `connect-src https://…`); add it before the
  policy is switched on. Switching on = copy the report-only value to
  `Content-Security-Policy` on both sources in `firebase.json`.
- **Measured, not assumed**: Chrome fires `securitypolicyviolation` for a
  report-only policy with no `report-uri`, so the policy sends nothing
  anywhere and has no endpoint; and a `firebase.json` header `"source": "/"`
  matches the root — checked with the Firebase hosting emulator
  (firebase-tools 13.35.1), which served `/` and `/index.html` with
  `no-cache` and the policy. The phone reads whether the policy was sent with
  a `HEAD` of `./` when Diagnostics opens (`cspCheck`, past the service worker
  because it is not a GET).
- **`_drawn` on `#jobsList` and `#weekStrip`** holds the HTML last drawn
  there (I9). Anything else that ever writes into either element must clear
  it, or the next render will think nothing changed.
- **`i18nPut` keeps the FIRST words** of a clashing key and names it in
  `I18N_CLASH`; to change a sentence, change it where it is. `beforeSub` was
  the only clash and now lives in `CO_L10N` with its T2.27 words.
- **t232-test serves the page with headers through `page.route`** (the local
  `http.server` sends none): enforced and report-only policies, and a page of
  another build. Its enforced walk is the evidence that switching the policy
  on would not block the app's own code; it cannot speak for the real
  network (the mock answers in the page), which is what report-only is for.
- **A Playwright script in the scratchpad finds `playwright` through
  `scratchpad/node_modules`, a link to `/opt/node-tools/node_modules`.** An
  `npm install` there replaces the link with a real folder and every script
  stops resolving it; install tools in a subfolder with its own
  `package.json`.
- **T2.32 is live**: Carl ran the one chain (`clasp deploy … -d "T2.32"`,
  `firebase deploy --only hosting`, which ran `check-build.mjs` for the first
  time); db-crews.web.app has served it since 18:03Z on 30 Oct 2026 —
  `index.html`, `sw.js` and `app.js?b=T2.32` byte-identical to the branch,
  `/` and `/index.html` answering `no-cache` with the report-only policy — and
  his Diagnostics read App and API both T2.32. `check-build.mjs` run against
  the live site afterwards says "T2.32 is already live and app.js is
  unchanged", as it should.

## T2.33 (2 Nov 2026) — Step 1 of the second audit, what the README does not say

- **The second audit** is a private page on Carl's account:
  https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr — defects D21–D40 and
  improvements I10–I19, by id, and a three-step roadmap. Step 1 (D21, D22,
  D23, D24, D26, D27, D29, D34, D35, D36, D38) is T2.33 here and DB
  CheckOut's eb84c5a. Step 2 is D40, I12 with I14, I16 with D32, D37 and D33;
  Step 3 is I10, I11, D25, I13, I15, D31, D39, I17, D28 and D30.
- **"A day before" is the script's own day** (`staleOpen_`: the open block's
  start is on an earlier `isoDay_` than now, in the script's time zone; a
  planned block after a break, which starts in the future, is never stale).
  `assertNotStale_` is called by `openEntry_` (every fresh clock-in and code
  change), `clockOut` and both branches of `startBreak`; `leftSite` is the one
  write that may close such a block, at the time given. The error is
  `STALE_OPEN: …` with `e.stale = { startedAt, jobId }`, and doPost copies
  `stale` (and `notOn`) onto the reply beside `error`, the T2.31 `refuse`
  shape. The phone reads them as `err.stale` / `err.notOn`; `apiAttempt`
  re-reads the clock (`clockReread(true)`) and, for stale, opens *When did you
  leave?*.
- **NOT_ON_CLOCK is two shapes on purpose.** `switchCode` and `endBreak`
  with nothing open throw it (each would otherwise open a fresh block — the
  old `endBreak` did exactly that); `clockOut` with nothing open answers
  `{ ok: true, closed: null, notOn: true }`, because the crew meant to be off
  the clock and are. A kept arrival (`opts.queued`) is still allowed to open
  a block with nothing open.
- **A kept clock-in waiting on yesterday's block never holds *When did you
  leave?*** (`cqHolds`). `openSheet` turns every clock sheet into the
  clock-in sheet while one waits (T2.31, `CQ_HOLDS`), and `left` is among
  them, so the first cut deadlocked: the clock-in waited for the question and
  the question waited for the clock-in. t233-test pins it. A stale item keeps
  `stale` until `leftOut` lands, `cqOverlay` never draws it as the running
  clock, and `cqSend` skips it while `leftOvernight()` holds.
- **`owner` on a kept clock-in is the signed-in email** (`myEmail()`: `S.me`,
  else the token's). One saved before T2.33 has none and counts as whoever is
  signed in — the old behavior, and the only reading available. Someone
  else's is not this person's to send, so neither it nor the start photo
  waiting on it (`waitRid`) counts in the clock or photo lane (`qMine`,
  `cqNotMineRids`) — counted, it would block sign-out, the one way its owner
  can get back in. `wipePhoneState` keeps them both for their owner, reading
  whose is whose before it clears the sign-in. Only kept clock-ins carry an
  owner; the rest of D31 (an owner on every waiting item) is Step 3.
- **Close Out items carry their own `tries` and `next`** (`coPump`). A job's
  items still go by `seq`; an item that could not go (no answer, a 5xx, a 401
  from the server's key) blocks only its own `jobId` for the rest of that
  walk; a 409 is held with its own next time and blocks nothing; a refusal
  (4xx, 410, an inspection with no `completedTaskId`) is kept and walked past,
  as before. The next walk is set for the soonest `next` among held items and
  the first item of each job (those behind it wait for it), so a job waiting
  on its backoff is not re-walked every few seconds. `CO.pumpFails` is no
  longer read by the walk. Signed out stops the walk and counts nothing.
- **A block from a day before has its own start line** (`startedBefore`):
  *Started Sun Nov 1, 7:02a* / *Empezó el Dom 1 nov a las 7:02a*, and the
  drive's *Since …* the same. The first cut glued the day onto the time, which
  read as "Nov 17" on a phone and as *a las Dom 1 nov* in Spanish.
- **The server half is live**: at 16:23Z on 2 Nov 2026 (Carl: *"go, deploy
  the server now"*) DB CheckOut's `main` was fast-forwarded to eb84c5a,
  `dpl_E4f2y8XqVaVUdVjU8dKKt891ekWQ`, and `/health` answered
  `{"source":"d0b195b48064","on":"vercel","commit":"eb84c5a"}` with
  `"contract":2`; `/jobs` and `/queue` still 401 with no token, and no
  runtime errors. The 4387f3f deployment (`dpl_2aGXqxaGeoKH1gpwt7irLFCFnrQR`)
  is the rollback. Until the phone's T2.33 is on the phones, Diagnostics on a
  T2.32 phone reads the server as level 2, which it accepts (it needs 1).
- **`completedTaskId` is the receipt.** The phone treats a 200 on `close` or
  `area` without it as recorded nowhere (`notRecorded`). DB CheckOut's
  close-inspection always names it since eb84c5a; an older server answers
  null on a job with no Final inspection task, which is exactly D22.
- **`enFix` on a Close Out item** is a note saved before its English came
  back: `{ field: 'final' | 'area' | 'repair', said }`. `coEnFix` asks once
  more as the item goes (8 seconds, the old wait), writes the English in with
  the words as said in brackets, clears `enFix` and saves the item; no answer,
  it goes as said. The send itself no longer waits on the English.
- **Two vocab collisions checked**: `signedOutWait` is a new `coAdd` key and
  'Waiting for you to sign in again' a new `esAdd` one; neither existed. The
  T2.33 sentences are in `esAdd({ … }) /* T2.33-ES */` and
  `coAdd({ … }) /* CO-T233 */`.
- **The mock grew switches**: `__MOCK_ST` (the clock as JobTread holds it, to
  change behind the phone's back), `__MOCK_EXPIRED` (every call refused as
  signed out), `__MOCK_NOTICEFAIL` (the comment to the PM fails: morning,
  evening, leftSite, startedEarlier), `__MOCK_CO_NOTASK` (an old server's OK
  with no task), `__MOCK_CO_GONE` / `__MOCK_CO_502` (a repair answered 410 or
  502, by task id) and `__MOCK_OLD_BREAK` (a server from before T2.13 that
  reopened on Back to work). `getBuilds` reports contract 2.
- **Two suites moved with the build**: t232-test reads the build from the
  files instead of pinning T2.32 (six of its checks failed on every new build,
  the T2.30 lesson again), and t230-test's "a server that reports no level is
  not called behind" became the opposite — the phone needs 2 now, so a server
  older than T2.30 is behind and said to be. code-test's old *…and back to
  work opens a new one* (which failed in this container on T2.26 too) is gone,
  replaced by the D29 refusal, so the only suite that fails here is push-test
  (6/14, the test setup serves no Firebase files).
- **Not done on purpose**: the roll-out notice (`rollForgot`) still answers OK
  when its comment fails — throwing `Pave:` there would have the phone retry
  a notice that may have half-landed; Step 3 with D31. And whether a crew
  member may say afterwards that a break ended early is Carl's (D27: *ask the
  office* until then; End break early still works in real time).
- **The training videos are further out of date**: the morning-after screen,
  the "couldn't be told" words and sign-out's draft warning are new on screen.
  Carl's "Do not recreate videos yet" still stands.
- **`CREW-ASSIGNMENTS-API.md` spelled color the British way** (line 165). It
  must stay byte-identical with the board's copy, so it changed in both repos
  in one session — T2.36's, with the line-by-line save.
- **T2.33 is live**: Carl ran the one chain (`clasp deploy … -d "T2.33"`,
  `firebase deploy --only hosting`) after the Close Out server; by 16:37Z on
  2 Nov 2026 db-crews.web.app served `index.html`, `sw.js` and
  `app.js?b=T2.33` byte-identical to the branch, `/` and `/index.html`
  `no-cache` with the report-only policy, and his Diagnostics read App and
  API both T2.33. `check-build.mjs` against the live site says "T2.33 is
  already live and app.js is unchanged"; the Close Out server showed no
  runtime errors through the switch.

## T2.34 (2 Nov 2026) — Step 2 of the second audit, what the README does not say

- **Step 2 is D40, I12 with I14, I16 with D32, D37 and D33** (the report:
  https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr). This repo's half, DB
  CheckOut's (N/A and who answered on each line, the photo time, `GET
  /assigned`, contract 3) and the board's Review sheet (it reads both markers
  off each checklist line) were built together. The report's "then re-record
  the training videos" is NOT done: Carl's "Do not recreate videos yet"
  stands, and they are further out of date now (Today, the Waiting card, the
  N/A reason).
- **The Close Out push lives in `sweepSchedulePushes`** and goes first
  (`sweepCloseoutPushes_`): it answers to the Close Out server, so the board
  being unset or down must not stop it. Per phone whose owner is service or
  Operations (`closeOutAllowed_` on the token's email), one `GET /assigned`.
  The snapshot is `cop_<userId>`: task id → `'r'` or `'i'`, the day booked,
  `|` and the job's name — a task deleted in JobTread can no longer say where
  it was, so the snapshot does. The first run only snapshots; a failed fetch
  or a failed push leaves the snapshot as it was (the next hour says it); a
  dead token takes its snapshot with it, someone moved off service loses
  theirs, and a snapshot whose phone has gone is cleared. `known` is capped at
  120 (what the server reads); something the server's scan did not reach and
  still open and still theirs is kept, never news. Finished work is said by
  nobody. `pushSafe_` wraps `sendPush_`, which throws when FCM is not set up:
  the schedule sweep used to stop at the first phone for that.
- **The token carries the email now** (`registerPushToken`), lowercased. It
  is the server that writes it, so any phone build registering after the Apps
  Script deploy adds it; a record from before has none and is skipped until
  that phone opens the app again.
- **`CO.jobFresh` is "the last read came from the server"**, set only by a
  good `coLoadJob` and cleared by `coOpenJob`. The removed-repair screen shows
  only then: a restored copy that lacks the task (a copy older than the task)
  still reads Loading while the read runs, or the error after. A reassigned
  repair stays on the job's list — the server lists every punch to-do,
  anybody's — so "given to somebody else" is the repair screen's *For* line,
  not the removed screen.
- **A reopened repair is judged against when the read set out** (`askedAt` in
  `coLoadJob`), the phone's own clock on both sides: a numeric Done older than
  `CO_REOPEN_GRACE_MS` (10 min) before it, with the task listed open, is let
  go. A read that set out before the Done landed can never undo it, and
  `'queued'` is the outbox's.
- **N/A reasons are one flat map by item key** (`naReasons`): the keys are
  unique across every form, which DB CheckOut's `forms.test.ts` pins. The
  phone keeps them in `v.naWhy` / `av.naWhy`; a reason stays in the store if
  the answer changes to OK, but only an N/A line sends one. Sent as typed,
  like the site checks' n/a. The line name the server writes is
  `<base> — n/a: <reason> — by: <name>` (a bare ` — n/a`), and only those
  exact markers split a name, because the template's own words carry " — "
  and phrases like "by the chimney". The board's reader (`checklistLine`)
  leaves an old ` · ⚠ REPORT …` suffix as text; the server's strips it.
- **The second inspection unticks a line only when a REPORT is open on it**
  (`openReportCodes` on DB CheckOut): this visit answered Fix, not fixed on
  site, and an open REPORT punch item carries the line's code. A replay of
  the same close gives the same line.
- **A camera photo's time is `rec.at`**, when the phone kept it after the
  shrink (within a second of the shutter). The server takes a time from 2000
  to a day ahead and stamps it in Ohio time; an older server ignores it.
- **A new Close Out route needs its line in DB CheckOut's `vercel.json`.**
  Anything not named there falls through to the retired app's notice page,
  which answers 200 with HTML. `GET /assigned` shipped that way on the first
  preview (b225edc) — every hourly push would have read as a failure and said
  nothing — and was caught only by asking the preview itself, since the
  server's tests call the handler directly. 96f8830 routes it, and DB
  CheckOut's `routes.test.ts` now fails when a path the handler answers has
  no rewrite. Read a preview's answer for any new route before calling it done.
- **Contract 3**: `PHONE_CONTRACT` 3 on DB CheckOut, `CO_CONTRACT_NEED` 3
  here. Against level 2 nothing breaks: the reasons and the times are
  ignored, and `/assigned` is a 404 the push counts as failed.
- **Today's next action follows a fixed order**: site checks (only for whoever
  may sign them, site manager or Operations), the pre-start, the Close Out
  work on arrival, today's log when it is prompted. It hides on a break, a
  drive, at the shop, on a kept clock-in and on a block from a day before.
  `#todaySect` draws only while the "which one are you at?" pick is not
  showing. `#todaySect` and `#waitSect` keep `_drawn` like `#jobsList` (I9):
  anything else that writes into either must clear it.
- **One set of five states for every waiting list.** Close Out's own list
  says them too, which is why `closeout-test`'s refused chip reads *Te
  necesita*, not *rechazado* — the rule, not a regression.
- **A suite moved with the build**: t230's two contract checks read
  `CO_CONTRACT_NEED` from the page instead of pinning a level (the T2.30
  lesson again).
- **The mock grew switches**: `__MOCK_CO_REMOVED` (a repair the office took
  off — gone from the job's list) and `__MOCK_CO_REOPEN` (one it reopened —
  open whatever the phone finished), a task id or a list; `getBuilds`
  reports contract 3.
- **Not done on purpose**: the push for anyone outside service and Operations
  (I13, Close Out for anyone assigned, is Step 3); the schedule pushes are
  still English ("Tomorrow", "Schedule changed").
- **The server half is live**: at 18:50Z on 2 Nov 2026 (Carl: *"go, deploy
  the server now"*) DB CheckOut's `main` was fast-forwarded to 831136a,
  `dpl_CWU9ZMs7gP7zzHuvhn7MDmpXdUMe`, and `/health` on
  closeout.deitemeyerbrothers.com answered
  `{"source":"157fcfa809fc","on":"vercel","commit":"831136a"}` with
  `"contract":3`; `/queue`, `/jobs` and `/assigned` answer the API's own 401
  with no token, and there were no runtime errors. The eb84c5a deployment
  (`dpl_E4f2y8XqVaVUdVjU8dKKt891ekWQ`) is the rollback.
- **The board's half is live**: its `main` at 7e4db6e
  (`dpl_Fe5wogiwNDfrY3UWUZ16cZXy6KKN`, 19:24Z on 2 Nov 2026, Carl's browser
  check on the fixtures) reads N/A and who answered off each checklist line
  (`checklistLine`, `lib/closeout.ts`); the board's branch was deleted after
  the merge.
- **T2.34 is live on the phones**: by 20:05Z on 2 Nov 2026 db-crews.web.app
  served `index.html`, `sw.js` and `app.js?b=T2.34` byte-identical to the
  branch at 4357ff1, and `check-build.mjs` against the live site says "T2.34
  is already live and app.js is unchanged". The Apps Script's build was not
  read from here; in the chain Carl runs, `firebase deploy` only starts once
  `clasp deploy` has worked. The Close Out server and the board showed no
  runtime errors from their deploys to 20:05Z. **The Close Out push was the
  last part to start**: no push of any kind had ever been sent, and it went
  live with all the others that evening — next section.

## Pushes on the script's own sign-in (2 Nov 2026) — what the README does not say

- **No push had ever been sent.** Checking T2.34's push, Carl found the live
  script (it is **DB Crew App** at script.google.com; he looked in DB Cam
  2.0's first) with the hourly `sweepSchedulePushes` trigger installed but no
  `PUSH_ENABLED`, `FCM_PROJECT_ID` or `FCM_SERVICE_ACCOUNT`. Every run
  stopped on its first line, so the before-photo nudge, the 7pm "Still on
  the clock" (T2.24), the break reminders (T2.13), "Tomorrow" / "Schedule
  changed" and T2.34's Close Out push had never reached a phone. The phone's
  Diagnostics "Notifications: on" is only the phone's half (it signed up), and
  the break screen promised a reminder anyway. The Triggers page lists only
  the signed-in account's own triggers.
- **The organization refuses service account keys** ("Key creation is not
  allowed on this service account", Firebase console, Google's default for
  newer organizations), so SETUP's key could not be made. Carl chose the
  script's own sign-in over lifting that block ("go with 1").
- **`fcmAuthHeaders_`** is the one place it is decided: `FCM_SERVICE_ACCOUNT`
  set → the key, as before; unset → `ScriptApp.getOAuthToken()` plus
  `X-Goog-User-Project: <FCM_PROJECT_ID>`. The header is needed because the
  token belongs to Apps Script's hidden default Cloud project, where the FCM
  API is not on and cannot be switched on; it names db-time-clock as the
  project the call counts against, which the account may do as an Owner or
  Editor there. The token is never cached (it is the running account's).
  If FCM still refuses it, the next thing to try is moving the script onto
  the standard Cloud project db-time-clock (Project Settings > Google Cloud
  Platform project) — untried.
- **`appsscript.json` lists its permissions now** (`oauthScopes`: external
  requests, triggers, send mail, the user's email, Firebase messaging),
  because Apps Script cannot infer `firebase.messaging` from the code, and
  once the list is written it infers nothing. `code-test.mjs` scans Code.gs
  for every Apps Script service and fails on one whose permission is missing
  or unknown, and on a permission nothing uses. **The order of a deploy that
  changes the list**: `clasp push -f`, run a function in the editor and
  approve, THEN `clasp deploy` — a deployment the account has not approved
  answers every phone "Authorization is required". Triggers run the saved
  code, so they fail between the push and the approval (Google may email
  about it); the access feed copy lasts 24 hours, so nothing is lost.
- **`testPushToMe` and the hourly sweep log their answer**: the editor and
  the Executions page show what a function logs, never what it returns.
  `testPushToMe` ignores `PUSH_ENABLED`, so it is the test that reaches no
  one else. The hourly line is counts only (`schedule pushes: {…}`), never a
  token or an address.
- **Proven live, not only against stubs**: Carl's `testPushToMe` landed on
  his phone (2 Nov 2026), so FCM takes the script's own token for
  db-time-clock with the `X-Goog-User-Project` header — the Cloud project
  move above was never needed. `PUSH_ENABLED` turns on every push whose
  trigger is installed, for everyone, at once.
- **Switched on, about 21:30Z on 2 Nov 2026.** Carl ran SETUP 4b's order
  from 3383459: the Overview's four permissions matched the new list,
  `FCM_PROJECT_ID` = `db-time-clock`, `clasp push -f`, approve and
  `testPushToMe` in the editor, then `clasp deploy … -d "T2.34 push
  sign-in"`, and set `PUSH_ENABLED` = `true`. The web app's GET answered
  "Opening DB Crew" at 21:36Z (an unapproved deployment answers
  "Authorization is required"). The test push landed, and all three push
  triggers are installed (`sweepSchedulePushes` hourly,
  `sweepBeforePhotoNudges` every 5 minutes, `sweepBreakReminders` every
  minute), so every push is live from then: the before-photo nudge, the 7pm
  "Still on the clock", the break reminders, "Tomorrow" / "Schedule changed"
  and the Close Out push. The first hourly run after 4pm sends "Tomorrow" to
  every registered phone with a booking the next day; the Close Out part and
  "Schedule changed" only take their snapshots on it. Its line on the
  Executions page (`schedule pushes: {…}`, `"failed":0` both places) was not
  read from here.

## `main` (2 Nov 2026)

- **`main` was 48 commits behind what the phones ran** — it stopped on 28 Oct
  at e177049, before T2.16, because every deploy pulls
  `claude/zealous-hopper-j7xy98`. A fresh clone of `main` was three weeks old
  and had no `check-build.mjs` to stop it going out. At Carl's word ("bring
  main up to date") it was fast-forwarded to the branch, no force. Deploys
  still pull the branch; nothing deploys when `main` moves (no workflows).
- **Standing rule: keep `main` level at the end of each round** (Carl, 2 Nov
  2026, *"keep main level at the end of each round"*). When a round is handed
  back, fast-forward `main` to the branch's last commit —
  `git push origin claude/zealous-hopper-j7xy98:main` — and check the two
  match. Never force. If `main` ever holds a commit the branch lacks, merge
  `main` into the branch first (a merge commit), then fast-forward; if both
  changed the same thing, ask Carl.

## T2.35 (2 Nov 2026) — Can't finish today (audit I10), what the README does not say

- **Step 3 of the second audit** (the report:
  https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr) starts here. Its order:
  I10 (this) → I11 → D25 → I13 → I15, D31, D39, I17, D28, D30. The server half
  is DB CheckOut's bf552e1 (`POST /tasks/:id/blocked`, `PHONE_CONTRACT` 4),
  the board half is `bledsoecw/DB_Production_Board` f2099e6 (the *Couldn't
  finish* group); both reached their `main` on 2 Nov 2026 (the last bullet).
- **The waiting line is one family in three repos**: `⏳ Waiting on
  material` · `on access` · `on the weather` · `on a decision` · a bare
  `⏳ Waiting` (anything else), then ` — <words> (<name>, <Mon D>)`. DB
  CheckOut writes it (`waitingLine` in `packages/shared/src/jobtread.ts`),
  the board reads it (`waitingOf` in `src/lib/trades.ts`) and the phone hides
  it from *what to do* (`coWhat`). Change the three together. The board's own
  `⏳ Waiting on material` is the first of the family, so a crew's material
  line and the PM's read as one thing.
- **The day comes off on the server, on purpose**: the board's Close-out list
  asks only about open repairs with no day, so a repair that kept its spent
  day would never reach the PM. The PM's new day answers any waiting line
  (`punchDescription` on the board); Done strips it (`completeTask`).
- **`coSnapDayOff_`** rewrites the sayer's own Close Out push snapshot
  (`cop_<userId>`) when the send lands, so the hourly push does not tell them
  *Moved: repair at … to no day* about their own tap. A sweep already running
  when the send lands can write the old day back; then the push says it an
  hour later, which is the worst case and not worth a lock.
- **An outbox item of kind `blocked`**, sent as `coBlocked(taskId, jobId,
  reason, note, ref)`. Its photos ride `<ref>.m0`… ahead of it, the shape a
  repair's extra photos use, and DB CheckOut links up to eight of them
  (`REPAIR_MORE_MAX`) to the message; the rest are on the repair, unlinked.
  The draft lives in `coVisit` as `cantReason` / `cantNote` / `cantPhotos` /
  `cantEn` by task, and keeps the visit from being trimmed (`coVisitIdle`).
- **Vocab**: `coAdd({ … }) /* CO-T235 */`. `cantReach`, `cantReachSub` and
  `waitSending` already existed, so the new keys are `cantBtn`, `cantR_*`,
  `cantS_*`, `cantNoteK_*`, `cantWaitSending`, `waitR_*` and the rest;
  `I18N_CLASH` stays empty (t235-test checks it).
- **Not done on purpose**: Today's jobs still counts a waiting repair as one
  of the *repairs open* — it has done that for any undated open repair since
  T2.34 ("booked today or has repairs open"). A per-job waiting count in DB
  CheckOut's `/queue` would let Today leave them out; ask Carl first.
- **Two suites moved with the build**: t234's contract check reads
  `CO_CONTRACT_NEED` from the page now (the T2.30 lesson again), and
  closeout-test reads Done's own line (`#coDone + .foot`) instead of the
  screen's last one, which is the new button's now. The mock
  keeps `CO_WAITING` per task and lays the line over `coJob` the way DB
  CheckOut writes it; `getBuilds` reports contract 4.
- **The training videos are further out of date** (the new button). Carl's
  "Do not recreate videos yet" stands.
- **The board and the server halves are live**: at 23:01Z on 2 Nov 2026
  (Carl: *"go, deploy the board and the server"*) the board's `main` was
  fast-forwarded to f2099e6 (`dpl_F5LzePBDcQVViXcxxfBYTQ44Vj2u`, ready
  23:01:50Z on ops.deitemeyerbrothers.com; the rollback is 7e4db6e,
  `dpl_Fe5wogiwNDfrY3UWUZ16cZXy6KKN`) and DB CheckOut's to 414e503
  (`dpl_36KKNELGSejzERJQcEimcTva4aXg`), whose `/health` answered
  `{"source":"5405cbdbf6c5","on":"vercel","commit":"414e503"}` with
  `"contract":4` by 23:01:52Z (the rollback is 831136a,
  `dpl_CWU9ZMs7gP7zzHuvhn7MDmpXdUMe`). With no token, `POST /tasks/x/blocked`
  answers the API's own 401 JSON — the route is routed, not the notice page —
  and so do `/queue`, `/jobs` and `/assigned`. The server showed no runtime
  errors; the board's one error group (a JobTread 25-second stall on
  `/api/schedule` at 21:35Z) was on the deployment before. A T2.34 phone needs
  contract 3 and reads 4 without a warning. The Apps Script and the phones
  are Carl's chain (`clasp deploy … -d "T2.35"`, `firebase deploy`).
- **The phones are live; the API's label was left behind.** Carl ran the
  chain the same evening: db-crews.web.app served `index.html`, `sw.js` and
  `app.js?b=T2.35` byte-identical to the branch by 23:16Z, `/` `no-cache`
  with the report-only policy. But his Diagnostics read API T2.34: 8e47084
  never bumped `APP_BUILD` in `Code.gs`, so the API ran the T2.35 code under
  the old label and every phone's Diagnostics warned *"This app (T2.35) is
  newer than the API (T2.34)"* (`buildWarnings`; it gates nothing).
  `check-build.mjs`'s message names `Code.gs` but never read it, and it runs
  after `clasp deploy` in the chain anyway. code-test now fails when
  `Code.gs`'s build is older than `app.js`'s, the same comparison the phone
  makes. The label went out with a second `clasp push` / `clasp deploy` of
  the same branch (`-d "T2.35 label"`, no `firebase deploy`: the phones
  already had T2.35), and Carl's Diagnostics then read App and API both
  T2.35. **T2.35 is live in all four places.**

## T2.36 (2 Nov 2026) — checklists saved a line at a time (audit D25), what the README does not say

- **Two gates, both needed** (`ckLineSaves()`): the job list's
  `checklist.saves === 'lines'` (the board says it takes a partial save) AND
  an API at T2.36 or later (`buildNum(api) >= 2036`; `'mock'` counts as new,
  an empty build does not). Either missing and the phone sends the whole list,
  exactly as T2.35 did. An older board reads any save as the whole list (an
  absent `signOff` unsigns, an absent `magnetBy` is wiped, a pre-start line
  left out is unticked); an older `Code.gs` drops `was` and always sends
  `magnetBy` and `signOff`. With both gates the deploy order cannot do harm —
  the board half's flag (`saves: "lines"` on `checklistShape()`) is what made
  that true, added after the first cut relied on the order alone.
- **`base` on each entry is the board's list as last handed over**, never the
  phone's copy. `ckDelta` (the board's `checksSave` in the phone's words)
  sends what differs from it; `ckMerge` lays what was touched DURING a save
  back over the board's answer; a line the board did not take carries the
  board's value afterwards, so it is never sent again over somebody else's
  change without the person seeing it. Never rebase `base` while an entry is
  dirty: a newer board answer would turn the phone's stale untouched lines
  into "changes" and overwrite with no conflict.
- **A clean save hands the entry back** (`ckReconcile`: `state` and `base`
  null once the next job list lands), so a test reads the board's copy off
  `visitForChecks(tid).checks.state`, not off `ckStore`. An entry kept from
  before T2.36 has no `base` and goes whole once.
- **Refused means `e.refused`**: `true` for a 400 (not asked again until a
  change, a sign tap, or Let go), `'role'` for a 403 (asked again at once when
  `ckClearRO()` runs — the profile says Site Manager — else at most hourly on
  waking, `roleRetry`/`e.roleTry`). A 200 clears the read-only memory, because
  the board took a write from this person. The status chip says *Not saved*;
  the notice says the reason (`ckReasonWords`, the err without its prefix);
  the board's own words ride `e.why`, never inside `e.err` (which is looked up
  in Spanish).
- **A refused list no longer on the phone is let go from Waiting to send**
  (`drop` on the item, two taps, `S.waitDrop`), or it would block sign-out
  with no way to open it. The checks screen's *Let my changes go* arms for
  eight seconds (`LETGO`).
- **Conflicts live on the entry** (`e.conflicts`) until *Got it*, so they
  survive a reload and the hand-back. Only a line with words can conflict; a
  tick, the signature and every pre-start box cannot (booleans: the board
  finds them either as the phone saw them or as it wants them).
- **The mock grew switches**: `__MOCK_OLD_BOARD` (no `saves`; a save read as
  the whole list), `__MOCK_API_BUILD` (what getBoot says), `__MOCK_CK_EDIT`
  (somebody else's change just before the next save) with `__MOCK_CK_BY`,
  `__MOCK_CK_REFUSE` (the 400), `__MOCK_PRE_EDIT` and `__MOCK_PRE_REFUSE`.
- **`dev/t236-test.mjs` reads a missing element as empty** (`txt`, `cls`,
  `box`, `val`, `tap`) so a run against an older build reports what is missing
  instead of timing out: against the T2.35 phone 44 of its 73 checks fail, and
  all pass on T2.36. `checks-test.mjs` moved with the rule (the whole-state
  checks became line checks; the 403 keeps the tick) and reads today's date at
  the check, not at the start.
- **clock-test's evening-push step fails between about 00:30 and 02:00 UTC**
  whatever the build: `__MOCK_OPEN_AGO=90` then started yesterday, and the
  T2.33 day-before rule answers instead. Measured on the T2.35 phone at 00:35
  UTC with the same failure. It is the container's clock, not the app: run
  with the browser on Ohio time (`TZ=America/New_York node
  dev/clock-test.mjs`) it passes 229/229 at the same hour. code-test's D21
  check had the same fault in its own setup — "yesterday" was the UTC date
  less one, still Ohio's today until midnight Ohio — and crashed the suite at
  00:55 UTC; it takes the script's day now (`addDays_(today, -1)`). push-test
  is 6/14 here as before.
- **Not done on purpose**: the training videos (Carl's "Do not recreate
  videos yet" stands; the notices are edge-case screens), and a conflict on
  the sign-off line (it cannot happen with a boolean, so the phone has words
  for it and no test reaches it).
- **The board half is live**: at 01:24Z on 3 Nov 2026 (8:24pm on 2 Nov in
  Ohio; Carl: *"go, deploy the board"*) the board's `main` was fast-forwarded
  to f8613c1, after its 890 tests, `tsc` and lint ran clean
  (`dpl_4fvcF99mwFHnNqmS3HQBPEgXpDL4`, ready 01:24:51Z on
  ops.deitemeyerbrothers.com, no alias error; the rollback is f2099e6,
  `dpl_F5LzePBDcQVViXcxxfBYTQ44Vj2u`). With no token, `GET
  /api/crew/assignments` answers the route's own 401 JSON, and the
  deployment showed no runtime errors after the switch. `checklist.saves`
  itself was not read from here (the route needs `CREW_APP_SECRET`); the
  deployment's commit is the proof. Until the Apps Script and the phones are
  T2.36, every phone sends the whole list, which the board applies as sent
  (a body with no `was`). The Apps Script and the phones are Carl's chain
  (`clasp deploy … -d "T2.36"`, `firebase deploy --only hosting`).
- **T2.36 is live in all four places**: Carl ran the chain the same evening
  and his Diagnostics read App and API both T2.36. By 01:30Z db-crews.web.app
  served `index.html`, `sw.js` and `app.js?b=T2.36` identical to the branch,
  `/` and `/index.html` `no-cache` with the report-only policy, and
  `check-build.mjs` against the live site says "T2.36 is already live and
  app.js is unchanged". The board showed no runtime errors from its deploy to
  01:30Z. **The live files carry Windows line endings** (CRLF, from Carl's
  checkout): a raw byte compare reads every file as different, so compare
  with the `\r` taken out, as `check-build.mjs` does.

## T2.37 (3 Nov 2026) — whose work is waiting on a shared phone (audit D31), what the README does not say

- **Two mechanisms, chosen by the store's shape.** The stores keyed by a
  list, a job or a day (`OWN_STORES`: `ckStore`, `prStore`, `dlStore`,
  `rollStore`, `coStore.visits`) can hold one entry per key, so another
  person's entries are moved out whole into `held` (`dbtc_held`, by email)
  and every screen, count and sender reads only the signed-in person's. The
  queues keyed by item (IndexedDB `q` and `co`) and `clockQ` stay in place
  and are read by owner (`ownMine`): `CO.outbox` is the signed-in person's
  only (`coSplitOutbox`; `CO.others` holds the rest), `S.qItems` / `S.queued`
  the same (`S.qOthers` the rest). A new store keyed by job or day must join
  `OWN_STORES` with its `keep` and `rest`, and anything new that waits must
  call `ownStamp` where it is made (`ckEntry`, `prTouch`, `dlTouch`,
  `rollSet`, `rollForgot`, `coVisit`, `enqueueUpload`, `coEnqueue`;
  `startKept` has stamped clock-ins since T2.33) — or it goes as whoever is
  signed in.
- **`ownHandover()` runs first in `start()`.** `me` is the token's email;
  `last` is `dbtc_who`, the token's email written at the previous start —
  never the API's profile, because a plain reload must never read as somebody
  else (the mock signs a service-role phone in with Tyler B.'s token and
  answers Alberto as the profile; comparing with `dbtc_me` broke
  closeout-test's reopen-where-you-were on the first cut). `dbtc_me` stands in
  only on a phone from before T2.37, which has no `dbtc_who`. `myEmail()`
  now reads the token first for the same reason: the token is who the API
  acts as, so it is whose the work is. Different: every entry
  worth keeping goes into `held` (the new person's own too, to come back),
  `ownWipeKept` removes every `dbtc_*` key except `OWN_KEEP_KEYS` (the new
  sign-in, `held`, `clockQ`, the Close Out sequence, the photo tries), and
  the page reloads once the IndexedDB owners are written — the in-memory
  stores were loaded at parse time and still hold the last person's. After
  the reload `dbtc_me` is gone, so the routine path runs: others' entries
  aside (normally none), the signed-in person's back (`ownRestore`), and
  `dbtc_who` written.
- **`OWN.frozen`**: `authRefused` sets it, and `apiCall` then rejects every
  call but `exchangeSession` as `e.auth` (every lane waits, uncounted). Without
  it, the same-page sign-in (the gate that came up over the app) stores the new
  token while the old page's timers and its `pagehide` flush still hold the
  last person's work. The page always reloads after that sign-in.
- **Work saved before T2.37 is adopted once** (`ownAdopt`): for `last`, else
  `me` — on an upgrading phone that is `dbtc_me`, the last profile it kept. A start photo takes its clock-in's owner. T2.33's rule (an ownerless
  kept clock-in counts as whoever is signed in) is now only the in-memory
  fallback before the adoption is written.
- **`wipePhoneState` keeps** `held`, others' `clockQ` items, IndexedDB items
  not the leaving person's, and the Close Out photos those items or `held`
  visits reference (a plain `indexOf` of the photo id in `held`'s JSON — ids
  are `uid()` strings).
- **`held` is a sixth waiting state** (after the five of T2.34): `WAIT_ORDER.held` is last,
  words *Waiting for {name}* (the T2.33 key), hint *Goes when they sign in on
  this phone*. T2.33's other-person clock rows moved from `signin` to `held`
  with the same words. Their drafts (a day log not sent, an inspection in
  progress) are set aside but not listed — they are not waiting to send.
- **The mock grew switches**: `__MOCK_KEEP_AUTH` (a sign-in the test made
  survives the reloads), `__MOCK_PEOPLE_TOKENS` (getBoot answers for the
  token's email, `exchangeSession` mints for it, and every call is logged as
  `[fn, email]` in `sessionStorage.mock_calls`, which outlives reloads), and
  `window.__mockToken(email, iss)`. A phone that never opens Close Out never
  starts the mock's `window.__CO`, so a test that sends a Close Out item there
  sets `window.__CO=[]` first, or the mock's handler throws.
- **Not done on purpose**: nobody can let go of another person's held work —
  if they never sign in on that phone again it stays there (the Waiting card
  and Diagnostics say whose); letting the office or Operations release it is
  Carl's call. The roll-out notice's half-landed comment (T2.33's note) is
  still open. `Code.gs` changed only its build label. The training videos:
  Carl's "Do not recreate videos yet" stands.
- **T2.37 is live**: Carl ran the chain the same evening (`clasp deploy …
  -d "T2.37"`, `firebase deploy --only hosting`) and his Diagnostics read App
  and API both T2.37. By 02:41Z on 3 Nov 2026 db-crews.web.app served
  `index.html`, `sw.js` and `app.js?b=T2.37` identical to the branch at
  5aacc1b (line endings aside), `/` and `/index.html` `no-cache` with the
  report-only policy, and `check-build.mjs` against the live site says "T2.37
  is already live and app.js is unchanged". No board change; the board showed
  no runtime errors from 01:24Z to then.

## T2.38 (3 Nov 2026) — a clock change kept behind a waiting one (audit I17), what the README does not say

- **One chain, in the order it was made** (`cqChain()`: this person's kept
  items not refused; `cqPending()`). The kinds are `in`, `switch` (`arrive`
  true for an arrival — out of a drive, or onto another job — false for a code
  change; one kept before T2.38 has neither and was an arrival, `cqKind`),
  `travel` and `out`. `commitStart`, `commitTravel`, `commitOut`,
  `doTravelOut` and `doBreakOut` keep when there is no signal OR anything is
  pending, so nothing made later can overtake a change still on the phone —
  including one made with signal while the one before it is on its way. Only
  the first is ever sent (`cqSend`); `cqLanded` sends the next at once
  (`next.next = 0`). A refused one does not stop the chain: what was made
  after it stands on its own, at its own moment.
- **`cqOverlay` shows the last change**, off the clock after an `out`, and
  takes the job of the last change that is not an `out` — after a clock-out
  the job is the person's to pick again. `cqOverlay(true)` (after When did you
  leave?) takes it whatever the kind. Boot and `clockReread` do not take
  JobTread's job while anything is pending (`cqTakesJob()`), except while one
  waits on a block from a day before, which is the job that question is
  about. t238-test proves the re-read line matters: put the old one back and
  two of its checks fail.
- **End photos wait on the change that opened their block** (`endPhotoOf`:
  `waitRid` = `S.open.id` without its `q:`), so Webster's end photo goes with
  the code-change block, never the clock-in's. A photo written while its
  change was landing would have waited for good (the release had already
  walked the store): the pump stamps it from `CQ_DONE` (the page's own record
  of what each change landed as) and saves it again rather than send that copy.
- **The server judges "a day before" at the write's own moment**
  (`staleOpen_(open, atMs)`): a change kept the evening the block began, sent
  the next morning, closes it that evening; a clock-out kept this afternoon
  under a block left open overnight is still asked about. A kept clock-out
  still needs its end photo (a refused one says to check the clock); the
  block a break planned goes when the clock-out was made before it began
  (`plannedBreak`), even once JobTread has started it; a kept drive may open
  with nothing running, as a kept arrival may.
- **The wait is counted back from the API's own clock**, so a request held in
  flight lands late by however long it was held. t238-test measured it (a
  request held five minutes put the clock-in at 7:07 for 7:02); a real one
  gives up after 25 seconds, which is the most it can be off by.
- **The gate**: `cqKeepsAll()` — the API's build (`S.builds.api`, else
  `me.build`, else the remembered `meSeen`) at T2.38 or later; an API the
  phone has not heard from is taken as current, because the phones get T2.38
  only after the Apps Script does. Below it the phone keeps no drive or
  clock-out and holds every move (`CQ_HOLDS_OLD`), as T2.31 did: an older
  Apps Script ignores `queued` on `startTravel` and `clockOut` and would put
  them at the moment they arrived — hours on the wrong side of the drive, with
  nothing said.
- **Today's hours read the kept blocks** (`dayEntries()`, the table only):
  JobTread's block running when the first change was made ends there, and
  each kept change runs to the next. Nothing that decides anything reads it —
  `startPhotoOwed` has its own look at the chain (`workedHereToday`), and the
  day log's hours do not count kept blocks yet.
- **What still waits**: a break, Started earlier and Already left (`CQ_HOLDS`).
  Each is checked against the entry itself, and a break kept with no signal
  would need its own past-time door on the server (JobTread takes a break as
  `endNow: { breakDuration }`, now or never) — whether to build one is a
  payroll call for Carl, not assumed here. Already left is hidden on the
  camera, the move sheet and the roll-out while changes wait.
- **The codes of today's booked jobs are fetched behind the schedule**
  (`assignPrefetchCodes`, six at most, the reads lane), so the drive to one
  finds its travel line with no signal. A job never opened and not booked
  today still needs signal to pick a code — measured, not fixed.
- **The mock grew**: `__queued(opts, jobId, costItemId, kind)` with Code.gs's
  `since` and `old` refusals and its notes, kept `startTravel` and
  `clockOut`, `__stale(atMs)`, `__MOCK_QREFUSE_ONCE` (the next kept write
  only), `__QUEUED` entries carry `kind`, and `getBuilds` answers
  `__MOCK_API_BUILD`. `__RIDS` is the mock's own array: empty it in place
  (`.length = 0`) — a test that replaces it reads an empty list for ever.
- **Two traps for a test, both hit writing t238**: a read (`getStart`) waits
  behind a write in flight on the `main` lane, so a test that holds a write's
  request and then awaits a clock re-read deadlocks — `page.evaluate` has no
  timeout of its own; and `apiCall` retries a dropped request by itself, so
  dropping one fetch never leaves a change waiting — drop them until the
  change has its first try counted. The suite runs on a page clock
  (`page.clock.install`, then `setSystemTime` for each change) in an Ohio
  `timezoneId`, so each change really is made hours after the last.
- **A suite moved with the rule**: t231's *clocking out waits for it* became
  *a break waits for it* — the rule, not a regression.
- **The training videos are further out of date** (the clock-waiting sheet
  lists the chain now). Carl's "Do not recreate videos yet" stands.
- **T2.38 is live**: Carl ran the chain the same day (`clasp deploy … -d
  "T2.38"`, `firebase deploy --only hosting`) and his Diagnostics read App and
  API both T2.38. By 23:05Z on 3 Nov 2026 db-crews.web.app served
  `index.html`, `sw.js` and `app.js?b=T2.38` identical to the branch at
  b1dc40d (line endings aside), `/` and `/index.html` `no-cache` with the
  report-only policy, `check-build.mjs` against the live site says "T2.38 is
  already live and app.js is unchanged", and the API deployment's GET answers
  "Opening DB Crew" (an unapproved one answers "Authorization is required").
  No board change.

## T2.39 (4 Nov 2026) — Close Out for anyone assigned (audit I13, step 1), what the README does not say

- **Two scopes, decided by role** (`coScopeOf_` in `Code.gs`): `all` for the
  service crew and Operations (everything, as before), `assigned` for everyone
  else. `closeOutAllowed_` now means "the whole of Close Out" and only the push
  sweep reads it. **Every Close Out function the phone can call gates itself
  before `coFetch_`** (`coGate_`, or `coScopeOf_` for the queue, `coMine` and
  the translator) — `coFetch_` no longer checks the role. code-test fails on a
  `co*` function registered in `WITH_USER` that calls `coFetch_` without one,
  so a new route cannot go out open.
- **What is theirs is `membership.assignedTasks`**, verified live (read-only,
  4 Nov 2026): it takes `where`, `size` and `count`, filtered server-side, with
  the Close Out server's own task kinds (`coTaskWhere_`: punch to-dos, and
  Inspection-typed `Final inspection%`). That day four people had open
  close-out work: Yahir 46, Alberto 46, Carl 1, Scott Rice 1 (26-1355
  Bricker_Service, the board's service-call rule). Never the Close Out server's
  `mine`, which matches names: a job it calls theirs with nothing of theirs in
  JobTread is left out.
- **Two kept copies, per person**: `coO_<userId>` (their open work by job, 5
  minutes — the tab, the push sweep, the translator) and
  `coJ_<userId>_<jobId>` (one job's tasks of theirs, open or done, 6 hours —
  CacheService's limit — written only when it holds something). A gate that
  misses reads JobTread once more before refusing. The job read, the queue,
  Done, Can't finish and closing an inspection read fresh; photos, reports and
  the scope summary ride the copy (ten site photos, one read). **Done tasks
  still count as theirs**: an after photo sent after the Done, or a send that
  landed and goes again, must be answered, never refused. JobTread not
  answering throws a Pave error (the phone tries again), never `NO_CLOSEOUT_WORK`.
- **What the assigned scope is sent** (`coQueueMine_`, `coOnlyMine_`): rows and
  the job carry `mine`, `myRepairs` (open), `myInspect` (open) and `scope:
  'assigned'`; `punchTasks` and `areas` are cut to theirs. On a job with work
  areas an inspection counts only through its area — a task no area names can
  never open the roof's checklist. The phone's `coKindOf` reads `myInspect` /
  `myRepairs` first: only an inspection → `inspect`; no inspection → `repairs`
  (done reads as their repairs, never an inspection to start again); both →
  the stage, as before.
- **The refusal** is `NO_CLOSEOUT_WORK: …` — it still matches `^NO_CLOSEOUT`, so
  an older phone treats it as a refusal too, in its old words. A refused
  `coLoadJob` drops the phone's copy of that job, so a stale copy cannot stand
  in for work taken away.
- **The phone's tab** is `TABS_BY_ROLE` plus `co` while `coAssignedTab()`:
  `S.coMine` (`dbtc_comine`, `{ who, scope, count, at }`) is this signed-in
  person's, scope `assigned`, and count > 0 — or they are on the tab, so
  finishing the last repair never pulls the screen away. Asked by `coMine` at
  launch and on coming to the front (30 minutes stale), never for the service
  crew or Operations, never with Close Out unset. A `count` it gets back
  (also on every queue answer, `mineCount`) loads the list behind the clock so
  Today and the arrival see it — a live one, once a launch (`coMineList`):
  the copy `coRestoreQueue` puts back at start for no signal is only last
  launch's, so a launch that trusts its kept answer and asks nothing still
  fetches the list (the first cut skipped it whenever that copy was there). `dbtc_comine` is not in `OWN_KEEP_KEYS`, so a
  handover clears it; the `who` check covers the rest. A `?tab=co` push before
  the phone knew sets `CO.wanted` and asks at once.
- **The push sweep** asks JobTread first for anyone outside the service crew:
  nothing open and no snapshot (or `'{}'`) → no Close Out call, and `'{}'` is
  written as their starting point, so the first work anyone gives them is a
  push, not a snapshot. Nothing open but a non-empty snapshot → the Close Out
  server is asked once more, to say what went. Moving someone off the service
  crew no longer deletes their snapshot: the work JobTread gives them is still
  theirs to be told about.
- **The field crew are on personal addresses in JobTread** (read-only, 4 Nov
  2026: the whole construction bench — Brian Bowers on Hotmail, Ian Poe on
  Yahoo, the rest Gmail — plus Kodey, Nick Sowers, Lexi, Rick Bright, Drew,
  Aiden, and Tyler and Kenton; only the office, the PMs, sales, Yahir, Alberto
  and Chris Blue are on the company domain). DB CheckOut acted for
  `@deitemeyerbrothers.com` and its own `GOOGLE_ALLOWED_EMAILS` only, so it
  would have refused nearly everyone I13 is for. Its door now also acts for an
  address JobTread has as an internal membership (`actingPerson` /
  `isInternalMemberEmail` in DB CheckOut, exact match after `=` then `like`,
  ten minutes per instance, a 503 "try again" when JobTread does not answer)
  — DB Crew's own sign-in rule, so no second list. `GOOGLE_ALLOWED_EMAILS`
  stays (Sensitive on db-check-out Production since late Aug 2026; its
  contents cannot be read from here) and still works as before.
- **`not-listed`**: a 401 from DB CheckOut for an acting address off the domain
  comes back from `coFetch_` as `{ status: 403, reason: 'not-listed' }` with
  the address in the words — what a DB CheckOut older than this round answers
  the bench — and the phone says so, keeping their work for Retry. A company
  address's 401 is still the key's (`http-401`).
- **Construction is step 2.** DB CheckOut sends no `areas` on a job that is not
  roofing and `jobFormKey()` answers the roof form for every job, so a
  construction final inspection assigned to someone would open the roof's
  checklist — exactly as it does for the service crew today. Nothing assigns
  one yet (the board's defaults are roofing and service only); the form comes
  first.
- **The mock grew**: `__MOCK_CO_ASSIGNED` (`{ <jobId>: { repairs: [ids],
  inspect: true | '<inspection task id>' } }`, read the way Code.gs reads
  JobTread), `__MOCK_CO_NOTLISTED`, a `coMine` handler, and the gates on every
  Close Out handler. `window.__CALLS` is the mock's list of every call;
  `window.__CO` records only the writes, `coMine` and `coTranslate` — a test
  that asks whether the queue was fetched reads `__CALLS`.
- **A suite moved with the rule**: code-test's *a crew member is refused before
  any call* became *a crew member with Close Out unset is told so too*, and
  the push sweep's *the crew member is never asked* / *moved off the service
  crew: the snapshot goes* became the JobTread-first rules above.
- **Not done on purpose**: letting the office or Operations release work held
  for somebody else on a shared phone (T2.37) is still Carl's (#7 below), and
  the training videos (Carl's "Do not recreate videos yet" stands; the
  Close Out tab now appears for more people).
- **The server half is live**: at 00:47Z on 4 Nov 2026 (7:47pm on 3 Nov in
  Ohio; Carl: *"go, deploy the server now"*) DB CheckOut's `main` was
  fast-forwarded to eb2b4e4, `dpl_35UDuhNVM8vLApeYLHE6Gch5sUUw`, and `/health`
  on closeout.deitemeyerbrothers.com answered
  `{"source":"006185e192e5","on":"vercel","commit":"eb2b4e4"}` with
  `"crewApp":true` and `"contract":4`. `/queue`, `/jobs`, `/assigned` and `POST
  /tasks/x/blocked` answer the API's own 401 with no token, a wrong secret
  naming a crew member's Gmail is a 401 too, and there were no runtime errors.
  The 414e503 deployment (`dpl_36KKNELGSejzERJQcEimcTva4aXg`) is the rollback.
  Nothing changes for anyone until the T2.39 Apps Script is out: the one live
  before it calls the server only for the service crew and Operations. The
  JobTread query the new door sends was run read-only against the live org
  first (Scott Rice's Gmail found exactly and in capitals, Ian Poe's `_`
  address finds Ian Poe himself, a made-up address finds nobody).
- **T2.39 is live in all four places**: Carl ran the chain (`clasp deploy …
  -d "T2.39"`, `firebase deploy --only hosting`) after the Close Out server,
  and his Diagnostics read App and API both T2.39 (4 Nov 2026). By 16:45Z
  db-crews.web.app served `index.html`, `sw.js` and `app.js?b=T2.39`
  identical to the branch at 2cd4644 (line endings aside), `/` and
  `/index.html` `no-cache` with the report-only policy, `check-build.mjs`
  against the live site says "T2.39 is already live and app.js is
  unchanged", and the API deployment's GET answers "Opening DB Crew". The
  Close Out server showed no runtime errors from its deploy to 16:43Z. No
  board change.

## T2.40 (4 Nov 2026) — construction final inspections (audit I13 step 2), what the README does not say

- **Three repos, one rule.** Carl (3–4 Nov): the job's sales rep does a
  construction job's final inspection, the PM covers when the rep is busy or
  already on site, and it is *"notes a photos for now"*. The board assigns
  (`jobPeopleInspectors`: every name in the Sales Rep field, then the PM,
  resolved by name to memberships), DB CheckOut lists it (one area,
  `construction`, form `notes`, `line: false`, on the job's own "Final
  inspection" line) and closes it (`close-area-inspection` with that area,
  Status by Close Out's own `applyLinear`), and the phone draws it on the
  work-area screens it already had. Contract 5 (`PHONE_CONTRACT` there,
  `CO_CONTRACT_NEED` here).
- **`line: false` is on purpose.** On the phone `line` means "this area's
  inspection is the roof checklist on the job screen"; a notes area that is
  not the line is a tile with its own screen and send. So every phone build
  that knows areas (T2.27 on) already draws and sends the construction
  inspection — the server deploy alone switches construction from the roof
  checklist to notes and photos, and T2.40 only adds its words.
- **`coIsConstr(j)`** separates the two meanings of "areas": the screens
  (`coMultiArea`, which a notes area turns on) stay, and the words about the
  board's loop (`areaWhatNext`, `lastClosesAreas`, *Work areas · each is
  inspected and approved on its own*, *the PM books it on the board*) give way
  to Close Out's linear words (`toPmReview` / `toPunch`) and the CO-T240
  block (`constrK`, `constrSub`, `constrHint`, `constrNotBooked`).
  `CO_AREA_ES.construction` is `['Construcción', 'la obra']`. No key
  collided; `I18N_CLASH` stays empty.
- **Opening a construction inspection asks nobody to clock in.** The area
  tile's T2.15 clock prompt (`coClockHere(jobId, key)`) is skipped for
  `construction`: the inspection is the sales rep's and the app knows of no
  rep on the time clock, so the prompt would make a time entry for someone
  who may not be hourly. *Assumed, and flagged to Carl* — whether reps clock
  in for an inspection is a payroll question. "Clock in here" on the job
  screen and Start on the card are still there for anyone who clocks (Neal
  does). t240-test pins it: against the T2.39 phone the suite stops at the
  code sheet that opens over the construction screen.
- **Measured before it was built (read-only, 4 Nov 2026)**: nine
  construction jobs at Final Inspection, none with a "Final inspection"
  line, all moved there in the JobTread app (Amy, the Operations account,
  Nick Girod) — so the board's button alone reaches none of them, and the
  hourly catch-up's construction half is an Operations switch that ships off
  (Carl's 23 Oct rule was roofing only). On five of the nine the Sales Rep
  field also names **Kristin Holt (JobTread role Design)**; the rule takes
  every name there, flagged rather than filtered. Justin Phillips's
  membership has no role.
- **Reps need DB Crew for any of this to reach them.** T2.39 gives anyone
  with assigned close-out work the Close Out tab, and DB CheckOut acts for
  internal members by email (all of the reps are on the company domain), but
  a rep who has never signed in to DB Crew sees nothing but JobTread's own
  to-do. The catch-up switch's words in Operations say to turn it on once the
  reps have the app.
- **The safe deploy order**: DB CheckOut, then the Apps Script and the
  phones, then the board. The board is the half that starts putting reps on
  inspections; out first, a rep's T2.39 phone would show the roof checklist
  (old DB CheckOut) or ask them to clock in (old phone).
- **The mock grew**: `__MOCK_CO_CONSTRUCTION` (a made-up construction job,
  `co-prentice` 26-0950, at Final Inspection with the construction area; a
  list in place of `true` names who is on it) and the construction branch of
  `coCloseArea` (Close Out's linear move, `sentTo` the job's PM).
  `getBuilds` reports contract 5.
- **A suite moved with the build**: t235's two contract checks pinned level 4
  and read it off the page now (`CO_CONTRACT_NEED`, the T2.30 lesson again).
  The full run on T2.40: every suite passed but push-test (6/14, the same eight
  container failures as T2.39's run, compared line by line) and t235 before
  that fix (51/53; 53/53 after it).
- **Not done on purpose**: construction PUNCH work still defaults to the band's
  list (nobody on the seed) — Carl's answer was about the inspection; a
  construction-specific checklist (Neal's, with Carl) would replace `notes`
  with a form served the way the gutters' is; and the training videos
  (Carl's "Do not recreate videos yet" stands).
- **The server half is live**: at 21:36Z on 4 Nov 2026 (4:36pm in Ohio;
  Carl: *"go, deploy the server now"*) DB CheckOut's `main` was
  fast-forwarded to de31482 after its 207 tests and typecheck ran clean on
  that commit. `dpl_HvHZ8w7vvDVrGdS32gKxVspYHjsC` was ready at 21:36:46Z on
  closeout.deitemeyerbrothers.com with no alias error, and `/health`
  answered `{"source":"3239ced62585","on":"vercel","commit":"de31482"}` with
  `"crewApp":true` and `"contract":5` by 21:36:53Z. With no token, `/queue`,
  `/jobs`, `/assigned`, `POST /tasks/x/blocked` and `POST
  /jobs/x/close-area-inspection` answer the API's own 401 JSON, and the
  project showed no runtime errors in the 24 hours through the switch. The
  eb2b4e4 deployment (`dpl_35UDuhNVM8vLApeYLHE6Gch5sUUw`) is the rollback.
  **Between this and the phones' T2.40**, a construction job at Final
  Inspection already reads as one notes-and-photos tile on a T2.39 phone
  (the service crew and Operations, scope `all`), with the board's
  work-area words and the T2.15 clock prompt. Its send goes through:
  `coSendArea` is byte-identical on T2.39 and T2.40 and sends a notes area
  with no `form`, which the construction branch takes. A T2.39 phone needs
  contract 4 and reads 5 without a warning.
- **T2.40 is live on the phones**: Carl ran the chain (`clasp deploy … -d
  "T2.40"`, `firebase deploy --only hosting`) after the Close Out server. By
  00:15Z on 5 Nov 2026 db-crews.web.app served `index.html`, `sw.js` and
  `app.js?b=T2.40` identical to the branch (line endings aside), `/` and
  `/index.html` `no-cache` with the report-only policy, `check-build.mjs`
  against the live site says "T2.40 is already live and app.js is
  unchanged", and the API deployment's GET answers "Opening DB Crew". The
  API's own label was not read from here: the hand-back asked for *"go,
  deploy the board"* once his Diagnostics read App and API both T2.40, and
  that is the word that came.
- **The board half is live, last of the three**: at 00:16Z on 5 Nov 2026
  (7:16pm on 4 Nov in Ohio; Carl: *"go, deploy the board"*) the board's
  `main` was fast-forwarded f8613c1..26827ea, with nothing on `main` the
  branch lacked, after its 894 tests and `tsc` ran clean on that commit and
  `eslint` ran clean on every file it touched and on all of `src/`.
  `dpl_Fv3QYoSkHCJbJvC5fJMmfjDWaiqn` was ready at 00:16:39Z on
  ops.deitemeyerbrothers.com with no alias error. With no token, `GET
  /api/crew/assignments` and `GET /api/cron/materials` answer their own 401
  JSON (`crew-app-auth.ts`, `cron-auth.ts`), `/signin` answers 200 and
  `/production-board` bounces to sign-in. The project's one error group in
  the 24 hours through the switch was JobTread's 25-second stall at 21:10Z
  on 4 Nov, on the deployment before. The f8613c1 deployment
  (`dpl_4fvcF99mwFHnNqmS3HQBPEgXpDL4`) is the rollback. The construction
  catch-up ships off, so nothing puts a rep on an inspection until the
  office moves a construction job to Final Inspection on the board or picks
  who with *Pick who ›*, or Operations turns the catch-up on; the
  construction jobs already at Final Inspection (moved there in JobTread)
  wait for one of those. **The whole-repo `npm run lint` is red, and was
  before this round**: four errors in two files outside the app
  (`docs/guides/crew-app/build-deck.js` and the design handoff's
  `support.js`, both last changed in 76a96bf on 27 Oct), which is why each
  round lints the files it changed; Next 16's build does not lint. Telling
  ESLint to leave `docs/` and `design/` alone rides the next board change.
  **T2.40 is live in all four places.**

## Carl's calls on the rest of Step 3 (3 Nov 2026), for the rounds that build them

Asked with I13 (the report: https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr),
his words, then what each is read as. A reading marked *assumed* is to be
confirmed when its round starts.

1. **I11 — time corrections**: *"Manager of the person approves them, before
   payroll, ops dir daily list come by email."* Corrections (Already left,
   Started earlier, kept clock-ins, partner moves) are approved by the
   person's manager before payroll runs, and the Ops Director gets the daily
   list by email. *Assumed*: "the person's manager" needs a mapping the app
   does not have (the division PM? DB Hub's Manager level?), and "approved"
   means JobTread's own `approved` flag on the time entry. Both to ask.
2. **D28 — Already left to a job with no travel line**: *"Drive is paid,
   travel line should be on the job they traveled to."* The gap between
   leaving and the next block is paid drive time, on the destination job's
   travel line. *Assumed*: a destination with no travel line of its own —
   the case D28 is about — needs a fallback (the shop's travel line, or ask).
3. **D30 — "Wrong job, I was never at …"**: *"app move the hours already
   clocked to the right job and tell the PM."* The wrong block ends where it
   began and the right job opens at that start, in one write, with a notice to
   the PM (the report's own proposal).
4. **D39 — sign-in length**: *"As long as possible 90+."* A session renews
   until at least 90 days after the last Google sign-in; the allow-list and DB
   Hub are re-checked when it renews.
5. **I13 step 2 — construction final inspections**: *"Construction PM or Sales
   Rep assigned to the job."* The board assigns a construction job's final
   inspection to its Project Manager or Sales Rep (the job's own fields).
   Both open questions answered 4 Nov 2026: *"both for now, Rep is primary,
   but PM is available if Rep is busy or already on site"* — both go on the
   inspection, the rep first — and the form is *"notes a photos for now"*.
6. **I15 — warranty coverage**: *"Construction Sales Manager approves warranty,
   Roofing Sales manager approves warranty."* By division. *Open*: who each
   is, by name or JobTread role.
7. **D31 release** — asked to explain further. Explained in T2.39's
   hand-back with three options (leave it as it is; Operations sends it for
   them, at the time they made it, through I11's approval; Operations lets it
   go), recommending the second and third built with I11. Awaiting his pick.
8. **A break taken with no signal**: *"break taken with no signal count at the
   phone's time."* Kept like every other clock change since T2.38 (it still
   waits for signal today, `CQ_HOLDS`). JobTread takes a break only as
   `endNow: { breakDuration }` — now or never — so a kept break is written as
   the block ending at the moment the break began and the next opening when it
   ended, the same two-entry shape a break has always left in JobTread.
