/* "Material loaded for the crew", end to end against dev/mock.js. Nothing
 * here ships.
 *
 *   node dev/loaded-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * Drives the real page: the button on a card with a warehouse half and not on
 * one without, the save, the material line RE-ASKED from the board after it
 * (T1.18 — T1.17 left the line reading "not loaded" under a green button),
 * the "are you sure" before an undo, the board's 403 taking the button away,
 * and a 502 leaving the card as it was. The mock records every save in
 * window.__LOADS and counts the list fetches in window.__MYJOBS. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
}

async function boot(flags = {}) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) return;              // the sandbox has no CA for accounts.google.com
    const at = (m.location && m.location()) || {};
    if (/config\.js/.test(at.url || '')) return;                          // git-ignored; the mock pins the config instead
    errs.push(m.text());
  });
  await page.addInitScript(`window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;
    window.__MOCK_NOTMANAGER=${!!flags.notManager};window.__MOCK_PUTFAIL=${!!flags.putFail};window.__MOCK_SLOWPUT=0;
    window.__MOCK_TWO_TODAY=true;`);   // Lucas booked today: a card further out than tomorrow hides its material line on purpose
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const loads = (page) => page.evaluate(() => (window.__LOADS || []).map((p) => JSON.parse(JSON.stringify(p))));
const asked = (page) => page.evaluate(() => window.__MYJOBS || 0);
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const cls = (page, sel) => page.locator(sel).first().getAttribute('class');
const count = (page, sel) => page.locator(sel).count();
// The Lucas card (j2): a DB inventory pull, nothing pulled yet, booked TODAY
// so the card draws its material line. Found by the card's own main button,
// which survives the loaded button turning into the question.
const LUCAS = '.jcard:has([data-pick="j2"])';

// ---- a site manager: the button, the save, the re-asked line, the undo that asks first ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('a card with a warehouse half carries the button', await count(page, '[data-loaded="j2"]'), 1);
  check('a card with no warehouse half does not', await count(page, '[data-loaded="j_2841"]'), 0);
  check('a load already recorded reads loaded, with the undo kicker',
    [await txt(page, '[data-loaded="j4"] > span:first-child'), await txt(page, '[data-loaded="j4"] .jbtn-k')],
    ['Loaded for the crew', 'Tap to undo']);
  check('before: the line is the board\'s words', await txt(page, `${LUCAS} .jmat`), 'Pull from shop');
  const askedBefore = await asked(page);

  await tap(page, '[data-loaded="j2"]', 2000);
  let l = await loads(page);
  check('one save, loaded, with the job label', [l.length, l[0].jobId, l[0].loaded, l[0].jobLabel], [1, 'j2', true, 'JT #26-1045 Lucas']);
  check('the button reads loaded', [await txt(page, '[data-loaded="j2"] > span:first-child'), await txt(page, '[data-loaded="j2"] .jbtn-k')], ['Loaded for the crew', 'Tap to undo']);
  check('the list was asked for again after the save', (await asked(page)) - askedBefore, 1);
  check('so the material line is the board\'s new sentence, tick stripped', await txt(page, `${LUCAS} .jmat`), 'Loaded for the crew');
  check('in green', /\bgood\b/.test(await cls(page, `${LUCAS} .jmat`)), true);

  await tap(page, '[data-loaded="j2"]', 400);
  check('an undo asks first: the question and two answers', [await count(page, `${LUCAS} .jsure`), await count(page, '[data-loaded-keep="j2"]'), await count(page, '[data-loaded-undo="j2"]')], [1, 1, 1]);
  // The label is its own block, so the DOM text runs the two together.
  const q = await txt(page, `${LUCAS} .jsure`), k = await txt(page, `${LUCAS} .jsure .k`);
  check('the question says what the undo does', [k, q.slice(k.length).trim()],
    ['Undo the load — are you sure?', 'The board will read not loaded for the crew again, and the office gets a note saying so.']);
  check('nothing saved by asking', (await loads(page)).length, 1);
  check('the line is untouched while it asks', await txt(page, `${LUCAS} .jmat`), 'Loaded for the crew');

  await tap(page, '[data-loaded-keep="j2"]', 400);
  check('"No, keep it": the green button is back and nothing was saved',
    [await txt(page, '[data-loaded="j2"] > span:first-child'), await count(page, `${LUCAS} .jsure`), (await loads(page)).length],
    ['Loaded for the crew', 0, 1]);

  await tap(page, '[data-loaded="j2"]', 400);
  await tap(page, '[data-loaded-undo="j2"]', 2000);
  l = await loads(page);
  check('"Yes, undo it": the undo is saved', [l.length, l[1].jobId, l[1].loaded], [2, 'j2', false]);
  check('the button offers the load again', await txt(page, '[data-loaded="j2"] > span:first-child'), 'Material loaded for the crew');
  check('and the line follows the board: staged, not loaded', [await txt(page, `${LUCAS} .jmat`), /\bwarn\b/.test(await cls(page, `${LUCAS} .jmat`))], ['Staged — not loaded yet', true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- not a site manager: the board's 403 takes the button away ----
{
  const { ctx, page, errs } = await boot({ notManager: true });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('the button shows until the board says no', await count(page, '[data-loaded="j2"]'), 1);
  await tap(page, '[data-loaded="j2"]', 1500);
  check('the 403 takes every loaded button away', await count(page, '[data-loaded]'), 0);
  check('the line stays the board\'s', await txt(page, `${LUCAS} .jmat`), 'Pull from shop');
  check('one attempt was made', (await loads(page)).length, 1);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a JobTread hiccup: a 502 leaves the card as it was ----
{
  const { ctx, page, errs } = await boot({ putFail: true });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  const askedBefore = await asked(page);
  await tap(page, '[data-loaded="j2"]', 1500);
  check('a 502 leaves the button offering the load', await txt(page, '[data-loaded="j2"] > span:first-child'), 'Material loaded for the crew');
  check('and the line as it was', await txt(page, `${LUCAS} .jmat`), 'Pull from shop');
  check('nothing was re-asked for a save that did not land', (await asked(page)) - askedBefore, 0);
  check('the save was attempted once', (await loads(page)).length, 1);
  await ctx.close();
}

await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got  ${JSON.stringify(r.actual)}\n      want ${JSON.stringify(r.expected)}`));
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
