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

// ---- crew: clocked out -> code -> start photo -> on the clock -> stop sheet -> end photo ----
{
  const { ctx, page, errs } = await session();
  await shot(page, '01-clocked-out');

  await tap(page, '#clockIn');
  await shot(page, '02-code-picker');

  await tap(page, '.coderow:has-text("Masonry Labor")', 1200);
  await shot(page, '03-start-photo');          // the camera, locked to START

  await tap(page, '#shutter', 3200);           // the shutter clocks in (after the location ceiling)
  await shot(page, '04-on-clock');

  await tap(page, '#stopBtn', 500);
  await shot(page, '05-stop-sheet');

  await tap(page, '#stopOut', 1200);
  await shot(page, '06-end-photo');            // the camera, locked to END
  await tap(page, '#camBack', 500);            // stay on

  await tap(page, '#photoBtn', 1200);          // a progress shot: the camera, unlocked
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
  await tap(page, '[data-yn="f:22PC7jNSGzEb"][data-v="0"]', 200);
  await tap(page, '[data-opt="22PC7jNshbiK"][data-val="Roofing"]', 200);
  await tap(page, '[data-yn="f:22PC7jQ6BkBC"][data-v="1"]', 200);
  await tap(page, '[data-opt="22PLhdEgfHXF"][data-val="Weather"]', 200);
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

// ---- a break, and the clock-out: end photo, then today's log ----
{
  const { ctx, page, errs } = await session();
  await tap(page, '#clockIn');
  await tap(page, '.coderow:has-text("Masonry Labor")', 1000);
  await tap(page, '#shutter', 3200);
  await tap(page, '#stopBtn', 400);
  await tap(page, '#stopBreak', 3200);
  await shot(page, '11-on-break');
  await tap(page, '#backBtn', 3200);
  await tap(page, '#stopBtn', 400);
  await tap(page, '#stopOut', 1000);
  await tap(page, '#shutter', 3500);
  await shot(page, '11b-clock-out-nudge');
  allErrs.push(...errs);
  await ctx.close();
}

await browser.close();
console.log('CONSOLE ERRORS:', JSON.stringify([...new Set(allErrs)].slice(0, 12), null, 1));
