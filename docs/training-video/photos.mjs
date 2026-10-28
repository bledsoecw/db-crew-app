// The "photos" the training video takes: simple drawings of a house, a roof
// slope, a pipe boot, a gutter and a chimney, rendered to JPEGs, plus the
// moving picture the phone's camera shows (a .y4m Chromium plays as its fake
// camera). Drawings on purpose: no real house, and no test pattern on screen.
//
//   node photos.mjs            writes them under $VIDEO_WORK/photos
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { WORK, ensureDir } from "./studio.mjs";

const OUT = ensureDir(path.join(WORK, "photos"));

const SKY = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4e6"/><stop offset="1" stop-color="#cfe5f5"/></linearGradient>
  <pattern id="sh" width="44" height="22" patternUnits="userSpaceOnUse"><rect width="44" height="22" fill="#5b5f66"/><path d="M0 21h44M22 0v11M0 11h44M11 11v11M33 11v11" stroke="#3e4248" stroke-width="2"/></pattern>
  <pattern id="shn" width="44" height="22" patternUnits="userSpaceOnUse"><rect width="44" height="22" fill="#6b5a4c"/><path d="M0 21h44M22 0v11M0 11h44M11 11v11M33 11v11" stroke="#4c3f35" stroke-width="2"/></pattern>
  <pattern id="sid" width="20" height="16" patternUnits="userSpaceOnUse"><rect width="20" height="16" fill="#e9e3d6"/><path d="M0 15h20" stroke="#c9c1b0" stroke-width="2"/></pattern></defs>`;

const SCENES = {
  // The house, as the start photo sees it from the drive.
  house: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#sky)"/>
    <circle cx="1080" cy="150" r="70" fill="#fff6c8" opacity=".9"/>
    <ellipse cx="160" cy="560" rx="170" ry="210" fill="#4f8a3c"/><ellipse cx="1150" cy="590" rx="150" ry="190" fill="#467d36"/>
    <rect x="0" y="660" width="1280" height="300" fill="#6aa74c"/>
    <path d="M300 400 L640 190 L980 400 Z" fill="url(#sh)" stroke="#2e3136" stroke-width="6"/>
    <rect x="340" y="400" width="600" height="300" fill="url(#sid)" stroke="#a89f8d" stroke-width="4"/>
    <rect x="590" y="520" width="100" height="180" fill="#7a4b2a"/><circle cx="672" cy="612" r="6" fill="#e2c26b"/>
    <rect x="410" y="470" width="120" height="100" fill="#9cc7e8" stroke="#fff" stroke-width="8"/>
    <rect x="750" y="470" width="120" height="100" fill="#9cc7e8" stroke="#fff" stroke-width="8"/>
    <rect x="760" y="230" width="60" height="120" fill="#8e4a3a"/>
    <path d="M330 404 H950" stroke="#d8d8d8" stroke-width="10"/>
    <rect x="980" y="610" width="230" height="110" rx="6" fill="#2f6db3"/><rect x="980" y="600" width="230" height="20" fill="#24548a"/>
    <text x="1095" y="675" text-anchor="middle" font-family="Archivo,Arial" font-weight="800" font-size="30" fill="#fff">DB</text>
    <rect x="0" y="700" width="1280" height="260" fill="#9a9a96" opacity=".35"/></svg>`,
  // A finished slope, close up.
  slope: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#sky)"/>
    <path d="M0 260 L1280 120 L1280 960 L0 960 Z" fill="url(#shn)"/>
    <path d="M0 260 L1280 120" stroke="#3c332c" stroke-width="16"/>
    <rect x="0" y="252" width="1280" height="10" fill="#4b4038" transform="rotate(-6.2 0 252)"/></svg>`,
  // A pipe boot, cracked — the before photo.
  bootOld: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#sh)"/>
    <ellipse cx="640" cy="560" rx="230" ry="110" fill="#2a2a2a"/>
    <path d="M520 560 Q640 360 760 560 Z" fill="#333"/>
    <rect x="600" y="300" width="80" height="230" fill="#cfcfcf" stroke="#9a9a9a" stroke-width="4"/>
    <path d="M610 470 L650 500 L630 520 L670 545" stroke="#e8e8e8" stroke-width="7" fill="none"/>
    <path d="M560 540 L600 560 M700 560 L735 530" stroke="#111" stroke-width="5"/></svg>`,
  // The same pipe boot, new — the after photo.
  bootNew: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#shn)"/>
    <ellipse cx="640" cy="560" rx="230" ry="110" fill="#1d1d1d"/>
    <path d="M520 560 Q640 360 760 560 Z" fill="#262626"/>
    <rect x="600" y="300" width="80" height="230" fill="#e4e4e4" stroke="#a8a8a8" stroke-width="4"/>
    <ellipse cx="640" cy="555" rx="140" ry="40" fill="none" stroke="#111" stroke-width="10"/></svg>`,
  // A gutter run and its downspout.
  gutter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#sky)"/>
    <path d="M0 120 L1280 120 L1280 360 L0 360 Z" fill="url(#sh)"/>
    <rect x="0" y="360" width="1280" height="600" fill="url(#sid)"/>
    <rect x="0" y="350" width="1280" height="60" fill="#f2f2f2" stroke="#c4c4c4" stroke-width="4"/>
    <rect x="1050" y="400" width="56" height="560" fill="#f2f2f2" stroke="#c4c4c4" stroke-width="4"/>
    <path d="M1050 420 h56" stroke="#c4c4c4" stroke-width="6"/></svg>`,
  // A chimney and its flashing.
  chimney: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960">${SKY}
    <rect width="1280" height="960" fill="url(#sky)"/>
    <path d="M0 420 L1280 300 L1280 960 L0 960 Z" fill="url(#sh)"/>
    <rect x="520" y="150" width="240" height="420" fill="#8e4a3a"/>
    <path d="M520 150 h240 M520 230 h240 M520 310 h240 M520 390 h240 M520 470 h240" stroke="#6e3a2d" stroke-width="6"/>
    <path d="M500 560 L780 535 L780 575 L500 600 Z" fill="#b9b9b9"/>
    <path d="M500 560 L540 520" stroke="#b9b9b9" stroke-width="16"/></svg>`,
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
for (const [name, svg] of Object.entries(SCENES)) {
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", '<svg width="1280" height="960" ')}</body></html>`);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 88 });
}
await browser.close();

// The camera's moving picture: the house, held in a hand (a slow drift and a
// little wobble), 640×480 at 15fps, four seconds that Chromium loops.
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-loop", "1", "-i", path.join(OUT, "house.jpg"),
  "-vf", "scale=1600:1200,zoompan=z='1.12+0.02*sin(on/9)':x='iw/2-(iw/zoom/2)+18*sin(on/11)':y='ih/2-(ih/zoom/2)+10*cos(on/13)':d=1:s=640x480:fps=15",
  "-frames:v", "60", "-pix_fmt", "yuv420p", path.join(OUT, "camera.y4m"),
]);
console.log(`photos → ${OUT}`);
