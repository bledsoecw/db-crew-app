/* Screenshot every screen against dev/mock.js. Nothing here ships.
 *
 *   node dev/preview.mjs [outDir]
 *
 * Needs a local static server on the port below and Playwright available.
 * The Chromium flags give it a fake camera so the capture screen renders a
 * real preview instead of the permission wall. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const OUT = process.argv[2] || './shots';
const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

async function session(flags = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    permissions: ['camera'],
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The sandbox has no CA for accounts.google.com; that's the environment.
    if (/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) return;
    errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript(`window.__MOCK_FOREMAN=${!!flags.foreman};window.__MOCK_READONLY=${!!flags.readOnly};window.__MOCK_NOTMANAGER=${!!flags.notManager};window.__MOCK_TWO_TODAY=${!!flags.twoToday};`);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  return { ctx, page, errs };
}

const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
const tap = async (page, sel, ms = 500) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };

const allErrs = [];

// ---- crew: clocked out -> clock in -> owed -> switch -> blocked clock-out ----
{
  const { ctx, page, errs } = await session();
  await shot(page, '01-clocked-out');

  await tap(page, '#clockIn');
  await shot(page, '02-code-picker');

  await tap(page, '.coderow:has-text("Masonry Labor")', 800);
  await shot(page, '03-before-prompt');

  await tap(page, '#pSkip');
  await shot(page, '04-on-clock-owed');

  await tap(page, '#switchBtn');
  await tap(page, '.coderow:has-text("Final Clean")', 700);
  await shot(page, '05-finished-prompt');

  await tap(page, '#pNo', 900);
  await tap(page, '#pSkip');
  await tap(page, '#clockOutBtn', 600);
  await shot(page, '06-clock-out-blocked');

  await tap(page, '#sheetClose');
  await tap(page, '#remind', 1200);          // the camera is reached from the clock, not a tab
  await shot(page, '07-capture');

  await tap(page, '.tab[data-tab="job"]', 400);
  await tap(page, '#diagLine', 500);
  await shot(page, '07b-diagnostics');
  await tap(page, '#diagBack', 300);

  await tap(page, '.tab[data-tab="log"]', 600);
  await shot(page, '08-day-log');

  await tap(page, '.tab[data-tab="job"]', 400);
  await tap(page, '#sunBtn', 500);
  await shot(page, '09-day-mode');

  allErrs.push(...errs);
  await ctx.close();
}

// ---- foreman + the read-only bar ----
{
  const { ctx, page, errs } = await session({ foreman: true, readOnly: true });
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(400);
  await shot(page, '10-foreman-readonly');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- site checks: the card line, the list, a signature, read-only, the nudge ----
{
  const { ctx, page, errs } = await session();
  await shot(page, '12-clock-nudge');   // the banner sits on the screen the app opens to
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await shot(page, '13-jobs-checks');

  await tap(page, '[data-checks="t4roof"]', 600);
  await shot(page, '14-checklist');

  await tap(page, '.ckrow[data-line="movedback"]', 150);
  await tap(page, '.ckrow[data-line="blown"]', 150);
  await tap(page, '.ckrow[data-line="magnet"]', 150);
  await tap(page, '#ckWhoMe', 2300);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await shot(page, '15-checklist-ticked');

  await tap(page, '#ckSignBtn', 500);
  await shot(page, '16-sign-off-confirm');

  await tap(page, '#skYes', 2300);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await shot(page, '17-signed-off');

  await tap(page, '#ckBack', 900);
  await shot(page, '18-jobs-signed');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- a crew lead who is not a site manager: the board's 403 ----
{
  const { ctx, page, errs } = await session({ notManager: true });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 600);
  await tap(page, '.ckrow[data-line="address"]', 2300);
  await shot(page, '19-checklist-readonly');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the week, the two-roof morning, and the day log ----
{
  const { ctx, page, errs } = await session();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await shot(page, '20-week-view');
  await tap(page, '.tab[data-tab="log"]', 500);
  await shot(page, '21-day-log-blank');
  await tap(page, '[data-lang="es"]', 400);
  await shot(page, '21b-day-log-spanish');
  await tap(page, '[data-lang="en"]', 400);
  await page.locator('#dlStory').fill('Got on the job after 8 a.m. due to appointment');
  await tap(page, '#dlTellPm', 700);
  await page.locator('#dlStory').fill('Tear-off and dry-in, north side shingled. Two sheets of decking replaced.');
  await tap(page, '[data-yn="delays"][data-v="1"]', 200);
  await tap(page, '[data-why="weather"]', 200);
  await tap(page, '[data-yn="safety"][data-v="0"]', 300);
  await shot(page, '22-day-log-filled');
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(300);
  await shot(page, '22b-day-log-filled-bottom');
  await tap(page, '#dlReview', 500);
  await shot(page, '23-day-log-review');
  await tap(page, '#dlSend', 1500);
  await shot(page, '24-day-log-sent');
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await session({ twoToday: true });
  await shot(page, '25-two-roofs-today');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the 5-minute escalation, with the grace period shortened ----
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;');
  await page.addInitScript(mock);
  // Match both "/" and "/index.html" — the app is served from the directory URL.
  await page.route((u) => u.pathname === '/' || u.pathname.endsWith('/index.html'), async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('var BEFORE_GRACE_SEC = 5*60;', 'var BEFORE_GRACE_SEC = 3;');
    await route.fulfill({ response: res, body });
  });
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await tap(page, '#clockIn');
  await tap(page, '.coderow:has-text("Masonry Labor")', 800);
  await tap(page, '#pSkip');
  await page.waitForTimeout(5200);
  await shot(page, '11-nudge');
  allErrs.push(...errs);
  await ctx.close();
}

await browser.close();
console.log('CONSOLE ERRORS:', JSON.stringify([...new Set(allErrs)].slice(0, 12), null, 1));
