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
  `L('Clock out')` and `Lf('Driving to {p}', { p })` in `index.html`; the
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
  D13, D17, D18, I4, I7) is T2.29 here and DB CheckOut's 30 Oct commit. Next,
  in order: D6, D7, D8, D14, D16 and I3; then I2 (one outbox), D15 (request
  ids on writes), I1, I5, I6, I9.
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
  so) — so allowing zoom needs every input at 16px or more first.
- **D9 reads the phone's role** (site manager or Operations); the board's own
  sign rule also admits a roster crew flagged Site Manager. If that ever
  differs, the board sending `canSign` on `checks` is the fix (both repos'
  contract).
- **DB CheckOut's retired door**: `/auth/google`, `/auth/config` and session
  tokens are gone; `SESSION_SECRET` and `GOOGLE_CLIENT_ID` are no longer read
  and can be deleted from its Vercel project. `GOOGLE_ALLOWED_EMAILS` still
  is — it gates who DB Crew may act for. `public/` is a notice plus a
  service worker that clears the old app off any phone that installed it.
- **Two tests fail here and on T2.26 alike**, in this container: push-test
  (6/14, the test setup serves no Firebase files) and code-test's "…and back
  to work opens a new one". Not the app; checked by running both against
  T2.26.
