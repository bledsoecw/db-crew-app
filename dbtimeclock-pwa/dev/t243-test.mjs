/* T2.43 (6 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t243-test.mjs
 *
 * Carl's answers before the crews get the app (6 Nov 2026), as far as the
 * phone goes:
 *   - sign-in ("go with option B"): the door is the company domain or anyone
 *     JobTread has as one of the company's own people, so a Google account it
 *     turns away is told to use the address the office keyed into JobTread
 *     for them; JobTread not answering the check is "try again";
 *   - breaks ("no crew member can NOT shorten break afterward only a manager
 *     can shorten it for them"): Started earlier is the day's first
 *     clock-in's only, and the API refuses the rest in words that send them
 *     to their manager;
 *   - "no overnight work allowed": When did you leave? on a block from a day
 *     before takes a time on that day, by 11:59p, and the API refuses later.
 * The Apps Script half is tested in apps-script/code-test.mjs. The suite runs
 * on a page clock at 1:00p on the Ohio day it runs, so a block from 7:00a
 * that morning is always "earlier today", whatever the container's hour. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => { const l = page.locator(sel).first(); return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
async function until(page, fn, arg, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* reloading */ }
    await page.waitForTimeout(200);
  }
  return false;
}
// The Ohio day the suite runs on, and a moment in it.
const NY = 'America/New_York';
const DAY = new Date().toLocaleDateString('en-CA', { timeZone: NY });
const hmOf = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: NY, hour: '2-digit', minute: '2-digit' });
const at = (hm) => { for (const off of ['-05:00', '-04:00']) { const t = Date.parse(DAY + 'T' + hm + ':00' + off); if (hmOf(t) === hm) return t; } throw new Error('no ' + hm); };
async function boot(flags = '', time = at('13:00')) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, timezoneId: NY });
  const page = await ctx.newPage();
  await page.clock.install({ time });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__CO=[];window.__TOASTS=[];' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.waitForTimeout(600);
  return { ctx, page, errs };
}
const allErrs = [];

// ---- sign-in: the words when the door says no, or JobTread does not answer ----
{
  const { ctx, page, errs } = await boot();
  // The phone names the account its own token is for (the mock's Tyler B.).
  const said = await page.evaluate(() => {
    const em = jwtPayload(AUTH.token).email;
    authRefused({ authWhy: 'not-allowed', email: em });
    const a = document.getElementById('gateErr').textContent;
    authRefused({ authWhy: 'jobtread-check' });
    const b = document.getElementById('gateErr').textContent;
    return [a, b, !document.getElementById('gate').classList.contains('hidden'), em];
  });
  check('T2.43: an account the door turns away is told to use the address the office has for them in JobTread', said[0],
    'Google signed you in as ' + said[3] + ', and DB Crew didn’t accept it — JobTread has nobody at the company with that address. Sign in with the address the office has for you in JobTread, or ask the office to add this one.');
  check('…JobTread not answering the check is "try again", never "not allowed"', said[1], 'JobTread didn’t answer the sign-in check — tap the button to try again in a minute.');
  check('…and the sign-in screen is up for it', said[2], true);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- breaks: Started earlier is the day's first clock-in's only ----
{
  // On the clock since 12:55p after a morning block that ended at 12:15p: the
  // 40 minutes between were off the clock — lunch, clocked out and back in.
  const morning = "window.__MOCK_OPEN_AGO=5;window.__MOCK_ROLE='crew';window.__MOCK_FIX={entries:function(c){var t=Date.now();" +
    "return [{id:'am',startedAt:new Date(t-6*3600e3).toISOString(),endedAt:new Date(t-45*60e3).toISOString(),minutes:315,notes:'',job:c.job,code:c.code('ci9')}];}};";
  const { ctx, page, errs } = await boot(morning);
  check('T2.43: back from lunch (clocked out, clocked in again), the block after it offers no Started earlier',
    [await page.evaluate(() => [!!S.open, earlierFloor() > 0, earlierBlock()]), await page.locator('#earlierBtn').isVisible()], [[true, true, null], false]);
  const refused = await page.evaluate(() => apiCall('startedEarlier', [new Date(Date.now() - 30 * 60e3).toISOString()]).then(() => 'moved', (e) => e.message));
  check('…and the API refuses it in words that send them to their manager', /only your manager can change the time between your blocks/.test(refused), true);
  allErrs.push(...errs);
  await ctx.close();
}
{
  // The day's first clock-in, five minutes ago: still theirs to put right.
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=5;window.__MOCK_ROLE='crew';window.__MOCK_FIX={entries:function(){return [];}};");
  check('…the day\'s first clock-in still offers it', [await page.evaluate(() => !!earlierBlock()), await page.locator('#earlierBtn').isVisible()], [true, true]);
  await tap(page, '#earlierBtn', 400);
  check('…and the sheet says the rule', /Your first clock-in of the day only, up to 4 hours back\. Time after a break is your manager’s to change\./.test(await txt(page, '#sheetBody')), true);
  await page.evaluate(() => { closeSheet(); S.lang = 'es'; render(); openSheet('earlier'); });
  await page.waitForTimeout(400);
  check('…in Spanish too', /Solo tu primera entrada del día, hasta 4 horas atrás\. El tiempo después de un descanso lo cambia tu gerente\./.test(await txt(page, '#sheetBody')), true);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- no overnight work: a block from a day before ends that day, by 11:59p ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_YESTERDAY=true;window.__MOCK_ROLE='crew';");
  await tap(page, '#outBtn', 400);
  check('T2.43: When did you leave? on a block from yesterday asks for a time that day, by 11:59p',
    [await page.evaluate(() => [S.sheet, S.leftGate]), /pick the time you left that day, by 11:59p\. No work past midnight\./.test(await txt(page, '#sheetBody'))], [['left', 'overnight'], true]);
  await page.locator('#leftTime').fill('00:30'); await page.waitForTimeout(250);
  check('…12:30a is read as that day — before the block began — and is no end at all',
    [await page.locator('#leftGo').isDisabled(), await txt(page, '#leftGo')], [true, 'Not while you were on it']);
  await page.locator('#leftTime').fill('23:59'); await page.waitForTimeout(250);
  check('…11:59p that day is the latest it takes', [await page.locator('#leftGo').isDisabled(), await txt(page, '#leftGo')], [false, 'I left at 11:59p']);
  await page.evaluate(() => { window.__CLOCK = []; });
  await tap(page, '#leftGo', 300);
  await until(page, () => !S.open && document.body.style.pointerEvents === '', null, 10000);
  const c = await page.evaluate(() => (window.__CLOCK || []).filter((x) => x[0] === 'leftSite')[0] || []);
  const want = await page.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(23, 59, 0, 0); return y.getTime(); });
  check('…and goes as 11:59p yesterday', [c[0], Date.parse(c[1]) === want, c[2]], ['leftSite', true, 'out']);
  allErrs.push(...errs);
  await ctx.close();
}
{
  // The API's half, asked straight: an end after midnight is refused.
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_YESTERDAY=true;window.__MOCK_ROLE='crew';");
  const refused = await page.evaluate(() => { const t = new Date(); t.setHours(0, 30, 0, 0);
    return apiCall('leftSite', [t.toISOString(), null, { kind: 'out' }]).then(() => 'closed', (e) => e.message); });
  check('…the API refuses an end after midnight in words: no overnight work', /^No overnight work/.test(refused), true);
  await page.evaluate(() => { S.lang = 'es'; render(); leftAsk(); });
  await page.waitForTimeout(400);
  check('…and the sheet says it in Spanish', /a más tardar a las 11:59p\. No se trabaja pasada la medianoche\./.test(await txt(page, '#sheetBody')), true);
  allErrs.push(...errs);
  await ctx.close();
}

check('no page errors', allErrs, []);
await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n      got:  ${JSON.stringify(r.actual)}\n      want: ${JSON.stringify(r.expected)}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
