/* T2.42 (6 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t242-test.mjs
 *
 * The first audit's smaller defects and I18/I19, as far as the phone goes,
 * and Carl's "Extra work to bill" on a service repair (6 Nov 2026):
 *   - a start photo is on the phone before its online clock-in is answered,
 *     and one left that way by a closed app is matched to its entry after the
 *     next launch's clock read;
 *   - a photo that could not be saved says so; a store that could not be read
 *     is "unknown", holds sign-out and marks nothing lost (I18);
 *   - every photo carries its own mark (#PH:) for the API to file it once;
 *   - the day's hours count JobTread's minutes, and one open block, never two;
 *   - the clock-in asks for a precise fix and sends how sure it was;
 *   - What I sent this week, per job (I19);
 *   - Extra work to bill: words and a photo with the Done, at contract 7.
 * The Apps Script half (code-test) and DB CheckOut's (its routes.test) are
 * tested in their own repos. */
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
async function boot(flags = '', ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, timezoneId: 'America/New_York', ...ctxOpts });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__CO=[];window.__TOASTS=[];' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.evaluate(() => { const t = window.toast; window.toast = function (m, e) { window.__TOASTS.push(L(m)); return t(m, e); }; });
  await page.waitForTimeout(600);
  return { ctx, page, errs };
}
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const atWebster = async (page) => {
  if (await page.locator('[data-today="j_2841"]').count()) await tap(page, '[data-today="j_2841"]', 600);
  else { await page.evaluate(() => { pickJobObj(visitAsJob(S.assign.visits.filter((v) => v.jobId === 'j_2841')[0]), false); render(); }); await page.waitForTimeout(500); }
};
const forgotIfAsked = async (page) => { if (await page.evaluate(() => S.sheet === 'forgot')) await tap(page, '#forgotGo', 600); };
const stored = (page) => page.evaluate(() => idbAll().then((items) => items.map((x) => ({ id: x.id, tag: x.tag, waitIn: !!x.waitIn, entryId: x.entryId || '' }))));
const FRESH_DAY = 'window.__MOCK_FIX={entries:function(){return [];}};';
const allErrs = [];

// ---- the start photo is on the phone before the clock-in is answered ----
{
  const { ctx, page, errs } = await boot(FRESH_DAY + 'window.__MOCK_SLOWFN={clockIn:3500};');
  await atWebster(page);
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await forgotIfAsked(page);
  check('the start photo is owed at Webster', await page.evaluate(() => S.clockGate), 'start');
  await shoot(page);
  await page.waitForTimeout(900);
  const during = await stored(page);
  check('T2.42: while the clock-in is still on its way, the start photo is already in the phone\'s store, waiting for it',
    [during.length, during[0] && during[0].tag, during[0] && during[0].waitIn, await page.evaluate(() => Object.keys(IN_FLIGHT).length)], [1, 'before', true, 1]);
  check('…and nothing has gone to JobTread yet: it is never sent without its entry', await page.evaluate(() => (window.__FILES || []).length), 0);
  const landed = await until(page, () => (window.__FILES || []).some((f) => /^#START /.test(f.desc)), null, 15000);
  const f = await page.evaluate(() => [(window.__FILES || []).filter((x) => /^#START /.test(x.desc))[0].desc, S.open && S.open.id]);
  check('…the answer stamps it with its entry, and it goes', [landed, f[0].indexOf('#TE:' + f[1] + ' ') > -1, /#PH:t[a-z0-9]+$/.test(f[0])], [true, true, true]);
  check('…and the store is empty again', await until(page, () => idbAll().then((i) => i.length === 0), null, 8000), true);

  // The app closed before the answer: the photo was left marked, with no page waiting on it.
  const left = await page.evaluate(() => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8);
    c.toBlob((b) => {
      const at = Date.parse(S.open.startedAt) + 2000, id = 'tleftover0000';
      const it = ownStamp({ id: id, blob: b, mime: 'image/jpeg', tag: 'before', at: at, jobId: S.open.job.id, entryId: '', codeLabel: '',
        waitIn: { rid: 'rid-closed-app', jobId: S.open.job.id, costItemId: S.open.code.id, at: at } });
      const lost = ownStamp({ id: 'tleftover0001', blob: b, mime: 'image/jpeg', tag: 'before', at: at, jobId: 'j_none', entryId: '', codeLabel: '',
        waitIn: { rid: 'rid-never-landed', jobId: 'j_none', costItemId: 'cx', at: at } });
      idbPut(it).then(() => idbPut(lost)).then(() => { window.__FILES = []; pump(); res(S.open.id); });
    }, 'image/jpeg');
  }));
  await until(page, () => (window.__FILES || []).length >= 2, null, 15000);
  const files = await page.evaluate(() => (window.__FILES || []).map((x) => x.desc));
  check('…a start photo left waiting by a closed app is matched to the clock this launch read, and goes with its entry',
    files.some((d) => d.indexOf('#TE:' + left + ' ') > -1 && /#PH:tleftover0000$/.test(d)), true);
  check('…one whose clock-in never landed goes as it is, with no entry', files.some((d) => d.indexOf('#TE:') === -1 && /#PH:tleftover0001$/.test(d)), true);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- I18: a photo the phone could not save; a store it could not read ----
{
  const { ctx, page, errs } = await boot();
  const saved = await page.evaluate(() => {
    const keep = window.idbTx;
    window.idbTx = function () { return Promise.reject(new Error('QuotaExceededError')); };
    const rec = { id: 'tnosave00000', tag: 'during', at: Date.now(), pending: true, jobId: 'j_2841', name: 'x.jpg' };
    S.photos.push(rec);
    return enqueueUpload({ id: 'tnosave00000', blob: new Blob(['x']), mime: 'image/jpeg', tag: 'during', at: Date.now(), jobId: 'j_2841' })
      .then(() => { window.idbTx = keep; return [!!rec.lost, rec.err, window.__TOASTS.slice(-1)[0]]; });
  });
  check('I18: a photo the phone could not save is said at once, while it can be taken again — never found out at the end of the day',
    saved, [true, 'not saved on this phone — take it again', 'This phone couldn’t save that photo — take it again.']);
  const unread = await page.evaluate(() => {
    const keep = window.idb;
    window.idb = function () { return Promise.reject(new Error('blocked')); };
    // A photo marked pending a while ago: a failed read must not call it lost.
    const rec = { id: 'told0000000', tag: 'during', at: Date.now() - 5 * 60000, pending: true, jobId: 'j_2841', name: 'y.jpg' };
    S.photos.push(rec);
    return qCount().then(() => {
      const w = obWaiting().parts.filter((p) => p.key === 'photos')[0];
      return new Promise((res) => { pumping = false; pump(); setTimeout(() => res(w), 900); }).then((w2) => {
        const out = [S.qReadFailed, w && w.words, !!rec.lost];
        window.idb = keep;
        return out;
      });
    });
  });
  check('…a store the phone could not read is "unknown", not "nothing waiting" — and nothing in it is called lost',
    unread, [true, 'photos this phone couldn’t read just now', false]);
  await page.evaluate(() => { window.idb = window.idb; });
  await page.evaluate(() => { S.qReadFailed = true; signOut(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const k = window.idb; window.idb = function () { return Promise.reject(new Error('blocked')); }; window.__idbKeep = k; signOut(); });
  await page.waitForTimeout(800);
  check('…and sign-out waits for it, in words', /^Not yet — .*photos this phone couldn’t read just now/.test(await txt(page, '#signOutFoot')), true);
  await page.evaluate(() => { window.idb = window.__idbKeep; return qCount(); });
  check('…the next good read clears it', await page.evaluate(() => S.qReadFailed), false);
  check('the photo\'s own mark is last in its description', await page.evaluate(() => [fileDescription({ id: 'tabc12345', tag: 'before', entryId: 'te1', codeLabel: '04MA Masonry Labor' }),
    fileDescription({ id: 'x', tag: 'before', entryId: '', codeLabel: '' })]), ['#START #TE:te1 04MA Masonry Labor #PH:tabc12345', '#START']);
  check('…the browser is asked, once, to keep the phone\'s store', await page.evaluate(() => typeof S.persist === 'string' && S.persist.length > 0), true);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the day's hours: JobTread's minutes, one block running ----
{
  const { ctx, page, errs } = await boot(FRESH_DAY);
  const total = await page.evaluate(() => {
    const now = Date.now(), h = 3600000, code = (id, n, nm) => ({ id: id, number: n, name: nm });
    S.entries = [
      // JobTread's own count for a closed block: 125, whatever the seconds say.
      { id: 'a', startedAt: new Date(now - 5 * h).toISOString(), endedAt: new Date(now - 3 * h).toISOString(), minutes: 125, job: { id: 'j_2841' }, code: code('c1', '04MA', 'Masonry Labor') },
      // Two blocks JobTread still shows open: the older ends where the newer starts.
      { id: 'b', startedAt: new Date(now - 3 * h).toISOString(), endedAt: null, minutes: 0, job: { id: 'j_2841' }, code: code('c2', '02ST-1', 'Final Clean') },
      { id: 'c', startedAt: new Date(now - 1 * h).toISOString(), endedAt: null, minutes: 0, job: { id: 'j_2841' }, code: code('c2', '02ST-1', 'Final Clean') }
    ];
    renderDay();
    const rows = [...document.querySelectorAll('#dayTbl .trow .d')].map((d) => d.textContent);
    return [rows, document.querySelector('#dayTbl .ttotal .v').textContent, hoursFor('j_2841').map((x) => [x.number, x.minutes, x.live])];
  });
  check('the day table counts JobTread\'s minutes and one running block — the rows add up to the total, never two blocks to now',
    total, [['3h 00m', '2h 05m'], '5h 05m', [['04MA', 125, false], ['02ST-1', 180, true]]]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the clock-in asks for a precise fix, and says how sure it was ----
{
  const { ctx, page, errs } = await boot(FRESH_DAY, { permissions: ['geolocation'], geolocation: { latitude: 40.8779, longitude: -84.5871, accuracy: 35 } });
  await page.evaluate(() => { const sh = S.shop; pickJobObj(sh, false); render(); });
  await page.waitForTimeout(400);
  await tap(page, '#clockIn', 300);
  if (await page.locator('.coderow').count()) await tap(page, '.coderow', 600);
  await until(page, () => (window.__COORDS || []).length > 0, null, 10000);
  check('the clock-in sends where the phone was and how sure it was (metres)', await page.evaluate(() => window.__COORDS[0]), { lat: 40.8779, lng: -84.5871, acc: 35 });
  allErrs.push(...errs);
  await ctx.close();
}

// ---- I19: What I sent this week ----
{
  const { ctx, page, errs } = await boot();
  await atWebster(page);
  check('I19: under today\'s hours, What I sent this week', await page.locator('#sentWeekBtn').isVisible(), true);
  await tap(page, '#sentWeekBtn', 900);
  check('…opens, read from JobTread: the time on this job, in JobTread', [await page.evaluate(() => S.sheet), await txt(page, '#sheetTitle'),
    await page.evaluate(() => [...document.querySelectorAll('#sentWeek .obrow .st')].some((s) => s.textContent === 'In JobTread'))], ['sentWeek', 'What I sent this week', true]);
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__MOCK_SENTWEEK_FAIL = true; });
  await tap(page, '#sentWeekBtn', 900);
  check('…JobTread not answering is said so, with Try again — never "nothing sent"', [await txt(page, '#sentWeek .jempty'), await page.locator('#swAgain').count()],
    ['JobTread didn’t answer just now — try again in a minute.', 1]);
  await page.evaluate(() => { window.__MOCK_SENTWEEK_FAIL = false; });
  await tap(page, '#swAgain', 900);
  check('…Try again reads it again', await page.evaluate(() => !!SW.data && !SW.err), true);
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await tap(page, '#sentWeekBtn', 600);
  check('…with no signal it says it needs signal', await txt(page, '#sentWeek .jempty'), 'This list is read from JobTread — it needs signal. Open it again where there’s signal.');
  await page.evaluate(() => { closeSheet(); window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  // Close Out's sends, from this phone's own list.
  await page.evaluate(() => { coLedgerAdd({ jobId: 'j_2841', kind: 'complete', label: 'Repair done' }); });
  await page.waitForTimeout(300);
  await tap(page, '#sentWeekBtn', 900);
  check('…and what this phone sent through Close Out, said as this phone\'s', await page.evaluate(() => [...document.querySelectorAll('#sentWeek .obrow')].some((r) => /Sent from this phone/.test(r.textContent) && /Repair done/.test(r.textContent))), true);
  await page.evaluate(() => { S.lang = 'es'; renderLang && renderLang(); openSentWeek(); });
  await page.waitForTimeout(900);
  check('…in Spanish on a Spanish phone', await txt(page, '#sheetTitle'), 'Lo que envié esta semana');
  await page.evaluate(() => { closeSheet(); S.lang = 'en'; renderLang && renderLang(); });
  // The phone's own list is by owner, so it survives sign-out and a hand-over,
  // and each person on a shared phone gets back only their own.
  const kept = await page.evaluate(() => {
    const since = isoLocal(new Date(Date.now() - 7 * 864e5));
    const mine = coLedgerFor('j_2841', since).length;
    wipePhoneState();
    const stored = JSON.parse(localStorage.getItem('dbtc_coledger') || '[]').length;
    const real = window.myEmail;
    window.myEmail = () => 'somebody.else@deitemeyerbrothers.com';
    const theirs = coLedgerFor('j_2841', since).length;
    window.myEmail = real;
    return [mine > 0, stored === mine, theirs, OWN_KEEP_KEYS.dbtc_coledger === 1];
  });
  check('…kept through sign-out and a hand-over, and nobody else on the phone sees it', kept, [true, true, 0, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the day log keeps its photos, and asks for its label again ----
{
  const { ctx, page, errs } = await boot();
  const p = await page.evaluate(() => {
    const d = new Date(Date.now() - 2 * 86400000), date = isoLocal(d);
    const e = dlTouch('j_2841', date, null);
    dlKeepPhoto({ id: 'tp1', fileId: 'fold1', jobId: 'j_2841', at: d.getTime(), tag: 'before', name: 'a.jpg', time: '7:02a' });
    dlKeepPhoto({ id: 'tp1', fileId: 'fold1', jobId: 'j_2841', at: d.getTime(), tag: 'before', name: 'a.jpg', time: '7:02a' });
    const out = dlPayload(e);
    return [out.photos.map((x) => x.fileId), out.hours, out.jobLabel];
  });
  check('a day log sent two days late still carries the photos that reached JobTread that day (once each), and leaves its hours to the API to read',
    [p[0], p[1]], [['fold1'], []]);
  check('…its label is asked for again at send — the job\'s number and name, not its id', /^26-\d{4} /.test(p[2]), true);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- Extra work to bill, on a service repair (Carl, 6 Nov 2026) ----
async function okaforRepair(page) {
  await tap(page, '.tab[data-tab="co"]', 900);
  await tap(page, '[data-cojob="co-okafor"]', 900);
  await tap(page, '[data-coscreen="repairs"]', 700);
  await tap(page, '[data-corepair="pt1"]', 600);
}
const photoFile = (page, target) => page.evaluate(async (target) => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
  await coAddPhoto(target, new File([b], 'p.jpg', { type: 'image/jpeg' }));
}, target);
{
  const { ctx, page, errs } = await boot('window.__MOCK_ROLE="service";');
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; renderLang && renderLang(); });
  await okaforRepair(page);
  check('Extra work to bill: on a service call\'s repair, optional, with its own photo', [await page.locator('#coSvcExtra').count(), await txt(page, '#coSvcExtraK'),
    await page.locator('#coSvcExtraPhotos [data-cophoto*="extra"]').count()], [1, 'Extra work to bill — optional', 1]);
  check('…Done does not wait on it', await page.evaluate(() => coRepairMissing(coVisit('co-okafor'), 'pt1').join(' · ').indexOf('xtra') === -1), true);
  await photoFile(page, { kind: 'before', jobId: 'co-okafor', taskId: 'pt1' });
  await photoFile(page, { kind: 'after', jobId: 'co-okafor', taskId: 'pt1' });
  await page.locator('#coRepairNote').fill('Resealed the boot');
  await tap(page, '[data-cowarr="no"]', 400);
  await page.locator('#coSvcExtra').fill('Replaced 6 ft of drip edge — not on the work order');
  await photoFile(page, { kind: 'extra', jobId: 'co-okafor', taskId: 'pt1' });
  check('…its photo is kept with the repair', await page.evaluate(() => (coVisit('co-okafor').extraPhotos.pt1 || []).length), 1);
  await tap(page, '#coDone', 3000);
  const sent = await page.evaluate(() => (window.__CO || []).filter((c) => c.fn === 'coPhoto' || c.fn === 'coComplete').map((c) => c.fn === 'coPhoto' ? [c.fn, c.photo.label, c.photo.location || ''] : [c.fn, c.service && c.service.extra]));
  check('…the extra work\'s photo goes on the repair titled for the office, then the Done carries the words',
    [sent.some((x) => x[0] === 'coPhoto' && x[1] === 'REPAIR' && x[2] === 'Extra work to bill'), (sent.filter((x) => x[0] === 'coComplete')[0] || [])[1]],
    [true, 'Replaced 6 ft of drip edge — not on the work order']);
  check('…and the draft goes with the send', await page.evaluate(() => [coVisit('co-okafor').svcExtra.pt1, coVisit('co-okafor').extraPhotos.pt1]), [undefined, undefined]);
  check('the phone needs Close Out contract 7', await page.evaluate(() => CO_CONTRACT_NEED), 7);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('window.__MOCK_ROLE="service";window.__MOCK_CO_CONTRACT=6;');
  await page.evaluate(() => loadBuilds && loadBuilds());
  await until(page, () => !!(S.builds && S.builds.closeOut), null, 8000);
  await okaforRepair(page);
  check('…a Close Out server older than contract 7 would drop it unsaid: the field is not drawn', await page.locator('#coSvcExtra').count(), 0);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- words: a partner's clock busy, the install bar, the vocabulary ----
{
  const { ctx, page, errs } = await boot();
  check('a partner whose clock was busy on another phone is said in Spanish too', await page.evaluate(() => { S.lang = 'es'; const w = partnerWhy('another clock change of theirs was still saving'); S.lang = 'en'; return w; }),
    'otro cambio de su reloj todavía se estaba guardando');
  check('no translation key added twice with different words', await page.evaluate(() => (window.I18N_CLASH || []).length), 0);
  check('a computer is never told to use the Home Screen icon', await page.locator('#installBar').isHidden(), true);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
  check('I18: an iPhone in a Safari tab is told, in plain words, to open DB Crew from its Home Screen icon', [await page.locator('#installBar').isVisible(),
    /You’re in a browser tab\. Open DB Crew from its Home Screen icon/.test(await txt(page, '#installBar')), /Share › Add to Home Screen/.test(await txt(page, '#installBar'))], [true, true, true]);
  await tap(page, '#installBar', 300);
  check('…a tap puts it away for the day', await page.locator('#installBar').isHidden(), true);
  allErrs.push(...errs);
  await ctx.close();
}

check('no page errors', allErrs, []);
await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n        got:  ${JSON.stringify(r.actual)}\n        want: ${JSON.stringify(r.expected)}`));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
