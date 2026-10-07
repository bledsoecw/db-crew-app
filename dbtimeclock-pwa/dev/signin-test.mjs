/* Signing in (T2.8), end to end against dev/mock.js with a fake Google.
 * Nothing here ships.
 *
 *   node dev/signin-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * Google's script is replaced by a stub whose callback the test fires by
 * hand, so it can do what the field did: answer twice (the button tapped
 * again), answer with a personal Gmail, or answer while the trade for the
 * 30-day session cannot get through. */
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
const FAKE_GIS = `window.__GIS = { inits: [], prompts: 0, disabled: 0, cb: null };
window.google = { accounts: { id: {
  initialize: function (o) { __GIS.inits.push({ auto: o.auto_select, fedcm: !!o.use_fedcm_for_button }); __GIS.cb = o.callback; },
  renderButton: function (el) { el.innerHTML = '<button id="gbtn">Sign in with Google</button>'; },
  prompt: function () { __GIS.prompts++; },
  disableAutoSelect: function () { __GIS.disabled++; }
} } };`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const googleToken = (email, sig = 'sig') => 'h.' + b64({ iss: 'https://accounts.google.com', email, exp: Math.floor(Date.now() / 1000) + 3600 }) + '.' + sig;

async function boot(flags = {}) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  // Signed out: the mock only plants its own session when this is not set.
  if (!flags.signedIn) await page.addInitScript(`if (!sessionStorage.getItem('__seen')) { sessionStorage.setItem('__seen', '1'); localStorage.setItem('dbtc_pick_account', '1'); }`);
  await page.addInitScript(`window.__MOCK_ROLE=${JSON.stringify(flags.role || 'service')};window.__MOCK_EXCHANGE_FAIL=${Number(flags.exchangeFail) || 0};window.__MOCK_READONLY=${!!flags.readOnly};`);
  // Every state the read-only bar was ever in, from the first paint.
  await page.addInitScript(`window.__RO = []; document.addEventListener('DOMContentLoaded', function () {
    var rb = document.getElementById('roBar'); window.__RO.push(rb.classList.contains('hidden'));
    new MutationObserver(function () { window.__RO.push(rb.classList.contains('hidden')); }).observe(rb, { attributes: true });
  });`);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const gateUp = (page) => page.evaluate(() => !document.getElementById('gate').classList.contains('hidden'));
const fns = (page, fn) => page.evaluate((f) => window.__TOKENS.filter((c) => c.fn === f).length, fn);
const tokIss = (page) => page.evaluate(() => jwtPayload(JSON.parse(localStorage.getItem('dbtc_auth') || '{}').token).iss || '');
const allErrs = [];

// ---- Google answers twice (the button tapped again): one app, one boot ----
{
  const { ctx, page, errs } = await boot();
  check('signed out: the gate and the button', [await gateUp(page), await page.locator('#gbtn').count()], [true, 1]);
  check('the button asks Google without a popup where it can (FedCM)', await page.evaluate(() => __GIS.inits.at(-1).fedcm), true);
  const tok = googleToken('alberto@deitemeyerbrothers.com');
  await page.evaluate((t) => { __GIS.cb({ credential: t }); __GIS.cb({ credential: t }); }, tok);
  await page.waitForTimeout(1200);
  await page.evaluate((t) => __GIS.cb({ credential: t }), tok);   // and a late third
  await page.waitForTimeout(600);
  check('in, once', [await gateUp(page), await fns(page, 'getStart'), await page.evaluate(() => S.started)], [false, 1, true]);
  check('the Google token was traded for the 30-day session', [await fns(page, 'exchangeSession'), await tokIss(page)], [1, 'dbtc-session']);
  check('the service crew lands on Close Out', await page.evaluate(() => S.tab), 'co');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the trade fails at sign-in (weak signal): in anyway, and it keeps trying ----
{
  const { ctx, page, errs } = await boot({ exchangeFail: 4 });
  await page.evaluate((t) => __GIS.cb({ credential: t }), googleToken('alberto@deitemeyerbrothers.com'));
  await page.waitForTimeout(8000);   // the API's own three retries, all refused
  check('a failed trade does not keep anyone out', [await gateUp(page), await page.evaluate(() => !!S.me)], [false, true]);
  check('…the phone is still on the Google hour, and says so in Diagnostics', [await tokIss(page), await page.evaluate(() => S.errs.some((e) => e.where === 'session'))], ['https://accounts.google.com', true]);
  check('…and a retry is waiting', await page.evaluate(() => !!SESSION_RENEW.timer), true);
  await page.evaluate(() => ensureSession(true));
  await page.waitForTimeout(600);
  check('the next try lands the 30-day session', await tokIss(page), 'dbtc-session');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the wrong Google account: named, and not picked again by itself ----
{
  const { ctx, page, errs } = await boot();
  await page.evaluate((t) => __GIS.cb({ credential: t }), googleToken('yahir.personal@gmail.com', 'BAD'));
  await page.waitForTimeout(1500);
  check('refused: back at the gate', await gateUp(page), true);
  check('…naming the account Google used', /yahir\.personal@gmail\.com/.test(await page.locator('#gateErr').textContent()), true);
  check('…with the button back, not a spinner', [await page.locator('#gbtn').isVisible(), await page.locator('#gateBusy').isVisible()], [true, false]);
  check('…and One Tap will ask which account next time', [await page.evaluate(() => localStorage.getItem('dbtc_pick_account')), await page.evaluate(() => __GIS.disabled > 0), await page.evaluate(() => __GIS.inits.at(-1).auto)], ['1', true, false]);
  check('…and no token kept', await page.evaluate(() => localStorage.getItem('dbtc_auth')), null);
  // The right account now: a clean start.
  await Promise.all([page.waitForEvent('load'), page.evaluate((t) => __GIS.cb({ credential: t }), googleToken('alberto@deitemeyerbrothers.com'))]);
  await page.waitForTimeout(1500);
  check('the right account gets in', [await gateUp(page), await page.evaluate(() => !!S.me)], [false, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- reopening: straight in, the right tabs at once, never a wrong bar ----
{
  const { ctx, page, errs } = await boot({ signedIn: true, role: 'service' });
  check('signed in: no gate, no Google prompt', [await gateUp(page), await page.evaluate(() => __GIS.prompts)], [false, 0]);
  check('writes on: the read-only bar never showed', await page.evaluate(() => window.__RO.every(Boolean)), true);
  // Reopen: before the API answers, the name, the role and Close Out are already there.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  check('reopen: the header and the tab from the last answer', [await page.locator('#hdrW').textContent(), await page.evaluate(() => S.tab)], ['Alberto Gonzalez · Service', 'co']);
  await page.waitForTimeout(900);
  check('reopen: the read-only bar never showed', await page.evaluate(() => window.__RO.every(Boolean)), true);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({ signedIn: true, readOnly: true, role: 'crew' });
  check('a read-only build still says so', await page.locator('#roBar').isVisible(), true);
  allErrs.push(...errs);
  await ctx.close();
}

check('no page errors', allErrs, []);
await browser.close();
let passed = 0;
for (const r of results) {
  if (r.pass) passed++;
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n      got  ' + JSON.stringify(r.actual) + '\n      want ' + JSON.stringify(r.expected)));
}
console.log('\n' + passed + '/' + results.length + ' passed');
process.exit(passed === results.length ? 0 : 1);
