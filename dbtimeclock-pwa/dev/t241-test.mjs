/* T2.41 (5 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t241-test.mjs
 *
 * The rest of Step 3 of the second audit
 * (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr), as far as the phone
 * goes. This suite walks the break taken with no signal (Carl, 3 Nov 2026:
 * "break taken with no signal count at the phone's time"): kept, shown as a
 * break on the phone, and sent in order with the way back from it when signal
 * returns. clock-test walks the travel line made for a job that had none
 * (D28) and the wrong-job move (D30); signin-test the one-year sign-in (D39). */
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
async function boot(flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__MOCK_KEEP_CLOCK=true;window.__CO=[];' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const kinds = (page) => page.evaluate(() => clockQ.map((x) => cqKind(x)));
const allErrs = [];

// ---- a break taken with no signal, and the way back from it ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__CLOCK = []; });
  await tap(page, '#breakBtn', 300);
  check('T2.41: with no signal the break is still offered (it is kept, not held)', await page.locator('.brkopt[data-brk="30"]').count() > 0, true);
  const t0 = Date.now();
  await tap(page, '.brkopt[data-brk="30"]', 800);
  check('…kept on the phone, with the moment it was taken and its length', [await kinds(page), await page.evaluate(() => [clockQ[0].minutes, Math.abs(clockQ[0].at - Date.now()) < 60000])], [['break'], [30, true]]);
  check('…and the phone is on its break: the block after it starts 30 minutes on', await page.evaluate((t0) => [onBreakNow(), Math.round((Date.parse(S.open.startedAt) - t0) / 60000)], t0).then(([b, m]) => [b, m >= 29 && m <= 30]), [true, true]);
  check('…saying it is saved on this phone', /^No signal — your .+ break is saved on this phone and goes when there’s signal$/.test(await txt(page, '#toast span')), true);
  check('…and nothing reached the API', await page.evaluate(() => (window.__CLOCK || []).filter((c) => c[0] === 'startBreak').length), 0);
  // Back early, still with no signal.
  await page.evaluate(() => doEndBreak());
  await page.waitForTimeout(800);
  check('…back to work early with no signal: kept behind the break, and the clock runs from now', [await kinds(page), await page.evaluate(() => [onBreakNow(), !!S.open && Math.abs(Date.parse(S.open.startedAt) - Date.now()) < 60000])], [['break', 'back'], [false, true]]);
  // Signal back: both go, in order, each at its own moment.
  await page.evaluate(() => { window.__MOCK_NONET = false; window.__QUEUED = []; window.dispatchEvent(new Event('online')); });
  const sent = await until(page, () => clockQ.length === 0, null, 20000);
  check('…when signal returns both go, in the order they were made', [sent, await page.evaluate(() => (window.__QUEUED || []).map((q) => q.kind))], [true, ['break', 'back']]);
  check('…as the break and the way back, each with its own moment', await page.evaluate(() => (window.__CLOCK || []).filter((c) => c[0] === 'startBreak' || c[0] === 'endBreak').map((c) => [c[0], c[0] === 'startBreak' ? c[1] : null, c[c.length - 1]])),
    [['startBreak', 30, true], ['endBreak', null, true]]);
  check('…and the phone says they both reached JobTread', await txt(page, '#toast span'), 'Your 2 clock changes have reached JobTread');
  check('…on the clock again, at Webster', await page.evaluate(() => [!!S.open, onBreakNow(), S.open && S.open.job && S.open.job.id]), [true, false, 'j_2841']);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- a break kept and still going when signal returns ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await tap(page, '#breakBtn', 300);
  await tap(page, '.brkopt[data-brk="45"]', 800);
  await page.evaluate(() => { window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await until(page, () => clockQ.length === 0, null, 20000);
  check('T2.41: a kept break still counting down when it lands is the break JobTread now holds', await page.evaluate(() => [onBreakNow(), S.brk && S.brk.entryId === S.open.id, /^open/.test(S.open.id)]), [true, true, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- an API older than T2.41 cannot land a break at its moment: held, as before ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;window.__MOCK_API_BUILD="T2.40 (2026-11-04)";');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__CLOCK = []; });
  await tap(page, '#breakBtn', 300);
  const offered = await page.locator('.brkopt[data-brk="30"]').count();
  if (offered) await tap(page, '.brkopt[data-brk="30"]', 1500);
  check('T2.41: against a T2.40 API a break with no signal is not kept (it would land when it arrived)', await kinds(page), []);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- I15: a service call's repair says what was found, and whether the warranty covers it ----
const coFresh = (page, jobId) => page.waitForFunction((id) => CO.jobFresh === id && !CO.jobLoading, jobId, { timeout: 15000 }).then(() => page.waitForTimeout(200));
const coOpen = async (page, jobId) => { await page.evaluate((id) => { setTab('co'); coOpenJob(id); }, jobId); await coFresh(page, jobId); };
const openRepair = async (page, taskId) => { await page.evaluate((id) => { CO.taskId = id; coGo('repair'); }, taskId); await page.waitForTimeout(350); };
const english = (page) => page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); });
const repairPhotos = (page, jobId, taskId) => page.evaluate(async ([j, t]) => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
  await coAddPhoto({ kind: 'before', jobId: j, taskId: t }, new File([b], 'b.jpg', { type: 'image/jpeg' }), null);
  await coAddPhoto({ kind: 'after', jobId: j, taskId: t }, new File([b], 'a.jpg', { type: 'image/jpeg' }), null);
  coRender();
}, [jobId, taskId]);
const doneState = (page) => page.evaluate(() => { const b = document.getElementById('coDone'); return b ? [b.disabled, b.nextElementSibling.textContent] : null; });
const tiles = (page) => page.evaluate(() => [...document.querySelectorAll('[data-cowarr]')].map((b) => [b.getAttribute('data-cowarr'), b.getAttribute('aria-pressed'), b.querySelector('.es').textContent]));
const sentRepairs = (page, fn) => page.evaluate((f) => (window.__CO || []).filter((x) => x.fn === f).map((x) => [x.taskId, x.service]), fn);
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';window.__MOCK_CO_DAYS=true;");
  await english(page);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt2');
  check('I15: a service call\'s repair asks what was found and whether the warranty covers it, nothing picked',
    [await page.locator('#coSvcFound').count(), await tiles(page)],
    [1, [['yes', 'false', 'Yes'], ['no', 'false', 'No'], ['ask', 'false', 'Ask the office']]]);
  const t = await page.locator('[data-cowarr="ask"]').boundingBox();
  check('…each answer a 44-pixel target at least', !!t && t.height >= 44, true);
  await repairPhotos(page, 'co-okafor', 'pt2');
  await page.locator('#coRepairNote').fill('Downspout reconnected'); await page.locator('#coRepairNote').blur(); await page.waitForTimeout(600);
  check('…Done waits on the warranty answer, and says so', await doneState(page), [true, 'Missing: say whether the warranty covers it']);
  await page.locator('#coSvcFound').fill('The elbow strap had rusted through'); await page.locator('#coSvcFound').blur(); await page.waitForTimeout(400);
  await tap(page, '[data-cowarr="ask"]', 500);
  check('…Ask the office is pressed, and Done is ready', [await tiles(page), (await doneState(page))[0]],
    [[['yes', 'false', 'Yes'], ['no', 'false', 'No'], ['ask', 'true', 'Ask the office']], false]);
  await tap(page, '#coDone', 400);
  await until(page, () => (window.__CO || []).some((x) => x.fn === 'coComplete' && x.taskId === 'pt2'), null, 20000);
  check('…Done sends what was found and the answer, as said', await sentRepairs(page, 'coComplete'),
    [['pt2', { found: 'The elbow strap had rusted through', warranty: 'ask' }]]);
  // A repair that is not a service call asks neither, and keeps the plain words.
  await coOpen(page, 'co-lane');
  await openRepair(page, 'pt20');
  check('…a repair that is not a service call asks neither, and keeps Can\'t finish today',
    [await page.locator('#coSvcFound').count(), (await tiles(page)).length, await txt(page, '#coCant')],
    [0, 0, 'Can’t finish today']);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- I15: Can't finish on a service call carries the answers it has ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt1');
  await page.locator('#coSvcFound').fill('Boot cracked all the way round'); await page.locator('#coSvcFound').blur(); await page.waitForTimeout(400);
  await tap(page, '[data-cowarr="yes"]', 400);
  await tap(page, '#coCant', 400);
  await tap(page, '[data-cocant="material"]', 400);
  await page.locator('#coCantNote').fill('A 3 inch lead boot'); await page.locator('#coCantNote').blur(); await page.waitForTimeout(500);
  await tap(page, '#coCantSend', 400);
  await until(page, () => (window.__CO || []).some((x) => x.fn === 'coBlocked' && x.taskId === 'pt1'), null, 20000);
  check('I15: Needs a return visit sends what was found and the warranty answer with the reason',
    await page.evaluate(() => (window.__CO || []).filter((x) => x.fn === 'coBlocked').map((x) => [x.taskId, x.reason, x.service])),
    [['pt1', 'material', { found: 'Boot cracked all the way round', warranty: 'yes' }]]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- I15: a Close Out server before contract 6 has nowhere to write it ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';window.__MOCK_CO_CONTRACT=5;");
  await english(page);
  await page.evaluate(() => loadBuilds && loadBuilds(true)).catch(() => {});
  await page.waitForTimeout(600);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt2');
  check('I15: against a contract-5 server the repair asks neither, and Done does not wait on it',
    [await page.locator('#coSvcFound').count(), (await tiles(page)).length, await txt(page, '#coCant')],
    [0, 0, 'Can’t finish today']);
  await repairPhotos(page, 'co-okafor', 'pt2');
  await page.locator('#coRepairNote').fill('Downspout reconnected'); await page.locator('#coRepairNote').blur(); await page.waitForTimeout(600);
  await tap(page, '#coDone', 400);
  await until(page, () => (window.__CO || []).some((x) => x.fn === 'coComplete' && x.taskId === 'pt2'), null, 20000);
  check('…and Done goes with no service record', await sentRepairs(page, 'coComplete'), [['pt2', null]]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- D31: work held for somebody else, released from the board ----
// Carl (5 Nov 2026): Operations decides on the board — "Send it for Tyler" or
// "Let it go" — and "sent clock times land at the time Tyler made them".
const TYLER = 'tyler@gmail.com';
const heldTyler = (page) => page.evaluate((T) => {
  const at = Date.now() - 3 * 3600e3;
  clockQ.push({ rid: 'rq-' + Math.random().toString(36).slice(2, 9), kind: 'in', jobId: 'j2', costItemId: 'ci5', coords: null, startPhotoId: 'ph_t1', endPhotoId: '', opts: {}, at,
                job: { id: 'j2', number: '26-1591', name: 'Lucas' }, code: { id: 'ci5', number: '02ST-1', name: 'Final Clean' }, owner: T, ownerName: 'Tyler Mohr' });
  cqPersist();
  held[T] = { name: 'Tyler Mohr', roll: { 'j2|2026-11-05': { daily: { args: ['j2', 't1', '26-1591', 1, ['Tarps'], ''], rid: 'rr-' + Date.now(), tries: 0 } } },
              dl: { 'j2|2026-11-05': { story: 'a day log never sent' } } };
  heldPersist();
  return at;
}, TYLER);
const release = (page, r) => page.evaluate((r) => { window.__MOCK_RELEASES = [r]; window.__MOCK_RELEASES_ONCE = true; window.__HELD_REPORTS = []; REL.at = 0; return relReport(true); }, r);
const tylers = (page) => page.evaluate((T) => [clockQ.filter((x) => x.owner === T).length, Object.keys((held[T] || {}).roll || {}).length, Object.keys((held[T] || {}).dl || {}).length], TYLER);
{
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;window.__REL_BOOT_MS=600000;');
  const mine = await page.evaluate(() => S.open && S.open.id);
  const at = await heldTyler(page);
  await page.evaluate(() => { window.__HELD_REPORTS = []; return relReport(true); });
  const rep = await page.evaluate(() => (window.__HELD_REPORTS || [])[0]);
  check('D31: the phone tells the board what it holds and for whom, from its own id',
    [/^ph_[a-z0-9]{8,}/.test(rep && rep.phone), rep && rep.owners.map((o) => [o.email, o.name, o.items.map((i) => i.kind)])],
    [true, [[TYLER, 'Tyler Mohr', ['clock', 'rollout', 'draft']]]]);
  check('…in words Operations can read', rep && rep.owners[0].items[0].what, '7:02a clock-in · 26-1591'.replace('7:02a', await page.evaluate((a) => clockLabel(a), at)));

  // Send it for Tyler.
  await release(page, { id: 'rel1', owner: TYLER, ownerName: 'Tyler Mohr', action: 'send', by: 'Carl Bledsoe', exp: Date.now() + 864e5, sig: 'sig-rel1' });
  await until(page, () => (window.__HELD_REPORTS || []).length >= 2, null, 20000);
  check('…Send it: his clock change goes as his, under the release, and his roll-out notice after it',
    await page.evaluate(() => (window.__ACTFOR || []).map((a) => a.slice(0, 3))), [['clockIn', TYLER, 'rel1'], ['rollChecked', TYLER, 'rel1']]);
  check('…at the time he made it, not when it went', await page.evaluate((a) => (window.__RELEASED || [])[0].at === a, at), true);
  check('…off the phone, his draft left for him or Operations, and the person signed in still on their own clock',
    [await tylers(page), await page.evaluate(() => S.open && S.open.id)], [[0, 0, 1], mine]);
  const back = await page.evaluate(() => window.__HELD_REPORTS[1]);
  check('…and the phone tells the board how it went, with only the draft left', [back.outcomes.rel1, back.owners.map((o) => o.items.map((i) => i.kind))],
    ['Sent 1 clock change, 1 list and notice', [['draft']]]);
  check('…saying so on this phone', await txt(page, '#toast span'), 'Operations sent Tyler’s work from this phone');

  // Let it go.
  await heldTyler(page);
  await release(page, { id: 'rel2', owner: TYLER, ownerName: 'Tyler Mohr', action: 'drop', by: 'Carl Bledsoe', exp: Date.now() + 864e5 });
  await until(page, () => (window.__HELD_REPORTS || []).length >= 2, null, 20000);
  check('D31: Let it go takes all of it off the phone — clock change, notice and drafts',
    [await tylers(page), await page.evaluate(() => window.__HELD_REPORTS[1].outcomes.rel2), await page.evaluate(() => window.__HELD_REPORTS[1].owners.length)],
    [[0, 0, 0], 'Let go 1 clock change, 2 other things', 0]);

  // JobTread refuses it: said to the board, and off the phone.
  await heldTyler(page);
  await page.evaluate(() => { window.__MOCK_REL_REFUSE = 1; window.__ACTFOR = []; });
  await release(page, { id: 'rel3', owner: TYLER, ownerName: 'Tyler Mohr', action: 'send', by: 'Carl Bledsoe', exp: Date.now() + 864e5, sig: 'sig-rel3' });
  await until(page, () => (window.__HELD_REPORTS || []).length >= 2, null, 20000);
  check('D31: a clock change JobTread refuses is said to the board in its words',
    /Refused: \d+:\d\d[ap] clock-in — You were put on the clock at 8:00a while that clock-in waited\./.test(await page.evaluate(() => window.__HELD_REPORTS[1].outcomes.rel3)), true);

  // A release the board did not sign: refused by the API, and nothing is lost.
  await page.evaluate((T) => { delete held[T]; heldPersist(); clockQ = clockQ.filter((x) => x.owner !== T); cqPersist(); }, TYLER);
  await heldTyler(page);
  await release(page, { id: 'rel4', owner: TYLER, ownerName: 'Tyler Mohr', action: 'send', by: 'Carl Bledsoe', exp: Date.now() + 864e5, sig: 'forged' });
  await until(page, () => (window.__HELD_REPORTS || []).length >= 2, null, 20000);
  check('D31: a release the board did not sign sends nothing, and the work stays on the phone',
    [(await tylers(page))[0], /^Sent nothing yet\. Still waiting: RELEASE: that release is not one the board gave\./.test(await page.evaluate(() => window.__HELD_REPORTS[1].outcomes.rel4))], [1, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- D31: an API before T2.41 has no door for it: the phone says nothing ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;window.__REL_BOOT_MS=600000;window.__MOCK_API_BUILD="T2.40 (2026-11-04)";');
  await heldTyler(page);
  await page.evaluate(() => { window.__HELD_REPORTS = []; return relReport(true); });
  check('D31: against a T2.40 API the phone reports nothing', await page.evaluate(() => (window.__HELD_REPORTS || []).length), 0);
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
