/* T2.38 (3 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t238-test.mjs
 *
 * Audit I17 (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr): while a
 * clock-in kept with no signal waited, every move, code change and clock-out
 * waited with it, so a crew with no signal all morning could not record
 * leaving one job for another at all. Now each is kept behind it, with its
 * own moment, and they go in order when signal returns: the hours land on
 * the right job, at the right times, and every photo with the block it is
 * of. Walked on a page clock set to an Ohio morning, so each change really
 * is made hours after the one before. A break, Started earlier and Already
 * left still wait — each is checked against the entry itself. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => { const l = page.locator(sel).first(); return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 15000 }); await page.waitForTimeout(300); };
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
async function until(page, fn, arg, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* reloading */ }
    await page.waitForTimeout(200);
  }
  return false;
}
const closeSheets = (page) => page.evaluate(() => { if (S.sheet) closeSheet(); }).then(() => page.waitForTimeout(300));

// The Ohio day the suite runs on, and a moment in it.
const NY = 'America/New_York';
const DAY = new Date().toLocaleDateString('en-CA', { timeZone: NY });
const hmOf = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: NY, hour: '2-digit', minute: '2-digit' });
const at = (hm) => { for (const off of ['-05:00', '-04:00']) { const t = Date.parse(DAY + 'T' + hm + ':00' + off); if (hmOf(t) === hm) return t; } throw new Error('no ' + hm); };
const CLOCK_FNS = ['clockIn', 'switchCode', 'startTravel', 'clockOut'];
const kinds = (page) => page.evaluate(() => clockQ.map((x) => cqKind(x)));

async function boot(flags = '', time) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, timezoneId: NY });
  const page = await ctx.newPage();
  if (time) await page.clock.install({ time });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  // The toasts said, in order — each replaces the last on screen.
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__MOCK_KEEP_CLOCK=true;window.__CO=[];window.__TOASTS=[];' +
    // The phone's own hour and minute (the page is on Ohio time), for the checks.
    'window.hmOfLocal=function(t){var d=new Date(t);return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);};' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await until(page, () => typeof S === 'object' && S.booted && !!S.me);
  await page.evaluate(() => { const t = window.toast; window.toast = function (m, e) { window.__TOASTS.push(L(m)); return t(m, e); }; });
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
// __RIDS is the mock's own list: emptied in place, never replaced.
const offline = (page) => page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__CLOCK = []; window.__QUEUED = []; (window.__RIDS || []).length = 0; });
const online = (page) => page.evaluate(() => { window.__MOCK_NONET = false; window.__FILES = []; window.dispatchEvent(new Event('online')); });
const atWebster = async (page) => {
  if (await page.locator('[data-today="j_2841"]').count()) await tap(page, '[data-today="j_2841"]', 600);
  else { await page.evaluate(() => { pickJobObj(visitAsJob(S.assign.visits.filter((v) => v.jobId === 'j_2841')[0]), false); render(); }); await page.waitForTimeout(500); }
};
// The day log a site manager sends before leaving a site, and the shop
// checks a job can still show at clock-in: answered the plain way.
const logIfAsked = async (page) => { if (await page.evaluate(() => S.tab === 'log')) await tap(page, '#dlNormal', 900); };
const forgotIfAsked = async (page) => { if (await page.evaluate(() => S.sheet === 'forgot')) await tap(page, '#forgotGo', 600); };

// ---- a day with no signal: in, a code change, the drive, the arrival, out ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_TWO_TODAY=true;', at('07:00'));
  await atWebster(page);
  check('I17: the codes of today\'s booked jobs are on the phone before the signal goes — the next one\'s travel line with them',
    await page.evaluate(() => [!!codesCached('j_2841'), !!(codesCached('j2') || []).filter(isTravelCode).length]), [true, true]);
  await offline(page);

  // 7:02 · clock in at Webster on Masonry Labor, with the start photo.
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await forgotIfAsked(page);
  await shoot(page); await settle(page);
  check('7:02 · with no signal the clock-in is kept, the clock running from then', [await kinds(page), await page.evaluate(() => [!!S.open.kept, S.open.code.number, hmOfLocal(S.open.startedAt)])],
    [['in'], [true, '04MA', '07:02']]);

  // 9:15 · a change of code on the same roof: no photo, kept behind it.
  await page.clock.setSystemTime(at('09:15'));
  await tap(page, '#codeBtn', 400);
  check('…a change of code is not held for it any more: the codes open', await page.evaluate(() => S.sheet), 'codes');
  await tap(page, '.coderow:has-text("Final Clean")', 300); await settle(page);
  check('9:15 · the change of code is kept behind the clock-in, and the clock is on the new code from 9:15',
    [await kinds(page), await page.evaluate(() => [!!S.open.kept, S.open.code.number, hmOfLocal(S.open.startedAt)]), await page.evaluate(() => window.__TOASTS.slice(-1)[0])],
    [['in', 'code'], [true, '02ST-1', '09:15'], 'No signal — your 9:15a code change is saved on this phone and goes when there’s signal']);

  // 11:30 · done at Webster for the day: the log, the end photo, the drive to Lucas.
  await page.clock.setSystemTime(at('11:30'));
  await tap(page, '#leaveBtn', 400);
  check('…leaving is not held either: Leaving Noah Webster', await page.evaluate(() => S.sheet), 'leave');
  await tap(page, '[data-leave="done-job"]', 500);
  await logIfAsked(page);
  check('…the end photo of Webster', await page.evaluate(() => S.clockGate), 'end-travel');
  check('…and no Already left on the camera while changes wait: its time is checked against the entry itself', await page.locator('#leftBtn').isHidden(), true);
  await shoot(page); await until(page, () => S.sheet === 'dest');
  await tap(page, '[data-dest="j2"]', 300); await settle(page);
  check('11:30 · the drive to Lucas is kept, on Lucas\'s travel line, carrying the end photo of Webster',
    [await kinds(page), await page.evaluate(() => { const d = clockQ[2]; return [d.jobId, d.costItemId, !!d.endPhotoId, d.opts.doneHere, /^Drive to 26-1045 Lucas · from 26-0890 Noah Webster$/.test(d.notes)]; })],
    [['in', 'code', 'travel'], ['j2', 'ci11', true, true, true]]);
  check('…the band is the drive, and says it is saved on this phone',
    [await txt(page, '#band .lbl'), await page.locator('#travelStack').isVisible(), await txt(page, '#bandSub'), await txt(page, '#arriveBtn')],
    ['Driving to Lucas', true, 'Since 11:30a · saved on this phone · Sends when there’s signal', 'I’m here · start work']);
  check('…the end photo of Webster waits for the code change it is of, not the clock-in',
    await page.evaluate(() => { const p = S.photos.filter((x) => x.tag === 'after')[0]; return [!!p, p && p.waitRid === clockQ[1].rid]; }), [true, true]);

  // 11:58 · I'm here at Lucas: Final Clean, the start photo.
  await page.clock.setSystemTime(at('11:58'));
  await tap(page, '#arriveBtn', 600);
  check('…I\'m here: Lucas\'s codes, from the phone', [await page.evaluate(() => S.sheet), await txt(page, '#sheetTitle')], ['codes', 'What are you doing?']);
  await tap(page, '.coderow:has-text("Final Clean")', 600);
  await forgotIfAsked(page);
  check('…Lucas not worked today: the start photo', await page.evaluate(() => S.clockGate), 'start');
  await shoot(page); await settle(page);
  check('11:58 · the arrival is kept, its start photo waiting for it',
    [await kinds(page), await page.evaluate(() => { const a = clockQ[3]; const p = S.photos.filter((x) => x.tag === 'before' && x.waitRid === a.rid); return [a.jobId, a.costItemId, !!a.startPhotoId, p.length, S.job.id, !!S.open.kept, hmOfLocal(S.open.startedAt)]; })],
    [['in', 'code', 'travel', 'arrive'], ['j2', 'ci5', true, 1, 'j2', true, '11:58']]);

  // 3:40 · out for the day at Lucas, going home: the log, the end photo.
  await page.clock.setSystemTime(at('15:40'));
  await tap(page, '#outBtn', 500);
  check('…clocking out is not held: End of the day', await page.evaluate(() => S.sheet), 'outhow');
  await tap(page, '#sheetBody [data-leave="out"]', 500);
  await logIfAsked(page);
  check('…the end photo of Lucas', await page.evaluate(() => S.clockGate), 'end-out');
  await shoot(page);
  await until(page, () => !S.open && document.body.style.pointerEvents === '');
  await page.waitForTimeout(500);
  check('3:40 · the clock-out is kept: the clock is off, and the five changes wait in the order they were made',
    [await kinds(page), await page.evaluate(() => [!!S.open, clockQ.map((x) => hmOfLocal(x.at))])],
    [['in', 'code', 'travel', 'arrive', 'out'], [false, ['07:02', '09:15', '11:30', '11:58', '15:40']]]);
  check('…nothing reached the API all day', await page.evaluate((f) => (window.__CLOCK || []).filter((c) => f.includes(c[0])).length, CLOCK_FNS), 0);

  // What the phone says about them.
  await page.evaluate(() => setTab('job')); await page.waitForTimeout(300);
  check('…today\'s hours read the day as it went, before any of it has gone: Masonry Labor until the code change, Final Clean before the drive and after it',
    // In whole minutes as JobTread counts them (T2.42): the minute it ended less the minute it began.
    await page.evaluate(() => { const q = clockQ, row = (n) => [...document.querySelectorAll('#dayTbl .trow')].filter((r) => r.querySelector('.n') && r.querySelector('.n').textContent === n).map((r) => r.querySelector('.d').textContent)[0];
      const m = (a, b) => Math.floor(b / 60000) - Math.floor(a / 60000);
      return [row('04MA') === hm(m(q[0].at, q[1].at) * 60), row('02ST-1') === hm((m(q[1].at, q[2].at) + m(q[3].at, q[4].at)) * 60)]; }), [true, true]);
  check('…the notice counts them', await page.evaluate(() => (nudgeItems().filter((n) => n.kind === 'clockq')[0] || {}).text), '5 clock changes since 7:02a are on this phone — they go in order when there’s signal');
  await page.evaluate(() => openSheet('clockq')); await page.waitForTimeout(300);
  check('…the sheet lists every one, in order, and says what still waits',
    [await txt(page, '#sheetTitle'), await page.locator('#sheetBody .body').evaluateAll((b) => b.slice(0, 5).map((x) => x.textContent.trim())),
     /They go to JobTread in order as soon as there’s signal — each at the time you made it\./.test(await txt(page, '#sheetBody')),
     // T2.41: a break is kept too now, so only Started earlier and Already left wait.
     /Started earlier and Already left wait until they have gone\./.test(await txt(page, '#sheetBody')) && !/A break, Started earlier/.test(await txt(page, '#sheetBody'))],
    ['Clock changes to send', ['7:02a · 04MA Masonry Labor at Noah Webster', '9:15a · Change to 02ST-1 Final Clean', '11:30a · The drive to Lucas', '11:58a · Start at Lucas · 02ST-1 Final Clean', '3:40p · Clock out'], true, true]);
  await closeSheets(page);
  await page.evaluate(() => openSheet('waiting')); await page.waitForTimeout(300);
  check('…Waiting to send has a row for each', await page.evaluate(() => (S.waitShown || []).filter((i) => i.lane === 'clock').map((i) => i.what)),
    ['Clock-in 7:02a', 'Code change 9:15a', 'Drive 11:30a', 'Arrival 11:58a', 'Clock-out 3:40p']);
  await closeSheets(page);
  await page.evaluate(() => setTab('diag')); await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('…and sign-out names them first', (await txt(page, '#signOutFoot')).startsWith('Not yet — 5 clock changes,'), true);
  await page.evaluate(() => setTab('job'));
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; savePrefs(); render(); openSheet('clockq'); }); await page.waitForTimeout(300);
  check('…in Spanish on a Spanish phone',
    [await txt(page, '#sheetTitle'), await page.locator('#sheetBody .body').evaluateAll((b) => b.slice(1, 5).map((x) => x.textContent.trim()))],
    ['Cambios por enviar', ['9:15a · Cambiar a 02ST-1 Final Clean', '11:30a · El viaje a Lucas', '11:58a · Empezar en Lucas · 02ST-1 Final Clean', '3:40p · Marcar salida']]);
  await page.evaluate(() => { S.lang = 'en'; savePrefs(); render(); }); await closeSheets(page);

  // 4:05 · signal back: they go one after another, in order, each at its own time.
  await page.clock.setSystemTime(at('16:05'));
  await online(page);
  await until(page, () => !clockQ.length, null, 40000);
  const s = await page.evaluate((f) => ({
    rids: window.__RIDS.filter((x) => f.includes(x[0])).map((x) => x[0]),
    ids: new Set(window.__RIDS.filter((x) => f.includes(x[0])).map((x) => x[1])).size,
    q: (window.__QUEUED || []).map((x) => x.kind),
    open: S.open, toasts: window.__TOASTS.slice(-3)
  }), CLOCK_FNS);
  check('4:05 · signal back: they go by themselves, in the order they were made, each with its own id',
    [s.rids, s.ids, s.q], [['clockIn', 'switchCode', 'startTravel', 'switchCode', 'clockOut'], 5, ['in', 'change', 'drive', 'change', 'out']]);
  const blocks = await page.evaluate(() => window.__MOCK_ST.entries.filter((e) => !/^e\d$/.test(e.id)).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .map((e) => [e.id, hmOfLocal(e.startedAt), e.endedAt ? hmOfLocal(e.endedAt) : null, e.job.id, e.code.number, (e.notes || '').replace(/ at \d+:\d\d:\d\d [AP]M/g, ' at T').replace(/\.$/, '')]));
  check('…and the day in JobTread is the day as it was: each block on its job and code, starting and ending when the phone said',
    blocks.map((b) => b.slice(1, 5)),
    [['07:02', '09:15', 'j_2841', '04MA'], ['09:15', '11:30', 'j_2841', '02ST-1'], ['11:30', '11:58', 'j2', '01GR-9'], ['11:58', '15:40', 'j2', '02ST-1']]);
  check('…each block\'s notes say it was kept, and the drive says where to',
    blocks.map((b) => b[5]),
    ['Clocked in with no signal at T — sent from DB Crew',
     'Started with no signal at T — sent from DB Crew',
     'Drive to 26-1045 Lucas · from 26-0890 Noah Webster · Started the drive with no signal at T — sent from DB Crew',
     'Started with no signal at T — sent from DB Crew. Clocked out with no signal at T — sent from DB Crew']);
  check('…the clock is off, and one receipt says they all went', [s.open, s.toasts.includes('Your 5 clock changes have reached JobTread')], [null, true]);
  await until(page, () => (window.__FILES || []).filter((f) => /#(START|END)/.test(f.desc || '')).length >= 4, null, 30000);
  const files = await page.evaluate(() => (window.__FILES || []).filter((f) => /#(START|END)/.test(f.desc || '')).map((f) => (/#(START|END)(?: #TE:(\w+))?/.exec(f.desc) || []).slice(1)));
  const id = (i) => blocks[i][0];
  check('…and every photo went with the block it is of: the start of each roof, the end of each roof',
    files.sort((a, b) => (a[1] || '').localeCompare(b[1] || '') || a[0].localeCompare(b[0])),
    [['START', id(0)], ['END', id(1)], ['END', id(3)], ['START', id(3)]].sort((a, b) => (a[1] || '').localeCompare(b[1] || '') || a[0].localeCompare(b[0])));
  check('…none still waiting', await page.evaluate(() => S.photos.filter((p) => p.waitRid).length), 0);
  check('no page errors (a day with no signal)', errs, []);
  await ctx.close();
}

// ---- one refused in the middle: said, and the rest still go ----
{
  const { ctx, page, errs } = await boot('', at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  await page.clock.setSystemTime(at('09:15'));
  await tap(page, '#codeBtn', 400); await tap(page, '.coderow:has-text("Final Clean")', 300); await settle(page);
  check('I17: kept, a clock-in and a code change', await kinds(page), ['in', 'code']);
  // The office put them on the clock at 7:40 while the 7:02 clock-in waited.
  await page.clock.setSystemTime(at('10:00'));
  await page.evaluate((t) => { window.__MOCK_QREFUSE_ONCE = { why: 'since', at: new Date(t).toISOString(), open: true }; }, at('07:40'));
  await online(page);
  await until(page, () => clockQ.length === 1 && clockQ[0].refused, null, 30000);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({ open: S.open && [S.open.code.number, hmOfLocal(S.open.startedAt), !!S.open.kept],
    blocks: window.__MOCK_ST.entries.filter((e) => !/^e\d$/.test(e.id)).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).map((e) => [hmOfLocal(e.startedAt), e.endedAt ? hmOfLocal(e.endedAt) : null, e.code.number]) }));
  check('…the clock-in is refused — the office had them on since 7:40 — and the code change still goes at 9:15, ending the office\'s block there',
    [r.blocks, r.open], [[['07:40', '09:15', '04MA'], ['09:15', null, '02ST-1']], ['02ST-1', '09:15', false]]);
  check('…the notice says which was refused', await page.evaluate(() => (nudgeItems().filter((n) => n.kind === 'clockq-no')[0] || {}).text), 'Your 7:02a clock-in wasn’t added — tap to see why');
  await page.evaluate(() => { const n = nudgeItems().filter((x) => x.kind === 'clockq-no')[0]; n.go(); }); await page.waitForTimeout(400);
  check('…and opens that one, with its reason and what to do', [await txt(page, '#sheetTitle'), /You were put on the clock at 7:40a while this clock-in waited\./.test(await txt(page, '#sheetBody')), await page.locator('#cqOk').count()],
    ['Clock-in not added', true, 1]);
  await tap(page, '#cqOk', 500);
  check('…OK lets it go', await page.evaluate(() => clockQ.length), 0);
  check('no page errors (refused in the middle)', errs, []);
  await ctx.close();
}

// ---- with signal, a change made while one is still on its way goes behind it ----
{
  const { ctx, page, errs } = await boot('', at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  // Signal back, and the clock-in on its way — its answer slow to come.
  await page.clock.setSystemTime(at('07:20'));
  await page.evaluate(() => { const f = window.fetch;
    window.fetch = function (u, o) {
      const b = String(u).includes('mock.local/exec') && o && typeof o.body === 'string' ? JSON.parse(o.body) : {};
      if (b.fn === 'clockIn' && !window.__HELD) { window.__HELD = true; return new Promise((res) => { window.__RELEASE = () => res(f(u, o)); }); }
      return f(u, o);
    }; });
  await online(page);
  await until(page, () => clockQ.length === 1 && clockQ[0].inflight && !!window.__RELEASE, null, 20000);
  // Seconds later, never minutes: the API counts the wait back from its own
  // clock, so a request held for minutes would land late by as much — and a
  // real one gives up after 25 seconds.
  await tap(page, '#codeBtn', 400); await tap(page, '.coderow:has-text("Final Clean")', 300); await settle(page);
  check('I17: with signal, a change of code made while the clock-in is still on its way is kept behind it — never sent ahead of it',
    [await kinds(page), await page.evaluate(() => (window.__CLOCK || []).filter((c) => c[0] === 'switchCode').length), await page.evaluate(() => window.__TOASTS.slice(-1)[0])],
    [['in', 'code'], 0, 'Saved on this phone — it goes once the change before it has']);
  await page.evaluate(() => window.__RELEASE());
  await until(page, () => !clockQ.length, null, 20000);
  const s = await page.evaluate(() => ({ calls: (window.__CLOCK || []).filter((c) => ['clockIn', 'switchCode'].includes(c[0])).map((c) => c[0]),
    blocks: window.__MOCK_ST.entries.filter((e) => !/^e\d$/.test(e.id)).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).map((e) => [hmOfLocal(e.startedAt), e.endedAt ? hmOfLocal(e.endedAt) : null, e.code.number]) }));
  check('…the clock-in lands at 7:02, then the change goes, at 7:20',
    [s.calls, s.blocks], [['clockIn', 'switchCode'], [['07:02', '07:20', '04MA'], ['07:20', null, '02ST-1']]]);
  check('no page errors (behind one on its way)', errs, []);
  await ctx.close();
}

// ---- yesterday's block still open: the chain waits behind the question ----
{
  const { ctx, page, errs } = await boot('', at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  await page.clock.setSystemTime(at('09:15'));
  await tap(page, '#codeBtn', 400); await tap(page, '.coderow:has-text("Final Clean")', 300); await settle(page);
  // Meanwhile JobTread has a block open since yesterday (another phone, or the office).
  await page.clock.setSystemTime(at('10:00'));
  await page.evaluate(() => { const st = window.__MOCK_ST, y = new Date(); y.setDate(y.getDate() - 1); y.setHours(7, 2, 0, 0);
    st.open = { id: 'oy3', startedAt: y.toISOString(), endedAt: null, minutes: 0, notes: '', job: JSON.parse(JSON.stringify(S.job)), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' } };
    st.entries = [st.open].concat(st.entries); });
  await online(page);
  await until(page, () => S.sheet === 'left' && clockQ[0] && clockQ[0].stale, null, 20000);
  check('I17 + D21: the clock-in meets yesterday\'s block and waits, When did you leave? opens, and the code change waits behind them both',
    [await kinds(page), await page.evaluate(() => [!!clockQ[0].stale, S.sheet, S.open && S.open.id, (window.__CLOCK || []).filter((c) => c[0] === 'switchCode').length])],
    [['in', 'code'], [true, 'left', 'oy3', 0]]);
  await page.locator('#leftTime').fill('16:30'); await page.waitForTimeout(200);
  await tap(page, '#leftGo', 300);
  await until(page, () => !clockQ.length, null, 20000);
  const s = await page.evaluate(() => ({ calls: (window.__CLOCK || []).map((c) => c[0]).filter((f) => ['clockIn', 'switchCode', 'leftSite'].includes(f)),
    blocks: window.__MOCK_ST.entries.filter((e) => !/^e\d$/.test(e.id)).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).map((e) => [isoLocal(new Date(e.startedAt)) === isoLocal() ? 'today' : 'before', hmOfLocal(e.startedAt), e.endedAt ? hmOfLocal(e.endedAt) : null, e.code.number]) }));
  check('…said: yesterday ends at 4:30p, then the clock-in at 7:02 and the change at 9:15, in order',
    [s.calls, s.blocks], [['clockIn', 'leftSite', 'clockIn', 'switchCode'], [['before', '07:02', '16:30', '04MA'], ['today', '07:02', '09:15', '04MA'], ['today', '09:15', null, '02ST-1']]]);
  check('no page errors (behind yesterday\'s block)', errs, []);
  await ctx.close();
}

// ---- out away from the shop, then another job picked: both stand ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_AWAY_OUT=true;', at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  await page.clock.setSystemTime(at('15:40'));
  await tap(page, '#outBtn', 500); await tap(page, '#sheetBody [data-leave="out"]', 500); await logIfAsked(page);
  await shoot(page); await until(page, () => !S.open && document.body.style.pointerEvents === '');
  await page.waitForTimeout(400);
  check('I17: a clock-in and a clock-out kept', await kinds(page), ['in', 'out']);
  // Signal back: the clock-in lands; the clock-out's first try gets no
  // answer, so it waits on its next try — and meanwhile another job is
  // picked and the clock read again. (A read waits behind a write in flight,
  // so this is the window a read can come in.)
  await page.evaluate(() => { const f = window.fetch;
    window.fetch = function (u, o) {
      const b = String(u).includes('mock.local/exec') && o && typeof o.body === 'string' ? JSON.parse(o.body) : {};
      if (b.fn === 'clockOut' && window.__DROP_OUT) return Promise.reject(new TypeError('Failed to fetch'));
      return f(u, o);
    }; });
  await page.evaluate(() => { window.__DROP_OUT = true; });
  await online(page);
  await until(page, () => clockQ.length === 1 && clockQ[0].kind === 'out' && clockQ[0].tries > 0 && !clockQ[0].inflight, null, 20000);
  await page.evaluate(() => { window.__DROP_OUT = false; });
  await page.evaluate(() => { pickJobObj(visitAsJob(S.assign.visits.filter((v) => v.jobId === 'j4')[0] || { jobId: 'j4', jobNum: '26-1490', jobName: '261490 Courtney_Roof', cust: 'Courtney' }), false); render(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => clockReread(true)); await page.waitForTimeout(400);
  check('…the job picked after the kept clock-out stays picked when the clock is read again — not put back to the job JobTread has open',
    await page.evaluate(() => [S.job && S.job.id, !!S.open, window.__MOCK_ST.open && window.__MOCK_ST.open.job.id]), ['j4', false, 'j_2841']);
  await page.evaluate(() => { const w = cqWaiting(); if (w){ w.next = 0; cqSend(); } });
  await until(page, () => !clockQ.length, null, 20000);
  await page.waitForTimeout(300);
  check('…and when the last has gone, its receipt is the clock-out away from the shop — the PM and the Ops Director were told — not a count that hides it',
    await page.evaluate(() => [window.__TOASTS.includes('Clocked out away from the shop · your PM and the Ops Director are told'), window.__TOASTS.some((t) => /clock changes have reached JobTread/.test(t)), S.job && S.job.id]), [true, false, 'j4']);
  check('no page errors (away, then another job)', errs, []);
  await ctx.close();
}

// ---- an API older than T2.38: the drive, the clock-out and moving wait, as before ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_API_BUILD='T2.37 (2026-11-03)';", at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  check('I17: kept, a clock-in', await kinds(page), ['in']);
  await tap(page, '#outBtn', 400);
  const outSheet = [await page.evaluate(() => S.sheet), await txt(page, '#sheetTitle')];
  await closeSheets(page);
  await tap(page, '#codeBtn', 400);
  const codeSheet = await page.evaluate(() => S.sheet);
  await closeSheets(page);
  await tap(page, '#leaveBtn', 400);
  check('…against an API older than T2.38, which would put a kept drive or clock-out at the moment it arrived, clocking out, a change of code and leaving still wait for the clock-in',
    [outSheet, codeSheet, await page.evaluate(() => S.sheet)], [['clockq', 'Clock-in not sent yet'], 'clockq', 'clockq']);
  await closeSheets(page);
  check('no page errors (an older API)', errs, []);
  await ctx.close();
}

// ---- a break no longer waits (T2.41): kept behind the clock-in, at its own moment ----
{
  const { ctx, page, errs } = await boot('', at('07:00'));
  await offline(page);
  await page.clock.setSystemTime(at('07:02'));
  await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await forgotIfAsked(page);
  await shoot(page); await settle(page);
  await tap(page, '#breakBtn', 400);
  check('T2.41: a break no longer waits for the clock-in — the break sheet opens', await page.evaluate(() => S.sheet), 'break');
  await tap(page, '.brkopt[data-brk="30"]', 800);
  check('…and it is kept behind the clock-in, in the order it was made', await kinds(page), ['in', 'break']);
  check('no page errors (a break)', errs, []);
  await ctx.close();
}

await browser.close();
let pass = 0;
for (const r of results) {
  if (r.pass) { pass++; console.log('  ok  ' + r.name); }
  else console.log('FAIL  ' + r.name + '\n      got:      ' + JSON.stringify(r.actual) + '\n      expected: ' + JSON.stringify(r.expected));
}
console.log('\n' + pass + '/' + results.length + ' passed');
process.exit(pass === results.length ? 0 : 1);
