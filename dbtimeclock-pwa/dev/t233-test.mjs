/* T2.33 (2 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t233-test.mjs
 *
 * Step 1 of the second audit (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr),
 * the phone's half. Records first: a block left open from a day before is
 * closed at the time they say, never "now" (D21); signed out means waiting,
 * and a clock-in kept on a shared phone waits for whoever made it (D24); an
 * inspection the server did not record is never cleared as sent (D22); a
 * repair JobTread no longer has is said, and one stuck item holds back only
 * its own job (D23); "your PM is told" only when they were (D26); Started
 * earlier never shortens a break (D27); a clock that already ended elsewhere
 * is said, not clocked out of again (D29); Send is saved at the tap (D34);
 * sign-out names unsent work before it erases it (D35); a line added to a
 * sent day log waits and retries (D36). The server halves are
 * apps-script/code-test.mjs and DB CheckOut's test/routes.test.ts. */
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
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const calls = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CLOCK || [])));
const settle = (page) => page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 15000 }).catch(() => {});
const toastText = (page) => txt(page, '#toast span');
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const clockIn = async (page) => { await tap(page, '#clockIn', 300); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page); };
const closeSheets = (page) => page.evaluate(() => { if (S.sheet) closeSheet(); }).then(() => page.waitForTimeout(250));

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

// ---- D21: the morning after ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_YESTERDAY=true;window.__MOCK_ROLE='crew';");
  const day = await page.evaluate(() => dayWords(new Date(S.open.startedAt)));
  check('D21: a block still open from a day before dims the clock buttons, and the line under them says why',
    [await page.evaluate(() => document.getElementById('runStack').classList.contains('wait')), await txt(page, '#stopFoot')],
    [true, `Say when you left on ${day} first. The buttons wait until then.`]);
  check('…the band says the day it started, not only the time', (await txt(page, '#bandSub')).startsWith(`Started ${day}, 7:02a`), true);
  await page.evaluate(() => { S.lang = 'es'; render(); });
  check('…and in Spanish', (await txt(page, '#bandSub')).startsWith(`Empezó el ${await page.evaluate(() => dayWords(new Date(S.open.startedAt)))} a las 7:02a`), true);
  await page.evaluate(() => { S.lang = 'en'; render(); });
  const asked = [];
  for (const b of ['#outBtn', '#breakBtn', '#codeBtn', '#leaveBtn', '#pickJobBtn']) {
    await closeSheets(page);
    await tap(page, b, 400);
    asked.push(await page.evaluate(() => [S.sheet, S.leftGate]));
  }
  check('…Clock out, Break, Change code, Leave and Change job each ask when they left that day, first', asked, Array(5).fill(['left', 'overnight']));
  check('…and none of them wrote anything', (await calls(page)).length, 0);
  // The time is read on the day the block began, and since T2.43 (Carl, 6 Nov
  // 2026: "no overnight work allowed") never rolls into the next morning: from
  // 7:02a, "17:30" is 5:30p that day, "23:59" the latest, and "01:00" is 1am
  // that same day — before the block began, so not a time it can end.
  check('…a time is read on the day the block began, never the next morning (T2.43: no overnight work)',
    await page.evaluate(() => {
      const b = new Date(S.open.startedAt), at = (h, m) => { const d = new Date(b); d.setHours(h, m, 0, 0); return d.getTime(); };
      return [leftFromInput('17:30') === at(17, 30), leftOk(leftFromInput('23:59')), leftFromInput('01:00') === at(1, 0), leftOk(leftFromInput('01:00')), leftOk(at(23, 59) + 2 * 60e3)];
    }), [true, true, true, false, false]);
  check('…and the sheet says so', /by 11:59p\. No work past midnight\./.test(await txt(page, '#sheetBody')), true);
  await page.locator('#leftTime').fill('17:30'); await page.waitForTimeout(200);
  check('…the button says the time back', await txt(page, '#leftGo'), 'I left at 5:30p');
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 }).catch(() => {});
  const c = (await calls(page)).slice(-1)[0] || [];
  const want = await page.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(17, 30, 0, 0); return y.getTime(); });
  check('…out at 5:30p that day — a clock-out, not a 24-hour block', [c[0], Date.parse(c[1]) === want, c[2]], ['leftSite', true, 'out']);
  check('…and the toast says the PM and the Ops Director were told, because they were', await toastText(page), 'Clocked out at 5:30p · your PM and the Ops Director are told');
  check('…the buttons are buttons again', await page.evaluate(() => document.getElementById('runStack').classList.contains('wait')), false);
  check('no page errors (D21)', errs, []);
  await ctx.close();
}
{
  // The phone thought the block was today's; the API says it began yesterday.
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=20;window.__MOCK_ROLE='crew';");
  await page.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(7, 2, 0, 0); window.__MOCK_ST.open.startedAt = y.toISOString(); window.__CLOCK = []; });
  await tap(page, '#breakBtn', 400); await tap(page, '[data-brk="15"]', 300);
  await page.waitForFunction(() => S.sheet === 'left', null, { timeout: 10000 }).catch(() => {});
  check('D21: the API refuses a break on a block from a day before, and the phone reads the clock again and asks when they left',
    await page.evaluate(() => [S.sheet, S.leftGate, isoLocal(new Date(S.open.startedAt)) < isoLocal(), (window.__CLOCK || []).map((x) => x[0])]),
    ['left', 'overnight', true, ['startBreak']]);
  check('no page errors (D21, the API says so)', errs, []);
  await ctx.close();
}
{
  // A clock-in kept with no signal meets a block from a day before.
  const { ctx, page, errs } = await boot('');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__CLOCK = []; });
  await clockIn(page);
  const keptAt = await page.evaluate(() => clockQ[0] && clockQ[0].at);
  // Meanwhile JobTread has a block open since yesterday (another phone, or the office).
  await page.evaluate(() => { const st = window.__MOCK_ST, y = new Date(); y.setDate(y.getDate() - 1); y.setHours(7, 2, 0, 0);
    st.open = { id: 'oy2', startedAt: y.toISOString(), endedAt: null, minutes: 0, notes: '', job: JSON.parse(JSON.stringify(S.job)), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' } };
    st.entries = [st.open].concat(st.entries);
    window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => S.sheet === 'left' && clockQ[0] && clockQ[0].stale, null, { timeout: 15000 }).catch(() => {});
  check('D21 + I1: a kept clock-in that meets yesterday\'s block waits, and When did you leave? opens — never the clock-in sheet in its place',
    await page.evaluate(() => [clockQ.length, !!clockQ[0].stale, S.sheet, S.leftGate, S.open && S.open.id]), [1, true, 'left', 'overnight', 'oy2']);
  await closeSheets(page);
  check('…its notice says what it waits for', /^Your \d+:\d\d[ap] clock-in goes once you say when you left the day before$/.test(await page.evaluate(() => (nudgeItems().filter((n) => n.kind === 'clockq')[0] || {}).text)), true);
  await page.evaluate(() => openSheet('clockq')); await page.waitForTimeout(250);
  check('…its own sheet says so too, and its button asks the question', [/It waits until you say when you left the day before/.test(await txt(page, '#sheetBody')), await txt(page, '#cqLeft')], [true, 'When did you leave?']);
  await tap(page, '#cqLeft', 300);
  check('…which opens When did you leave?', await page.evaluate(() => [S.sheet, S.leftGate]), ['left', 'overnight']);
  await page.evaluate(() => cqSend());
  check('…while it waits, it is not sent again', await page.evaluate(() => (window.__CLOCK || []).filter((x) => x[0] === 'clockIn').length), 1);
  await page.locator('#leftTime').fill('16:30'); await page.waitForTimeout(200);
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !clockQ.length && S.open && !S.open.kept, null, { timeout: 15000 }).catch(() => {});
  const s = await page.evaluate((keptAt) => ({ calls: (window.__CLOCK || []).map((x) => x[0]), open: S.open && S.open.id, at: S.open && S.open.startedAt,
    made: window.__MOCK_ST.entries.filter((e) => Math.abs(Date.parse(e.startedAt) - keptAt) < 3000).length }), keptAt);
  check('…said: yesterday ends at 4:30p, then the clock-in goes, starting when it was made — one entry',
    [s.calls, /^open\d+$/.test(s.open || ''), Math.abs(Date.parse(s.at) - keptAt) < 3000, s.made], [['clockIn', 'leftSite', 'clockIn'], true, true, 1]);
  check('no page errors (D21 + I1)', errs, []);
  await ctx.close();
}

// ---- D29: a clock that already ended elsewhere ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=25;window.__MOCK_ROLE='crew';");
  // The office ends it in JobTread; the phone still shows it running.
  await page.evaluate(() => { const st = window.__MOCK_ST; st.open.endedAt = new Date().toISOString(); st.open = null; window.__CLOCK = []; });
  await tap(page, '#codeBtn', 500);
  await page.locator('.coderow:not(.on)').first().click();
  await page.waitForFunction(() => !S.open, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('D29: a code change on a clock ended elsewhere is refused, and the phone says so and shows the clock off',
    [await page.evaluate(() => [!!S.open, (window.__CLOCK || []).map((x) => x[0])]), await toastText(page)],
    [[false, ['switchCode']], 'Your clock was already ended elsewhere — you’re off the clock now.']);
  check('no page errors (D29, change code)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=25;window.__MOCK_ROLE='crew';");
  await page.evaluate(() => { const st = window.__MOCK_ST; st.open.endedAt = new Date().toISOString(); st.open = null; window.__CLOCK = []; });
  await tap(page, '#outBtn', 400); await tap(page, '[data-leave="out"]', 700);
  if (await page.evaluate(() => S.tab === 'cam')) { await shoot(page); }
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('D29: clocking out of a clock ended elsewhere says so, rather than "sent to JobTread"',
    [await page.evaluate(() => [!!S.open, (window.__CLOCK || []).map((x) => x[0])]), await toastText(page)],
    [[false, ['clockOut']], 'Your clock was already ended elsewhere — you’re off the clock now.']);
  check('no page errors (D29, clock out)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=25;window.__MOCK_ROLE='crew';");
  await page.evaluate(() => { const st = window.__MOCK_ST; st.open.endedAt = new Date().toISOString(); st.open = null; });
  // Back to the front: read again (at most every two minutes).
  await page.evaluate(() => { CLOCK_REREAD.at = 0; return clockReread(false); });
  await page.waitForTimeout(300);
  check('D29: coming back to the app reads the clock again, and an ended clock is said at once', [await page.evaluate(() => !!S.open), await toastText(page)],
    [false, 'Your clock was already ended elsewhere — you’re off the clock now.']);
  await page.evaluate(() => { window.__GETSTART = (window.__RIDS || []).filter((x) => x[0] === 'getStart').length; return clockReread(false); });
  check('…and not again inside two minutes', await page.evaluate(() => (window.__RIDS || []).filter((x) => x[0] === 'getStart').length - window.__GETSTART), 0);
  check('…Back to work with nothing open is refused, not a fresh clock-in',
    await page.evaluate(() => apiCall('endBreak', [S.job.id, 'ci9']).then(() => 'went', (e) => [!!e.notOn, /^NOT_ON_CLOCK/.test(e.message)])), [true, true]);
  check('no page errors (D29, the front)', errs, []);
  await ctx.close();
}

// ---- D27: Started earlier never shortens a break ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=5;window.__MOCK_ROLE='crew';window.__MOCK_FIX={entries:function(){return [];}};");
  check('D27: an ordinary block just begun offers Started earlier', [await page.evaluate(() => !!earlierBlock()), await page.locator('#earlierBtn').isVisible()], [true, true]);
  // The same job and code ended 30 minutes before it began: a break.
  await page.evaluate(() => { const o = S.open, began = Date.parse(o.startedAt);
    S.entries = [o, { id: 'b1', job: o.job, code: o.code, startedAt: new Date(began - 95 * 60e3).toISOString(), endedAt: new Date(began - 30 * 60e3).toISOString(), minutes: 65, notes: '' }]; render(); });
  check('D27: the block a 30-minute break planned offers no Started earlier', [await page.evaluate(() => [afterBreakBlock(S.open), earlierBlock()]), await page.locator('#earlierBtn').isVisible()], [[true, null], false]);
  await page.evaluate(() => { S.entries[1].endedAt = new Date(Date.parse(S.open.startedAt) - 7 * 60e3).toISOString(); render(); });
  // A 7-minute gap is no break the Break button took — but since T2.43 any
  // earlier block today means the time before this one was off the clock, so
  // Started earlier is the day's first clock-in's only (Carl, 6 Nov 2026).
  check('…a gap no break is (7 minutes) is not a planned break, and since T2.43 offers no Started earlier either',
    [await page.evaluate(() => [afterBreakBlock(S.open), earlierBlock()]), await page.locator('#earlierBtn').isVisible()], [[false, null], false]);
  await page.evaluate(() => { S.brk = { entryId: S.open.id }; render(); });
  check('…nor does the block the phone itself saw a break plan', [await page.evaluate(() => [afterBreakBlock(S.open), earlierBlock()]), await page.locator('#earlierBtn').isVisible()], [[true, null], false]);
  // The API's half: its own record of the block the break planned.
  await page.evaluate(() => { window.__MOCK_ST.brkId = window.__MOCK_ST.open.id; });
  check('…and the API refuses it too, in words',
    await page.evaluate(() => apiCall('startedEarlier', [new Date(Date.parse(S.open.startedAt) - 15 * 60e3).toISOString()]).then(() => 'moved', (e) => /cannot shorten a break/.test(e.message))), true);
  check('no page errors (D27)', errs, []);
  await ctx.close();
}

// ---- D26: told only when they were ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_KEEP_CLOCK=true;window.__MOCK_AWAY='far';window.__MOCK_NOTICEFAIL=true;window.__MOCK_FIX={entries:function(){return [];}};");
  await tap(page, '#shopBtn', 400); await settle(page);
  check('D26: away from the shop and the notice could not be made: in all the same, and the phone says to tell the PM',
    [await page.evaluate(() => S.open && S.open.code && S.open.code.number), await toastText(page)], ['99TM-1', 'Not at the shop or the office · your PM couldn’t be told — tell them yourself']);
  check('no page errors (D26, morning)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_YESTERDAY=true;window.__MOCK_ROLE='crew';window.__MOCK_NOTICEFAIL=true;");
  await tap(page, '#outBtn', 400);
  await page.locator('#leftTime').fill('17:30'); await page.waitForTimeout(200);
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 }).catch(() => {});
  check('D26: When did you leave? with the notice failing says so', await toastText(page), 'Clocked out at 5:30p · your PM couldn’t be told — tell them yourself');
  check('no page errors (D26, left)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_OPEN_AGO=5;window.__MOCK_ROLE='crew';window.__MOCK_NOTICEFAIL=true;window.__MOCK_FIX={entries:function(){return [];}};");
  await tap(page, '#earlierBtn', 400);
  await tap(page, '#sheetBody [data-earlier]', 200);
  const t = await page.evaluate(() => clockLabel(new Date(S.earlierPick)));
  await tap(page, '#earlierGo', 300);
  await page.waitForFunction(() => document.body.style.pointerEvents === '' && /Started earlier/.test(S.open.notes || ''), null, { timeout: 10000 }).catch(() => {});
  check('D26: Started earlier with the notice failing says so', await toastText(page), `Your block starts at ${t} now · your PM couldn’t be told — tell them yourself`);
  // The words for every place check, from the answers Code.gs sends.
  const said = await page.evaluate(() => {
    const out = [];
    const say = (m, o) => { document.querySelector('#toast span').textContent = '—'; placeCheckToast(m, o); out.push(document.querySelector('#toast span').textContent); };
    say({ ok: false, where: 'about 12 miles from the shop on Monroe St', notice: { ok: true } }, true);
    say({ ok: false, where: 'about 12 miles from the shop on Monroe St', notice: { ok: false } }, true);
    say({ ok: false, where: 'with no location from the phone', notice: { ok: false } }, false);
    say({ ok: null, error: 'Pave timed out' }, false);   // T2.33: the check itself failed — nothing claimed
    say({ ok: false, error: 'Pave timed out' }, false);  // an older API's way of saying the same
    say({ ok: false, quiet: true }, false);              // a partner's half: the other phone says it
    return out;
  });
  check('D26: each place check says what happened to the notice, and nothing when the check itself failed', said, [
    'Clocked out away from the shop · your PM and the Ops Director are told',
    'Clocked out away from the shop · your PM couldn’t be told — tell them yourself',
    'No location from the phone · your PM couldn’t be told — tell them yourself',
    '—', '—', '—']);
  await page.evaluate(() => { S.lang = 'es'; });
  check('…in Spanish on a Spanish phone', await page.evaluate(() => [toldWords({ ok: true }), toldWords({ ok: false }), toldWords(null)]),
    [' · se le avisa a tu PM y al Director de Operaciones', ' · no se pudo avisar a tu PM — avísale tú', '']);
  check('no page errors (D26, earlier and the words)', errs, []);
  await ctx.close();
}

// ---- D24: signed out means waiting; a kept clock-in is its maker's ----
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
{
  const { ctx, page, errs } = await boot('');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await clockIn(page);
  await queuePhoto(page, { id: 'p-exp', at: Date.now() - 60e3 });
  await page.evaluate(() => {
    rollStore[S.job.id + '|' + isoLocal()] = { forgot: { args: [S.job.id, 'Webster', ['Tarps checked']], rid: 'rtest-roll-0233', tries: 0 } }; rollPersist();
    return coEnqueue([{ id: 'cot-exp', kind: 'complete', jobId: 'co-okafor', taskId: 'pt1', label: 'Repair done', payload: { note: 'Boot replaced' } }]);
  });
  // The session has run out by the time there is signal again.
  await page.evaluate(() => { window.__MOCK_EXPIRED = true; window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => clockQ[0] && /sign in again/.test(clockQ[0].err || ''), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.all([rollFlush(), new Promise((r) => { pump(); setTimeout(r, 800); }), coRefreshOutbox()]));
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => coObAll().then((co) => ({
    cq: [clockQ.length, clockQ[0].tries, !!clockQ[0].refused, clockQ[0].err],
    roll: (function(w){ return [w.tries, !w.refused, w.next > Date.now() + 30e3]; })(rollStore[S.job.id + '|' + isoLocal()].forgot),
    photo: !qRetry['p-exp'],
    co: co.filter((x) => x.id === 'cot-exp').map((x) => [x.status, x.tries || 0, x.err])[0],
    gate: !document.getElementById('gate').classList.contains('hidden') })));
  check('D24: signed out, the kept clock-in waits for the sign-in — not counted as a try, never refused', s.cq, [1, 0, false, 'Waiting for you to sign in again']);
  check('…so does the roll-out note, a minute at a time and uncounted', s.roll, [0, true, true]);
  check('…a photo is not counted as failing', s.photo, true);
  check('…nor a Close Out item, which says what it is waiting for', s.co, ['queued', 0, 'Waiting for you to sign in again']);
  check('…and the sign-in screen is up', s.gate, true);
  check('no page errors (D24, signed out)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('');
  // Alberto clocked in with no signal on this phone, then signed out; Tyler is signed in now.
  await page.evaluate(() => { const at = new Date(); at.setHours(6, 50, 0, 0);
    clockQ.push({ rid: 'rtest-other-0233', kind: 'in', jobId: S.job.id, costItemId: 'ci9', coords: null, startPhotoId: '', opts: {}, at: at.getTime(),
      job: cqJobSnap(S.job), code: { id: 'ci9', number: '04MA', name: 'Masonry Labor' }, partner: false, tries: 0, next: 0,
      owner: 'alberto@deitemeyerbrothers.com', ownerName: 'Alberto Gonzalez' });
    cqPersist(); window.__CLOCK = []; render(); return cqSend(); });
  await queuePhoto(page, { id: 'p-alberto', at: Date.now() - 90 * 60e3, extra: { waitRid: 'rtest-other-0233' } });
  await page.evaluate(() => qCount().then(render));
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({ mine: cqWaiting(), others: cqOthers().length, sent: (window.__CLOCK || []).length, open: !!S.open,
    nudge: (nudgeItems().filter((n) => /Alberto/.test(n.text || ''))[0] || {}).text, waiting: obWaiting().parts.map((p) => p.key) }));
  check('D24: a clock-in another person kept on this phone is never sent as the signed-in person\'s, nor shown as their clock',
    [s.mine, s.others, s.sent, s.open], [null, 1, 0, false]);
  check('…a notice says whose it is', s.nudge, 'Alberto Gonzalez’s 6:50a clock-in waits for them to sign in on this phone');
  check('…it and its start photo are not counted as this person\'s to send, so they can still sign out', s.waiting, []);
  await page.evaluate(() => setTab('diag'));
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('…sign-out says it stays for them', (await txt(page, '#signOutFoot')).endsWith('Alberto Gonzalez’s 6:50a clock-in stays on this phone and goes when they sign in.'), true);
  await page.locator('#signOutBtn').click();
  await page.waitForFunction(() => !document.getElementById('gate').classList.contains('hidden') && typeof idbAll === 'function', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const kept = await page.evaluate(() => idbAll().then((q) => [JSON.parse(localStorage.getItem('dbtc_clockq') || '[]').map((x) => [x.rid, x.owner]), q.map((x) => x.id)]));
  check('…and signed out, the phone still holds Alberto\'s clock-in and its photo for when he signs in', kept,
    [[['rtest-other-0233', 'alberto@deitemeyerbrothers.com']], ['p-alberto']]);
  check('no page errors (D24, whose)', errs, []);
  await ctx.close();
}

// ---- D22 and D23: the Close Out waiting list ----
const coDrain = (page) => page.waitForFunction(() => !CO.pumping, null, { timeout: 15000 }).then(() => page.waitForTimeout(300));
const coItems = (page) => page.evaluate(() => coObAll().then((items) => items.map((x) => ({ id: x.id, status: x.status, tries: x.tries || 0, err: x.err || '', next: !!(x.next && x.next > Date.now()) }))));
const coCalls = (page) => page.evaluate(() => (window.__CO || []).filter((x) => x.fn === 'coComplete' || x.fn === 'coClose').map((x) => x.fn === 'coClose' ? 'close:' + x.jobId : x.taskId));
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); render(); window.__MOCK_CO_NOTASK = true; window.__CO = [];
    return coEnqueue([{ id: 'cot-close', kind: 'close', jobId: 'co-hartman', label: 'Inspection + Cleanup', payload: { form: 'roof', answers: {}, notes: {}, findings: [], problemsReported: 0 } }]); });
  await coDrain(page);
  let it = (await coItems(page)).find((x) => x.id === 'cot-close');
  check('D22: an inspection the server answered without naming its task is kept, never cleared as sent',
    [it && it.status, it && it.err], ['rejected', 'Not recorded — this job has no Final inspection task in JobTread. Ask the office to add it, then tap Retry. Your answers are kept on this phone.']);
  check('…with Retry and Discard beside it', await page.evaluate(() => [/data-coretry="cot-close"/.test(coOutboxHtml()), /data-codiscard="cot-close"/.test(coOutboxHtml())]), [true, true]);
  await page.evaluate(() => { window.__MOCK_CO_NOTASK = false; coRetryNow('cot-close'); });
  await page.waitForTimeout(400); await coDrain(page);
  check('…Retry once the task is there: it goes, and leaves the list', (await coItems(page)).filter((x) => x.id === 'cot-close').length, 0);

  // One job's stuck repair holds back only its own job.
  await page.evaluate(() => { window.__MOCK_CO_502 = 'pt1'; window.__CO = [];
    return coEnqueue([
      { id: 'cot-a1', kind: 'complete', jobId: 'co-okafor', taskId: 'pt1', label: 'Repair done', payload: { note: 'Boot replaced' } },
      { id: 'cot-a2', kind: 'complete', jobId: 'co-okafor', taskId: 'pt2', label: 'Repair done', payload: { note: 'Downspout reconnected' } },
      { id: 'cot-b1', kind: 'complete', jobId: 'co-lane', taskId: 'pt20', label: 'Repair done', payload: { note: 'Ridge vent nails reset' } }]); });
  await coDrain(page);
  let items = await coItems(page);
  check('D23: a repair JobTread keeps refusing waits with its own next try, and holds back the rest of its job',
    [await coCalls(page), items.filter((x) => x.id.indexOf('cot-a') === 0).map((x) => [x.id, x.status, x.tries, x.next])],
    [['pt1', 'pt20'], [['cot-a1', 'queued', 1, true], ['cot-a2', 'queued', 0, false]]]);
  check('…while another job\'s repair goes', items.filter((x) => x.id === 'cot-b1').length, 0);
  check('…Discard is not offered after one failure', await page.evaluate(() => /data-codiscard="cot-a1"/.test(coOutboxHtml())), false);
  await page.evaluate(() => coObAll().then((all) => { const x = all.find((i) => i.id === 'cot-a1'); x.tries = 3; return coObPut(x); }).then(coRefreshOutbox));
  check('…after three it is, so nothing can hold the phone hostage', await page.evaluate(() => [/data-codiscard="cot-a1"/.test(coOutboxHtml()), /data-coretry="cot-a1"/.test(coOutboxHtml())]), [true, true]);
  // Then JobTread answers that it is gone.
  await page.evaluate(() => { window.__MOCK_CO_502 = null; window.__MOCK_CO_GONE = 'pt1'; window.__CO = []; coRetryNow('cot-a1'); });
  await page.waitForTimeout(400); await coDrain(page);
  items = await coItems(page);
  check('D23: a repair JobTread no longer has is said in words, kept for Discard, and the rest of its job goes',
    [await coCalls(page), items.map((x) => [x.id, x.status, x.err])],
    [['pt1', 'pt2'], [['cot-a1', 'rejected', 'Not in JobTread any more — it was taken off or moved. Ask your PM, then Discard.']]]);
  await page.evaluate(() => { coDiscard('cot-a1'); });
  await page.waitForTimeout(400);
  check('…Discard takes it off the list', (await coItems(page)).length, 0);
  check('no page errors (D22, D23)', errs, []);
  await ctx.close();
}

// ---- D34: Send is saved at the tap ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  // A Spanish note, with no signal: it is saved at once, as said, its English still to come.
  await page.evaluate(() => {
    S.lang = 'es'; S.langSet = true; savePrefs();
    window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline'));
    window.coToEnglish = function (r) { return new Promise(function (res) { setTimeout(function () { r.noteSrc = String(r.note || '').trim(); r.noteEn = 'Replaced the cracked boot and sealed it'; res(); }, 300); }); };
    const v = coVisit('co-okafor'); v.repairNote.pt1 = 'Cambié la bota rota y la sellé'; coPersist();
    window.__T0 = Date.now(); return coFinishRepair('co-okafor', 'pt1').then(function () { window.__T1 = Date.now(); });
  });
  const saved = await page.evaluate(() => coObAll().then((all) => all.filter((x) => x.kind === 'complete').map((x) => [x.taskId, x.payload.note, x.enFix && x.enFix.field, x.enFix && x.enFix.said])));
  check('D34: Done on a repair is saved on the phone at the tap — not after up to 8 seconds waiting on the English',
    [saved, await page.evaluate(() => window.__T1 - window.__T0 < 2000)], [[['pt1', 'Cambié la bota rota y la sellé', 'repair', 'Cambié la bota rota y la sellé']], true]);
  await page.evaluate(() => { window.__CO = []; window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => (window.__CO || []).some((x) => x.fn === 'coComplete'), null, { timeout: 15000 }).catch(() => {});
  check('…its English is fetched as it goes, and JobTread gets both',
    await page.evaluate(() => ((window.__CO || []).find((x) => x.fn === 'coComplete') || {}).note), 'Replaced the cracked boot and sealed it\n\n(Cambié la bota rota y la sellé)');
  // A whole send goes into the list in one transaction.
  const one = await page.evaluate(() => { let n = 0; const real = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (s, m) { if (m === 'readwrite' && String(s) === 'co') n++; return real.apply(this, arguments); };
    window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline'));
    return coEnqueue([1, 2, 3, 4].map((i) => ({ id: 'cot-batch' + i, kind: 'photo', jobId: 'co-hartman', photoId: 'x' + i, label: 'Photo', payload: {} })))
      .then(() => { IDBDatabase.prototype.transaction = real; return n; }); });
  check('…and a send of four items is written in one transaction, so a phone shut half way never keeps half a visit', one, 1);
  check('no page errors (D34)', errs, []);
  await ctx.close();
}

// ---- D35: sign-out names what it would erase ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => coLoadQueue(true));
  await page.waitForFunction(() => (CO.jobs || []).length > 0, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const v = coVisit('co-hartman'); v.answers.inspection = { a: 'ok' }; coPersist();
    const e = dlTouch(S.job.id, isoLocal(), dlInfoFor(S.job.id)); e.story = 'Tore off the back slope and dried it in.'; dlPersist();
    setTab('diag');
  });
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  const num = await page.evaluate(() => dlGet(S.job.id, isoLocal()).jobNum);
  check('D35: sign-out names an inspection in progress and a day log not sent before it erases them',
    [await txt(page, '#signOutBtn'), await txt(page, '#signOutFoot')],
    ['Tap again to erase them and sign out', `Not sent, and erased if you sign out now: Close Out work at 26-0418, the day log for ${num}. Send them first, or tap again to erase them.`]);
  check('no page errors (D35)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='crew';");
  await page.evaluate(() => setTab('diag'));
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('D35: with nothing unsent, sign-out reads as it always did', [await txt(page, '#signOutBtn'), /^This phone forgets /.test(await txt(page, '#signOutFoot'))], ['Tap again to sign out', true]);
  check('no page errors (D35, nothing)', errs, []);
  await ctx.close();
}

// ---- D36: a line added to a sent day log waits and retries ----
{
  const { ctx, page, errs } = await boot('');
  await page.evaluate(() => { const e = dlTouch(S.job.id, isoLocal(), dlInfoFor(S.job.id)); e.story = 'Dried in the back slope.'; e.sent = { id: 'dlX', at: Date.now() }; e.notes = []; dlPersist(); });
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); window.__LOGNOTES = []; dlAddLater(S.job.id, isoLocal(), 'Two boxes of staples back to the shop'); });
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => { const n = dlGet(S.job.id, isoLocal()).notes[0]; return [n.pending, !!n.rid, dlLaterWaiting().length, obWaiting().parts.map((p) => p.key), (window.__LOGNOTES || []).length]; });
  check('D36: a line added with no signal is kept as waiting, with its id, and counted with the day logs', s, [true, true, 1, ['log'], 0]);
  await page.evaluate(() => { S.dlJobId = S.job.id; setTab('log'); });
  await page.waitForTimeout(400);
  check('…the sent log shows it as not sent yet, not as part of the log', /Two boxes of staples back to the shop · not sent yet/.test(await txt(page, '#dlBody')), true);
  // Its answer lost once: tried again with the same id, and one line lands.
  await page.evaluate(() => { window.__MOCK_NONET = false; window.__MOCK_LOSTREPLY = 1; window.__RIDS.length = 0; window.dispatchEvent(new Event('online')); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { dlLaterWaiting().forEach((x) => { x.n.next = 0; }); return dlLaterFlush(); });
  await page.waitForTimeout(400);
  s = await page.evaluate(() => { const n = dlGet(S.job.id, isoLocal()).notes[0]; const r = window.__RIDS.filter((x) => x[0] === 'addDailyLogNote').map((x) => x[1]);
    return [n.pending, (window.__LOGNOTES || []).length, r.length >= 2 && r.every((x) => x === n.rid), dlLaterWaiting().length]; });
  check('…signal back: it goes, a lost answer is tried again with the same id, and JobTread gets the line once', s, [false, 1, true, 0]);
  // Refused by the API: kept, and said.
  await page.evaluate(() => { const f = window.fetch;
    window.fetch = function (u, o) { const b = String(u).includes('mock.local/exec') ? JSON.parse(o.body) : {};
      if (b.fn === 'addDailyLogNote') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ ok: false, error: 'That daily log is not on this job.' })) });
      return f(u, o); };
    dlAddLater(S.job.id, isoLocal(), 'And the ladder'); });
  await page.waitForTimeout(600);
  s = await page.evaluate(() => { const n = dlGet(S.job.id, isoLocal()).notes[1]; return [n.pending, !!n.refused, dlLaterWaiting().length]; });
  check('…one the API refuses is kept, not retried for ever', s, [true, true, 0]);
  await page.evaluate(() => renderDayLog()); await page.waitForTimeout(200);
  check('…and the log says to tell the office', /And the ladder · not added — tell the office/.test(await txt(page, '#dlBody')), true);
  check('no page errors (D36)', errs, []);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${failed.length ? results.length - failed.length : results.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
