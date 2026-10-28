# Training video: DB Crew for the crews

A narrated, captioned screen recording (about twenty-three minutes, nineteen
chapters in four parts) that walks the crews through the app on a phone, and
then through the war-room TV:

1. **Production crews** — signed in as Tyler, a site manager: finding your way
   around, clocking in at the shop (Morning Clock-In and the start photo), My
   jobs, leaving the shop (Before you roll out, the drive, I'm here), the site
   checks and the sign-off, photos, breaks and switching codes, clocking out
   (Already left) and the day log — then **your day, production crew**.
2. **Service, repair and warranty** — signed in as Yahir: the Close Out list
   and the Clock Alberto too box, and a repair from start to finish (the shop,
   the drive, Start on the repair card as the arrival, before and after photos,
   Finish & send to PM) — then **your day on service calls**.
3. **Close out** — the drive to a final inspection and Start as the arrival,
   a problem report, the cleanup, visit photos, the send, and a gutters
   inspection reached with Already left — then **your day on close out**.
4. **Reading the Production Board** — the war-room TV: lanes, cards, the
   material tags, the inspection and repair cards, the week buttons.

Each of the first three parts ends on a "your day" chapter: a card listing the
day's steps, one a line, while the narration walks them (Carl liked the
service PM video's ending). They sit at the end of each part rather than once
at the end because each part is also a file of its own.

English narration (the same Kokoro voice as the Production Board's service-PM
video), made twice: once with English captions and once with Spanish
subtitles. Each part is also cut as a file of its own, in both languages, so a
crew can be sent only their part.

The MP4s are **not committed**; they are handed over as files. Everything that
makes them lives here, so they can be made again after the app changes.

## How it is made

The same pipeline as `bledsoecw/DB_Production_Board`'s
`docs/guides/service-pm-video/` (Carl was happy with that one), adapted to a
phone app:

- `script.mjs` holds **the words, the Spanish subtitles and the taps**,
  chapter by chapter. The English is the only copy of the narration: the voice
  reads it and the captions are cut from it. Every line's `es` is its Spanish
  subtitle, written sentence for sentence so it can be timed on the same
  pauses. Buttons are named by their words on the screen, and the Spanish
  keeps those words in English, in quotes, because the screens are filmed in
  English.
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
  the LEXICON grown for this script (N/A, ES, EN, Ord, Mohr, Castellano).
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
morning for Yahir's part. The board's dev server is pinned to the same day by
its own `start-dev.sh`.

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

Then each take:

```bash
export VIDEO_WORK=/tmp/crewvideo/work TTS_PYTHON=/tmp/crewvideo/venv/bin/python KOKORO_DIR=/tmp/crewvideo/kokoro
cd /path/to/DB_Production_Board && VIDEO_WORK=/tmp/crewvideo/board docs/guides/service-pm-video/start-dev.sh
cd /path/to/db-crew-app/docs/training-video
./start-dev.sh                 # the app on :8100
node photos.mjs                # the camera's picture and the photos (once)
node record.mjs tts            # speak the narration (cached by wording)
/tmp/crewvideo/venv/bin/python -I check-voice.py "$VIDEO_WORK/lines.json" "$VIDEO_WORK/voice-am_michael"
node record.mjs debug          # optional: a fast walk, screenshots in $VIDEO_WORK/debug
node record.mjs record         # the take, about twenty-three minutes
node assemble.mjs "$VIDEO_WORK/out"
```

The phone keeps nothing between takes (every load is a fresh phone), but the
board's dev server is restarted before a take as a habit, the way its own
video does.

## When to re-record

The narration names buttons by their words ("Clock in", "Stop the clock",
"Switch code or job", "Site checks", "Sign off as Tyler", "Review & send",
"Finish & send to PM"…), so a rename in the app is a re-record, not a caption
fix. So is a change to a flow the video walks, or to the checklist the board
sends. `node record.mjs debug` is the quick way to see what broke: it stops on
the first tap that no longer finds its button and leaves
`$VIDEO_WORK/failed.png`.
