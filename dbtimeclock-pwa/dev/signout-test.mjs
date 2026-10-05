/* Sign out (T2.1), against dev/mock.js. Nothing here ships.
 *
 *   node dev/signout-test.mjs
 *
 * The button on Diagnostics: refused with the reason while anything is still
 * queued, armed by the first tap, and on the second the phone forgets every
 * dbtc_* key and the IndexedDB stores and lands on the sign-in screen with
 * the account picker offered rather than the account that just left. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();

const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.addInitScript('window.__MOCK_ROLE="siteManager";');
await page.addInitScript(mock);
await page.goto(APP_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);

await page.locator('#diagLine').click();
await page.waitForTimeout(300);
check('button on Diagnostics', await txt(page, '#signOutBtn'), 'Sign out');
check('button is 44px or more', await page.evaluate(() => document.getElementById('signOutBtn').getBoundingClientRect().height >= 44), true);

// Refused while something is queued, and the reason names it.
await page.evaluate(() => { S.queued = 2; });
await page.locator('#signOutBtn').click();
await page.waitForTimeout(200);
check('refused with queued photos', (await txt(page, '#signOutFoot')).startsWith('Not yet — 2 photos still waiting to send'), true);
check('not armed by a refusal', await txt(page, '#signOutBtn'), 'Sign out');
await page.evaluate(() => { S.queued = 0; });

// Seed some per-person state to prove the wipe.
await page.evaluate(() => { localStorage.setItem('dbtc_co_job_x', '{}'); localStorage.setItem('dbtc_co_seq', '7'); });
const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^dbtc_/.test(k)).length);
check('state on the phone before', before > 2, true);

// First tap arms, second tap signs out.
await page.locator('#signOutBtn').click();
await page.waitForTimeout(200);
check('first tap arms', await txt(page, '#signOutBtn'), 'Tap again to sign out');
check('arming says who is forgotten', /forgets .+ and shows the sign-in screen/.test(await txt(page, '#signOutFoot')), true);
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }).catch(() => {}), page.locator('#signOutBtn').click()]);
await page.waitForTimeout(1200);
const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^dbtc_/.test(k)));
check('only the picker flag survives', keys, ['dbtc_pick_account']);
check('gate shown', await page.evaluate(() => !document.getElementById('gate').classList.contains('hidden') && document.getElementById('app').classList.contains('hidden')), true);
check('gate says why', await txt(page, '#gateErr'), 'Signed out. Pick the account to sign in with.');
const stores = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('dbtc', 2);
  r.onsuccess = () => { const db = r.result; const out = {}; let n = 0;
    ['q', 'co', 'cophotos'].forEach((st) => { const c = db.transaction(st).objectStore(st).count(); c.onsuccess = () => { out[st] = c.result; if (++n === 3) res(out); }; });
  };
  r.onerror = () => res({ error: true });
}));
check('IndexedDB stores empty', stores, { q: 0, co: 0, cophotos: 0 });
check('no page errors', errs, []);

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
