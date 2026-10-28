// The recording kit behind the Crew App training video: the app running at
// phone size inside a 1920×1080 stage (stage.html), on the dev mock with the
// video's own made-up data (fixtures.js), a touch dot and highlight boxes
// drawn on the stage, the war-room TV from a dev Production Board for the
// chapter on reading the board, a 30fps capture piped into ffmpeg, and the
// narration clock every beat is timed against.
//
// Copied in shape from the Production Board's service-PM video
// (bledsoecw/DB_Production_Board, docs/guides/service-pm-video/studio.mjs);
// what differs is the stage and that the app here is a static page on a mock.
// Nothing can reach a live system: every request that is not the local app
// or the local dev board is refused (see openStage).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const HERE = import.meta.dirname;
export const APP = process.env.APP_URL ?? "http://localhost:8100";
export const BOARD = process.env.BOARD_URL ?? "http://localhost:3000";
export const WORK = process.env.VIDEO_WORK ?? path.join(HERE, ".video-work");
export const FPS = 30;
/** The narrator: a Kokoro voice. am_michael is the PM video's, so the two sound like a set. */
export const VOICE = process.env.NARRATOR ?? "am_michael";
export const voiceDir = () => path.join(WORK, `voice-${VOICE}`);
const GAP_MS = 380; // breath between narration lines
/** The take's "now": Thursday 6 August 2026, 6:58am in Ohio — the board's fixture week. */
export const TAKE_START = "2026-08-06T10:58:00Z";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * The words a line is SPOKEN with; captions keep the written ones. Only
 * punctuation the voice trips on changes here — how a word SOUNDS is
 * tts.py's LEXICON.
 */
export function spoken(text) {
  return text
    .replace(/›/g, "")
    .replace(/—/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
export const lineId = (text) => crypto.createHash("sha1").update(spoken(text)).digest("hex").slice(0, 16);

// The app's own iframe — never the stage, never the board's TV.
const IS_APP = `function isApp(){ try { return window !== window.top && !!window.frameElement && window.frameElement.id === "app"; } catch (e) { return false; } }`;

// ── Inside the app's frame: the role, a clean phone, the touch dot's feed ──
// Runs in every frame; only the app's iframe acts on it.
const FRAME_KIT = () => {
  if (!isApp()) return;
  const q = new URLSearchParams(location.search);
  window.__MOCK_ROLE = q.get("role") || "siteManager";
  // A new role is a new phone: nothing remembered from the last one.
  try {
    const key = "__fresh:" + q.get("take");
    if (!sessionStorage.getItem(key)) {
      localStorage.clear();
      sessionStorage.setItem(key, "1");
    }
  } catch {}
  // The stage draws the finger; the app's own events tell it where.
  const toStage = (e) => {
    const r = frameElement.getBoundingClientRect();
    const k = r.width / innerWidth;
    return [r.left + e.clientX * k, r.top + e.clientY * k];
  };
  addEventListener("mousemove", (e) => parent.__stage && parent.__stage.move(...toStage(e)), true);
  addEventListener("mousedown", (e) => parent.__stage && parent.__stage.press(true, ...toStage(e)), true);
  addEventListener("mouseup", () => parent.__stage && parent.__stage.press(false), true);
  // Speech, as a phone would hear it: the recorder says what to "hear" with
  // window.__hear(text) and the app's own Record button gets the words.
  window.SpeechRecognition = window.webkitSpeechRecognition = function () {
    const r = this;
    r.start = () => { window.__srLive = r; setTimeout(() => r.onstart && r.onstart(), 30); };
    r.stop = () => { setTimeout(() => { r.onend && r.onend(); }, 60); };
    r.abort = r.stop;
  };
  window.__hear = (text, isFinal) => {
    const row = [{ transcript: text, confidence: 0.95 }];
    row.isFinal = !!isFinal;
    window.__srLive && window.__srLive.onresult && window.__srLive.onresult({ resultIndex: 0, results: [row] });
  };
};

// ── The stage ───────────────────────────────────────────────────────────────
export async function openStage() {
  const fixtures = fs.readFileSync(path.join(HERE, "fixtures.js"), "utf8");
  const mock = fs.readFileSync(path.join(HERE, "../../dbtimeclock-pwa/dev/mock.js"), "utf8");
  const stage = fs.readFileSync(path.join(HERE, "stage.html"), "utf8");
  const camera = path.join(WORK, "photos", "camera.y4m");
  if (!fs.existsSync(camera)) throw new Error("no camera picture — run `node photos.mjs` first");
  const exe = process.env.PW_CHROMIUM;
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${camera}`,
      // The stage is answered by the recorder itself, so Chromium counts it as
      // a public page and would refuse to frame the dev board on localhost.
      "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    timezoneId: "America/New_York",
    locale: "en-US",
    permissions: ["camera", "microphone", "geolocation", "notifications"],
    geolocation: { latitude: 40.8673, longitude: -84.6022, accuracy: 12 },
    colorScheme: "dark",
  });
  await ctx.clock.install({ time: new Date(TAKE_START) });
  await ctx.addInitScript(`${IS_APP};(${FRAME_KIT})();`);
  await ctx.addInitScript(`${IS_APP};if (isApp()) {\n${fixtures}\n}`);
  await ctx.addInitScript(`${IS_APP};if (isApp()) {\n${mock}\n}`);
  const appOrigin = new URL(APP).origin;
  const boardOrigin = new URL(BOARD).origin;
  // Nothing leaves this machine: the app's mock answers its API, and anything
  // else (Google's sign-in script, Firebase, a live board) is refused outright.
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === appOrigin && u.pathname === "/__stage.html") return route.fulfill({ contentType: "text/html", body: stage });
    // The live config (apiUrl, client id, Firebase keys) is never loaded: the mock pins its own.
    if (u.origin === appOrigin && u.pathname === "/config.js") return route.fulfill({ contentType: "text/javascript", body: "/* the training video's mock pins DBTC_CONFIG */" });
    if (u.origin === appOrigin || u.origin === boardOrigin || u.protocol === "data:" || u.protocol === "blob:") return route.fallback();
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.warn(`page error: ${e.message.split("\n")[0]}`));
  await page.goto(`${APP}/__stage.html`, { waitUntil: "load" });
  return { browser, ctx, page };
}

let takeN = 0;
/** Open the app in the phone as a given role, on a fresh phone; waits for the clock to draw. */
export async function loadApp(page, role) {
  const take = ++takeN;
  await page.evaluate((u) => window.__stage.load(u), `/index.html?role=${role}&take=${take}`);
  // The phone's frame once it is on THIS load, not the one it is leaving.
  let frame = null;
  for (let i = 0; i < 300 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes(`take=${take}`)) ?? null;
    if (!frame) await sleep(100);
  }
  if (!frame) throw new Error("the phone never loaded");
  await frame.waitForLoadState("load");
  const app = page.frameLocator("#app");
  await app.locator("#tabs").waitFor({ state: "visible", timeout: 30_000 });
  // The guard: the phone must be on the mock with the video's data, or nothing is filmed.
  const ok = await frame.evaluate(
    () => /mock\.local/.test(window.DBTC_CONFIG?.apiUrl ?? "") && !!window.__MOCK_FIX,
  );
  if (!ok) throw new Error("the app is not on the mock with the video's fixtures — refusing to film it");
  await sleep(1200);
  return app;
}

// ── Capture: screencast → 30fps → ffmpeg ─────────────────────────────────
export async function startCapture(page, outFile) {
  const cdp = await page.context().newCDPSession(page);
  let latest = null;
  cdp.on("Page.screencastFrame", (f) => {
    latest = Buffer.from(f.data, "base64");
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 93, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  for (let i = 0; i < 100 && !latest; i++) await sleep(50);
  const ff = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", outFile],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const t0 = performance.now();
  let emitted = 0;
  let stopped = false;
  const pump = (async () => {
    while (!stopped) {
      const due = Math.floor(((performance.now() - t0) / 1000) * FPS);
      while (emitted < due) {
        if (latest && !ff.stdin.write(latest)) await once(ff.stdin, "drain");
        emitted++;
      }
      await sleep(4);
    }
  })();
  return {
    t: () => (performance.now() - t0) / 1000,
    async stop() {
      stopped = true;
      await pump;
      await cdp.send("Page.stopScreencast").catch(() => {});
      ff.stdin.end();
      await once(ff, "close");
      return emitted / FPS;
    },
  };
}

// ── The director: what a chapter script calls ────────────────────────────
// Every target is a FUNCTION of { page, app, tv } — app is the phone's frame,
// tv the board's — so the script can be walked with no browser at all to
// collect the narration (collect mode).
export function director({ page, capture, lengths, collect, debugDir }) {
  const cues = [];
  const marks = [];
  let mx = 1500;
  let my = 900;
  let shot = 0;
  let layout = "side";
  let part = "";
  const where = () => ({ page, app: page.frameLocator("#app"), tv: page.frameLocator("#tv") });
  const loc = (f) => (typeof f === "function" ? f(where()) : f);

  async function glide(x, y, ms) {
    const steps = Math.max(6, Math.round(ms / 16));
    const x0 = mx;
    const y0 = my;
    for (let i = 1; i <= steps; i++) {
      const k = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
      mx = x0 + (x - x0) * k;
      my = y0 + (y - y0) * k;
      await page.mouse.move(mx, my);
      if (layout === "full") await page.evaluate(([x, y]) => window.__stage.move(x, y), [mx, my]);
      await sleep(14);
    }
  }
  // Brings the target into the phone's view with a smooth scroll (the way a
  // thumb would) and returns its box on the stage.
  async function boxOf(f, { scroll = true } = {}) {
    const l = loc(f).first();
    await l.waitFor({ state: "visible", timeout: 20_000 });
    if (scroll) {
      const moved = await l
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          const tabs = document.getElementById("tabs");
          const bottom = tabs && tabs.offsetParent ? tabs.getBoundingClientRect().top : innerHeight;
          if (r.top >= 70 && r.bottom <= bottom - 16) return false;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          return true;
        })
        .catch(() => false);
      if (moved) await sleep(750);
    }
    const b = await l.boundingBox();
    if (!b) throw new Error("no box");
    return b;
  }
  async function point(f, { dx = 0, dy = 0, ms } = {}) {
    let b = await boxOf(f);
    let [x, y] = [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy];
    await glide(x, y, ms ?? Math.min(1000, 300 + Math.hypot(x - mx, y - my) * 0.6));
    for (let i = 0; i < 3; i++) {
      await sleep(100);
      b = await boxOf(f, { scroll: false });
      [x, y] = [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy];
      if (Math.hypot(x - mx, y - my) < 3) break;
      await glide(x, y, 200);
    }
    return b;
  }

  const api = {
    page,
    cues,
    marks,
    where,
    /** One line of narration; `act` runs while it is spoken. `es` is the Spanish subtitle. */
    async say(text, a, b) {
      const act = typeof a === "function" ? a : null;
      const opts = (a && typeof a === "object" ? a : b) ?? {};
      const id = lineId(text);
      if (collect) {
        cues.push({ id, text, es: opts.es ?? null, spoken: spoken(text), part });
        return;
      }
      const dur = lengths[id];
      if (dur == null) throw new Error(`no narration for: ${text}`);
      const at = capture ? capture.t() : 0;
      cues.push({ id, text, es: opts.es ?? null, at, dur, layout, part });
      const t0 = performance.now();
      if (act) await act();
      const left = (debugDir ? 650 : dur * 1000 + GAP_MS) - (performance.now() - t0);
      if (left > 0) await sleep(left);
      if (debugDir) await sleep(450); // let a box drawn at the end of the beat finish fading in
      if (debugDir) await page.screenshot({ path: path.join(debugDir, `${String(++shot).padStart(3, "0")}.png`) }).catch(() => {});
    },
    /** A part's title card (Production crews, Service…). Parts are what the per-part files are cut on. */
    async part(n, title, sub, es) {
      part = title;
      if (collect) {
        marks.push({ title, part: true });
        return api.say(`Part ${n}. ${title}.`, { es: es?.say });
      }
      marks.push({ title, part: true, at: capture ? capture.t() : 0 });
      await page.evaluate((spec) => window.__stage.card(spec), { kicker: `Part ${n}`, title, sub });
      await api.say(`Part ${n}. ${title}.`, { es: es?.say });
    },
    /** A chapter: its card, then the stage keeps its name beside the phone. */
    async chapter(n, title, { sub, kicker, who, es } = {}) {
      if (collect) {
        marks.push({ title });
        return api.say(n === 0 ? title : `${title}.`, { es: es ? (n === 0 ? es : `${es}.`) : null });
      }
      marks.push({ title, at: capture ? capture.t() : 0 });
      await page.evaluate(
        ([spec, info]) => { window.__stage.card(spec); window.__stage.info(info); },
        [{ kicker: kicker ?? (n === 0 ? "DB Crew · training" : `Chapter ${n}`), title, sub },
          n === 0 ? { kicker: "", title: "", who: "" } : { kicker: `${part ? part + " · " : ""}Chapter ${n}`, title, who: who ?? "" }],
      );
      await api.say(n === 0 ? title : `${title}.`, { es: es ? (n === 0 ? es : `${es}.`) : null });
    },
    async uncard() {
      if (collect) return;
      await page.evaluate(() => window.__stage.uncard());
      await sleep(500);
    },
    /** Put the app in the phone as a role (behind a card, so the load is never seen). */
    async phone(role) {
      if (!collect) await loadApp(page, role);
    },
    async setLayout(name) {
      layout = name;
      if (!collect) await page.evaluate((n) => window.__stage.layout(n), name);
    },
    async wait(ms) {
      if (!collect) await sleep(ms);
    },
    async point(f, opts) {
      if (!collect) await point(f, opts);
    },
    async tap(f, opts = {}) {
      if (collect) return;
      await point(f, opts);
      await sleep(140);
      if (layout === "full") await page.evaluate(([x, y]) => window.__stage.press(true, x, y), [mx, my]);
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
      if (layout === "full") await page.evaluate(() => window.__stage.press(false));
      await sleep(opts.after ?? 300);
    },
    async type(f, text, { delay = 45 } = {}) {
      if (collect) return;
      await api.tap(f);
      await page.keyboard.type(text, { delay });
    },
    /** Hand the app a picture as if the phone's camera or gallery had made it. */
    async pick(f, files, opts = {}) {
      if (collect) return;
      await point(f, opts);
      await sleep(140);
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10_000 }),
        (async () => { await page.mouse.down(); await sleep(90); await page.mouse.up(); })(),
      ]);
      await chooser.setFiles(files);
      await sleep(opts.after ?? 600);
    },
    /** Words arriving from the "microphone", a few at a time, then final. */
    async hear(text, { wordMs = 230 } = {}) {
      if (collect) return;
      const frame = page.frames().find((fr) => /index\.html/.test(fr.url()));
      const words = text.split(" ");
      for (let i = 1; i <= words.length; i++) {
        await frame.evaluate(([t, fin]) => window.__hear(t, fin), [words.slice(0, i).join(" "), i === words.length]);
        await sleep(wordMs);
      }
    },
    /** A box around something; its label sits in the space beside the phone. */
    /** A box around something — or around several things, given as a list. */
    async highlight(f, label, { hold } = {}) {
      if (collect) return;
      let b;
      if (Array.isArray(f)) {
        const bs = [await boxOf(f[0])];
        for (const g of f.slice(1)) bs.push(await boxOf(g, { scroll: false }));
        const x = Math.min(...bs.map((r) => r.x));
        const y = Math.min(...bs.map((r) => r.y));
        b = { x, y, width: Math.max(...bs.map((r) => r.x + r.width)) - x, height: Math.max(...bs.map((r) => r.y + r.height)) - y };
      } else b = await boxOf(f);
      await page.evaluate(([r, l]) => window.__stage.highlight(r, l), [b, label ?? null]);
      if (hold) {
        await sleep(hold);
        await api.clear();
      }
    },
    async clear() {
      if (!collect) await page.evaluate(() => window.__stage.clear());
    },
    /** A smooth scroll of the phone's screen. */
    async scroll(f, dy) {
      if (collect) return;
      await loc(f).first().evaluate((el, d) => el.scrollBy({ top: d, behavior: "smooth" }), dy);
      await sleep(700);
    },
    /** Move the phone's clock on (a break running out, the end of the day). */
    async later(ms) {
      if (!collect) await page.clock.fastForward(ms);
    },
    /** Anything else, with { page, app, tv } — skipped in collect mode. */
    async do(fn) {
      if (!collect) await fn(where());
    },
    async park(x = 1500, y = 900) {
      if (!collect) await glide(x, y, 600);
    },
  };
  return api;
}
