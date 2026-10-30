/* T2.29 (30 Oct 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t229-test.mjs
 *
 * The audit's first fixes on the phone: Close Out's waiting list sends when
 * signal comes back and says what it is doing; an unreachable Close Out is
 * not "nothing ready today"; a tap on a photo opens it and removing it asks
 * twice; the unsigned-checks banner is for people who can sign; blue text is
 * readable on the dark ground; the "Clocking in…" overlay goes when the write
 * lands; one shutter press is one photo; the Type button is gone; the sold
 * scope is escaped. */
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
  // Count the API calls the page makes, by name.
  await page.evaluate(() => {
    window.__calls = [];
    const orig = window.fetch;
    window.fetch = function (u, o) { try { const b = JSON.parse((o && o.body) || '{}'); if (b.fn) window.__calls.push(b.fn); } catch (e) {} return orig.apply(this, arguments); };
  });
  return { ctx, page, errs };
}
const calls = (page, fn) => page.evaluate((fn) => window.__calls.filter((f) => f === fn).length, fn);

// ---- D2: the waiting list sends when signal comes back ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => setTab('co')); await page.waitForTimeout(1000);
  await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline'))); await page.waitForTimeout(200);
  await page.evaluate(() => coEnqueue([{ id: 'r-t229-' + Date.now(), kind: 'report', jobId: 'co-okafor', label: 'test', payload: { location: 'ridge', englishNote: 'test note', fixedOnSite: false, reportedBy: 'Alberto' } }]));
  await page.waitForTimeout(500);
  await page.evaluate(() => coGo('outbox')); await page.waitForTimeout(300);
  check('offline: the report waits, and the list says there is no signal', [await page.evaluate(() => CO.outbox.length), await calls(page, 'coReport'), await txt(page, '#coBody .foot')],
    [1, 0, 'Sin señal — todo se guarda · Se envía solo cuando haya señal']);
  check('…no Send now without signal', await page.locator('[data-cosendnow]').count(), 0);
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => CO.outbox.length === 0, null, { timeout: 8000 }).catch(() => {});
  check('signal back: it sends by itself', [await page.evaluate(() => CO.outbox.length), await calls(page, 'coReport')], [0, 1]);
  await page.evaluate(() => coGo('outbox')); await page.waitForTimeout(300);
  check('the waiting list on its own is named, and says when it is empty', [await txt(page, '#coK'), await txt(page, '#coTitle'), await txt(page, '#coBody .jempty')],
    ['Close Out', 'Por enviar', 'Nada pendiente por enviar']);
  // Reopening the app sends too, and a stalled item can be sent by hand.
  await page.evaluate(() => { CO.pumpFails = 0; });
  await page.evaluate(() => { S.online = false; return coEnqueue([{ id: 'r-t229b-' + Date.now(), kind: 'report', jobId: 'co-okafor', label: 'test 2', payload: { location: 'ridge', englishNote: 'second', fixedOnSite: false, reportedBy: 'Alberto' } }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { S.online = true; coGo('outbox'); }); await page.waitForTimeout(300);
  check('online with one waiting: the list says it sends by itself, and offers Send now', [await txt(page, '#coBody .foot'), await page.locator('[data-cosendnow]').count()],
    ['Se envía solo en un momento', 1]);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => CO.outbox.length === 0, null, { timeout: 8000 }).catch(() => {});
  check('back to the app: it sends', [await page.evaluate(() => CO.outbox.length), await calls(page, 'coReport')], [0, 2]);
  check('no page errors (outbox)', errs, []);
  await ctx.close();
}

// ---- D3: an unreachable Close Out says so ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';window.__MOCK_CO_DOWN=true;");
  await page.evaluate(() => setTab('co')); await page.waitForTimeout(1200);
  const body = await txt(page, '#coBody');
  check('server down, nothing saved: it says it cannot reach Close Out, not that there is no work',
    [body.indexOf('No se puede conectar con Close Out ahora') > -1, body.indexOf('Nada listo para revisar hoy') > -1, await page.locator('[data-coreload]').count()], [true, false, 1]);
  const asked = await calls(page, 'coQueue');
  await page.locator('[data-coreload]').first().click(); await page.waitForTimeout(800);
  check('…Try again asks again', await calls(page, 'coQueue'), asked + 1);
  check('no page errors (down)', errs, []);
  await ctx.close();
}

// ---- D4: a tap on a photo opens it; removing it asks twice ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => setTab('co')); await page.waitForTimeout(1000);
  await page.locator('[data-cojob="co-hartman"]').first().click(); await page.waitForTimeout(1200);
  if (await page.evaluate(() => S.tab !== 'co')) { await page.evaluate(() => setTab('co')); await page.waitForTimeout(400); }
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200; c.getContext('2d').fillRect(0, 0, 200, 200);
    const thumb = c.toDataURL('image/jpeg', 0.7); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
    const v = coVisit(CO.jobId);
    for (const id of ['ph-a', 'ph-b']) { await coPhotoPut({ id, blob, mime: 'image/jpeg' }); v.photos.push({ id, thumb, at: Date.now(), time: '10:42a' }); }
    coPersist(); coGo('photos');
  });
  await page.waitForTimeout(400);
  const tile = await page.locator('[data-corm="ph-a"]').first().boundingBox();
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height * 0.7); await page.waitForTimeout(500);
  check('a tap opens the photo; nothing is removed', [await page.evaluate(() => S.sheet), await page.evaluate(() => coVisit(CO.jobId).photos.length), await txt(page, '#sheetTitle')], ['coPhoto', 2, 'Foto']);
  check('…the full photo loads from the phone', await page.evaluate(() => /^blob:/.test(document.getElementById('coPhotoImg').src)), true);
  await page.locator('#coPhotoRm').click(); await page.waitForTimeout(200);
  check('the first tap on Remove asks again', [await txt(page, '#coPhotoRm'), await page.evaluate(() => coVisit(CO.jobId).photos.length)], ['Toca otra vez para quitarla', 2]);
  await page.locator('#coPhotoRm').click(); await page.waitForTimeout(400);
  check('the second removes it, file and all', [await page.evaluate(() => S.sheet), await page.evaluate(() => coVisit(CO.jobId).photos.map((p) => p.id)), await page.evaluate(async () => !!(await coPhotoGet('ph-a'))), await txt(page, '#toast')],
    [null, ['ph-b'], false, 'Foto quitada']);
  const tile2 = await page.locator('[data-corm="ph-b"]').first().boundingBox();
  await page.mouse.click(tile2.x + tile2.width / 2, tile2.y + tile2.height / 2); await page.waitForTimeout(300);
  await page.locator('#coPhotoKeep').click(); await page.waitForTimeout(300);
  check('Keep it closes and keeps it', [await page.evaluate(() => S.sheet), await page.evaluate(() => coVisit(CO.jobId).photos.length)], [null, 1]);
  check('no page errors (photo)', errs, []);
  await ctx.close();
}

// ---- D9: the unsigned-checks banner is for people who can sign ----
for (const [role, want] of [['crew', false], ['siteManager', true]]) {
  const { ctx, page } = await boot(`window.__MOCK_ROLE='${role}';`);
  check(`${role}: the "isn't signed off" banner ${want ? 'shows' : 'stays away'}`, await page.evaluate(() => nudgeVisits().length > 0), want);
  await ctx.close();
}

// ---- D10: blue text is readable on the dark ground; the Type button is gone ----
{
  const { ctx, page } = await boot("window.__MOCK_ROLE='siteManager';");
  const ratio = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (r, g, b) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    let bg = el; while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(bg).backgroundColor)) bg = bg.parentElement;
    const a = lum(...rgb(getComputedStyle(el).color)), b = lum(...rgb(getComputedStyle(bg || document.body).backgroundColor));
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  }, sel);
  await page.evaluate(() => setTab('jobs')); await page.waitForTimeout(1000);
  const go = await ratio('.jact.nav .a1');
  check('"Go here instead" reads at 4.5:1 or better', go === null || go >= 4.5, true);
  await page.evaluate(() => setTab('log')); await page.waitForTimeout(800);
  check('the day log: Record, and no Type button', [await page.locator('#dlTalk').count(), await page.locator('.talkbtn.type').count()], [1, 0]);
  await page.evaluate(() => { setTab('job'); openSheet('tellpm'); }); await page.waitForTimeout(300);
  check('Tell the PM: Record, and no Type button', [await page.locator('#tpmRec').count(), await page.locator('.talkbtn.type').count()], [1, 0]);
  await ctx.close();
}

// ---- D11: the overlay goes when the clock-in lands, not when the day reloads ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await page.evaluate(() => {
    const orig = apiCall;
    window.apiCall = apiCall = function (fn, args, co) { if (fn === 'getMyDay') return new Promise((r) => setTimeout(() => r(orig(fn, args, co)), 6000)); return orig.apply(this, arguments); };
  });
  await page.locator('#shopBtn').click();
  await page.waitForTimeout(1500);
  check('on the clock, and the screen is free, while the day still reloads', [await page.evaluate(() => !!S.open), await page.evaluate(() => document.getElementById('wait').classList.contains('on')), await page.evaluate(() => document.body.style.pointerEvents)],
    [true, false, '']);
  check('no page errors (overlay)', errs, []);
  await ctx.close();
}

// ---- D17: one press, one photo ----
{
  const { ctx, page } = await boot("window.__MOCK_ROLE='siteManager';");
  await page.evaluate(() => { setTab('cam'); }); await page.waitForTimeout(1500);
  const shots = await page.evaluate(async () => {
    if (!camStream) return 'no camera';
    let n = 0; const orig = captured; window.captured = captured = function () { n++; };
    S.lastShotAt = 0; shoot(); shoot(); await new Promise((r) => setTimeout(r, 600));
    window.captured = captured = orig;
    return n;
  });
  check('a double tap on the shutter takes one photo', shots, 1);
  await ctx.close();
}

// ---- D13: the sold scope is escaped ----
{
  const { ctx, page } = await boot("window.__MOCK_ROLE='service';");
  const html = await page.evaluate(() => {
    const j = { id: 'jx', soldScope: [{ name: 'Roof', number: '1', lines: [{ name: 'Shingles', quantity: 30, unit: '<img src=x onerror=alert(1)>' }] }] };
    CO.scope.jx = { open: true };
    return coScopeHtml(j);
  });
  check('a unit name with HTML in it is shown as text', [html.indexOf('<img') === -1, html.indexOf('&lt;img') > -1], [true, true]);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
