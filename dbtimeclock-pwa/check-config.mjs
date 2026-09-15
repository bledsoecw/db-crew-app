/* Refuse to deploy a blank public/config.js.
 *
 * Runs as a Firebase `predeploy` hook, so it fires on every `firebase deploy`
 * with no one having to remember it.
 *
 * public/config.js carries the live apiUrl, clientId and Firebase keys. It is
 * git-ignored, so branches can no longer disturb it — but a Hosting deploy
 * REPLACES the entire site, so a missing or blank config.js still takes the
 * live app down just as surely as a wrong one. Both cases fail here.
 *
 * The service worker hides the damage for a while: config.js is in the cached
 * shell and the fetch handler is cache-first, so phones keep serving the last
 * good copy until their cache is dropped. The outage then appears hours after
 * the deploy that caused it, with a working app in between and nothing to
 * connect the two. That delay is why this check exists rather than a habit.
 */
import { readFileSync } from 'node:fs';

const FILE = new URL('./public/config.js', import.meta.url);
const RED = '\x1b[31m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

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
  '    curl.exe -s https://db-time-clock.web.app/config.js -o public\\config.js',
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
  '    curl.exe -s https://db-time-clock.web.app/config.js -o public\\config.js',
];

let src;
try {
  src = readFileSync(FILE, 'utf8');
} catch {
  die(['public/config.js does not exist.',
       'It is git-ignored now, so a fresh clone will not have one.',
       'A Hosting deploy replaces the whole site, so deploying without it',
       'would leave the live app with no settings at all.'], FIRST_TIME);
}

// JavaScript has three string quotes and this file is hand-edited, so all
// three are accepted. Matching only ' made a double-quoted config — the style
// Firebase's own console hands you — read as "not present", which stopped a
// perfectly good deploy and blamed the wrong thing.
const valueOf = (key) => {
  const m = src.match(new RegExp(key + "\\s*:\\s*([\"'`])([\\s\\S]*?)\\1"));
  return m ? m[2].trim() : null;
};

const problems = [];
for (const key of ['apiUrl', 'clientId']) {
  const v = valueOf(key);
  if (v === null) problems.push(`${key} is not present in the file.`);
  else if (!v) problems.push(`${key} is empty — this looks like the template, not your settings.`);
}

const apiUrl = valueOf('apiUrl');
if (apiUrl && !/^https:\/\/script\.google\.com\/.*\/exec$/.test(apiUrl)) {
  problems.push(`apiUrl does not look like an Apps Script /exec URL: ${apiUrl}`);
}

if (problems.length) die(problems, FROM_BACKUP);

console.log('config.js: apiUrl and clientId are set — deploying.');
