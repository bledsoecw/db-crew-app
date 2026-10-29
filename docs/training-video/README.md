# Training videos: DB Crew for the crews

Narrated, captioned screen recordings that walk the crews through the app on a
phone, and then through the war-room TV. Re-recorded for T2.25 (29 Oct 2026),
off Carl's review: **short ones by role**, each its own file, and the whole set
**twice — in English, and with a Spanish voice and the phone in Spanish**.

1. **Every crew member** — signed in as Zac, on the construction bench: finding
   your way around, clocking in at the shop (one tap, no photo; Started
   earlier), My jobs (the stage and the week of a long job, the pre-start list),
   leaving the shop and the drive, the job's codes first and the start photo,
   the day (Change code, Break, Leave the site for a supply run — photos
   through the day go in DB Cam), clocking out (the end photo, Already left,
   the evening push) — then **your day**.
2. **Site managers** — Tyler: Before you roll out (the shop checks), the site
   checks (a note, N/A with its reason, Covered by, the sign-off with the crew
   leader named), and the day log sent before leaving for the day — then
   **your day**.
3. **Service, repair and warranty** — Yahir: the Close Out list and the Clock
   Alberto too box, and a repair from start to finish — then **your day**.
4. **Close out** — Yahir: leaving one job for another, a final inspection
   (Start as the arrival, the checks, a problem report, the cleanup, visit
   photos, the send), and a gutters inspection reached while still on the
   clock somewhere else (Already there, say when) — then **your day**.
5. **Reading the Production Board** — the war-room TV: lanes, cards, the
   material tags, the inspection and repair cards, the week buttons.

Part 1 is the clock everyone uses; the others build on it and do not repeat
it. Each of Parts 1–4 ends on a "your day" card listing the day's steps, one a
line, while the narration walks them (Carl liked the service PM video's
ending). The narration says **the Ops Director**, never Carl (Carl, 29 Oct
2026).

**The two languages are two takes.** The English take speaks and captions the
English with the phone in English; the Spanish take speaks and captions `es`
with the phone set to Spanish, so the Spanish narration names the buttons by
the Spanish words on the screen («Salir del taller», «Ya llegué · empezar»).
The board's TV has no Spanish, so its tags keep their English names in both.
The earlier "English narration with Spanish subtitles" cut is gone: with a
Spanish voice it would describe screens the viewer is not looking at.

The MP4s are **not committed**; they are handed over as files. Everything that
makes them lives here, so they can be made again after the app changes.

## How it is made

The same pipeline as `bledsoecw/DB_Production_Board`'s
`docs/guides/service-pm-video/` (Carl was happy with that one), adapted to a
phone app:

- `script.mjs` holds **the words in both languages and the taps**, chapter by
  chapter. Each line is the English and its `es`; the take's language
  (`VIDEO_LANG`) decides which one the voice reads and the captions show.
  Labels on the stage are `T("Your tabs", "Tus pestañas")`. Buttons are named
  by their words on the screen in that language — the Spanish lines name the
  Spanish buttons, in «quotes».
- `stage.html` is the frame: 1920×1080, the app in an iframe at phone size
  (402×874, scaled 1.12) on the left, the chapter's name and who is signed in
  on the right, and the captions under them. For the TV chapter the board fills
  the frame and the captions sit underneath. A touch dot, a ripple on each tap
  and amber highlight boxes are drawn on the stage, never in the app.
- `studio.mjs` is the recording kit: the stage in Chromium with the phone's
  camera fed a drawing of a house (`photos.mjs`), speech recognition answered
  with the words the script "says", a 30fps capture piped into ffmpeg, and the
  clock every narration line is timed against.
- `fixtures.js` is the practice data the phone sees, and `board-world.mjs`
  the data the TV sees (below).
- `tts.py`, `mix.py`, `check-voice.py` are the Production Board video's, with
  the LEXICON grown for this script (N/A, ES, EN, Ord, Mohr, Castellano) and a
  Spanish lexicon of its own (`LEXICON_ES`: DB Crew, JobTread, Close Out, the
  people's and customers' English names as a Spanish speaker says them). The
  English voice is `am_michael`, the Spanish `em_alex` with the Latin American
  phonemizer (`es-419`). Checked by the recogniser on the day: a Spanish test
  line came back word for word.
- `record.mjs` runs it: `tts`, `debug` (a fast walk, one screenshot a line),
  `record` (the real take). `assemble.mjs` makes the MP4s, the `.srt` files
  and the chapter marks.

### Nothing real can land in it

- **The phone is on the dev mock**, never the live API. `dev/mock.js` answers
  every Apps Script call; `fixtures.js` hands it the video's own jobs through
  `window.__MOCK_FIX` (the hook is in the mock: anything it names replaces the
  demo data, and with nothing set the mock behaves as it always has).
  `loadApp` refuses to film a phone that is not on the mock with those
  fixtures, and `openStage` refuses every request that is not the local app or
  the local dev board — Google's sign-in script, Firebase and anything live
  never load.
- **Every customer, address and job number is made up.** The surnames were
  checked against the org's customer accounts (none is a customer) and no
  26-8xxx job number exists. The people (Tyler, Yahir, Alberto, the PMs and
  reps) are the company's own, as in the board's video. The labour codes are
  real code names.
- **The TV never shows the dev board's own jobs.** The board's dev fixtures
  are copies of real jobs with real customers' names, so `board-world.mjs`
  answers `/api/jobs`, `/api/schedule` and `/api/jobs/squares` with the video's
  jobs only, and refuses to film if any customer name the dev board served
  reaches the TV. It also flags Tyler and Kenton as site managers (so Tyler's
  name rides the Platinum card, as on the live wall) and turns the warehouse
  track off, as Carl has it live.

### The day

Everything happens on **Thursday 6 August 2026** — the week the board's dev
fixtures are dated — starting at 6:58am. The stage's clock is Playwright's
(`ctx.clock`), moved forward through the day (`s.later()`) and set back to the
morning for Tyler's and Yahir's parts. The board's dev server is pinned to the
same day by its own `start-dev.sh`.

**Zac's jobs are the bench's** (`fixtures.js`, role `crew`): Lindqvist's
Rough-in is week 2 of a three-week stay (`taskName: "Rough-in"`, `days: 15`),
its code list marks the construction codes (`trade: "Construction"`) so the
sheet puts them first, and Halvorsen starts Monday with its pre-start list half
done (`h.prestartFor`).

## Making it again (Linux — a Claude session or WSL)

It needs bash, `ffmpeg` with libx264 and libass, Python 3 with `kokoro-onnx`,
`soundfile` and `numpy` (and `faster-whisper` + `scipy` for the voice check),
the Kokoro model files, Playwright with its Chromium, Node 22, the **Inter**
font installed for the captions, and a clone of `bledsoecw/DB_Production_Board`
with `npm ci` done and a `.env.local` holding `AUTH_SECRET` and
`AUTH_DEV_MODE=true`. Once:

```bash
python3 -m venv /tmp/crewvideo/venv
/tmp/crewvideo/venv/bin/pip install kokoro-onnx soundfile numpy faster-whisper scipy
mkdir -p /tmp/crewvideo/kokoro && cd /tmp/crewvideo/kokoro
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

and, from this folder, a link to a Playwright install (the folder has no
`package.json`; `node_modules` is gitignored):

```bash
ln -s "$(npm root -g)" node_modules
```

Then each take — once as it stands (English), and once more with
`VIDEO_LANG=es` (Spanish). A take lands under `$VIDEO_WORK/en` or
`$VIDEO_WORK/es`; the voices (`voice-am_michael`, `voice-em_alex`) and the
photos are shared:

```bash
export VIDEO_WORK=/tmp/crewvideo/work TTS_PYTHON=/tmp/crewvideo/venv/bin/python KOKORO_DIR=/tmp/crewvideo/kokoro
cd /path/to/DB_Production_Board && VIDEO_WORK=/tmp/crewvideo/board docs/guides/service-pm-video/start-dev.sh
cd /path/to/db-crew-app/docs/training-video
./start-dev.sh                 # the app on :8100
node photos.mjs                # the camera's picture and the photos (once)
node record.mjs tts            # speak the narration (cached by wording)
/tmp/crewvideo/venv/bin/python -I check-voice.py "$VIDEO_WORK/en/lines.json" "$VIDEO_WORK/voice-am_michael"
node record.mjs debug          # optional: a fast walk, screenshots in $VIDEO_WORK/en/debug
node record.mjs record         # the take
node assemble.mjs "$VIDEO_WORK/out"
# the Spanish take
export VIDEO_LANG=es
node record.mjs tts
/tmp/crewvideo/venv/bin/python -I check-voice.py "$VIDEO_WORK/es/lines.json" "$VIDEO_WORK/voice-em_alex" --lang es
node record.mjs record
node assemble.mjs "$VIDEO_WORK/out"
```

The phone keeps nothing between takes (every load is a fresh phone), but the
board's dev server is restarted before a take as a habit, the way its own
video does.

## When to re-record

The narration names buttons by their words in both languages ("At the shop",
"Leave the site", "I'm here · start work", "Doesn't apply here", "Tell the PM
now", "Finish & send to PM" — and «En el taller», «Salir de la obra»…), so a
rename in the app, or in its Spanish, is a re-record, not a caption fix. So is
a change to a flow the video walks, or to the checklist the board sends. `node record.mjs debug` is the quick way to see what broke: it stops on
the first tap that no longer finds its button and leaves
`$VIDEO_WORK/<lang>/failed.png`.
