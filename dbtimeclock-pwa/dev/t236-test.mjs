/* T2.36 (2 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t236-test.mjs
 *
 * Step 3 of the second audit (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr),
 * D25: checklists saved a line at a time. Every site-checks and pre-start
 * save used to carry the whole list, so a phone that had been offline wrote
 * its old copy over lines the office or a second site manager ticked in the
 * meantime, and nothing said so. Now a save names only what this phone
 * changed, with what each field was; the board takes a field only while it
 * still says that, and names any line somebody else changed first. Also: a
 * save the board refused stayed "Not saved" for ever and held sign-out up,
 * and a 403 threw the unsent ticks away. The board's half is its
 * install-checks.test.ts and prestart-checks.test.ts; the Apps Script's
 * forwarding is apps-script/code-test.mjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
// An element that is not there reads as '' / null at once, so a run against
// an older build reports what is missing instead of waiting it out.
const txt = async (page, sel) => (await page.locator(sel).count()) ? ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim() : '';
const cls = async (page, sel) => (await page.locator(sel).count()) ? page.locator(sel).first().getAttribute('class') : null;
const box = async (page, sel) => (await page.locator(sel).count()) ? page.locator(sel).first().boundingBox() : null;
const val = async (page, sel) => (await page.locator(sel).count()) ? page.locator(sel).first().inputValue() : null;
const tap = async (page, sel, ms = 300) => { if (await page.locator(sel).count()) await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const puts = (page) => page.evaluate(() => window.__PUTS || []);
const preputs = (page) => page.evaluate(() => window.__PREPUTS || []);
const toastText = (page) => txt(page, '#toast span');
// The board's copy as the job list now carries it: after a clean save the
// phone hands the list back to it, so its own working copy is gone.
const board = (page, tid = 't2roof') => page.evaluate((t) => visitForChecks(t).checks.state, tid);
const SAVE_MS = 2600;   // the 1.5-second debounce and the answer

async function boot(flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;' + flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); });
  return { ctx, page, errs };
}
const openList = async (page, tid = 't2roof') => { await tap(page, '.tab[data-tab="jobs"]', 900); await tap(page, '[data-checks="' + tid + '"]', 500); };
const note = async (page, key, words) => {
  if (!(await page.locator('[data-note="' + key + '"]').count())) await tap(page, '[data-note-add="' + key + '"]', 200);
  await page.locator('[data-note="' + key + '"]').fill(words);
  await page.locator('[data-note="' + key + '"]').press('Enter');
};

// ---- two phones on one list: a tick made elsewhere is kept ----
{
  const { ctx, page, errs } = await boot();
  await openList(page);
  check('the board says it takes a save a line at a time, and this API forwards one', await page.evaluate(() => [S.assign.checklist.saves, typeof ckLineSaves === 'function' ? ckLineSaves() : 'missing']), ['lines', true]);
  // Another phone ticks the homeowner line and writes on the address line
  // after this one loaded the list.
  await page.evaluate(() => { window.__MOCK_CK_EDIT = (l) => { l.done.homeowner = true; l.notes = l.notes || {}; l.notes.address = 'Gate 1234'; }; });
  await tap(page, '.ckrow[data-line="scope"]', SAVE_MS);
  const p = await puts(page);
  check('only the line this phone changed goes, with what it was', [p.length, p[0]?.checks?.done, p[0]?.checks.na, p[0]?.checks.notes, p[0]?.checks.was],
    [1, { scope: true }, { scope: '' }, {}, { lines: { scope: { done: false, na: '', note: '' } } }]);
  check('…the other phone\'s tick and note stay on the board, and this phone now shows them',
    [await board(page).then((b) => [b.done.homeowner, b.notes.address]), await cls(page, '.ckrow[data-line="homeowner"]'), await cls(page, '[data-note-add="address"]')],
    [[true, 'Gate 1234'], 'ckrow on', 'cknote-pen has']);
  check('…nothing said as lost, nothing waiting', [await page.locator('.cknotice').count(), await txt(page, '#ckSave'), await page.evaluate(() => waitItems().length)], [0, 'Saved', 0]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a note changed elsewhere first: not taken, said, put right ----
{
  const { ctx, page, errs } = await boot();
  await openList(page);
  await page.evaluate(() => { window.__MOCK_CK_EDIT = (l) => { l.notes = l.notes || {}; l.notes.address = 'Gate 1234'; }; window.__MOCK_CK_BY = 'Tyler Mohr'; });
  await note(page, 'address', 'Gate 4411');
  await page.waitForTimeout(SAVE_MS);
  let p = await puts(page);
  check('the note goes with what the line said when this phone had it', [p.length, p[0]?.checks.notes, p[0]?.checks.was?.lines.address], [1, { address: 'Gate 4411' }, { done: false, na: '', note: '' }]);
  check('…the board kept the other phone\'s words, and says so on the screen',
    [await txt(page, '.cknotice .nk'), await txt(page, '.cknotice .nt'), await txt(page, '.cknotice li b'), (await txt(page, '.cknotice li')).includes('— the note now says “Gate 1234”')],
    ['Not taken', 'Somebody changed these lines first', 'Right address, right roof', true]);
  check('…who changed it and when', /^Tyler Mohr changed it at \d{1,2}:\d{2}[ap]$/.test(await txt(page, '.cknotice li .who')), true);
  check('…and what to do about it', await txt(page, '.cknotice .ns'), 'The list shows what is there now. Change a line again if yours was right.');
  check('…the box now holds what is there, and a toast said it', [await val(page, '[data-note="address"]'), await toastText(page)],
    ['Gate 1234', 'Some of your changes weren’t taken — somebody changed those lines first.']);
  check('…the save itself landed: Saved, nothing waiting to send', [await txt(page, '#ckSave'), await page.evaluate(() => waitItems().length)], ['Saved', 0]);
  const ok = await box(page, '.cknotice [data-ckok]');
  check('…Got it is a 44-pixel target at least', ok && ok.height >= 44, true);
  await tap(page, '.cknotice [data-ckok]', 300);
  check('Got it clears the notice, and the phone remembers', [await page.locator('.cknotice').count(), await page.evaluate(() => ckStore.t2roof.conflicts)], [0, null]);
  await note(page, 'address', 'Gate 4411');
  await page.waitForTimeout(SAVE_MS);
  p = await puts(page);
  check('changed again, it goes: what it was is now theirs', [p.length, p[1]?.checks.notes, p[1]?.checks.was?.lines.address.note, await page.locator('.cknotice').count(),
    await board(page).then((b) => b.notes.address)], [2, { address: 'Gate 4411' }, 'Gate 1234', 0, 'Gate 4411']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- an N/A reason given elsewhere first, and the words for each kind ----
{
  const { ctx, page, errs } = await boot();
  await openList(page);
  await page.evaluate(() => { window.__MOCK_CK_EDIT = (l) => { l.na = l.na || {}; l.na.septic = 'well'; l.done.septic = false; }; window.__MOCK_CK_BY = null; });
  await tap(page, '[data-note-add="septic"]', 200);
  await tap(page, '[data-na-open="septic"]', 200);
  await page.fill('[data-na="septic"]', 'city sewer');
  await page.locator('[data-na="septic"]').press('Enter');
  await page.waitForTimeout(SAVE_MS);
  const p = await puts(page);
  check('the n/a goes as a tick change, with what the line was', [p[0]?.checks.na, p[0]?.checks?.done, p[0]?.checks.was?.lines.septic], [{ septic: 'city sewer' }, { septic: false }, { done: false, na: '', note: '' }]);
  check('…not taken: the line shows the reason already there, and nobody to name',
    [(await txt(page, '.cknotice li')).includes('Well and septic located — now not applicable: well'), await txt(page, '.cknotice li .who'), await txt(page, '.ckrow[data-line="septic"] .nar')],
    [true, 'Changed in JobTread or on another phone', 'Not applicable · well']);
  const words = await page.evaluate(() => {
    const y = new Date(Date.now() - 86400000); y.setHours(15, 14, 0, 0);
    const html = (c) => { const d = document.createElement('div'); d.innerHTML = typeof ckConflictHtml === 'function' ? ckConflictHtml(c) : 'missing'; return d.textContent; };
    return [
      html({ key: 'homeowner', label: 'Homeowner talked to', what: 'tick', now: { done: true, na: '' }, by: 'Kenton', at: y.toISOString() }),
      html({ key: 'homeowner', label: 'Homeowner talked to', what: 'tick', now: { done: false, na: '' } }),
      html({ key: 'address', label: 'Right address, right roof', what: 'note', now: { note: '' }, at: new Date().toISOString() }),
      html({ key: 'covered', label: 'Covered by', what: 'name', now: { value: 'Kenton, back by 3:30' }, by: 'Chris Blue' }),
      html({ key: 'covered', label: 'Covered by', what: 'name', now: { value: null } }),
      dayWords(y),
    ];
  });
  check('a tick done elsewhere on another day says the day', words[0], 'Homeowner talked to — now tickedKenton changed it on ' + words[5] + ' at 3:14p');
  check('…untick, a note taken off, a name, a name taken off', [words[1], /^Right address, right roof — the note was taken offChanged at \d{1,2}:\d{2}[ap]$/.test(words[2]), words[3], words[4]],
    ['Homeowner talked to — now not tickedChanged in JobTread or on another phone', true, 'Covered by — now says “Kenton, back by 3:30”Chris Blue changed it', 'Covered by — the name was taken offChanged in JobTread or on another phone']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a tap during a slow save that comes back with a line not taken ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_SLOWPUT=1500;');
  await openList(page);
  await page.evaluate(() => { window.__MOCK_CK_EDIT = (l) => { l.notes = l.notes || {}; l.notes.address = 'Gate 1234'; }; window.__MOCK_CK_BY = 'Tyler Mohr'; });
  await note(page, 'address', 'Gate 4411');
  await page.waitForFunction(() => ckStore.t2roof && ckStore.t2roof.inflight, null, { timeout: 5000 });
  await tap(page, '.ckrow[data-line="homeowner"]', 100);
  await page.waitForTimeout(5200);
  const p = await puts(page);
  check('the tap rides the next save on its own; the line not taken is never sent again', [p.length, p[1]?.checks?.done, p[1]?.checks.notes, p[1]?.checks.was?.lines],
    [2, { homeowner: true }, {}, { homeowner: { done: false, na: '', note: '' } }]);
  check('…the screen: theirs on the line not taken, the tap kept, the notice up', [await val(page, '[data-note="address"]'), await cls(page, '.ckrow[data-line="homeowner"]'), await page.locator('.cknotice li').count(), await txt(page, '#ckSave')],
    ['Gate 1234', 'ckrow on', 1, 'Saved']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- ticked and unticked again: nothing to send ----
{
  const { ctx, page, errs } = await boot();
  await openList(page);
  await tap(page, '.ckrow[data-line="address"]', 80);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  check('nothing differs from the board\'s list, so nothing goes, and nothing is said as unsaved', [(await puts(page)).length, await page.evaluate(() => [ckStore.t2roof.dirty, waitItems().length])], [0, [false, 0]]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- an older board, an older API: the whole list, as before ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_OLD_BOARD=true;');
  await openList(page);
  check('a board that does not say it takes a line at a time', await page.evaluate(() => [S.assign.checklist.saves || null, typeof ckLineSaves === 'function' ? ckLineSaves() : 'missing']), [null, false]);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  let p = await puts(page);
  check('…gets the whole list, the signature and the magnet name in it, no was', [Object.keys(p[0]?.checks?.done).length, p[0]?.checks.signOff, 'magnetBy' in (p[0]?.checks || {}), 'was' in (p[0]?.checks || {})], [28, false, true, false]);
  await page.evaluate(() => ckSign(S.checksVisit, true));
  await page.waitForTimeout(1500);
  await tap(page, '.ckrow[data-line="homeowner"]', SAVE_MS);
  p = await puts(page);
  check('…so a tick after signing still says signed, and the signature stays', [p.length, p[2]?.checks.signOff, await board(page).then((b) => !!b.signedOff)], [3, true, true]);
  check('no page errors (older board)', errs, []);
  await ctx.close();
}
for (const [build, lines] of [['T2.35 (2026-11-02)', false], ['T2.36 (2026-11-02)', true]]) {
  const { ctx, page, errs } = await boot(`window.__MOCK_API_BUILD='${build}';`);
  await openList(page);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  const p = await puts(page);
  check(`an API at ${build.split(' ')[0]} gets ${lines ? 'the line alone' : 'the whole list (it drops was and always sends the signature)'}`,
    [Object.keys(p[0]?.checks?.done).length, 'was' in (p[0]?.checks || {}), 'signOff' in (p[0]?.checks || {})], lines ? [1, true, false] : [28, false, true]);
  check('no page errors (' + build.split(' ')[0] + ')', errs, []);
  await ctx.close();
}

// ---- a copy kept on the phone from before T2.36: sent whole once ----
{
  const seed = `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('dbtc_checks', JSON.stringify({ t2roof: { state: { done: { address: true }, notes: {}, na: {}, magnetBy: null, coveredBy: null, watertightWith: null, signedOff: null },
      dirty: true, seq: 1, savedAt: 0, at: Date.now(), err: 'retry', jobId: 'j2', jobLabel: '26-1045 Lucas' } })); }`;
  const { ctx, page, errs } = await boot(seed);
  await page.waitForTimeout(1500);
  let p = await puts(page);
  check('a copy with no base (saved by T2.35) goes whole, once', [p.length, p[0] && p[0]?.checks?.done.address, p[0] && 'was' in (p[0]?.checks || {}), p[0] && 'signOff' in (p[0]?.checks || {})], [1, true, false, true]);
  await openList(page);
  await tap(page, '.ckrow[data-line="scope"]', SAVE_MS);
  p = await puts(page);
  check('…after which the board\'s answer is the base, and saves go a line at a time', [p.length, p[1]?.checks?.done, 'was' in (p[1]?.checks || {})], [2, { scope: true }, true]);
  check('no page errors (kept copy)', errs, []);
  await ctx.close();
}

// ---- a save the board refused: kept, said, asked again only on a change, let go ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_CK_REFUSE='membershipId, taskId, jobId and checks are required';");
  await openList(page);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  check('the 400: the tick stays, said as refused, with the board\'s words',
    [await cls(page, '.ckrow[data-line="address"]'), await txt(page, '#ckSave'), await txt(page, '.cknotice .nk'), await txt(page, '.cknotice .nt'), await txt(page, '.cknotice .ns')],
    ['ckrow on', 'Not saved', 'Not saved', 'The board refused it (membershipId, taskId, jobId and checks are required)',
     'Trying again won’t change the answer. Tell the office, or let your changes go.']);
  const lg = await box(page, '.cknotice [data-letgo]');
  check('…Let my changes go is a 44-pixel target at least', lg && lg.height >= 44, true);
  await page.evaluate(() => { obWake(); });
  await page.waitForTimeout(1200);
  check('…waking the outbox does not ask again: the answer would be the same', (await puts(page)).length, 1);
  check('…it holds sign-out, and Waiting to send opens the list', await page.evaluate(() => [waitingToSend(), waitItems().map((i) => [i.lane, i.state, !!i.go, !!i.drop])]),
    [['1 site-check save'], [['checks', 'you', true, false]]]);
  await page.evaluate(() => { window.__MOCK_CK_REFUSE = null; });
  await tap(page, '.ckrow[data-line="homeowner"]', SAVE_MS);
  let p = await puts(page);
  check('a new change asks again, and carries the refused one with it', [p.length, p[1]?.checks?.done, await txt(page, '#ckSave'), await page.locator('.cknotice').count()],
    [2, { address: true, homeowner: true }, 'Saved', 0]);
  await page.evaluate(() => { window.__MOCK_CK_REFUSE = 'no'; });
  await tap(page, '.ckrow[data-line="scope"]', SAVE_MS);
  await tap(page, '.cknotice [data-letgo]', 300);
  check('Let my changes go asks once more', await txt(page, '.cknotice [data-letgo]'), 'Tap again to throw your changes away');
  await page.waitForTimeout(8400);
  check('…and stands down after eight seconds', await txt(page, '.cknotice [data-letgo]'), 'Let my changes go');
  await tap(page, '.cknotice [data-letgo]', 300);
  await tap(page, '.cknotice [data-letgo]', 500);
  check('…two taps let it go: the board\'s list, nothing waiting, sign-out free', [await cls(page, '.ckrow[data-line="scope"]'), await cls(page, '.ckrow[data-line="homeowner"]'),
    await page.locator('.cknotice').count(), await page.evaluate(() => [waitingToSend().length, Object.keys(ckStore).length]), await toastText(page)],
    ['ckrow', 'ckrow on', 0, [0, 0], 'Your changes were let go — the list shows what the board has.']);
  check('no page errors (400)', errs, []);
  await ctx.close();
}

// ---- a refused save for a list no longer on this phone: Let go, from Waiting to send ----
{
  const seed = `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('dbtc_checks', JSON.stringify({ tgone: { state: { done: { address: true }, notes: {}, na: {} }, base: { done: {}, notes: {}, na: {} },
      dirty: true, refused: true, err: 'Not saved — the board refused it', why: 'that list is gone', seq: 1, savedAt: 0, at: Date.now(), jobId: 'jgone', jobLabel: '26-0001 Gone' } })); }`;
  const { ctx, page, errs } = await boot(seed);
  await page.evaluate(() => openWaiting());
  await page.waitForTimeout(600);
  check('Waiting to send offers Let go alone, and says why', [await page.locator('#sheetBody [data-waitgo]').count(), await txt(page, '#sheetBody [data-waitdrop]'),
    (await txt(page, '#sheetBody .obrow .pqerr')).endsWith('This list isn’t on your jobs any more, so it can only be let go.')], [0, 'Let go', true]);
  const dropBox = await box(page, '#sheetBody [data-waitdrop]');
  check('…a 44-pixel target at least', dropBox && dropBox.height >= 44, true);
  await tap(page, '#sheetBody [data-waitdrop]', 400);
  check('…the first tap asks again', await txt(page, '#sheetBody [data-waitdrop]'), 'Tap again');
  await tap(page, '#sheetBody [data-waitdrop]', 500);
  check('…the second lets it go: nothing waiting, sign-out free', [await page.evaluate(() => [waitingToSend().length, Object.keys(ckStore).length]), await toastText(page)],
    [[0, 0], 'Let go — it won’t be sent.']);
  check('no page errors (gone list)', errs, []);
  await ctx.close();
}

// ---- a 403: the ticks are kept, and go once the office gives the role ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_NOTMANAGER=true;');
  await openList(page);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  check('the 403: read-only, the tick kept, said, with the way to let it go',
    [await page.locator('.ckrow[disabled]').count(), await cls(page, '.ckrow[data-line="address"]'), await txt(page, '#ckSave'), await txt(page, '.cknotice .nt'), await txt(page, '.cknotice .ns'), await page.locator('.cknotice [data-letgo]').count()],
    [27, 'ckrow on', 'Not saved', 'Only a site manager can tick these. Ask the office.', 'Your ticks stay on this phone and go by themselves once the office makes you a site manager.', 1]);
  await page.evaluate(() => { obWake(); });
  await page.waitForTimeout(900);
  check('…not asked again within the hour', (await puts(page)).length, 1);
  await page.evaluate(() => { window.__MOCK_NOTMANAGER = false; S.me.role = 'Site Manager'; ckOnProfile(); });
  await page.waitForTimeout(1500);
  const p = await puts(page);
  check('the role comes through on the profile: the kept tick goes, the list is live again',
    [p.length, p[1]?.checks?.done, await txt(page, '#ckSave'), await page.locator('.ckrow[disabled]').count(), await page.locator('.cknotice').count()],
    [2, { address: true }, 'Saved', 0, 0]);
  check('no page errors (403, then the role)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('window.__MOCK_NOTMANAGER=true;');
  await openList(page);
  await tap(page, '.ckrow[data-line="address"]', SAVE_MS);
  await page.evaluate(() => { window.__MOCK_NOTMANAGER = false; if (ckStore.t2roof) ckStore.t2roof.roleTry = Date.now() - 2 * 3600000; obWake(); });
  await page.waitForTimeout(1500);
  const p = await puts(page);
  check('an hour on, waking asks again; the board takes it, and the list is live again',
    [p.length, p[1] && p[1]?.checks?.done, await txt(page, '#ckSave'), await page.evaluate(() => ckReadOnly())], [2, { address: true }, 'Saved', false]);
  check('no page errors (the hourly ask)', errs, []);
  await ctx.close();
}

// ---- the pre-start, a line at a time ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_PRESTART=true;');
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-prestart="tpre"]', 500);
  await page.evaluate(() => { window.__MOCK_PRE_EDIT = (l) => { l.done.debris = true; }; });
  await tap(page, '[data-pline="utilities"]', 200);
  await tap(page, '#ckBack', 1400);
  const pp = await preputs(page);
  check('the pre-start sends the box changed here, with what it was', [pp.length, pp[0]?.done, pp[0]?.was], [1, { utilities: true }, { utilities: false }]);
  check('…the box ticked elsewhere meanwhile is kept, and the card says so', await txt(page, '.jcard:has([data-prestart="tpre"]) .jck'), 'Pre-start — 4 of 7 done');
  await tap(page, '[data-prestart="tpre"]', 500);
  check('…and the list shows it', [await page.locator('#ckBody .ckrow.on').count(), await cls(page, '[data-pline="debris"]')], [4, 'ckrow on']);
  check('no page errors (pre-start)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('window.__MOCK_PRESTART=true;window.__MOCK_OLD_BOARD=true;');
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-prestart="tpre"]', 500);
  await tap(page, '[data-pline="utilities"]', 200);
  await tap(page, '#ckBack', 1400);
  const pp = await preputs(page);
  check('an older board gets the whole pre-start, as before', [pp.length, Object.keys(pp[0]?.done).length, pp[0]?.was], [1, 7, null]);
  check('no page errors (pre-start, older board)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot("window.__MOCK_PRESTART=true;window.__MOCK_PRE_REFUSE='membershipId, taskId, jobId and done are required';");
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-prestart="tpre"]', 500);
  await tap(page, '[data-pline="utilities"]', 200);
  await page.evaluate(() => prFlush('tpre'));
  await page.waitForTimeout(900);
  check('a refused pre-start: kept, said, and Waiting to send opens it', [await page.locator('#ckBody .ckrow.on').count(), await txt(page, '#ckSave'), await txt(page, '.cknotice .nt'), await page.evaluate(() => waitItems().map((i) => [i.lane, i.state, !!i.go]))],
    [3, 'Not saved', 'The board refused it (membershipId, taskId, jobId and done are required)', [['prestart', 'you', true]]]);
  await page.evaluate(() => { prRetryPending(); });
  await page.waitForTimeout(600);
  check('…not asked again by itself', (await preputs(page)).length, 1);
  await tap(page, '.cknotice [data-letgo]', 300);
  await tap(page, '.cknotice [data-letgo]', 500);
  check('…let go: the board\'s two ticks, nothing waiting', [await page.locator('#ckBody .ckrow.on').count(), await page.evaluate(() => [waitingToSend().length, Object.keys(prStore).length])], [2, [0, 0]]);
  check('no page errors (pre-start 400)', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot('window.__MOCK_PRESTART=true;window.__MOCK_PRE_FORBID=true;');
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-prestart="tpre"]', 500);
  await tap(page, '[data-pline="debris"]', 200);
  await page.evaluate(() => prFlush('tpre'));
  await page.waitForTimeout(900);
  check('a pre-start 403: read-only, the tick kept and said', [await page.locator('#ckBody .ckrow[disabled]').count(), await page.locator('#ckBody .ckrow.on').count(), await txt(page, '.cknotice .ns')],
    [7, 3, 'Your ticks stay on this phone and go by themselves once the office lets you tick the pre-start.']);
  await page.evaluate(() => { window.__MOCK_PRE_FORBID = false; if (prStore.tpre) prStore.tpre.roleTry = Date.now() - 2 * 3600000; prRetryPending(); });
  await page.waitForTimeout(900);
  const pp = await preputs(page);
  check('…an hour on it goes, and the list is live again', [pp.length, pp[1] && pp[1]?.done, await page.evaluate(() => !!prRO()), await page.locator('#ckBody .ckrow[disabled]').count()],
    [2, { debris: true }, false, 0]);
  check('no page errors (pre-start 403)', errs, []);
  await ctx.close();
}

// ---- in Spanish ----
{
  const { ctx, page, errs } = await boot();
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; savePrefs(); render(); });
  await openList(page);
  await page.evaluate(() => { window.__MOCK_CK_EDIT = (l) => { l.notes = l.notes || {}; l.notes.address = 'Gate 1234'; }; window.__MOCK_CK_BY = 'Tyler Mohr'; });
  await note(page, 'address', 'Gate 4411');
  await page.waitForTimeout(SAVE_MS);
  check('the notice in Spanish', [await txt(page, '.cknotice .nk'), await txt(page, '.cknotice .nt'), (await txt(page, '.cknotice li')).includes('— la nota ahora dice “Gate 1234”'),
    /^Tyler Mohr lo cambió a las \d{1,2}:\d{2}[ap]$/.test(await txt(page, '.cknotice li .who')), await txt(page, '.cknotice .ns'), await txt(page, '.cknotice [data-ckok]'), await toastText(page)],
    ['No se guardó', 'Alguien cambió estas líneas primero', true, true, 'La lista muestra lo que hay ahora. Cambia la línea otra vez si lo tuyo era lo correcto.', 'Entendido',
     'Algunos de tus cambios no se guardaron — alguien cambió esas líneas primero.']);
  await tap(page, '.cknotice [data-ckok]', 300);
  await page.evaluate(() => { window.__MOCK_CK_REFUSE = 'no'; });
  await tap(page, '.ckrow[data-line="scope"]', SAVE_MS);
  check('…and a refused save', [await txt(page, '#ckSave'), await txt(page, '.cknotice .nk'), await txt(page, '.cknotice .nt'), await txt(page, '.cknotice .ns'), await txt(page, '.cknotice [data-letgo]')],
    ['Sin guardar', 'Sin guardar', 'El tablero lo rechazó (no)', 'Intentarlo otra vez no cambia la respuesta. Avisa a la oficina o descarta tus cambios.', 'Descartar mis cambios']);
  await tap(page, '.cknotice [data-letgo]', 300);
  check('…asking once more', await txt(page, '.cknotice [data-letgo]'), 'Toca otra vez para descartar tus cambios');
  check('no page errors (Spanish)', errs, []);
  await ctx.close();
}

await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got  ${JSON.stringify(r.actual)}\n      want ${JSON.stringify(r.expected)}`));
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
