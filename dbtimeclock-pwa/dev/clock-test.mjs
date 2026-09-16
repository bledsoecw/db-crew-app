/* The clock with its photo gates, end to end against dev/mock.js. Nothing
   here ships.

     node dev/clock-test.mjs

   Needs a local static server on the port below and Playwright available.
   The mock records every clock call it is handed (window.__CLOCK) and
   refuses a clock-in, clock-out or switch with no photo id, the way Code.gs
   does — so the shutter really is the only way through. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

async function boot(init = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) return;
    const at = (m.location && m.location()) || {};
    if (/config\.js/.test(at.url || '')) return;
    errs.push(m.text());
  });
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;' + init);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const cls = (page, sel) => page.locator(sel).first().getAttribute('class');
const st = (page) => page.evaluate(() => ({ tab: S.tab, gate: S.clockGate, open: S.open && S.open.id, code: S.open && S.open.code && S.open.code.number, brk: !!S.onBreak, photos: S.photos.map((p) => [p.tag, p.codeId, p.pending]) }));
const calls = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CLOCK || [])));
// A gate commit waits on the phone's location (up to 2.5s here), so wait for
// the commit itself: the gate cleared and the screen no longer busy.
const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(200); };
const until = async (page, fn) => { await page.waitForFunction(fn, null, { timeout: 10000 }); await page.waitForTimeout(200); };
// The shutter, as captured() sees it.
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));

// ---- clock in: code, then the start photo; the shutter opens the entry ----
{
  const { ctx, page, errs } = await boot();
  check('the button says what comes next', await txt(page, '#clockIn .sm'), 'Code, then start photo');
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  let s = await st(page);
  check('the code opens the camera, locked to START, nothing created', [s.tab, s.gate, s.open, await txt(page, '.tab.on .tl')], ['cam', 'start', null, 'Clock']);
  check('the stamps, the amber bar, the locked tag row', [await txt(page, '#stampAddr'), await txt(page, '#stampCode'), await txt(page, '#afterBarT'), await page.locator('.tagbtn.on .tl').textContent(), await page.locator('.tagbtn.dim').count()], ['408 Euclid Ave · JT #26-0890', '04MA Masonry Labor', 'Start photo · the clock starts when you shoot', 'Start', 2]);
  check('Back on the left, No skip on the right, no video, no last shot', [await txt(page, '#camBackLbl'), await page.locator('#noSkip').isVisible(), await page.locator('#modeBtn').isVisible(), await page.locator('#lastShot').isVisible()], ['Back', true, false, false]);
  await tap(page, '.tagbtn[data-tag="during"]', 200).catch(() => {});
  check('the other tags are not tappable', await page.evaluate(() => S.capture), 'before');
  await tap(page, '#camBack', 400);
  s = await st(page);
  check('Back: the code sheet again, no entry', [s.tab, s.gate, s.open, await txt(page, '#sheetTitle'), (await calls(page)).length], ['job', null, null, 'What are you doing?', 0]);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  s = await st(page);
  const c = await calls(page);
  check('the shutter clocks in, with the photo id', [s.tab, s.gate, s.code, c.length, c[0].slice(0, 3), typeof c[0][3]], ['job', null, '04MA', 1, ['clockIn', 'j_2841', 'ci9'], 'string']);
  check('the photo is on the code, stamped with the entry, as START', [s.photos.map((p) => p.slice(0, 2)), await page.evaluate(() => fileDescription({ tag: 'before', entryId: S.open.id, codeLabel: codeLabel(S.open.code) }))], [[['before', 'ci9']], '#START #TE:open1 04MA Masonry Labor']);
  await page.waitForTimeout(1500);
  check('...and uploads on its own', await page.evaluate(() => S.photos.map((p) => [p.pending, p.fileId])), [[false, 'f1']]);
  check('the band says so', [/^Started \d+:\d\d[ap] with a start photo · 1 photo on this code$/.test(await txt(page, '#bandSub')), await txt(page, '#stopFoot')], [true, 'Photos go on the job in JobTread, tagged to 04MA. Stop opens Break · Switch · Clock out.']);
  check('two buttons, no remind strip', [await txt(page, '#photoBtn'), await txt(page, '#stopBtn'), await page.locator('#remind').count()], ['Take a photo', 'Stop the clock', 0]);

  // a progress shot
  await tap(page, '#photoBtn', 500);
  s = await st(page);
  check('Take a photo: the camera, unlocked, During, tagged to the running code', [s.tab, s.gate, await page.evaluate(() => S.capture), await page.locator('.tagbtn.dim').count(), await page.locator('#modeBtn').isVisible(), await page.locator('#afterBar').isVisible()], ['cam', null, 'during', 0, true, false]);
  check('...with this code\'s counts', await page.locator('.tagbtn .tc').allTextContents(), ['01', '00', '00']);
  await shoot(page);
  await page.waitForTimeout(1200);
  s = await st(page);
  check('...and back to the clock after the shot', [s.tab, s.photos.length, await page.evaluate(() => fileDescription({ tag: 'during', entryId: 'x', codeLabel: '' }))], ['job', 2, '#DURING #TE:x']);

  // the stop sheet
  await tap(page, '#stopBtn', 400);
  check('Stop the clock: three rows and the fine print', [await txt(page, '#sheetTitle'), await page.locator('.stoprow .st').allTextContents(), await page.locator('.stoprow .ss').allTextContents(), /^Your \d+:\d\d on 04MA is already saved\. Nothing here can lose time\.$/.test(await txt(page, '#sheetBody .fine'))],
    ['Stop the clock', ['Break', 'Switch code or job', 'Clock out for the day'], ['Back soon · no photo', 'End photo of 04MA first', 'End photo, then today’s log'], true]);
  await tap(page, '#sheetClose', 300);

  // a break: no photo
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopBreak', 200);
  await until(page, () => !!S.onBreak && document.body.style.pointerEvents === '');
  s = await st(page);
  check('Break closes the block with no photo', [s.open, s.brk, (await calls(page)).slice(-1)[0]], [null, true, ['startBreak']]);
  check('the band pauses and says so', [/^On break · \d+:\d\d[ap]$/.test(await txt(page, '#band .lbl')), await cls(page, '#band'), await page.locator('#backBtn').isVisible(), await page.locator('#runStack').isVisible(), await page.locator('#clockIn').isVisible()], [true, 'paused', true, false, false]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('the break survives a reload', [await page.evaluate(() => !!S.onBreak), await page.locator('#backBtn').isVisible()], [true, true]);
  await tap(page, '#backBtn', 200);
  await until(page, () => !!S.open && document.body.style.pointerEvents === '');
  s = await st(page);
  check('Back to work re-opens the same code, no start photo', [s.code, s.brk, (await calls(page)).slice(-1)[0]], ['04MA', false, ['endBreak', 'j_2841', 'ci9']]);

  // a switch: the end photo, then the code, then the start photo — one call
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopSwitch', 600);
  s = await st(page);
  check('Switch: the camera, locked to END', [s.tab, s.gate, await txt(page, '#afterBarT'), await txt(page, '#camBackLbl'), await page.locator('.tagbtn.on .tl').textContent()], ['cam', 'end-switch', 'End photo of 04MA · you switch when you shoot', 'Stay on', 'End']);
  check('...the stamp carries the time on the code', /^04MA Masonry Labor · \d+:\d\d$/.test(await txt(page, '#stampCode')), true);
  await tap(page, '#camBack', 400);
  s = await st(page);
  check('Stay on: back to the clock, nothing changes', [s.tab, s.gate, s.code, (await calls(page)).slice(-1)[0][0]], ['job', null, '04MA', 'endBreak']);
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopSwitch', 600);
  await shoot(page);
  await page.waitForTimeout(800);
  s = await st(page);
  check('the end photo opens the code sheet; the clock is still running', [s.tab, s.gate, s.code, await txt(page, '#sheetTitle'), await page.evaluate(() => !!S.switching)], ['job', null, '04MA', 'Switch code', true]);
  await tap(page, '#sheetClose', 300);
  check('backing out leaves the clock running, the switch forgotten', [await page.evaluate(() => !!S.switching), (await st(page)).code], [false, '04MA']);
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopSwitch', 600);
  await shoot(page);
  await page.waitForTimeout(800);
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  s = await st(page);
  check('the next code: the camera, locked to START, for that code', [s.tab, s.gate, await txt(page, '#stampCode'), await page.locator('.tagbtn .tc').allTextContents()], ['cam', 'start', '02ST-1 Final Clean', ['00', '00', '00']]);
  await tap(page, '#camBack', 400);
  check('Back from the start photo: the code sheet again, still on the old code', [await txt(page, '#sheetTitle'), (await st(page)).code], ['Switch code', '04MA']);
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  await shoot(page);
  await settle(page);
  s = await st(page);
  const sw = (await calls(page)).slice(-1)[0];
  check('the start photo commits the switch: one call, both photo ids', [s.code, s.gate, sw.slice(0, 3), typeof sw[3], typeof sw[4], sw[3] !== sw[4]], ['02ST-1', null, ['switchCode', 'j_2841', 'ci5'], 'string', 'string', true]);
  check('the end photo is on the old code, the start photo on the new', await page.evaluate(() => S.photos.slice(-2).map((p) => [p.tag, p.codeId])), [['after', 'ci9'], ['before', 'ci5']]);

  // clock out: the end photo, then the day log
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopOut', 600);
  check('Clock out: the camera, locked to END', [await page.evaluate(() => S.clockGate), await txt(page, '#afterBarT')], ['end-out', 'End photo of 02ST-1 · you clock out when you shoot']);
  await shoot(page);
  await settle(page);
  s = await st(page);
  const out = (await calls(page)).slice(-1)[0];
  check('the shutter clocks out, with the photo id', [s.open, s.gate, out[0], typeof out[1]], [null, null, 'clockOut', 'string']);
  check('...and lands on the Day log with the nudge', [s.tab, await txt(page, '.promptbox .pe'), await txt(page, '.promptbox .pt')], ['log', 'Today’s log · not sent', 'Send it before you go?']);
  await tap(page, '#dlNormal', 1500);
  check('sending the log clears the nudge', await page.locator('.promptbox').count(), 0);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- leaving the camera by a tab drops the gate ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await tap(page, '.tab[data-tab="log"]', 400);
  check('a start photo not taken is no entry', [await page.evaluate(() => S.clockGate), await page.evaluate(() => S.open), (await calls(page)).length], [null, null, 0]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the API refuses a write with no photo — the gate cannot be skipped ----
{
  const { ctx, page, errs } = await boot();
  const tryCall = (fn, args) => page.evaluate(([f, a]) => apiCall(f, a).then(() => 'ok', (e) => e.message), [fn, args]);
  check('clockIn without a photo', /PHOTO_REQUIRED/.test(await tryCall('clockIn', ['j_2841', 'ci9', null, ''])), true);
  check('clockOut without a photo', /PHOTO_REQUIRED/.test(await tryCall('clockOut', [null, ''])), true);
  check('switchCode without the end photo', /PHOTO_REQUIRED/.test(await tryCall('switchCode', ['j_2841', 'ci9', null, '', 'x'])), true);
  check('...or the start photo', /PHOTO_REQUIRED/.test(await tryCall('switchCode', ['j_2841', 'ci9', null, 'x', ''])), true);
  check('a refused clock-in from the camera leaves the clock as it was, with the reason', await (async () => {
    await page.evaluate(() => { window.__MOCK_READONLY = true; });
    await tap(page, '#clockIn', 300);
    await tap(page, '.coderow:has-text("Masonry Labor")', 600);
    await page.evaluate(() => { const real = window.apiCall; window.apiCall = (fn, args) => fn === 'clockIn' ? Promise.reject(Object.assign(new Error('READ_ONLY'), { readOnly: true })) : real(fn, args); });
    await shoot(page);
    await settle(page);
    return [await page.evaluate(() => S.tab), await page.evaluate(() => S.open), await page.evaluate(() => S.clockGate), await page.evaluate(() => S.photos.length), await txt(page, '#toast span')];
  })(), ['job', null, null, 0, 'Read-only build — nothing was posted']);
  check('no page errors', errs, []);
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
