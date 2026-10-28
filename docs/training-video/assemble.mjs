// Turn a take (raw.mp4 + cues.json + marks.json under VIDEO_WORK) into the
// finished videos: the narration laid under the picture, captions burned in —
// once in English and once in Spanish — a matching .srt for each, a chapter
// mark per part and chapter, and each part cut as a file of its own.
//
//   node assemble.mjs [out-dir]
//
// Same audio and caption rules as the Production Board's service-PM video
// (its assemble.mjs): one steady gain to -16 LUFS, a limiter under -3 dB,
// captions changing on the sentence the voice is saying.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { WORK, voiceDir, ensureDir } from "./studio.mjs";

const outDir = ensureDir(path.resolve(process.argv[2] ?? path.join(WORK, "out")));
const cues = JSON.parse(fs.readFileSync(path.join(WORK, "cues.json"), "utf8"));
const marks = JSON.parse(fs.readFileSync(path.join(WORK, "marks.json"), "utf8"));
const raw = path.join(WORK, "raw.mp4");
const seconds = Number(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw], { encoding: "utf8" }),
);
const NAME = "DB Crew - training";
const LANGS = [
  { key: "en", label: "English captions", title: "DB Crew — crew training" },
  { key: "es", label: "subtitulos en espanol", title: "DB Crew — capacitación para las cuadrillas" },
];

// 1 · The narration track.
const mixed = path.join(WORK, "narration-mix.wav");
execFileSync(process.env.TTS_PYTHON ?? "python3", [
  path.join(import.meta.dirname, "mix.py"), path.join(WORK, "cues.json"), voiceDir(), String(seconds), mixed,
  path.join(WORK, "spans.json"),
]);
// -16 LUFS with one steady gain, then a fast limiter under -3 dB (the AAC
// encode overshoots a -1.5 dB limit). Not loudnorm: it rides the level.
const TARGET_LUFS = -16;
const probe = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mixed, "-af", "ebur128", "-f", "null", "-"], {
  encoding: "utf8",
  maxBuffer: 1 << 28,
});
const loudness = Number(probe.stderr.match(/Summary:[\s\S]*?I:\s+(-?[\d.]+) LUFS/)[1]);
const narration = path.join(WORK, "narration.wav");
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-i", mixed, "-af",
  `volume=${(TARGET_LUFS - loudness).toFixed(2)}dB,alimiter=limit=0.708:attack=5:release=60:level=disabled`,
  narration,
]);

// 2 · Captions.
const ts = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
// Split where tts.py splits — after . ! ? : ; — so caption units and spoken
// pieces line up one to one.
const units = (text) => text.trim().split(/(?<=[.!?:;])\s+/).filter((x) => x.trim());
function pieces(text, max) {
  const outp = [];
  for (const s of units(text)) {
    if (s.length <= max) { outp.push(s); continue; }
    let rest = s;
    while (rest.length > max) {
      const mid = Math.min(rest.length - 20, Math.round(max * 0.83));
      let cut = -1;
      for (let i = mid; i > 25 && cut < 0; i--) if (/[,:;]/.test(rest[i]) && rest[i + 1] === " ") cut = i + 1;
      if (cut < 0) for (let i = mid; i > 25 && cut < 0; i--) if (rest[i] === " ") cut = i;
      if (cut < 0) break;
      outp.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) outp.push(rest);
  }
  return outp;
}
const spans = JSON.parse(fs.readFileSync(path.join(WORK, "spans.json"), "utf8"));
/**
 * [{ text, start, end }] for one line in one language, in seconds from the
 * line's start. Each sentence shows from the moment the voice starts it until
 * the next one starts. The Spanish is written sentence for sentence with the
 * English, so it is timed on the same pauses; a line where the counts differ
 * is shared out by length across the whole line instead.
 */
function timed(c, text, max) {
  const us = units(text);
  const sp = spans[c.id];
  if (!sp || sp.length !== us.length) {
    const parts = pieces(text, max);
    const weight = parts.reduce((a, p) => a + p.length + 8, 0);
    let t = 0;
    return parts.map((p) => {
      const d = (c.dur * (p.length + 8)) / weight;
      const r = { text: p, start: t, end: t + d };
      t += d;
      return r;
    });
  }
  const outp = [];
  us.forEach((u, k) => {
    const start = sp[k][0];
    const end = k + 1 < us.length ? sp[k + 1][0] : Math.max(sp[k][1], c.dur);
    const parts = pieces(u, max);
    const weight = parts.reduce((a, p) => a + p.length + 8, 0);
    let t = start;
    for (const p of parts) {
      const d = ((end - start) * (p.length + 8)) / weight;
      outp.push({ text: p, start: t, end: t + d });
      t += d;
    }
  });
  return outp;
}
// Beside the phone the captions have a column of their own; under the TV
// they sit in a navy box like the Production Board video's.
const STYLE = { side: { name: "Side", max: 96 }, full: { name: "Full", max: 84 } };
const assHead = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Side,Inter,46,&H00FFFFFF,&H00FFFFFF,&H80000000,&H00000000,0,0,0,0,100,100,0,0,1,0,2,1,900,110,130,1
Style: Full,Inter,40,&H00FFFFFF,&H00FFFFFF,&H40331A0D,&H40331A0D,0,0,0,0,100,100,0,0,3,14,0,2,220,220,26,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const srtTs = (x) => ts(x).replace(/^(\d):/, "0$1:").replace(".", ",") + "0";
function captions(lang) {
  const events = [];
  const srt = [];
  let n = 0;
  let fallbacks = 0;
  cues.forEach((c, i) => {
    const text = lang === "en" ? c.text : c.es;
    if (!text) throw new Error(`no ${lang} caption for: ${c.text}`);
    const st = STYLE[c.layout ?? "side"];
    if ((spans[c.id]?.length ?? -1) !== units(text).length) fallbacks++;
    const stop = (cues[i + 1]?.at ?? Infinity) - 0.02;
    for (const p of timed(c, text, st.max)) {
      const a = c.at + p.start;
      const b = Math.min(c.at + p.end - 0.02, stop);
      events.push(`Dialogue: 0,${ts(a)},${ts(b)},${st.name},,0,0,0,,${p.text.replace(/\{/g, "(").replace(/\}/g, ")")}`);
      srt.push(`${++n}\n${srtTs(a)} --> ${srtTs(b)}\n${p.text}\n`);
    }
  });
  if (fallbacks) console.log(`captions (${lang}): ${fallbacks} line(s) timed by length — their sentences did not pair with the pauses`);
  const ass = path.join(WORK, `captions-${lang}.ass`);
  fs.writeFileSync(ass, assHead + events.join("\n") + "\n");
  return { ass, srt: srt.join("\n") };
}

// 3 · Chapters: the introduction, each part's card, each chapter.
const chapterNo = new Map();
let cn = 0;
for (const m of marks) if (!m.part && m.title !== marks[0].title) chapterNo.set(m, ++cn);
const titleOf = (m, i) => (i === 0 ? "Introduction" : m.part ? `Part ${marks.filter((x) => x.part).indexOf(m) + 1} · ${m.title}` : `${chapterNo.get(m)} · ${m.title}`);
function chapterMeta(title, from, to) {
  const meta = [";FFMETADATA1", `title=${title}`];
  marks.forEach((m, i) => {
    const start = m.at;
    const end = marks[i + 1]?.at ?? seconds;
    if (end <= from || start >= to) return;
    meta.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${Math.round((Math.max(start, from) - from) * 1000)}`,
      `END=${Math.round((Math.min(end, to) - from) * 1000)}`, `title=${titleOf(m, i)}`);
  });
  return meta.join("\n") + "\n";
}

// 4 · Encode: the whole video in each language, then each part cut from it.
const parts = marks.filter((m) => m.part).map((m, i, all) => ({ n: i + 1, title: m.title, from: m.at, to: all[i + 1]?.at ?? seconds }));
for (const lang of LANGS) {
  const { ass, srt } = captions(lang.key);
  const full = path.join(outDir, `${NAME} (${lang.label}).mp4`);
  fs.writeFileSync(full.replace(/\.mp4$/, ".srt"), srt);
  const meta = path.join(WORK, `chapters-${lang.key}.txt`);
  fs.writeFileSync(meta, chapterMeta(lang.title, 0, seconds));
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", raw, "-i", narration, "-i", meta, "-map", "0:v", "-map", "1:a", "-map_metadata", "2", "-map_chapters", "2",
      "-vf", `subtitles=${ass}`, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", full],
    { stdio: "inherit" },
  );
  console.log(`${full} — ${(seconds / 60).toFixed(1)} min, ${(fs.statSync(full).size / 1e6).toFixed(0)} MB`);
  for (const p of parts) {
    const file = path.join(outDir, `${NAME} - Part ${p.n} ${p.title} (${lang.label}).mp4`);
    const pm = path.join(WORK, `chapters-${lang.key}-part${p.n}.txt`);
    fs.writeFileSync(pm, chapterMeta(`${lang.title} — Part ${p.n} · ${p.title}`, p.from, p.to));
    // Cut on the exact frame (re-encoded, so a part never opens on the tail
    // of the chapter before it).
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-ss", p.from.toFixed(3), "-to", p.to.toFixed(3), "-i", full, "-i", pm,
        "-map", "0:v", "-map", "0:a", "-map_metadata", "1", "-map_chapters", "1",
        "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", file],
      { stdio: "inherit" },
    );
    console.log(`  ${path.basename(file)} — ${((p.to - p.from) / 60).toFixed(1)} min`);
  }
}
