/* T2.37 (3 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t237-test.mjs
 *
 * Audit D31 (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr): whose work
 * is waiting on a shared phone. Tyler B. leaves work unsent — a kept
 * clock-in, a photo, site checks, a pre-start, a day log, a roll-out record,
 * a Close Out item and an inspection in progress — the API refuses his
 * session, and Kenton signs in on the same phone. Nothing of Tyler's goes
 * under Kenton's sign-in; Kenton's phone starts clean and says whose the
 * waiting work is; Kenton's own work goes; Kenton can sign out, and Tyler's
 * work is still there; Tyler signs back in and it goes as his. Work saved
 * before T2.37 is taken as the last person the phone knew. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => { const l = page.locator(sel).first(); return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };

const TYLER = 'tyler.b@deitemeyerbrothers.com', KENTON = 'kentonmccomas@gmail.com';
// window.__CO: the mock's Close Out log, which it otherwise only starts when the
// Close Out tab loads — a site manager's phone never does, and a finished
// repair would then fail in the mock, not in the app.
const FLAGS = 'window.__MOCK_KEEP_AUTH=true;window.__MOCK_PEOPLE_TOKENS=true;window.__MOCK_FOREMAN=false;window.__CO=[];';
// Everything that carries waiting work to JobTread, the board or Close Out.
const WRITES = ['clockIn', 'switchCode', 'createCaptureUploadRequest', 'finalizeCaptureUpload', 'uploadCapture', 'saveSiteChecks', 'savePrestart',
  'sendDailyLog', 'rollChecked', 'rollForgot', 'coComplete', 'coClose', 'coCloseArea', 'coReport', 'coPhoto', 'coBlocked'];

async function boot(flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript(FLAGS + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
// Polled from outside, so a reload in the middle (a sign-in, a hand-over) only costs a try.
async function until(page, fn, arg, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* the page is reloading */ }
    await page.waitForTimeout(250);
  }
  return false;
}
const signedInAs = (page, email) => until(page, (em) => typeof S === 'object' && S.booted && !!S.me && S.me.email === em, email);
const callsBy = (page, email) => page.evaluate((em) => JSON.parse(sessionStorage.getItem('mock_calls') || '[]').filter((c) => c[1] === em).map((c) => c[0]), email);
const writesBy = async (page, email) => [...new Set((await callsBy(page, email)).filter((f) => WRITES.includes(f)))].sort();
const token = (page, email, iss) => page.evaluate(([em, i]) => __mockToken(em, i), [email, iss || 'https://accounts.google.com']);
const signIn = async (page, email) => { const t = await token(page, email); await page.evaluate((x) => authOnCredential({ credential: x }), t); };
const gateUp = (page) => until(page, () => typeof S === 'object' && !document.getElementById('gate').classList.contains('hidden'));

/* Tyler's unsent work, one of each, made with no signal so nothing goes. */
async function tylersWork(page) {
  await page.evaluate(() => { window.__MOCK_NONET = true; S.online = false; });
  // A tick through the screen, as a site manager makes it.
  await page.locator('.tab[data-tab="jobs"]').click(); await page.waitForTimeout(700);
  await page.locator('[data-checks="t2roof"]').click(); await page.waitForTimeout(500);
  await page.locator('.ckrow[data-line="address"]').click(); await page.waitForTimeout(300);
  await page.evaluate(() => setTab('job')); await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const jobId = S.job.id, today = isoLocal();
    prStore.tpre37 = ownStamp({ done: { utilities: true }, base: {}, dirty: true, seq: 1, at: Date.now(), jobId: jobId, jobLabel: '26-0890 Webster' }); prPersist();
    const e = dlTouch(jobId, today, null); e.story = 'Tyler wrote this'; e.wantSend = true; dlPersist();
    rollSet(jobId, 'tarps', true);
    const d = rollDay(jobId); d.daily = { args: [jobId, 't2roof', '26-0890 Webster', 2, ['Tarps checked'], ''], rid: newRid(), tries: 0 }; rollPersist();
    const v = coVisit('co-x37'); v.answers.inspection.k1 = 'OK'; coPersist();
    await coEnqueue([{ id: 'cot-37', kind: 'complete', taskId: 'pt37', jobId: 'co-x37', label: 'Repair done', payload: { note: '' } }]);
    // A clock-in kept with no signal, the way startKept writes it.
    clockQ.push({ rid: 'r-t37-in', kind: 'in', jobId: jobId, costItemId: 'ci9', coords: null, startPhotoId: '', opts: {}, at: Date.now() - 20 * 60e3,
      job: cqJobSnap(S.job), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' }, partner: false, tries: 0, next: 0, owner: myEmail(), ownerName: S.me.name });
    cqPersist();
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.getContext('2d').fillRect(0, 0, 32, 32);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
    enqueueUpload({ id: 'p-t37', blob, mime: 'image/jpeg', tag: 'progress', at: Date.now() - 10 * 60e3, jobId: jobId, entryId: '', codeLabel: '' });
    await new Promise((r) => setTimeout(r, 500));
    return qCount();
  });
}

// ---- Tyler's work, a refused session, Kenton signs in on the same phone ----
{
  const { ctx, page, errs } = await boot();
  await tylersWork(page);
  check('Tyler\'s unsent work is his to send: every lane counts it', await page.evaluate(() => obWaiting().parts.map((p) => p.key).sort()),
    ['checks', 'clock', 'closeout', 'log', 'photos', 'prestart', 'roll']);
  check('…and it carries his email', await page.evaluate(() => idbAll().then((q) => coObAll().then((co) => [q[0].owner, co[0].owner, ckStore.t2roof.owner, prStore.tpre37.owner,
    dlGet(S.job.id, isoLocal()).owner, rollDay(S.job.id).owner, coStore.visits['co-x37'].owner]))), Array(7).fill(TYLER));

  // The API refuses his session with signal back.
  await page.evaluate(() => { window.__MOCK_NONET = false; S.online = true; window.__MOCK_EXPIRED = true; obWake(); });
  check('the API refusing the session puts the sign-in screen up', await gateUp(page), true);
  const before = await page.evaluate(() => window.__TOKENS.length);
  await page.evaluate(() => { window.__MOCK_EXPIRED = false; obWake(); pump(); coPump(); rollFlush(); ckFlushAll(); });
  await page.waitForTimeout(900);
  check('D31: a page whose sign-in was refused sends nothing more, whatever wakes', [await page.evaluate(() => OWN.frozen), await page.evaluate(() => window.__TOKENS.length) - before], [true, 0]);

  // Kenton signs in on the sign-in screen that came up.
  await page.evaluate(() => sessionStorage.removeItem('mock_calls'));
  await signIn(page, KENTON);
  check('Kenton signs in on that page', await signedInAs(page, KENTON), true);
  await page.waitForTimeout(2500);
  check('D31: none of Tyler\'s work went under Kenton\'s sign-in', await writesBy(page, KENTON), []);
  const k = await page.evaluate(() => ({
    held: waitItems().filter((i) => i.state === 'held').map((i) => [i.lane, i.who]).sort(),
    mine: obWaiting().parts.map((p) => p.key),
    ck: ckStore.t2roof ? !!ckStore.t2roof.dirty : null,
    log: (dlGet(S.job ? S.job.id : 'j_2841', isoLocal()) || {}).story || '',
    visit: !!coStore.visits['co-x37'], pr: !!prStore.tpre37,
    stored: Object.keys(JSON.parse(localStorage.getItem('dbtc_held') || '{}')),
    me: JSON.parse(localStorage.getItem('dbtc_me') || '{}').email
  }));
  check('…Waiting to send lists every piece of it as waiting for Tyler B.', k.held,
    [['checks', 'Tyler B.'], ['clock', 'Tyler B.'], ['closeout', 'Tyler B.'], ['log', 'Tyler B.'], ['photos', 'Tyler B.'], ['prestart', 'Tyler B.'], ['roll', 'Tyler B.']]);
  check('…none of it is Kenton\'s to send, so none holds his sign-out', k.mine, []);
  check('…Kenton\'s phone starts clean: no unsent ticks, log, pre-start or inspection of Tyler\'s on his screens', [k.ck, k.log, k.pr, k.visit], [null, '', false, false]);
  check('…Tyler\'s is set aside for him, and the phone knows Kenton now', [k.stored, k.me], [[TYLER], KENTON]);
  await page.locator('.tab[data-tab="jobs"]').click(); await page.waitForTimeout(700);
  await page.locator('[data-checks="t2roof"]').click(); await page.waitForTimeout(500);
  check('…Kenton\'s site checks show the board\'s list, not Tyler\'s unsent tick', await page.locator('.ckrow[data-line="address"].on').count(), 0);
  await page.evaluate(() => setTab('job')); await page.waitForTimeout(300);
  const sheet = await page.evaluate(() => { const h = waitingHtml(); return [/Waiting for Tyler B\./.test(h), /Goes when they sign in on this phone/.test(h)]; });
  check('…the sheet says whose, and when it goes', sheet, [true, true]);
  check('…the card leads with Kenton\'s own state, Tyler\'s last', await page.evaluate(() => WAIT_ORDER.held > WAIT_ORDER.saved), true);
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; render(); });
  check('…and in Spanish', await page.evaluate(() => [waitStateWords('held', 0, 'Tyler B.'), L('Goes when they sign in on this phone')]),
    ['Espera a Tyler B.', 'Se envía cuando esa persona inicie sesión en este teléfono']);
  await page.evaluate(() => { S.lang = 'en'; render(); });

  // Kenton's own Close Out item, on the same job as Tyler's held one, goes.
  await page.evaluate(() => coEnqueue([{ id: 'cot-k38', kind: 'complete', taskId: 'pt38', jobId: 'co-x37', label: 'Repair done', payload: { note: '' } }]));
  await until(page, (em) => JSON.parse(sessionStorage.getItem('mock_calls') || '[]').some((c) => c[0] === 'coComplete' && c[1] === em), KENTON, 15000);
  check('Kenton\'s own Close Out item goes, never held back behind Tyler\'s on the same job', await writesBy(page, KENTON), ['coComplete']);
  check('…and Tyler\'s is still waiting for him', await page.evaluate(() => coObAll().then((co) => co.filter((x) => x.id === 'cot-37').map((x) => [x.owner, x.status]))), [[TYLER, 'queued']]);

  // Kenton signs out: two taps, and the last one says Tyler's stays.
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(300);
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(700);
  const foot = await txt(page, '#signOutFoot');
  check('Kenton can sign out, and the last tap says Tyler\'s work stays for him', [foot.startsWith('This phone forgets Kenton McComas'), / Tyler B\.’s \d{1,2}:\d{2}[ap] clock-in and other unsent work stay on this phone and go when they sign in\.$/.test(foot)], [true, true]);
  await page.locator('#signOutBtn').click();
  await gateUp(page);
  await page.waitForTimeout(900);
  const kept = await page.evaluate(() => Promise.all([idbAll(), coObAll()]).then(([q, co]) => ({ q: q.map((x) => [x.id, x.owner]), co: co.map((x) => [x.id, x.owner]),
    held: Object.keys(JSON.parse(localStorage.getItem('dbtc_held') || '{}')), cq: JSON.parse(localStorage.getItem('dbtc_clockq') || '[]').map((x) => [x.rid, x.owner]) })));
  check('…and signed out, every piece of Tyler\'s work is still on the phone', kept, { q: [['p-t37', TYLER]], co: [['cot-37', TYLER]], held: [TYLER], cq: [['r-t37-in', TYLER]] });

  // Tyler signs back in; his work goes, as his.
  await page.evaluate(() => sessionStorage.removeItem('mock_calls'));
  await signIn(page, TYLER);
  check('Tyler signs back in on the same phone', await signedInAs(page, TYLER), true);
  const want = ['clockIn', 'coComplete', 'createCaptureUploadRequest', 'finalizeCaptureUpload', 'rollChecked', 'savePrestart', 'saveSiteChecks', 'sendDailyLog'];
  await until(page, async (w) => { const got = JSON.parse(sessionStorage.getItem('mock_calls') || '[]').map((c) => c[0]); return w.every((f) => got.includes(f)); }, want, 40000);
  const tw = await writesBy(page, TYLER);
  check('D31: Tyler\'s work goes when he signs in — every piece, under his own sign-in', want.filter((f) => tw.includes(f)), want);
  check('…none of it under Kenton\'s', await writesBy(page, KENTON), []);
  check('…and nothing is set aside any more', await page.evaluate(() => [localStorage.getItem('dbtc_held'), Object.keys(held).length, (S.qOthers || []).length, (CO.others || []).length]), [null, 0, 0, 0]);
  check('…his inspection in progress is back on his screen', await page.evaluate(() => !!coStore.visits['co-x37'] && coStore.visits['co-x37'].answers.inspection.k1), 'OK');
  check('no page errors (hand-over)', errs, []);
  await ctx.close();
}

// ---- Work saved before T2.37: taken as the last person the phone knew ----
{
  const { ctx, page, errs } = await boot();
  await page.evaluate(async () => {
    window.__MOCK_NONET = true; S.online = false;
    const jobId = S.job.id;
    ckStore.told = { state: { done: { address: true }, notes: {}, na: {} }, base: { done: {}, notes: {}, na: {} }, dirty: true, seq: 1, at: Date.now(), jobId: jobId, jobLabel: '26-0890 Webster' };
    ckPersist();
    clockQ.push({ rid: 'r-old-in', kind: 'in', jobId: jobId, costItemId: 'ci9', opts: {}, at: Date.now() - 15 * 60e3, job: cqJobSnap(S.job), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' }, tries: 0, next: 0 });
    cqPersist();
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
    await idbPut({ id: 'p-old', blob, mime: 'image/jpeg', tag: 'before', at: Date.now() - 15 * 60e3, jobId: jobId, entryId: '', codeLabel: '', waitRid: 'r-old-in' });
    await idbPut({ id: 'p-old2', blob, mime: 'image/jpeg', tag: 'progress', at: Date.now() - 5 * 60e3, jobId: jobId, entryId: '', codeLabel: '' });
  });
  // The phone opens later with Kenton's sign-in on it.
  const t = await token(page, KENTON, 'dbtc-session');
  await page.evaluate((x) => { sessionStorage.removeItem('mock_calls'); localStorage.setItem('dbtc_auth', JSON.stringify({ token: x, exp: 4102444800 })); }, t);
  await page.reload();
  check('Kenton opens the phone', await signedInAs(page, KENTON), true);
  await page.waitForTimeout(2500);
  check('D31: work saved before T2.37, with no owner on it, never goes under Kenton\'s sign-in', await writesBy(page, KENTON), []);
  check('…it is written down as Tyler B.\'s — the last person the phone knew — and set aside for him',
    await page.evaluate(() => idbAll().then((q) => ({ q: q.map((x) => [x.id, x.owner]).sort(), cq: clockQ.map((x) => [x.rid, x.owner]), held: Object.keys((held['tyler.b@deitemeyerbrothers.com'] || {}).ck || {}) }))),
    { q: [['p-old', TYLER], ['p-old2', TYLER]], cq: [['r-old-in', TYLER]], held: ['told'] });
  check('…and said as his', await page.evaluate(() => waitItems().filter((i) => i.state === 'held').map((i) => i.lane).sort()), ['checks', 'clock', 'photos']);
  check('no page errors (before T2.37)', errs, []);
  await ctx.close();
}

// ---- The same person back after a refused session: no hand-over, it all goes ----
{
  const { ctx, page, errs } = await boot();
  await page.evaluate(() => { window.__MOCK_NONET = true; S.online = false; });
  await page.locator('.tab[data-tab="jobs"]').click(); await page.waitForTimeout(700);
  await page.locator('[data-checks="t2roof"]').click(); await page.waitForTimeout(500);
  await page.locator('.ckrow[data-line="address"]').click(); await page.waitForTimeout(300);
  await page.evaluate(() => setTab('job')); await page.waitForTimeout(300);
  await page.evaluate(() => { window.__MOCK_NONET = false; S.online = true; window.__MOCK_EXPIRED = true; obWake(); });
  await gateUp(page);
  await page.evaluate(() => { window.__MOCK_EXPIRED = false; sessionStorage.removeItem('mock_calls'); });
  await signIn(page, TYLER);
  check('Tyler signs back in after his session ran out', await signedInAs(page, TYLER), true);
  await until(page, (em) => JSON.parse(sessionStorage.getItem('mock_calls') || '[]').some((c) => c[0] === 'saveSiteChecks' && c[1] === em), TYLER, 20000);
  check('…his tick goes as his, nothing set aside', [await writesBy(page, TYLER), await page.evaluate(() => localStorage.getItem('dbtc_held'))], [['saveSiteChecks'], null]);
  check('no page errors (same person)', errs, []);
  await ctx.close();
}

await browser.close();
let pass = 0;
for (const r of results) {
  if (r.pass) { pass++; console.log('PASS  ' + r.name); }
  else console.log('FAIL  ' + r.name + '\n      got  ' + JSON.stringify(r.actual) + '\n     want  ' + JSON.stringify(r.expected));
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
