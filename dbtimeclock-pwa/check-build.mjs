/* Refuse to deploy a page and a script that would not reach the phones
 * together (T2.32, audit I5).
 *
 * Runs as the second Firebase `predeploy` hook, after check-config.mjs, so it
 * fires on every `firebase deploy` with no one having to remember it.
 *
 * Since T2.32 the app's script is its own file, public/app.js, which the page
 * asks for as app.js?b=<build>. The service worker saves the page and that
 * script as a pair and serves the script from its cache, so ONE build number
 * lives in four places and must agree:
 *
 *   public/index.html   <html data-build="T2.32">   <script src="app.js?b=T2.32">
 *   public/sw.js        var BUILD = 'T2.32'
 *   public/app.js       var APP_BUILD = 'T2.32 (…)'
 *
 * And it must CHANGE whenever app.js does. A phone that already holds
 * app.js?b=T2.32 never asks for it again, so a fixed script deployed under
 * the same build would never reach it — the deploy would look done and the
 * phones would go on running the old code, the way the Close Out server ran
 * October 26's code for days in October. So this compares with the live site
 * and stops a deploy whose script changed under an unchanged build.
 *
 * The live site out of reach is a warning, not a stop: a deploy must not wait
 * on the network to say the same build is still the same build.
 *
 *   node check-build.mjs                     (the predeploy hook runs it)
 *   DBC_LIVE_URL=http://127.0.0.1:5055 node check-build.mjs   (against an emulator)
 */
import { readFileSync } from 'node:fs';

const LIVE = (process.env.DBC_LIVE_URL || 'https://db-crews.web.app').replace(/\/+$/, '');
const RED = '\x1b[31m', YEL = '\x1b[33m', BOLD = '\x1b[1m', OFF = '\x1b[0m';
const read = (f) => readFileSync(new URL('./public/' + f, import.meta.url), 'utf8');
// Line endings are the clone's business, not the build's.
const same = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

const die = (lines) => {
  console.error(`\n${RED}${BOLD}Deploy stopped: the page and its script would not reach the phones together.${OFF}\n`);
  for (const l of lines) console.error('  ' + l);
  console.error('');
  process.exit(1);
};

const BUMP = [
  'Give this deploy a new build, the same in all four places:',
  '',
  '    public\\app.js      var APP_BUILD = \'T2.33 (date)\';',
  '    public\\index.html  <html lang="en" data-build="T2.33">',
  '    public\\index.html  <script src="app.js?b=T2.33"></script>',
  '    public\\sw.js       var BUILD = \'T2.33\';',
  '',
  'and the Apps Script\'s APP_BUILD in apps-script\\Code.gs to match, so',
  'Diagnostics reads App and API the same.',
];

let page, sw, app;
try { page = read('index.html'); sw = read('sw.js'); app = read('app.js'); }
catch (e) { die([`A file the app needs is missing: ${e.message}`]); }

const builds = {
  'index.html data-build': (/<html[^>]*\sdata-build="([^"]+)"/.exec(page) || [])[1],
  'index.html app.js?b=': (/<script src="app\.js\?b=([^"]+)"><\/script>/.exec(page) || [])[1],
  'sw.js BUILD': (/var BUILD = '([^']+)'/.exec(sw) || [])[1],
  'app.js APP_BUILD': (/var APP_BUILD = '([^ ']+)[ ']/.exec(app) || [])[1],
};
const missing = Object.keys(builds).filter((k) => !builds[k]);
if (missing.length) die([`No build found for: ${missing.join(', ')}.`, '', ...BUMP]);
const build = builds['app.js APP_BUILD'];
const off = Object.keys(builds).filter((k) => builds[k] !== build);
if (off.length) {
  die(['The build is not the same in all four places:', '',
       ...Object.entries(builds).map(([k, v]) => `    ${k.padEnd(24)} ${v}${v === build ? '' : '   <- differs'}`), '', ...BUMP]);
}
if (page.includes('<script>') || /<script(?![^>]*\ssrc=)[^>]*>/.test(page)) {
  die(['index.html has an inline <script> again. The script lives in app.js since T2.32,',
       'and the security policy will refuse inline script once it is switched on.']);
}
console.log(`build: ${build} in index.html, sw.js and app.js.`);

// The live site: the same build must still be the same script.
const get = async (path) => {
  if (typeof fetch !== 'function') throw new Error('this Node has no fetch (Node 18 or newer has it)');
  const r = await fetch(LIVE + path, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} answered ${r.status}`);
  return r.text();
};
try {
  const liveSw = await get('/sw.js');
  const liveBuild = (/var BUILD = '([^']+)'/.exec(liveSw) || [])[1] || '';
  if (liveBuild !== build) {
    console.log(`build: the live site runs ${liveBuild || 'a build from before T2.32'}; this deploy is ${build}.`);
  } else {
    const liveApp = await get(`/app.js?b=${encodeURIComponent(build)}`);
    if (!same(liveApp, app)) {
      die([`app.js has changed, but the build is still ${build} — the same as the live site.`,
           `Phones that already hold app.js?b=${build} would never fetch the new one.`, '', ...BUMP]);
    }
    console.log(`build: ${build} is already live and app.js is unchanged — deploying the rest.`);
  }
} catch (e) {
  console.log(`${YEL}build: could not compare with ${LIVE} (${e.message}). Deploying anyway —${OFF}`);
  console.log(`${YEL}  make sure the build was raised if app.js changed since the last deploy.${OFF}`);
}
