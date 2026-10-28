// Make the DB Crew training video.
//
//   node record.mjs tts      speak every narration line (cached by wording)
//   node record.mjs debug    walk the whole script fast, one screenshot a line
//                            (no capture) — how a broken tap is found
//   node record.mjs record   the real take: raw.mp4 + cues.json + marks.json
//
// Everything lands under VIDEO_WORK. assemble.mjs turns a take into the MP4s.
// Needs the app served (start-dev.sh) and, for the chapter on reading the
// board, the Production Board's dev board on :3000 — see README.md.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BOARD, VOICE, WORK, director, ensureDir, loadApp, openStage, sleep, startCapture, voiceDir as voiceDirOf } from "./studio.mjs";
import { installBoardWorld } from "./board-world.mjs";
import script from "./script.mjs";

const mode = process.argv[2] ?? "record";
ensureDir(WORK);
const voiceDir = ensureDir(voiceDirOf());

// 1 · Collect the narration and speak whatever is new.
const collector = director({ collect: true });
await script(collector);
const lines = collector.cues.map((c) => ({ id: c.id, text: c.spoken }));
fs.writeFileSync(path.join(WORK, "lines.json"), JSON.stringify(lines, null, 1));
fs.writeFileSync(path.join(WORK, "subtitles.json"), JSON.stringify(collector.cues.map((c) => ({ id: c.id, en: c.text, es: c.es })), null, 1));
const missingEs = collector.cues.filter((c) => !c.es);
if (missingEs.length) throw new Error(`no Spanish subtitle for: ${missingEs.map((c) => c.text).join(" | ")}`);
const py = process.env.TTS_PYTHON ?? "python3";
const kokoro = process.env.KOKORO_DIR;
if (!kokoro) throw new Error("KOKORO_DIR is not set — see README.md");
const lengths = JSON.parse(
  execFileSync(py, [path.join(import.meta.dirname, "tts.py"), path.join(WORK, "lines.json"), voiceDir, kokoro, VOICE], {
    encoding: "utf8",
    maxBuffer: 1 << 24,
  }),
);
const total = Object.values(lengths).reduce((a, b) => a + b, 0);
console.log(`narration (${VOICE}): ${lines.length} lines, ${(total / 60).toFixed(1)} min of speech`);
if (mode === "tts") process.exit(0);

// 2 · The take.
if (!(await fetch(`${BOARD}/signin`).then((r) => r.ok).catch(() => false)))
  throw new Error(`no dev board on ${BOARD} — start it with the board repo's docs/guides/service-pm-video/start-dev.sh`);
const { browser, ctx, page } = await openStage();
await installBoardWorld(ctx);
// Warm the app once so nothing on camera waits for a first load.
await loadApp(page, "siteManager");
await page.mouse.move(1500, 900);

let debugDir = null;
let capture = null;
if (mode === "debug") {
  debugDir = ensureDir(path.join(WORK, "debug"));
  for (const f of fs.readdirSync(debugDir)) fs.rmSync(path.join(debugDir, f));
} else {
  await page.evaluate(() => window.__stage.card({ kicker: "DB Crew · training", title: "DB Crew" }));
  await sleep(800);
  capture = await startCapture(page, path.join(WORK, "raw.mp4"));
}
const s = director({ page, capture, lengths, debugDir });
let failed = null;
try {
  await script(s);
  await sleep(2000);
} catch (e) {
  failed = e;
  await page.screenshot({ path: path.join(WORK, "failed.png") }).catch(() => {});
}
const seconds = capture ? await capture.stop() : 0;
await browser.close();
if (capture) {
  fs.writeFileSync(path.join(WORK, "cues.json"), JSON.stringify(s.cues, null, 1));
  fs.writeFileSync(path.join(WORK, "marks.json"), JSON.stringify(s.marks, null, 1));
  console.log(`take: ${(seconds / 60).toFixed(1)} min → ${path.join(WORK, "raw.mp4")}`);
}
if (failed) {
  console.error("✗ the script stopped:", failed.message);
  process.exit(1);
}
