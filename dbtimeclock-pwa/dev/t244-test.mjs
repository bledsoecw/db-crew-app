/* T2.44 (6 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t244-test.mjs
 *
 * Every crew member signs in with an @deitemeyerbrothers.com account now,
 * and JobTread still has most of the field crew on a personal address nobody
 * can change there. DB Hub links each person to their JobTread user and the
 * API finds them through it. What the phone does about it:
 *   - a sign-in the API finds no JobTread user for is refused with a reason
 *     (no-link · no-row · old-hub · gone), and the gate says it in words that
 *     tell the person what to ask the office for — and One Tap does not pick
 *     the same account again, so the one JobTread has works meanwhile;
 *   - DB Hub's list or JobTread not answering that lookup is "try again":
 *     boot asks again by itself, and nobody is signed out;
 *   - Diagnostics' copy says when the JobTread user came through the link;
 *   - an account the door turns away is told to use the company account.
 * The Apps Script half is tested in apps-script/code-test.mjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
async function until(page, fn, arg, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* reloading */ }
    await page.waitForTimeout(200);
  }
  return false;
}
async function open(flags = '', waitBoot = true) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__CO=[];window.__TOASTS=[];' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  if (waitBoot) await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const gate = (page) => page.evaluate(() => ({
  up: !document.getElementById('gate').classList.contains('hidden'),
  app: !document.getElementById('app').classList.contains('hidden'),
  text: document.getElementById('gateErr').textContent,
  pick: (function () { try { return localStorage.getItem(PICK_ACCOUNT_KEY); } catch (e) { return 'x'; } })(),
  token: !!AUTH.token,
  me: !!S.me,
}));
const allErrs = [];

// ---- the gate's words for each reason, said directly ----
{
  const { ctx, page, errs } = await open();
  const said = await page.evaluate(() => {
    // The phone names its own token's account when it has one (T2.8); with the
    // token gone, the account the API names.
    authClear();
    const out = {}, em = 'zac@deitemeyerbrothers.com';
    for (const link of ['no-link', 'no-row', 'old-hub', 'gone']) {
      authRefused({ authWhy: 'not-linked', link, email: em });
      out[link] = document.getElementById('gateErr').textContent;
    }
    authRefused({ authWhy: 'not-allowed', email: 'someone@gmail.com' });
    out.notAllowed = document.getElementById('gateErr').textContent;
    return out;
  });
  check('T2.44: a company account not linked yet is told to ask the office to link it in DB Hub, and that the JobTread address works meanwhile', said['no-link'],
    'Signed in as zac@deitemeyerbrothers.com. Your company account isn’t linked to your JobTread user yet — ask the office to link it in DB Hub. Meanwhile you can sign in with the address the office has for you in JobTread.');
  check('…an address DB Hub has no row for: ask for it on their DB Hub row', said['no-row'],
    'Signed in as zac@deitemeyerbrothers.com. Neither JobTread nor DB Hub has anyone under this address — ask the office to put it on your DB Hub row. Meanwhile you can sign in with the address the office has for you in JobTread.');
  check('…a DB Hub too old to link: ask the office to update DB Hub', said['old-hub'],
    'Signed in as zac@deitemeyerbrothers.com. DB Hub can’t link company accounts to JobTread yet — ask the office to update DB Hub. Meanwhile you can sign in with the address the office has for you in JobTread.');
  check('…linked to somebody no longer in JobTread: ask the office to check the link', said.gone,
    'Signed in as zac@deitemeyerbrothers.com. DB Hub links this account to a JobTread user who isn’t one of the company’s people any more — ask the office to check the link in DB Hub.');
  check('…and an account the door turns away is pointed at the company account first', said.notAllowed,
    'Google signed you in as someone@gmail.com, and DB Crew didn’t accept it — JobTread has nobody at the company with that address. Sign in with your @deitemeyerbrothers.com account, or the address the office has for you in JobTread.');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the API refuses the boot: the gate, the words, and One Tap held back ----
{
  const { ctx, page, errs } = await open('window.__MOCK_NOTLINKED="no-link";', false);
  await until(page, () => !document.getElementById('gate').classList.contains('hidden') && /linked/.test(document.getElementById('gateErr').textContent), null, 15000);
  const g = await gate(page);
  check('T2.44: a boot the API refuses as not linked shows the sign-in screen, not a blank clock', [g.up, g.app, g.me], [true, false, false]);
  check('…with the words for that reason, naming the account', /^Signed in as tyler\.b@deitemeyerbrothers\.com\. Your company account isn’t linked to your JobTread user yet/.test(g.text), true);
  check('…the refused token is let go, and One Tap will not pick that account again by itself', [g.token, g.pick], [false, '1']);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- DB Hub's list not on hand: boot asks again, and gets in ----
{
  const { ctx, page, errs } = await open('window.__MOCK_LINKBUSY=2;window.__BOOT_RETRY_MS=[400,400,400];', false);
  const booted = await until(page, () => typeof S === 'object' && !!S.me, null, 20000);
  const g = await gate(page);
  const toasts = await page.evaluate(() => (window.__TOASTS || []).join(' | '));
  check('T2.44: "try again" from the lookup is asked again by itself, and the boot gets in', [booted, g.up, g.token], [true, false, true]);
  check('…nobody was signed out on the way', /Session expired|Signed in as/.test(g.text), false);
  allErrs.push(...errs);
  void toasts;
  await ctx.close();
}

// ---- Diagnostics says the JobTread user came through DB Hub's link ----
{
  const { ctx, page, errs } = await open('window.__MOCK_JTLINKED=true;');
  const line = await page.evaluate(async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (s) => { copied = s; return Promise.resolve(); } } });
    document.getElementById('copyDiagBtn').click();
    await new Promise((r) => setTimeout(r, 200));
    return (copied.split('\n').find((l) => l.indexOf('user ') === 0) || '');
  });
  check('T2.44: the copied Diagnostics say the JobTread user came through DB Hub’s link', /\(JobTread user through DB Hub’s link\)$/.test(line), true);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await open();
  const line = await page.evaluate(async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (s) => { copied = s; return Promise.resolve(); } } });
    document.getElementById('copyDiagBtn').click();
    await new Promise((r) => setTimeout(r, 200));
    return (copied.split('\n').find((l) => l.indexOf('user ') === 0) || '');
  });
  check('…and say nothing of it for someone JobTread knows by the address they signed in with', [line.length > 0, /DB Hub’s link/.test(line)], [true, false]);
  allErrs.push(...errs);
  await ctx.close();
}

check('no page errors', allErrs, []);
await browser.close();
let pass = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got ${JSON.stringify(r.actual)}\n     want ${JSON.stringify(r.expected)}`));
  if (r.pass) pass++;
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
