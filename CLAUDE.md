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
- **Not on the phone yet, and visible in the video**: the board's checklist has
  carried "Covered by:" and "Watertight confirmed with:" name lines and the
  N/A state since 21 Sep (the T1.23 asks in `CREW-ASSIGNMENTS-API.md`). The
  phone draws those two lines as plain ticks with no name box; the video does
  not dwell on them.
- **Chromium refuses to frame localhost from a page the recorder answers**
  (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`); the stage is launched with
  `--disable-features=LocalNetworkAccessChecks`.
- The narration names buttons by their words, so a rename in the app, a change
  to a flow the video walks, or a change to the checklist the board sends is a
  re-record. `node record.mjs debug` shows what broke.
- **Re-recorded for T2.16–T2.22 (28 Oct 2026)**, off Carl's notes from
  watching the first cut: about twenty-three minutes, nineteen chapters.
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
