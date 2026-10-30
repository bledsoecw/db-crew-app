/* T2.31 (30 Oct 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t231-test.mjs
 *
 * Step 3 of the audit, first half: every write carries a request id, the
 * same on every try, so an answer lost on the way back never makes a second
 * write (D15); one outbox for everything the phone keeps to send later — one
 * retry schedule, one wake-up when signal or the app comes back, one count
 * for the no-signal bar and sign-out (I2); and a clock-in made with no
 * signal is kept on the phone with its time and start photo and sent when
 * there is signal (I1). The server's half is apps-script/code-test.mjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();

async function boot(flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript(flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}

// ---- D15: one id per write, the same on every try ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';");
  // Tell the PM, its answer lost on the way back: the phone tries again with
  // the same id, and the API hands back the first answer — one text.
  await page.evaluate(() => { window.__TEXTS = []; window.__RIDS.length = 0; window.__MOCK_LOSTREPLY = 1; });
  const told = await page.evaluate(() => apiCall('tellPm', [S.job.id, 'Short two bundles of ridge']).then((r) => !!r, (e) => 'ERR ' + e.message));
  const tries = await page.evaluate(() => window.__RIDS.filter((x) => x[0] === 'tellPm'));
  check('D15: Tell the PM whose answer was lost texts once, and the phone still hears it went', [told, await page.evaluate(() => window.__TEXTS.length)], [true, 1]);
  check('…the second try carried the same id as the first', [tries.length, !!tries[0][1], tries[0][1] === (tries[1] || [])[1]], [2, true, true]);
  // Every write carries one; a read carries none.
  await page.evaluate(() => { window.__RIDS.length = 0; });
  await page.evaluate(() => Promise.all([apiCall('getMyDay', []), apiCall('tellPm', [S.job.id, 'second note'])]).catch(() => {}));
  const rids = await page.evaluate(() => window.__RIDS.slice());
  check('…a read carries no id, and a new write gets a new one', [rids.find((x) => x[0] === 'getMyDay')[1], !!rids.find((x) => x[0] === 'tellPm')[1], rids.find((x) => x[0] === 'tellPm')[1] !== tries[0][1]], [null, true, true]);
  check('no page errors (D15)', errs, []);
  await ctx.close();
}

// A photo straight into the queue, as the camera leaves one (t230-test's).
const queuePhoto = (page, o) => page.evaluate(async (o) => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
  const jobId = (S.job && S.job.id) || 'j1';
  const item = Object.assign({ id: o.id, blob, mime: 'image/jpeg', tag: o.tag || 'before', at: o.at || Date.now(), jobId, entryId: '', codeLabel: '' }, o.extra || {});
  S.photos.push({ id: o.id, tag: item.tag, at: item.at, time: clockLabel(item.at), thumb: c.toDataURL('image/jpeg', 0.5), pending: true, jobId, name: fileName(item) });
  savePrefs();
  await idbPut(item);
  return fileName(item);
}, o);

// ---- I2: one outbox ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';window.__MOCK_PRESTART=true;");
  check('I2: one backoff for every lane — 20 s, a minute, three minutes, then every five', await page.evaluate(() => [1, 2, 3, 4, 9].map(obRetryMs)), [20000, 60000, 180000, 300000, 300000]);
  check('…and every lane is on the one outbox', await page.evaluate(() => OB_LANES.map((l) => l.key).sort()), ['checks', 'clock', 'closeout', 'log', 'photos', 'prestart', 'roll']);
  // No signal: a photo, a pre-start tick, a day log and a roll-out note wait.
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await queuePhoto(page, { id: 'o1', at: Date.now() - 60e3 });
  await page.evaluate(() => {
    prTouch(prVisit('tpre'), prVisit('tpre').prestart.lines[0].key);
    dlQueueSend(S.job.id, isoLocal());
    rollStore[S.job.id + '|' + isoLocal()] = { forgot: { args: [S.job.id, 'Webster', ['Tarps checked']], rid: 'rtest-roll-0000', tries: 0 } };
    rollPersist();
    return qCount().then(render);
  });
  check('…the no-signal bar counts everything waiting, not only the photos', await txt(page, '#offlineBar'), 'No signal · 4 items queued');
  await page.evaluate(() => setTab('diag'));
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('…and sign-out names every lane, the roll-out note included', await txt(page, '#signOutFoot'),
    'Not yet — 1 photo, 1 pre-start save, 1 day log, 1 roll-out note still waiting to send from this phone. Get a signal, let it go, then sign out.');
  // Signal back: one wake-up, every lane.
  await page.evaluate(() => { window.__MOCK_NONET = false; window.__CALLS.length = 0; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => ['savePrestart', 'rollForgot', 'finalizeCaptureUpload', 'sendDailyLog'].every((f) => window.__CALLS.includes(f)), null, { timeout: 20000 }).catch(() => {});
  check('…signal back wakes every lane at once — the pre-start and the roll-out note too, which it never used to',
    await page.evaluate(() => ['savePrestart', 'rollForgot', 'finalizeCaptureUpload', 'sendDailyLog'].map((f) => window.__CALLS.includes(f))), [true, true, true, true]);
  await page.waitForTimeout(600);
  check('…and once they have gone, nothing is waiting', await page.evaluate(() => obWaiting().total), 0);
  // A roll-out note that cannot go is kept and tried again with its id.
  await page.evaluate(() => { window.__MOCK_NONET = true; rollStore[S.job.id + '|' + isoLocal()] = { daily: { args: [S.job.id, 'tsk', 'Webster', 2, ['Tarps checked'], ''], rid: 'rtest-roll-0001', tries: 0 } }; rollPersist(); return rollFlush(); });
  check('…a roll-out note that cannot go is kept, with its next try — it used to be lost',
    await page.evaluate(() => { const w = rollStore[S.job.id + '|' + isoLocal()].daily; return [!w.sent, w.tries, w.next > Date.now(), obWaiting().parts.map((p) => p.key)]; }), [true, 1, true, ['roll']]);
  await page.evaluate(() => { window.__MOCK_NONET = false; window.__RIDS.length = 0; obWake(); });
  await page.waitForTimeout(900);
  check('…and goes, with the same id, as soon as signal is back', await page.evaluate(() => [rollStore[S.job.id + '|' + isoLocal()].daily.sent > 0, window.__RIDS.filter((x) => x[0] === 'rollChecked').map((x) => x[1])]), [true, ['rtest-roll-0001']]);
  // One trimming rule: finished goes after 14 days, unsent never.
  await page.evaluate(() => { const old = Date.now() - 21 * 864e5; ckStore.t_old_clean = { state: { done: {} }, dirty: false, at: old }; ckStore.t_old_dirty = { state: { done: { a: true } }, dirty: true, inflight: true, at: old, jobId: 'x' }; storeTrim(false); });
  check('…one trimming rule: a finished copy from three weeks ago goes, one still to send stays', await page.evaluate(() => [!!ckStore.t_old_clean, !!ckStore.t_old_dirty]), [false, true]);
  await page.evaluate(() => { delete ckStore.t_old_dirty; ckPersist(); });
  check('no page errors (I2)', errs, []);
  await ctx.close();
}

// ---- I1: clock in with no signal ----
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 15000 }); await page.waitForTimeout(250); };
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const clockIn = async (page) => { await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page); };
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__CLOCK = []; });
  await clockIn(page);
  let s = await page.evaluate(() => ({ queued: !!(S.open && S.open.kept), code: S.open && S.open.code && S.open.code.number, q: clockQ.length, calls: (window.__CLOCK || []).length, photo: S.photos.map((p) => [p.tag, p.codeId, !!p.waitRid]) }));
  check('I1: with no signal the clock-in is kept on the phone — the clock running, the start photo kept', [s.queued, s.code, s.q, s.calls, s.photo], [true, '04MA', 1, 0, [['before', 'ci9', true]]]);
  check('…the clock says so', [await txt(page, '#band .lbl'), /^Started \d+:\d\d[ap] · Sends when there’s signal$/.test(await txt(page, '#bandSub')), await page.locator('#earlierBtn').isVisible()], ['On the clock · saved on this phone', true, false]);
  check('…so does a notice', /^Clock-in ?Your \d+:\d\d[ap] clock-in is on this phone — it goes when there’s signal/.test(await txt(page, '#clockNudge')), true);
  check('…and the no-signal bar counts it, with its photo', await txt(page, '#offlineBar'), 'No signal · 2 items queued');
  await tap(page, '#outBtn', 400);
  check('…clocking out waits for it, and says why', [await page.evaluate(() => S.sheet), await txt(page, '#sheetTitle'), /Clocking out, a break and moving wait until it has gone\./.test(await txt(page, '#sheetBody'))], ['clockq', 'Clock-in not sent yet', true]);
  await tap(page, '#cqClose', 300);
  await tap(page, '#breakBtn', 400);
  check('…a break too', await page.evaluate(() => S.sheet), 'clockq');
  await tap(page, '#cqClose', 300);
  await page.evaluate(() => setTab('diag'));
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('…and sign-out names it first', (await txt(page, '#signOutFoot')).startsWith('Not yet — a clock-in, 1 photo still waiting to send'), true);
  await page.evaluate(() => setTab('job'));
  // A reload with no signal: still running from the same minute.
  const at0 = await page.evaluate(() => S.open.startedAt);
  await page.addInitScript('window.__MOCK_NONET=true;');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  s = await page.evaluate(() => ({ queued: !!(S.open && S.open.kept), at: S.open && S.open.startedAt, q: clockQ.length }));
  check('…a reload with no signal keeps it, running from the same minute', [s.queued, s.at, s.q], [true, at0, 1]);
  // Signal back: it goes, starting when it was made, and the photo follows.
  await page.evaluate(() => { window.__MOCK_NONET = false; window.__RIDS.length = 0; window.__FILES = []; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => !clockQ.length && S.open && !S.open.queued, null, { timeout: 15000 }).catch(() => {});
  s = await page.evaluate(() => ({ queued: S.open && S.open.kept, id: S.open && S.open.id, at: S.open && S.open.startedAt, q: window.__QUEUED || [], rid: (window.__RIDS.find((x) => x[0] === 'clockIn') || [])[1] }));
  check('…signal back: it goes by itself, with its id, starting when it was made',
    [!!s.queued, /^open\d+$/.test(s.id || ''), Math.abs(Date.parse(s.at) - Date.parse(at0)) < 1000, s.q.length, !!s.rid], [false, true, true, 1, true]);
  await page.waitForFunction(() => (window.__FILES || []).length >= 1, null, { timeout: 15000 }).catch(() => {});
  check('…and its start photo goes after it, stamped with the entry', await page.evaluate(() => [(window.__FILES[0] || {}).desc && window.__FILES[0].desc.indexOf('#START #TE:' + S.open.id) === 0, S.photos.map((p) => [p.pending, !!p.waitRid])]), [true, [[false, false]]]);
  check('…the clock is a clock again', [await txt(page, '#band .lbl'), await page.locator('#clockNudge').isVisible() && /clock-in/.test(await txt(page, '#clockNudge'))], ['On the clock', false]);
  check('no page errors (I1, no signal)', errs, []);
  await ctx.close();
}
{
  // A reply lost once: the try after it finds the first answer (D15) — one entry, nothing kept.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await page.evaluate(() => { window.__CLOCK = []; window.__MOCK_LOSTREPLY = 1; });
  await clockIn(page);
  let s = await page.evaluate(() => ({ open: S.open && S.open.id, queued: !!(S.open && S.open.kept), q: clockQ.length, n: (window.__CLOCK || []).filter((c) => c[0] === 'clockIn').length }));
  check('I1: a clock-in whose answer was lost once is one entry, and nothing is kept', [/^open\d+$/.test(s.open || ''), s.queued, s.q, s.n], [true, false, 0, 1]);
  // The write lands, then the signal goes: kept, and when it is sent the API finds the first.
  await page.evaluate(() => { const f = window.fetch; let first = true;
    window.fetch = function (u, o) { const b = String(u).includes('mock.local/exec') ? JSON.parse(o.body) : {};
      if (b.fn === 'clockOut' || b.fn === 'switchCode') return f(u, o);
      if (b.fn === 'clockIn' && first) { first = false; window.__MOCK_LOSTREPLY = 1; const p = f(u, o); window.__MOCK_NONET = true; return p; }
      return f(u, o); }; });
  await page.evaluate(() => { S.open = null; window.__CLOCK = []; render(); });
  // Back on the same job the same day: no start photo is owed, so no camera.
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 300); await settle(page);
  s = await page.evaluate(() => ({ queued: !!(S.open && S.open.kept), q: clockQ.length, n: (window.__CLOCK || []).filter((c) => c[0] === 'clockIn').length, rid: clockQ[0] && clockQ[0].rid, first: (window.__RIDS.filter((x) => x[0] === 'clockIn').slice(-1)[0] || [])[1] }));
  check('…the write landed and then the signal went: kept, with the same id as the try that landed', [s.queued, s.q, s.n, s.rid === s.first], [true, 1, 1, true]);
  check('…kept with a bar of signal and no data, it tries again on its own — the outbox backoff, not an "online" that may never come',
    await page.evaluate(() => [!!cqTimer, clockQ[0].next > Date.now(), clockQ[0].next - Date.now() <= 20000]), [true, true, true]);
  await page.evaluate(() => { window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => !clockQ.length, null, { timeout: 15000 }).catch(() => {});
  s = await page.evaluate(() => ({ queued: !!(S.open && S.open.kept), n: (window.__CLOCK || []).filter((c) => c[0] === 'clockIn').length, q: (window.__QUEUED || []).length }));
  check('…sent again, the API hands back the entry it already made — no second entry', [s.queued, s.n, s.q], [false, 1, 0]);
  check('no page errors (I1, lost answers)', errs, []);
  await ctx.close();
}
{
  // Refused when it finally goes: said, with the reason; OK lets it go, and the photo still goes.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await clockIn(page);
  // As Code.gs refuses one: the reason in words, and as data the phone says in its own language.
  await page.evaluate(() => { const d = new Date(); d.setHours(7, 40, 0, 0);
    window.__MOCK_QREFUSE = { why: 'since', at: d.toISOString() }; window.__MOCK_NONET = false; window.__FILES = []; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => clockQ.length === 1 && clockQ[0].refused, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  check('I1: refused when it goes: the clock is not running, and a notice says so',
    [await page.evaluate(() => !!(S.open && S.open.kept)), /^Clock-in ?Your \d+:\d\d[ap] clock-in wasn’t added — tap to see why/.test(await txt(page, '#clockNudge'))], [false, true]);
  await tap(page, '#clockNudge', 400);
  let body = await txt(page, '#sheetBody');
  check('…the notice opens the reason, said once, then what to do',
    [await txt(page, '#sheetTitle'), /You were put on the clock at 7:40a while this clock-in waited\./.test(body), (body.match(/Tell the office/g) || []).length, /wasn’t added|not added/.test(body)],
    ['Clock-in not added', true, 1, false]);
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; savePrefs(); render(); openSheet('clockq'); });
  await page.waitForTimeout(300);
  body = await txt(page, '#sheetBody');
  check('…and in Spanish on a Spanish phone, the reason too',
    [await txt(page, '#sheetTitle'), /Te pusieron en el reloj a las 7:40a mientras esta entrada esperaba\./.test(body), /Dile a la oficina/.test(body)],
    ['Entrada no agregada', true, true]);
  check('…a reason the phone has no name for is the API\'s own words',
    await page.evaluate(() => [cqWhy({ err: 'That job is closed.' }), cqWhy({ refuse: { why: 'old' } }), cqWhy({})]),
    ['That job is closed.', 'Esta entrada esperó en el teléfono más de 16 horas.', 'JobTread no la aceptó.']);
  await page.evaluate(() => { S.lang = 'en'; savePrefs(); render(); openSheet('clockq'); });
  await page.waitForTimeout(300);
  await tap(page, '#cqOk', 500);
  await page.waitForFunction(() => (window.__FILES || []).length >= 1, null, { timeout: 15000 }).catch(() => {});
  check('…OK lets it go, and the start photo still goes, without an entry', [await page.evaluate(() => clockQ.length), await page.evaluate(() => (window.__FILES[0] || {}).desc || '').then((d) => /^#START/.test(d) && !/#TE:/.test(d))], [0, true]);
  // An arrival kept with no signal goes as the switch it was.
  await page.evaluate(() => { window.__MOCK_QREFUSE = null; window.__QUEUED = []; window.__CLOCK = [];
    clockQ.push({ rid: 'rtest-sw-0001', kind: 'switch', jobId: S.job.id, costItemId: 'ci9', coords: null, startPhotoId: 'p1', endPhotoId: '', opts: {}, at: Date.now() - 20 * 60e3,
      job: cqJobSnap(S.job), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' }, partner: false, tries: 0 }); cqPersist(); return cqSend(); });
  await page.waitForTimeout(500);
  check('…an arrival kept with no signal goes as the switch it was, starting when it was made',
    await page.evaluate(() => [(window.__CLOCK[0] || [])[0], (window.__QUEUED || []).length, Math.abs(Date.now() - 20 * 60e3 - Date.parse(S.open.startedAt)) < 3000, clockQ.length]), ['switchCode', 1, true, 0]);
  check('no page errors (I1, refused)', errs, []);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${failed.length ? results.length - failed.length : results.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
