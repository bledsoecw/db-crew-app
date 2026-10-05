/* Refuse to deploy a public/config.js that would break the live app.
 *
 * Runs as a Firebase `predeploy` hook, so it fires on every `firebase deploy`
 * with no one having to remember it.
 *
 * public/config.js carries the live apiUrl, clientId and Firebase keys. It is
 * git-ignored, so branches cannot disturb it — but a Hosting deploy REPLACES
 * the entire site, so a missing, blank or broken config.js takes the live app
 * down just as surely as a wrong one.
 *
 * The service worker hides the damage for a while: config.js is in the cached
 * shell and the fetch handler is cache-first, so phones keep serving the last
 * good copy until their cache is dropped. The outage then appears hours after
 * the deploy that caused it, with a working app in between and nothing to
 * connect the two. That delay is why this check exists rather than a habit.
 *
 * It EXECUTES the file rather than pattern-matching it, because the text of a
 * config file says less than you would think:
 *
 *   - Matching quotes with a regex missed double-quoted values — the style
 *     Firebase's own console hands you — and reported a good file as broken.
 *   - A file that is missing `window.DBTC_CONFIG =` still contains the right
 *     words, so a text match passes it, while the browser fails to parse it.
 *   - A misplaced comma is invisible to a regex and fatal to the app.
 *
 * Running it in a vm catches all three the way the browser would.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE = new URL('./public/config.js', import.meta.url);
const RED = '\x1b[31m', YEL = '\x1b[33m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

const die = (lines, how) => {
  console.error(`\n${RED}${BOLD}Deploy stopped: public/config.js would take the live app down.${OFF}\n`);
  for (const l of lines) console.error('  ' + l);
  console.error('');
  for (const l of how) console.error('  ' + l);
  console.error('');
  process.exit(1);
};

const FROM_BACKUP = [
  'Restore it from your copy, then deploy again:',
  '',
  '    Copy-Item C:\\dev\\config-live-backup.js public\\config.js -Force',
  '',
  'No copy? Take one from the running site — it still has the good values:',
  '',
  '    curl.exe -s https://db-crews.web.app/config.js -o public\\config.js',
];

const FIRST_TIME = [
  'Setting this clone up for the first time? Start from the template:',
  '',
  '    Copy-Item config.example.js public\\config.js',
  '',
  'then fill in apiUrl and clientId. SETUP.md \u00a74 says where both come from.',
  '',
  'Already have a live site? Take the values straight off it instead:',
  '',
  '    curl.exe -s https://db-crews.web.app/config.js -o public\\config.js',
];

const SHAPE = [
  'The whole file should be one assignment, commas between every entry:',
  '',
  '    window.DBTC_CONFIG = {',
  "      apiUrl:   '…/exec',",
  "      clientId: '….apps.googleusercontent.com'",
  '    };',
  '',
  'Adding the optional firebase block? The clientId line then needs a',
  'trailing comma, because it is no longer the last entry.',
];

let src;
try {
  src = readFileSync(FILE, 'utf8');
} catch {
  die(['public/config.js does not exist.',
       'It is git-ignored, so a fresh clone will not have one.',
       'A Hosting deploy replaces the whole site, so deploying without it',
       'would leave the live app with no settings at all.'], FIRST_TIME);
}

// Run it exactly as the browser will.
const sandbox = { window: {} };
try {
  vm.runInNewContext(src, sandbox, { filename: 'public/config.js', timeout: 2000 });
} catch (e) {
  die([`public/config.js does not run: ${e.message}`,
       'The browser fails the same way, so the app would never start —',
       'the sign-in screen would say "config.js is not filled in yet".',
       'Usually a missing or extra comma between entries.'], SHAPE);
}

const cfg = sandbox.window.DBTC_CONFIG;
if (!cfg || typeof cfg !== 'object') {
  die(['public/config.js runs, but never sets window.DBTC_CONFIG.',
       'The app reads that exact name and would find nothing.',
       'Most often the leading "window.DBTC_CONFIG = " has been dropped.'], SHAPE);
}

// A console that masks a secret on screen will happily let you copy the mask.
// The result looks plausible — right prefix, right length — and is fatal in a
// way that names nothing: a header value must be Latin-1, so Safari throws a
// bare "Type error" out of the Headers constructor, four frames deep inside
// the Firebase SDK. Every value here is ASCII by nature, so anything else is
// a paste that went wrong.
const MASKS = /[\u2022\u00b7\u2219\u25cf\u25cb\u2027\u2024\uff65\u2043]/;
const nonAscii = [];
(function scan(o, path) {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    const at = path ? `${path}.${k}` : k;
    if (typeof v === 'string') {
      if (MASKS.test(v)) {
        nonAscii.push(`${at} contains bullet characters — this is the masked value a console shows, not the value itself. Use the copy button, or reveal it first.`);
      } else if (!/^[\x20-\x7E]*$/.test(v)) {
        const bad = [...v].find((c) => c < ' ' || c > '~');
        nonAscii.push(`${at} contains a character that is not plain ASCII (U+${bad.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}). Every value here should be ASCII; this is usually a bad copy-paste or a smart quote.`);
      }
    } else scan(v, at);
  }
})(cfg, '');
if (nonAscii.length) die(nonAscii, FROM_BACKUP);

const problems = [];
for (const key of ['apiUrl', 'clientId']) {
  const v = typeof cfg[key] === 'string' ? cfg[key].trim() : null;
  if (v === null) problems.push(`${key} is missing, or is not a string.`);
  else if (!v) problems.push(`${key} is empty — this looks like the template, not your settings.`);
}
if (typeof cfg.apiUrl === 'string' && cfg.apiUrl.trim() &&
    !/^https:\/\/script\.google\.com\/.*\/exec$/.test(cfg.apiUrl.trim())) {
  problems.push(`apiUrl does not look like an Apps Script /exec URL: ${cfg.apiUrl.trim()}`);
}
if (problems.length) die(problems, FROM_BACKUP);

console.log('config.js: apiUrl and clientId are set — deploying.');

// Push is optional, so this warns rather than stops. A half-filled block is
// worth saying out loud, because the app just reports "not set up" and the
// reason for that is invisible from the phone.
const fb = cfg.firebase && typeof cfg.firebase === 'object' ? cfg.firebase : {};
const pushKeys = { apiKey: fb.apiKey, projectId: fb.projectId, messagingSenderId: fb.messagingSenderId, appId: fb.appId, vapidKey: cfg.vapidKey };
const set = Object.entries(pushKeys).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k]) => k);
const unset = Object.keys(pushKeys).filter((k) => !set.includes(k));
if (set.length === 0) {
  // Optional, so not a refusal — but a config.js restored from an old backup
  // turns push OFF on every phone (Diagnostics: "Push: not set up", the Turn
  // on notifications button hidden), and config.js sits in the service
  // worker's cached shell, so the fix needs a new build, not just a redeploy.
  console.log(`${YEL}${BOLD}config.js: push notifications not configured${OFF}${YEL} — the app will say "Push: not set up" and hide the Turn on notifications button.${OFF}`);
  console.log(`${YEL}  Fine for a site that never had push. If the live site HAS it, this deploy turns it off on every phone: restore the firebase block${OFF}`);
  console.log(`${YEL}  and vapidKey (SETUP.md 4b), then bump CACHE in public/sw.js so the phones fetch the new file.${OFF}`);
} else if (unset.length) {
  console.log(`${YEL}config.js: push is half configured — missing ${unset.join(', ')}. It will stay off until all five are set.${OFF}`);
} else {
  console.log('config.js: push notifications configured.');
}
