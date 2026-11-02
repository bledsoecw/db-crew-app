/* T2.34 (2 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t234-test.mjs
 *
 * Step 2 of the second audit (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr),
 * the phone's half. Words that tell the crew what to do are 13 pixels and the
 * EN/ES halves 44 by 44 (D40); the Clock tab is Today — the card's one next
 * action and today's jobs with what each still needs (I12); one "Waiting to
 * send" card and sheet, every item in one of five states (I14); a Close Out
 * push opens Close Out, never the camera (I16, the service worker's half); a
 * repair the office took off says so with a way back, one it reopened reads
 * open again, and one given to somebody else says whose (D32); a camera photo
 * carries the time it was taken (D37); an N/A says why, and the phone sends
 * the reason (D33). The server halves are apps-script/code-test.mjs (the
 * hourly Close Out push) and DB CheckOut's test/jt.test.ts and routes.test.ts
 * (the N/A and who answered on each line, the photo time, GET /assigned). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const settle = (page) => page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 15000 }).catch(() => {});
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const clockIn = async (page) => { await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page); };
const px = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : null; }, sel);
const NOCLOCK = 'window.__MOCK_FIX={entries:function(){return [];}};';

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
const coFresh = (page, jobId) => page.waitForFunction((id) => CO.jobFresh === id && !CO.jobLoading, jobId, { timeout: 15000 }).then(() => page.waitForTimeout(200));
const coOpen = async (page, jobId) => {
  await page.evaluate((id) => { setTab('co'); coOpenJob(id); }, jobId);
  await coFresh(page, jobId);
};

// ---- D40: instructions at 13 pixels, the EN/ES halves 44 by 44 ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';");
  check('D40: "Code, then start photo" under Clock in is 13px, and so are the tab names', [await px(page, '#clockIn .sm'), await px(page, '.tab .tl')], [13, 13]);
  check('…each EN/ES half is at least 44 by 44', await page.evaluate(() => [...document.querySelectorAll('#clockLang button')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width) >= 44, Math.round(r.height) >= 44]; })),
    [[true, true], [true, true]]);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('…the week strip\'s day names are 13px', await px(page, '.wday .dn'), 13);
  check('no page errors (D40)', errs, []);
  await ctx.close();
}

// ---- I12: Today on the Clock tab, a site manager with two roofs today ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_TWO_TODAY=true;" + NOCLOCK);
  // Two roofs today and nothing on the clock: the phone asks which; Lucas.
  if (await page.locator('[data-today="j2"]').count()) await tap(page, '[data-today="j2"]', 700);
  else { await page.evaluate(() => { pickJobObj(visitAsJob(S.assign.visits.filter((v) => v.jobId === 'j2')[0]), false); render(); }); await page.waitForTimeout(600); }
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#todaySect .todrow')].map((r) => [r.querySelector('.tt').textContent, r.querySelector('.tn').textContent, r.tagName]));
  let r = await rows();
  check('I12: with Lucas picked and nothing on the clock, today\'s jobs list both jobs running today, under their heading',
    [await txt(page, '#todaySect .k'), r.map((x) => x[0].split(' ')[0])], ["Today's jobs", ['26-0890', '26-1045']]);
  check('…the job on the card says so and is not a button; the other opens it', [r[1][1], r[1][2], r[0][2]], ["Today's job", 'DIV', 'BUTTON']);
  check('…and nothing on the clock means no next action yet', await page.locator('#nextBtn').isHidden(), true);
  await tap(page, '#clockIn', 400); await tap(page, '.coderow', 600);
  // Lucas's shop lines are open (T2.20): the phone says so and clocks in all the same.
  if (await page.evaluate(() => S.sheet === 'forgot')) await tap(page, '#forgotGo', 600);
  await shoot(page); await settle(page);
  await page.waitForTimeout(400);
  const nx = await txt(page, '#nextBtn');
  check('…on the clock at Lucas, whose site checks are not signed: the card\'s one next action names them, with the count',
    [await page.locator('#nextBtn').isVisible(), /^Next: site checks · \d+ of \d+$/.test(nx)], [true, true]);
  r = await rows();
  check('…and Lucas\'s row says it is the job they are on, and what it still needs', /^On site now · Site checks · \d+ of \d+$/.test(r[1][1]), true);
  await tap(page, '#nextBtn', 700);
  check('…the button opens Lucas\'s site checks', await page.evaluate(() => [S.tab, S.checksKind, S.checksTask]), ['checks', 'site', 't2roof']);
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; savePrefs(); setTab('job'); });
  await page.waitForTimeout(400);
  check('…in Spanish on a Spanish phone', [/^Siguiente: revisiones de obra · \d+ de \d+$/.test(await txt(page, '#nextBtn')), await txt(page, '#todaySect .k')], [true, 'Trabajos de hoy']);
  check('no page errors (I12)', errs, []);
  await ctx.close();
}

// ---- I12: the service crew's day — Close Out work assigned to them ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); return coLoadQueue(true); });
  await page.waitForFunction(() => (CO.jobs || []).length > 0, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => setTab('job'));
  await page.waitForTimeout(400);
  const row = await page.evaluate(() => [...document.querySelectorAll('#todaySect .todrow')].map((r) => [r.querySelector('.tt').textContent, r.querySelector('.tn').textContent]).filter((x) => /^26-0415/.test(x[0]))[0]);
  check('I12: the service crew\'s Today lists the Close Out job with their repairs open, saying how many', row, ['26-0415 Okafor', '2 repairs open']);
  await page.locator('#todaySect .todrow', { hasText: '26-0415' }).first().click();
  await page.waitForTimeout(700);
  check('…a tap goes straight to that job in Close Out', await page.evaluate(() => [S.tab, CO.jobId]), ['co', 'co-okafor']);
  check('no page errors (I12, service)', errs, []);
  await ctx.close();
}

// ---- I14: one "Waiting to send" card and sheet ----
{
  const { ctx, page, errs } = await boot('');
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await clockIn(page);
  await page.evaluate(() => qCount().then(render));
  await page.waitForTimeout(500);
  const card = await page.evaluate(() => ({ head: document.querySelector('#waitSect .k') && document.querySelector('#waitSect .k').textContent,
    rows: [...document.querySelectorAll('#waitSect .wr')].map((w) => [...w.children].map((c) => c.textContent)) }));
  check('I14: a clock-in kept with no signal and its start photo — one card on the Clock tab, each kind with its state in words',
    card, { head: 'Waiting to send · 2', rows: [['A clock-in', 'Saved on this phone'], ['1 photo', 'Saved on this phone']] });
  await page.evaluate(() => document.getElementById('offlineBar').click());
  await page.waitForTimeout(500);
  const sheet = await page.evaluate(() => ({ sheet: S.sheet, intro: document.querySelector('#sheetBody .body').textContent,
    group: document.querySelector('#sheetBody .k').textContent,
    rows: [...document.querySelectorAll('#sheetBody .obrow')].map((r) => [r.querySelector('.st').textContent, r.querySelector('.ob-t').textContent.replace(/\d+:\d\d[ap]/, 'T')]) }));
  check('…the no-signal bar opens one list, by job, each item in one of five states',
    sheet, { sheet: 'waiting', intro: 'No signal. These are saved on this phone and go by themselves when there is signal.', group: sheet.group,
      rows: [['Saved on this phone', 'Clock-in T'], ['Saved on this phone', 'Start photo TGoes after its clock-in']] });
  check('…grouped under the job it is for', /26-0890/.test(sheet.group), true);
  check('D40: the state words in that list are 13px words, not 9px capitals', [await px(page, '#sheetBody .obrow .st'),
    await page.evaluate(() => getComputedStyle(document.querySelector('#sheetBody .obrow .st')).textTransform)], [13, 'none']);
  await page.evaluate(() => { closeSheet(); window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => !clockQ.length && !(S.qItems || []).length, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => qCount().then(render));
  await page.waitForTimeout(600);
  check('…signal back, both go, and the card leaves the Clock tab', [await page.evaluate(() => clockQ.length), await page.locator('#waitSect').isHidden()], [0, true]);
  await page.evaluate(() => openWaiting());
  await page.waitForTimeout(500);
  check('…and the list says nothing is waiting', await txt(page, '#sheetBody .body'), 'Nothing is waiting — everything has reached the office.');
  check('no page errors (I14)', errs, []);
  await ctx.close();
}

// ---- I16: a Close Out push opens Close Out (the service worker) ----
{
  const src = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const run = (windows) => {
    const on = {}, shown = [], opened = [], posted = [];
    const wins = windows.map(() => ({ focus: () => Promise.resolve(), postMessage: (m) => posted.push(m) }));
    const sandbox = {
      self: { addEventListener: (k, f) => { on[k] = f; }, registration: { showNotification: (t, o) => { shown.push({ t, o }); return Promise.resolve(); } }, location: { href: 'https://x/', origin: 'https://x' } },
      clients: { matchAll: () => Promise.resolve(wins), openWindow: (u) => { opened.push(u); return Promise.resolve(); } },
      caches: {}, Promise, URL, console, setTimeout,
    };
    vm.createContext(sandbox); vm.runInContext(src, sandbox);
    return { on, shown, opened, posted };
  };
  const push = (sw, data) => { let p; sw.on.push({ data: { json: () => ({ notification: { title: 'Close Out', body: 'New repair at Turner Roof' }, data }) }, waitUntil: (x) => { p = x; } }); return p; };
  const click = (sw, data) => { let p; sw.on.notificationclick({ notification: { data, close: () => {} }, waitUntil: (x) => { p = x; } }); return p; };
  let sw = run([]);
  await push(sw, { kind: 'closeout', tag: 'dbtc-closeout' });
  check('I16: a Close Out push shows with its own tag, and is not held on the lock screen', [sw.shown[0].t, sw.shown[0].o.tag, sw.shown[0].o.requireInteraction], ['Close Out', 'dbtc-closeout', false]);
  await push(sw, { kind: 'before-photo', tag: 'dbtc-before' });
  check('…a start-photo push still is', sw.shown[1].o.requireInteraction, true);
  await click(sw, { kind: 'closeout' });
  check('…tapped with the app closed, it opens Close Out — never the camera an unknown kind gets', sw.opened, ['./?tab=co']);
  sw = run([1]);
  await click(sw, { kind: 'closeout' });
  check('…with the app open, it is told to show Close Out', sw.posted, [{ kind: 'open-tab', tab: 'co' }]);
}

// ---- D32: a repair the office took off, reopened, or gave to somebody else ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); });
  await coOpen(page, 'co-okafor');
  await page.evaluate(() => { CO.taskId = 'pt1'; coGo('repair'); });
  await page.waitForTimeout(400);
  check('D32: the repair is open on the phone', await page.locator('#coDone').count(), 1);
  await page.evaluate(() => { window.__MOCK_CO_REMOVED = 'pt1'; coLoadJob('co-okafor'); });
  await coFresh(page, 'co-okafor');
  check('…the office takes it off in JobTread: the screen says so, never "Loading…" for good',
    [await txt(page, '#coRepairGone'), await txt(page, '#coRepairGoneBack'), (await txt(page, '#coBody')).indexOf('Loading') === -1],
    ['This repair isn’t on the job any more — the office took it off in JobTread. Ask your PM if it still needs doing.', 'Back to the repairs', true]);
  await tap(page, '#coRepairGoneBack', 500);
  check('…Back goes to the repairs, and the one taken off is not on them', await page.evaluate(() => [CO.screen, !!document.querySelector('[data-corepair="pt1"]'), !!document.querySelector('[data-corepair="pt2"]')]),
    ['repairs', false, true]);
  check('…in Spanish too', await page.evaluate(() => { S.lang = 'es'; const w = co('repairGone'); S.lang = 'en'; return w; }),
    'Esta reparación ya no está en el trabajo — la oficina la quitó en JobTread. Pregúntale a tu PM si todavía hay que hacerla.');
  // Reopened: a Done this phone sent eleven minutes ago, listed open again.
  await page.evaluate(() => { window.__MOCK_CO_REMOVED = null; const v = coVisit('co-okafor'); v.doneTasks.pt2 = Date.now() - 11 * 60 * 1000; v.doneTasks.pt1 = Date.now() - 2 * 60 * 1000; coPersist(); coLoadJob('co-okafor'); });
  await coFresh(page, 'co-okafor');
  check('…a repair the office reopened lets the phone\'s Done go, so it reads open again; one done two minutes ago is kept for now',
    await page.evaluate(() => Object.keys(coVisit('co-okafor').doneTasks).sort()), ['pt1']);
  await page.evaluate(() => coGo('repairs'));
  await page.waitForTimeout(300);
  check('…and on the list it is open, not Done', await page.evaluate(() => [document.querySelector('[data-corepair="pt2"]').classList.contains('done'), document.querySelector('[data-corepair="pt2"]').disabled]), [false, false]);
  await page.evaluate(() => { const v = coVisit('co-okafor'); v.doneTasks.pt2 = 'queued'; coPersist(); coLoadJob('co-okafor'); });
  await coFresh(page, 'co-okafor');
  check('…a Done still waiting to send is the waiting list\'s, and is left alone', await page.evaluate(() => coVisit('co-okafor').doneTasks.pt2), 'queued');
  // Given to somebody else: whose it is, on the repair itself.
  await page.evaluate(() => { const v = coVisit('co-okafor'); delete v.doneTasks.pt2; coPersist(); const t = CO.job.punchTasks.filter((x) => x.id === 'pt2')[0]; t.mine = false; t.assigneeNames = ['Kenton McComas']; CO.taskId = 'pt2'; coGo('repair'); });
  await page.waitForTimeout(300);
  check('…a repair given to somebody else says whose it is now, before the work is done twice', [await txt(page, '#coRepairWho .rk'), await txt(page, '#coRepairWho .rv')], ['For', 'Kenton McComas']);
  check('no page errors (D32)', errs, []);
  await ctx.close();
}

// ---- D37: a camera photo carries the time it was taken ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  check('D37: a camera shot names itself and its time; one from the phone\'s photos its own; nothing known, nothing said',
    await page.evaluate(() => [coOrigin({ at: Date.UTC(2026, 10, 2, 14, 5) }), coOrigin({ fromPhone: true, takenAt: '2026-10-01T10:00:00.000Z', at: 5 }), coOrigin({})]),
    [{ source: 'camera', takenAt: '2026-11-02T14:05:00.000Z' }, { source: 'phone', takenAt: '2026-10-01T10:00:00.000Z' }, {}]);
  await coOpen(page, 'co-okafor');
  await page.evaluate(async () => {
    window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline'));
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
    await coAddPhoto({ kind: 'before', jobId: 'co-okafor', taskId: 'pt2' }, new File([b], 'b.jpg', { type: 'image/jpeg' }), null);
    await coAddPhoto({ kind: 'after', jobId: 'co-okafor', taskId: 'pt2' }, new File([b], 'a.jpg', { type: 'image/jpeg' }), null);
    const v = coVisit('co-okafor'); v.repairNote.pt2 = 'Reconnected the downspout'; v.repairEn.pt2 = { note: 'Reconnected the downspout', noteSrc: 'Reconnected the downspout', noteEn: 'Reconnected the downspout' }; coPersist();
    window.__AT = { b: v.before.pt2.at, a: v.after.pt2.at };
    await coFinishRepair('co-okafor', 'pt2');
  });
  const ph = await page.evaluate(() => coObAll().then((all) => all.filter((x) => x.kind === 'photo').map((x) => [x.payload.label, x.payload.source, x.payload.takenAt === new Date(x.payload.label === 'BEFORE' ? window.__AT.b : window.__AT.a).toISOString()])));
  check('…a repair\'s before and after photos, taken with no signal, carry the moment the phone kept them', ph, [['BEFORE', 'camera', true], ['AFTER', 'camera', true]]);
  await page.evaluate(() => { window.__CO = []; window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => (window.__CO || []).filter((x) => x.fn === 'coPhoto').length >= 2, null, { timeout: 15000 }).catch(() => {});
  check('…and the server is sent that time with each', await page.evaluate(() => (window.__CO || []).filter((x) => x.fn === 'coPhoto').map((x) => [x.photo.source, typeof x.photo.takenAt])), [['camera', 'string'], ['camera', 'string']]);
  check('no page errors (D37)', errs, []);
  await ctx.close();
}

// ---- D33: an N/A says why ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); });
  await coOpen(page, 'co-hartman');
  await page.evaluate(() => coGo('inspect'));
  await page.waitForTimeout(400);
  const k = await page.evaluate(() => CO_INSPECT[0].key), n = await page.evaluate(() => CO_INSPECT[0].n);
  await tap(page, `.ans[data-key="${k}"] .na`, 500);
  check('D33: N/A asks why, under the line, and puts the cursor there',
    [await txt(page, '.conawhy .k'), await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-nawhy'))], ['Why it doesn’t apply — required', k]);
  check('…Review & send waits on it, saying which line', await page.evaluate(() => coBlockersCtx(coCtx()).map((b) => b.t).filter((t) => /doesn’t apply/.test(t))), [`Say why line ${n} doesn’t apply`]);
  await page.locator('.conawhy input').fill('No chimney on this roof');
  check('…typed, it is kept on the phone and no longer holds up the send',
    await page.evaluate((key) => [coVisit('co-hartman').naWhy[key], coBlockersCtx(coCtx()).some((b) => /doesn’t apply/.test(b.t))], k), ['No chimney on this roof', false]);
  // The rest answered, the site photos and the final notes in: the review, then the send.
  await page.evaluate((key) => { const v = coVisit('co-hartman'); CO_INSPECT.forEach((i) => { if (i.key !== key) v.answers.inspection[i.key] = 'OK'; }); CO_CLEAN.forEach((i) => { v.answers.cleanup[i.key] = 'OK'; }); coPersist(); }, k);
  await page.evaluate(async () => {
    for (let i = 0; i < 9; i++) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
      const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
      await coAddPhoto({ kind: 'visit', jobId: 'co-hartman' }, new File([b], 's' + i + '.jpg', { type: 'image/jpeg' }));
    }
    const v = coVisit('co-hartman'); v.fin = { note: 'Site left clean.' }; coPersist(); coGo('send');
  });
  await page.waitForTimeout(500);
  await tap(page, '[data-rvtoggle="sec:inspection"]', 400);
  const line = await page.evaluate((code) => { const r = [...document.querySelectorAll('#coBody .rvi')].filter((x) => x.querySelector('.n').textContent === code)[0]; return r ? [r.querySelector('.nawhy').textContent, r.querySelector('.a').textContent] : null; }, n);
  check('…the review shows the reason beside N/A', line, ['No chimney on this roof', 'N/A']);
  await page.evaluate(() => { window.__CO = []; });
  await tap(page, '#coSend', 3500);
  const sent = await page.evaluate(() => ((window.__CO || []).find((x) => x.fn === 'coClose') || {}).visit);
  check('…and the close carries it, by the line\'s key, as typed', sent && sent.naReasons, { [k]: 'No chimney on this roof' });
  check('…an N/A with no reason sends no reason field; nothing N/A, no field at all',
    await page.evaluate((key) => [coNaReasons(coForm('co-hartman'), { inspection: { [key]: 'N/A' } }, {}), coNaReasons(coForm('co-hartman'), { inspection: { [key]: 'OK' } }, { [key]: 'x' })], k), [null, null]);
  check('…the words in Spanish', await page.evaluate(() => { S.lang = 'es'; const w = [co('naWhyK'), co('whyNa').replace('{n}', '6')]; S.lang = 'en'; return w; }), ['Por qué no aplica', 'Di por qué no aplica la línea 6']);
  check('no page errors (D33)', errs, []);
  await ctx.close();
}
// The gutters' own checklist sends its reasons too.
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';window.__MOCK_CO_AREAS=true;window.__MOCK_CO_AREA_FORMS=true;");
  await coOpen(page, 'co-mason');
  const item = await page.evaluate(() => { CO.areaKey = 'gutters'; coGo('area'); const f = coCtx().form; return f.sections[0].items[5].key; });
  await page.evaluate(async (key) => {
    window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline'));
    const ctx = coCtx(); ctx.form.sections.forEach((x) => { ctx.answers[x.key] = ctx.answers[x.key] || {}; x.items.forEach((i) => { ctx.answers[x.key][i.key] = i.key === key ? 'N/A' : 'OK'; }); });
    ctx.naWhy[key] = 'No guards were sold'; coPersist();
    await coSendArea('co-mason', 'gutters');
  }, item);
  const area = await page.evaluate(() => coObAll().then((all) => (all.find((x) => x.kind === 'area') || {}).payload));
  check('D33: the gutters\' close carries its N/A reason the same way', area && area.naReasons, { [item]: 'No guards were sold' });
  check('no page errors (D33, gutters)', errs, []);
  await ctx.close();
}

// ---- the contract level: what the phone needs, read from the page (the T2.30
// lesson — a level pinned here failed on the next build that raised it) ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(900);
  const need = await page.evaluate(() => CO_CONTRACT_NEED);
  check('the phone needs Close Out contract 3 or more, and the mock server at that level raises no warning', [need >= 3, await page.locator('#verWarn').isHidden()], [true, true]);
  await page.evaluate((n) => { window.__MOCK_BUILDS = { api: APP_BUILD, closeOut: { configured: true, ok: true, build: { on: 'vercel', commit: 'eb84c5a' }, deployed: 'eb84c5a', contract: n - 1 } }; return loadBuilds(); }, need);
  await page.waitForTimeout(300);
  check('…a server one level behind is called behind, in words that say what to deploy',
    [await page.locator('#verWarn').isVisible(), (await txt(page, '#verWarn')).indexOf(`The Close Out server is older than this app needs (contract ${need - 1}, needs ${need}). Deploy DB CheckOut’s main.`) > -1], [true, true]);
  check('no word added twice with different words (T2.34)', await page.evaluate(() => I18N_CLASH), []);
  check('no page errors (contract)', errs, []);
  await ctx.close();
}

await browser.close();
let pass = 0;
for (const r of results) {
  console.log((r.pass ? '  ok  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n        got:  ${JSON.stringify(r.actual)}\n        want: ${JSON.stringify(r.expected)}`));
  if (r.pass) pass++;
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
