/* Refuse to deploy a blank public/config.js.
 *
 * Runs as a Firebase `predeploy` hook, so it fires on every `firebase deploy`
 * with no one having to remember it.
 *
 * config.js carries the live apiUrl, clientId and Firebase keys, and is
 * committed to git deliberately blank so those values are never in the
 * repository. Firebase uploads it like any other file in public/, so a fresh
 * clone — or a branch switch, or a merge that restores the committed copy —
 * followed by a deploy replaces the live settings with empty strings and every
 * phone lands on "config.js is not filled in yet".
 *
 * The service worker hides this for a while: config.js is in the cached shell
 * and the fetch handler is cache-first, so phones keep serving the last good
 * copy until their cache is dropped. The outage then appears hours later with
 * nothing in between to connect it to the deploy that caused it.
 *
 * So the check is here rather than in anyone's memory.
 */
import { readFileSync } from 'node:fs';

const FILE = new URL('./public/config.js', import.meta.url);
const RED = '\x1b[31m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

const die = (lines) => {
  console.error(`\n${RED}${BOLD}Deploy stopped: public/config.js would take the live app down.${OFF}\n`);
  for (const l of lines) console.error('  ' + l);
  console.error('\n  Restore it from your backup, then deploy again:\n');
  console.error('    Copy-Item C:\\dev\\config-live-backup.js public\\config.js -Force\n');
  console.error('  No backup? Take one from the running site first:\n');
  console.error('    curl.exe -s https://db-time-clock.web.app/config.js -o public\\config.js\n');
  process.exit(1);
};

let src;
try {
  src = readFileSync(FILE, 'utf8');
} catch {
  die(['public/config.js is missing entirely.']);
}

const valueOf = (key) => {
  const m = src.match(new RegExp(key + "\\s*:\\s*'([^']*)'"));
  return m ? m[1].trim() : null;
};

const problems = [];
for (const key of ['apiUrl', 'clientId']) {
  const v = valueOf(key);
  if (v === null) problems.push(`${key} is not present in the file.`);
  else if (!v) problems.push(`${key} is empty — this is the committed placeholder, not your settings.`);
}

const apiUrl = valueOf('apiUrl');
if (apiUrl && !/^https:\/\/script\.google\.com\/.*\/exec$/.test(apiUrl)) {
  problems.push(`apiUrl does not look like an Apps Script /exec URL: ${apiUrl}`);
}

if (problems.length) die(problems);

console.log('config.js: apiUrl and clientId are set — deploying.');
