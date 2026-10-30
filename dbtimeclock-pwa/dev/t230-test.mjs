/* T2.30 (30 Oct 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t230-test.mjs
 *
 * Step 2 of the audit: sign-out counts the photos from the phone's own store
 * and lets go of the phone's notifications (D6); one photo that will not go
 * no longer holds the rest, a stalled upload gives up, and a stuck one can
 * be tried again or discarded (D7); the phone lets go of what is finished
 * and says when a save is refused (D8); zoom, read-out toasts, sheets as
 * dialogs that Back closes, pressed states (D14); and Diagnostics names what
 * each system is running and warns when one is behind the phone (I3). The
 * service worker's three-second rule (D16) is dev/sw-test.mjs. */
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
// A photo straight into the queue, as the camera leaves one: a record with a
// thumbnail, and the file in the phone's store.
const queuePhoto = (page, o) => page.evaluate(async (o) => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
  const jobId = (S.job && S.job.id) || 'j1';
  const item = { id: o.id, blob, mime: 'image/jpeg', tag: o.tag || 'before', at: o.at, jobId, entryId: '', codeLabel: '' };
  S.photos.push({ id: o.id, tag: item.tag, at: o.at, time: clockLabel(o.at), thumb: c.toDataURL('image/jpeg', 0.5), pending: true, jobId, name: fileName(item) });
  savePrefs();
  await idbPut(item);
  return fileName(item);
}, o);
const queued = (page) => page.evaluate(() => idbAll().then((a) => a.map((x) => x.id).sort()));

// ---- D6: sign-out counts the photos from the store, the pre-start too ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';");
  await page.evaluate(() => { S.online = false; });   // the upload loop stays still
  await queuePhoto(page, { id: 'pOld', at: Date.now() - 20 * 3600e3 });
  // Opened in a dead spot: the loop never ran, so its number said nothing waits.
  await page.evaluate(() => { S.queued = 0; setTab('diag'); });
  await page.waitForTimeout(300);
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('D6: a phone that thinks nothing waits still counts the photo, and refuses', [/^Not yet — 1 photo still waiting/.test(await txt(page, '#signOutFoot')), await queued(page)], [true, ['pOld']]);
  check('…and the no-signal bar counts it too', await page.evaluate(() => S.queued), 1);
  await page.evaluate(() => idbDel('pOld').then(() => { S.queued = 0; prStore['t-pre'] = { dirty: true }; }));
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  check('an unsaved pre-start is counted', /1 pre-start save/.test(await txt(page, '#signOutFoot')), true);
  check('no page errors (D6)', errs, []);
  await ctx.close();
}
{
  const { ctx, page } = await boot("window.__MOCK_ROLE='crew';");
  await page.evaluate(() => {
    localStorage.setItem('dbtc_pushtok', 'tok-this-phone');
    const orig = apiCall;
    window.apiCall = apiCall = function (fn, args) { if (fn === 'unregisterPushToken') localStorage.setItem('t230_unreg', JSON.stringify(args)); return orig.apply(this, arguments); };
    setTab('diag');
  });
  await page.locator('#signOutBtn').click(); await page.waitForTimeout(400);
  await page.locator('#signOutBtn').click();
  await page.waitForFunction(() => !document.getElementById('gate').classList.contains('hidden'), null, { timeout: 15000 }).catch(() => {});
  check('signing out lets go of THIS phone\'s notifications, naming its token', await page.evaluate(() => localStorage.getItem('t230_unreg')), JSON.stringify(['tok-this-phone']));
  check('…and the token goes with the rest of the phone\'s keys', await page.evaluate(() => localStorage.getItem('dbtc_pushtok')), null);
  await ctx.close();
}

// ---- D7: oldest first, a failure steps aside, a stall gives up ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';");
  await page.evaluate(() => { S.online = false; window.__PUTS = []; });
  const now = await page.evaluate(() => Date.now());
  const nNew = await queuePhoto(page, { id: 'aNew', at: now - 60e3, tag: 'after' });   // the id sorts first,
  const nOld = await queuePhoto(page, { id: 'zOld', at: now - 3600e3 });               // the time does not
  await page.evaluate((n) => { window.__MOCK_PUTFAIL = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); S.online = true; pump(); }, nOld);
  await page.waitForFunction(() => !pumping && (window.__PUTS || []).length >= 2, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('D7: oldest first, whatever the id', await page.evaluate(() => window.__PUTS.slice(0, 2)), [nOld, nNew]);
  check('…a photo that will not go steps aside, and the next one goes', [await queued(page), await page.evaluate(() => photoRec('aNew').pending)], [['zOld'], false]);
  check('…the failed one keeps its own tries and a time to try again', await page.evaluate(() => [qRetry.zOld.tries, qRetry.zOld.next > Date.now(), /JobTread refused/.test(qRetry.zOld.err)]), [1, true, true]);
  // Stuck after a few tries: said on the Clock tab, with Try again and Discard.
  await page.evaluate(() => { qRetry.zOld.tries = 4; qRetrySave(); setTab('job'); render(); });
  await page.waitForTimeout(200);
  check('a stuck photo is said on the Clock tab', /1 photo hasn’t sent — tap to see it/.test(await txt(page, '#clockNudge')), true);
  await page.locator('#clockNudge').click(); await page.waitForTimeout(500);
  check('…tapping it lists the photos waiting', [await page.evaluate(() => S.sheet), await txt(page, '#sheetTitle'), await page.locator('.pqrow').count(), /Couldn’t send · tried 4 times/.test(await txt(page, '.pqrow'))],
    ['photoQ', 'Photos waiting to send', 1, true]);
  await page.locator('[data-pqdiscard]').click(); await page.waitForTimeout(200);
  check('Discard asks again first', [await txt(page, '[data-pqdiscard]'), await queued(page)], ['Tap again to discard', ['zOld']]);
  await page.locator('[data-pqdiscard]').click(); await page.waitForTimeout(800);
  check('…the second tap lets it go: off the phone, the record says so, the log stops waiting',
    [await queued(page), await page.evaluate(() => [photoRec('zOld').pending, photoRec('zOld').discarded]), await txt(page, '.pqlist, #sheetBody .jempty')],
    [[], [false, true], 'Nothing waiting to send']);
  // A stalled upload gives up and goes the other way.
  await page.evaluate(() => { closeSheet(); window.__MOCK_PUTFAIL = null; window.__MOCK_PUTSTALL = true; window.__UPLOAD_TIMEOUT_MS = 700; window.__VIAAPI = []; });
  await queuePhoto(page, { id: 'stall1', at: now - 30e3 });
  await page.evaluate(() => pump());
  await page.waitForFunction(() => (window.__VIAAPI || []).length >= 1, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('a stalled upload times out and goes through the API instead', [await queued(page), await page.evaluate(() => window.__VIAAPI.length)], [[], 1]);
  check('no page errors (D7)', errs, []);
  await ctx.close();
}

// ---- D8: the phone lets go of what is finished; a refused save is said ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  const r = await page.evaluate(() => {
    const day = (n) => isoLocal(new Date(Date.now() - n * 86400000));
    dlStore = {
      oldSent: { date: day(20), sent: { at: 1 }, jobId: 'j1' },
      oldWork: { date: day(20), story: 'Typed with no signal and never sent', wantSend: true, jobId: 'j2' },
      newSent: { date: day(2), sent: { at: 1 }, jobId: 'j3' }
    };
    const old = Date.now() - 20 * 86400000;
    coStore.visits = {
      idleOld: { answers: { inspection: {}, cleanup: {} }, reports: [], photos: [], before: {}, after: {}, repairNote: {}, doneTasks: {}, sentAt: old, startedAt: old },
      workOld: { answers: { inspection: {}, cleanup: {} }, reports: [{ ref: 'r1', saved: true }], photos: [], before: {}, after: {}, repairNote: {}, doneTasks: {}, sentAt: 0, startedAt: old },
      doneRepair: { answers: { inspection: {}, cleanup: {} }, reports: [], photos: [], before: {}, after: {}, repairNote: {}, doneTasks: { t9: Date.now() }, repairMore: { t9: [{ id: 'm1', thumb: 'data:x' }] }, sentAt: 0, startedAt: Date.now() }
    };
    localStorage.setItem('dbtc_co_job_oldCopy', JSON.stringify({ id: 'oldCopy', _at: old }));
    localStorage.setItem('dbtc_co_job_newCopy', JSON.stringify({ id: 'newCopy', _at: Date.now() }));
    localStorage.setItem('dbtc_co_job_workOld', JSON.stringify({ id: 'workOld', _at: old }));
    storeTrim(false);
    return [Object.keys(dlStore).sort(), Object.keys(coStore.visits).sort(), !!(coStore.visits.doneRepair || {}).repairMore && Object.keys(coStore.visits.doneRepair.repairMore).length,
      ['oldCopy', 'newCopy', 'workOld'].map((k) => localStorage.getItem('dbtc_co_job_' + k) !== null)];
  });
  check('D8: a sent log after 14 days goes; unsent work and a recent log stay', r[0], ['newSent', 'oldWork']);
  check('…a finished visit goes; one with unsent work stays', r[1], ['doneRepair', 'workOld']);
  check('…a finished repair\'s extra photos go at once', r[2], 0);
  check('…a job copy after 7 days goes, unless there is work on that job', r[3], [false, true, true]);
  // A refused save trims and tries again; still refused, it is said.
  const said = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'dbtc_daylog') throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); };
    storeWarnAt = 0;
    const ok = storeSet('dbtc_daylog', '{}');
    Storage.prototype.setItem = orig;
    return [ok, document.querySelector('#toast span').textContent];
  });
  check('a save the full phone refuses is said, not swallowed', [said[0], /^Phone storage is full|^El almacenamiento del teléfono está lleno/.test(said[1])], [false, true]);
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(700);
  check('Diagnostics says what the phone keeps', /Storage\s*\d[\d.]* [KMG]B saved/.test(await txt(page, '#verTbl')), true);
  check('no page errors (D8)', errs, []);
  await ctx.close();
}

// ---- D14: zoom, read-out toasts, sheets as dialogs, pressed states ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='siteManager';");
  check('D14: pinch-zoom is allowed, a double tap is still two taps', await page.evaluate(() => [document.querySelector('meta[name=viewport]').content, getComputedStyle(document.documentElement).touchAction]),
    ['width=device-width, initial-scale=1, viewport-fit=cover', 'manipulation']);
  check('…and no box is under 16px, so iOS never zooms in on its own', await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('input:not([type=file]), textarea').forEach((el) => { if (parseFloat(getComputedStyle(el).fontSize) < 16) small.push(el.id || el.className); });
    return small;
  }), []);
  await page.evaluate(() => toast('Saved'));
  await page.waitForTimeout(150);
  check('a toast is read out', [await page.evaluate(() => document.getElementById('srLive').getAttribute('role')), await txt(page, '#srLive')], ['status', 'Saved']);
  await page.evaluate(() => { setTab('job'); });
  const h0 = await page.evaluate(() => history.length);
  await page.evaluate(() => openSheet('break'));
  await page.waitForTimeout(200);
  check('a sheet is a dialog, and focus goes into it', await page.evaluate(() => [document.getElementById('sheet').getAttribute('role'), document.getElementById('sheet').getAttribute('aria-modal'), document.getElementById('sheet').contains(document.activeElement)]),
    ['dialog', 'true', true]);
  check('…opening it gives Back something to close', await page.evaluate(() => history.length), h0 + 1);
  await page.goBack(); await page.waitForTimeout(400);
  check('Back closes the sheet instead of leaving the app', [await page.evaluate(() => S.sheet), await page.evaluate(() => document.getElementById('scrim').classList.contains('on')), page.url().startsWith(APP_URL.replace(/\/$/, ''))], [null, false, true]);
  await page.evaluate(() => openSheet('break'));
  await page.waitForTimeout(200);
  await page.locator('#sheetClose').click(); await page.waitForTimeout(400);
  check('closed from its X, Back\'s entry is taken back too', [await page.evaluate(() => S.sheet), await page.evaluate(() => history.state)], [null, null]);
  // The gap clock-test found: a sheet closed and the next opened before the
  // browser had finished going back. Each close may take back its own entry
  // only — the old way, the entries drifted and a close left the app.
  for (const gap of [0, 1, 1, 20]) {
    await page.evaluate(() => openSheet('break')); await page.waitForTimeout(120);
    await page.evaluate((g) => { closeSheet(); if (g) setTimeout(() => openSheet('break'), g); else openSheet('break'); }, gap);
    await page.waitForTimeout(250);
    check(`…reopened ${gap ? gap + 'ms' : 'at once'} after a close: its own entry, on top`, await page.evaluate(() => [S.sheet, history.state]), ['break', { dbtcSheet: 1 }]);
    await page.evaluate(() => closeSheet()); await page.waitForTimeout(250);
  }
  check('…and after all of it the app is still the app, on its own entry', [await page.evaluate(() => typeof S === 'object' && S.sheet), await page.evaluate(() => history.state), page.url()], [null, null, APP_URL]);
  await page.evaluate(() => openSheet('break')); await page.waitForTimeout(150);
  await page.evaluate(() => { closeSheet(); openSheet('break'); }); await page.waitForTimeout(250);
  await page.goBack(); await page.waitForTimeout(400);
  check('Back on a reopened sheet closes it, and stays in the app', [await page.evaluate(() => S.sheet), page.url()], [null, APP_URL]);
  await page.evaluate(() => setTab('log')); await page.waitForTimeout(600);
  const yes = page.locator('[data-yn][data-v="1"]').first();
  check('a yes/no says whether it is pressed', await yes.getAttribute('aria-pressed'), 'false');
  await yes.click(); await page.waitForTimeout(300);
  check('…and says so after the tap', await page.locator('[data-yn][data-v="1"]').first().getAttribute('aria-pressed'), 'true');
  check('the Day log\'s EN/ES is a finger\'s height', await page.evaluate(() => Math.round(document.querySelector('#langTog button').getBoundingClientRect().height) >= 44), true);
  check('the open tab says it is the open one', await page.evaluate(() => document.querySelector('#tabs .tab.on').getAttribute('aria-current')), 'page');
  check('no page errors (D14)', errs, []);
  await ctx.close();
}

// ---- I3: Diagnostics names what each system runs, and warns when behind ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(900);
  const tbl = await txt(page, '#verTbl');
  // The phone's own build, whatever it is now (T2.31: not pinned to T2.30).
  const appBuild = await page.evaluate(() => APP_BUILD);
  check('I3: the phone, the API and the Close Out server, side by side', [tbl.replace(/\s+/g, '').indexOf('App' + appBuild.replace(/\s+/g, '')) > -1, /Close Out\s*9a4dfd9 · built on deploy · contract 1/.test(tbl), await page.locator('#verWarn').isHidden()], [true, true, true]);
  await page.evaluate(() => {
    window.__MOCK_BUILDS = { api: 'T2.29 (2026-10-30)', closeOut: { configured: true, ok: true, build: { source: 'x', on: 'local', commit: '6c6d5d1' }, deployed: '6c6d5d1', contract: 0 } };
    return loadBuilds();
  });
  await page.waitForTimeout(300);
  const w = await txt(page, '#verWarn');
  check('…a server behind the phone is warned about, in words that say what to deploy',
    [await page.locator('#verWarn').isVisible(), /newer than the API \(T2\.29\)\. Deploy the Apps Script/.test(w), /Close Out server is older than this app needs \(contract 0, needs \d+\)/.test(w), /not built on its deploy \(local\)/.test(w)],
    [true, true, true, true]);
  check('…every build row says its whole name, however long its value',
    await page.evaluate(() => [...document.querySelectorAll('#verTbl .trow .nm')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent)), []);
  await page.evaluate(() => { window.__MOCK_BUILDS = { api: APP_BUILD, closeOut: { configured: true, ok: true, build: { on: 'vercel', commit: '9a4dfd9' }, deployed: '9a4dfd9', contract: null } }; return loadBuilds(); });
  await page.waitForTimeout(300);
  check('a server that does not report a level yet is not called behind', await page.locator('#verWarn').isHidden(), true);
  check('no page errors (I3)', errs, []);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
