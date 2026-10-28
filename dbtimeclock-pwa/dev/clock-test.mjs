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

async function boot(init = '', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (opts.clock) await page.clock.install();
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
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
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
    ['Stop the clock', ['Break', 'Switch code or job', 'Leave for another job', 'Clock out for the day'], ['15, 30, 45 or 60 min · no photo', 'End photo of 04MA first', 'End photo here, then the drive', 'End photo, then today’s log'], true]);
  await tap(page, '#sheetClose', 300);

  // a break (T2.13): pick how long; JobTread's shape — the block ends, the
  // next one waits in JobTread for when the break is over. No photo.
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopBreak', 300);
  check('Break asks how long: JobTread\u2019s four lengths, each saying when the clock restarts',
    [await txt(page, '#sheetTitle'), await page.locator('.brkopt .bt').allTextContents(), (await page.locator('.brkopt .bs').allTextContents()).every((t) => /^back \d+:\d\d[ap]$/.test(t)), /^Your \d+:\d\d on 04MA is saved\. The clock starts again by itself when the break ends/.test(await txt(page, '#sheetBody .fine'))],
    ['How long a break?', ['0:15', '0:30', '0:45', '1:00'], true, true]);
  const brkTile = await page.locator('.brkopt').first().boundingBox();
  check('the tiles are big', brkTile.height >= 90, true);
  await tap(page, '.brkopt[data-brk="30"]', 200);
  await until(page, () => onBreakNow() && document.body.style.pointerEvents === '');
  s = await st(page);
  const brk = await page.evaluate(() => ({ left: breakLeft(), id: S.open.id, brk: S.brk && S.brk.minutes }));
  check('one call; the clock now points at the block after the break', [(await calls(page)).slice(-1)[0], brk.id, brk.brk, brk.left > 29 * 60 - 2 && brk.left <= 30 * 60, s.brk], [['startBreak', 30, 'en'], 'open2', 30, true, false]);
  check('the band counts down, paused, and says when the clock restarts',
    [/^On break · back at \d+:\d\d[ap]$/.test(await txt(page, '#band .lbl')), /^(29:\d\d|30:00)$/.test(await txt(page, '#elapsed')), await cls(page, '#band'), await txt(page, '#backBtn'), await page.locator('#runStack').isVisible(), await page.locator('#clockIn').isVisible(), /^30-minute break · started \d+:\d\d[ap] · \d+:\d\d on 04MA saved$/.test(await txt(page, '#bandSub'))],
    [true, true, 'paused', 'End break', false, false, true]);
  check('…and the reminders, in words', /The clock starts again by itself at \d+:\d\d[ap]\. Back early\? End break starts it now\.$/.test(await txt(page, '#breakFoot')), true);
  check('no job change in the middle of a break', [await txt(page, '#pickJobLbl'), await page.locator('#pickJobBtn').isDisabled()], ['End your break to change job', true]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('the break survives a reload — it is JobTread\u2019s open entry', [await page.evaluate(() => onBreakNow() && !!S.brk), await txt(page, '#backBtn'), /^30-minute break/.test(await txt(page, '#bandSub'))], [true, 'End break', true]);
  await tap(page, '#backBtn', 200);
  await until(page, () => !!S.open && !onBreakNow() && document.body.style.pointerEvents === '');
  s = await st(page);
  check('End break early: the waiting block goes, one starts now on the same code', [s.code, s.open, (await calls(page)).slice(-1)[0], await page.evaluate(() => S.brk), await txt(page, '#band .lbl')], ['04MA', 'open3', ['endBreak', 'j_2841', 'ci9'], null, 'On the clock']);

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

// ---- My jobs: Go here instead, on the clock, is the end photo first ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('the other cards say end photo first while on the clock', await page.locator('.jcard:has-text("Lucas") .jact .a1, .jcard:has-text("Lucas") .jact .a2').allTextContents(), ['Go here instead', 'End photo first']);
  await tap(page, '.jcard:has-text("Lucas") [data-go]', 600);
  check('...and open the camera locked to END, for a move', [await page.evaluate(() => S.tab), await page.evaluate(() => S.clockGate), await page.evaluate(() => S.pendingJob && S.pendingJob.id), await txt(page, '#afterBarT')], ['cam', 'end-switch', 'j2', 'End photo of 04MA · you switch when you shoot']);
  await shoot(page);
  await page.waitForTimeout(900);
  await settle(page);
  check('then the next job\'s codes', await txt(page, '#sheetTitle'), 'Code at Lucas');
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  await shoot(page);
  await settle(page);
  check('then the start photo there, and the clock is at the next roof', [await txt(page, '#jobAddr'), (await st(page)).code, (await calls(page)).slice(-1)[0].slice(0, 3)], ['812 S Washington St', '02ST-1', ['switchCode', 'j2', 'ci5']]);
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

// ---- T2.5: the wait curtain, the search that draws at once, the codes kept on the phone ----
{
  const { ctx, page, errs } = await boot();
  // The curtain: up at once, counted, down when the work ends; nested callers share it.
  check('busy(true) puts the curtain up and blocks taps', await page.evaluate(() => { busy(true, 'Clocking in…'); return [document.getElementById('wait').classList.contains('on'), document.getElementById('waitT').textContent, document.body.style.pointerEvents]; }), [true, 'Clocking in…', 'none']);
  await page.waitForTimeout(2300);
  check('…after two seconds it counts the wait aloud', /^Still working · \d+s$/.test(await page.evaluate(() => document.getElementById('waitS').textContent)), true);
  check('…a second caller keeps it up; the last one takes it down', await page.evaluate(() => { busy(true); busy(false); const mid = document.getElementById('wait').classList.contains('on'); busy(false); return [mid, document.getElementById('wait').classList.contains('on'), document.body.style.pointerEvents]; }), [true, false, '']);

  // The search: what the phone knows draws before JobTread answers.
  await page.evaluate(() => { const real = window.apiCall; window.apiCall = (fn, args, co) => fn === 'searchJobs' ? new Promise((res) => setTimeout(() => res(real(fn, args, co)), 1500)) : real(fn, args, co); });
  await tap(page, '#pickJobBtn', 400);
  await page.locator('#jobSearch').fill('lucas');
  await page.waitForTimeout(120);
  check('typing draws the local match at once, and says JobTread is still being asked', await page.evaluate(() => [[...document.querySelectorAll('#jobResults .jobrow')].map((r) => r.getAttribute('data-job')), !!document.getElementById('jobSearching')]), [['j2'], true]);
  await page.waitForTimeout(2200);
  check('…JobTread\'s answer is merged in when it lands', await page.evaluate(() => [[...document.querySelectorAll('#jobResults .jobrow')].map((r) => r.getAttribute('data-job')), !!document.getElementById('jobSearching')]), [['j_2841', 'j2'], false]);
  // The box stays put while the list underneath it scrolls (T2.6).
  check('the search box is pinned to the top of the sheet', await page.evaluate(() => { const b = document.getElementById('sheetBody'); b.scrollTop = 9999; const r = document.getElementById('jobSearch').getBoundingClientRect(), s = b.getBoundingClientRect(); return [document.getElementById('sheet').classList.contains('tall'), r.top >= s.top, r.bottom <= s.bottom]; }), [true, true, true]);
  await page.locator('#jobSearch').fill('26-1045');
  await page.waitForTimeout(120);
  check('a number finds the job on the phone before the API answers', await page.evaluate(() => [...document.querySelectorAll('#jobResults .jobrow')].map((r) => r.getAttribute('data-job'))), ['j2']);
  await page.locator('#jobSearch').press('Enter');
  await page.waitForTimeout(400);
  check('Enter picks the one row showing', await page.evaluate(() => [S.sheet, S.job && S.job.id]), [null, 'j2']);
  // The codes for the picked job are kept on the phone for the shift.
  await until(page, () => !!codesCached('j2'));
  check('the code list is kept on the phone (the boot job\'s too, from the extras)', await page.evaluate(() => [codesCached('j2').length, Object.keys(codesCache()).sort()]), [11, ['j2', 'j_2841']]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.9: From my photos on the camera — never on a START or END photo ----
{
  const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const exifJpeg = (when) => {
    const str = Buffer.from(when + '\0', 'ascii'), tiff = Buffer.alloc(44 + str.length);
    tiff.write('II', 0, 'ascii'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x8769, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18); tiff.writeUInt32LE(0, 22);
    tiff.writeUInt16LE(1, 26); tiff.writeUInt16LE(0x9003, 28); tiff.writeUInt16LE(2, 30); tiff.writeUInt32LE(str.length, 32); tiff.writeUInt32LE(44, 36); tiff.writeUInt32LE(0, 40);
    str.copy(tiff, 44);
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]), head = Buffer.alloc(4);
    head.writeUInt16BE(0xFFE1, 0); head.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([JPEG.subarray(0, 2), head, body, JPEG.subarray(2)]);
  };
  const { ctx, page, errs } = await boot();
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  check('locked to the START photo: no From my photos', await page.locator('#galBtn').isVisible(), false);
  check('…and a picked photo could not get through even if asked', await page.evaluate(() => { captured(new Blob(['x'], { type: 'image/jpeg' }), 'image/jpeg', { fromPhone: true }); return [S.clockGate, S.photos.length]; }), ['start', 0]);
  await shoot(page);
  await settle(page);
  await tap(page, '#photoBtn', 500);
  check('Take a photo: From my photos under the tags', [await page.locator('#galBtn').isVisible(), await txt(page, '#galBtn')], [true, 'From my photos']);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#galBtn').click()]);
  check('…several at once', chooser.isMultiple(), true);
  await chooser.setFiles([{ name: 'IMG_1.jpg', mimeType: 'image/jpeg', buffer: exifJpeg('2026:10:12 14:10:05') }, { name: 'IMG_2.jpg', mimeType: 'image/jpeg', buffer: JPEG }]);
  await until(page, () => S.photos.length === 3);
  await page.waitForTimeout(2200);
  const ph = await page.evaluate(() => S.photos.slice(1).map((p) => [p.tag, p.fromPhone, p.name.replace(/-[A-Z]+\.jpg$/, '')]));
  check('two photos on the running code, from the phone, named by when they were taken', [ph[0][0], ph[0][1], ph[0][2], ph[1][1], /^\d{8}-\d{6}-PHONE-DURING$/.test(ph[1][2])], ['during', true, '20261012-141005-PHONE-DURING', true, true]);
  const files = await page.evaluate(() => (window.__FILES || []).map((f) => f.desc));
  check('in JobTread they say so, and never look like a START photo', files.slice(1),
    ['#PHONE DURING #TE:open1 04MA Masonry Labor · picked from the phone\'s photos, taken Oct 12, 2026 2:10p', '#PHONE DURING #TE:open1 04MA Masonry Labor · picked from the phone\'s photos, time taken unknown']);
  check('…and back to the clock after the last one', await page.evaluate(() => S.tab), 'job');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a break that runs its full length, on the phone's own clock ----------
{
  const { ctx, page, errs } = await boot('', { clock: true });
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopBreak', 300);
  await tap(page, '.brkopt[data-brk="15"]', 200);
  await until(page, () => onBreakNow() && document.body.style.pointerEvents === '');
  const left = await page.evaluate(() => breakLeft());
  await page.clock.fastForward(Math.round((left - 4 * 60 - 20) * 1000));
  await page.waitForTimeout(1300);
  check('5 minutes out: the phone says so once (the push comes from the server)',
    [await page.evaluate(() => !!S.brk.cue5), /^Break ends in 4 min · back at \d+:\d\d[ap]$/.test(await txt(page, '#toast span')), /^4:\d\d$/.test(await txt(page, '#elapsed'))], [true, true, true]);
  await page.clock.fastForward(5 * 60 * 1000);
  await page.waitForTimeout(1300);
  check('the break runs out: the clock is running again by itself, and the screen says so',
    [await page.evaluate(() => [onBreakNow(), breakOver(), !!S.brk.cue0]), /^Break over · clock on since \d+:\d\d[ap]$/.test(await txt(page, '#band .lbl')), await cls(page, '#band'), await txt(page, '#backBtn'), /^0:00:\d\d$/.test(await txt(page, '#elapsed'))],
    [[false, true, true], true, '', 'End break', true]);
  const n = (await calls(page)).length;
  await tap(page, '#backBtn', 300);
  check('End break after it ran out writes nothing — it only stops the reminder',
    [await page.evaluate(() => [S.brk, S.open.id]), (await calls(page)).slice(n), await txt(page, '#band .lbl')], [[null, 'open2'], [['endBreak', 'j_2841', 'ci9']], 'On the clock']);

  // out for the day from a break: the waiting block goes, no photo
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopBreak', 300);
  await tap(page, '.brkopt[data-brk="45"]', 200);
  await until(page, () => onBreakNow() && document.body.style.pointerEvents === '');
  check('the Clock out button on a break', await txt(page, '#breakOutBtn'), 'Clock out for the day');
  await tap(page, '#breakOutBtn', 200);
  await until(page, () => !S.open && document.body.style.pointerEvents === '');
  check('Clock out from a break: no photo, the waiting block gone, today\u2019s log next',
    [(await calls(page)).slice(-1)[0], await page.evaluate(() => [S.brk, S.tab])], [['clockOut', null], [null, 'log']]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- an Apps Script from before T2.13: the old break still works ----------
{
  const { ctx, page, errs } = await boot('window.__MOCK_OLD_BREAK=true;');
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  await tap(page, '#stopBtn', 300);
  await tap(page, '#stopBreak', 300);
  await tap(page, '.brkopt[data-brk="30"]', 200);
  await until(page, () => !!S.onBreak && document.body.style.pointerEvents === '');
  let s = await st(page);
  check('old server: the block closes, the old break', [s.open, s.brk, await txt(page, '#backBtn'), /^On break · \d+:\d\d[ap]$/.test(await txt(page, '#band .lbl'))], [null, true, 'Back to work', true]);
  await tap(page, '#backBtn', 200);
  await until(page, () => !!S.open && document.body.style.pointerEvents === '');
  s = await st(page);
  check('…and Back to work re-opens the code', [s.code, s.brk, (await calls(page)).slice(-1)[0]], ['04MA', false, ['endBreak', 'j_2841', 'ci9']]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the foreman sees who is on a break ----------------------------------
{
  const { ctx, page, errs } = await boot('window.__MOCK_FOREMAN=true;window.__MOCK_CREW_BREAK=true;');
  await page.waitForFunction(() => S.crew && S.crew.length === 4, null, { timeout: 10000 });
  await page.evaluate(() => render());
  check('a break is named, and not counted as on',
    [await txt(page, '#crewK'), await page.locator('.crewrow.brk').count(), /^On break · back \d+:\d\d[ap] · 26-0890/.test(await txt(page, '.crewrow.brk .cs')), await txt(page, '.crewrow.brk .ct')],
    ['Crew · 3 on · 1 on break', 1, true, 'Break']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.17: At the shop is one tap; the code sheet is the job's clock-in list ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  check('off the clock: At the shop sits under Clock in', [await page.locator('#shopRow').isVisible(), await txt(page, '#shopBtn'), await txt(page, '#shopOther')],
    [true, 'At the shopMorning clock-in · start photo', 'Other shop work']);
  await tap(page, '#shopBtn', 600);
  let s = await st(page);
  check('one tap: the shop\'s Morning Clock-In, straight to the start photo', [s.tab, s.gate, await page.evaluate(() => [S.job && S.job.id, S.gateCode && S.gateCode.number, S.sheet])], ['cam', 'start', ['shop', '99TM-1', null]]);
  check('…the stamps name the shop and the code', await txt(page, '#stampCode'), '99TM-1 Morning Clock-In');
  await shoot(page); await settle(page);
  s = await st(page);
  check('the shutter clocks in at the shop', [(await calls(page)).map((c) => c.slice(0, 3)), s.code, await txt(page, '#jobK'), await txt(page, '#jobAddr')],
    [[['clockIn', 'shop', 'sh1']], '99TM-1', 'At the shop · JT #25-0011', 'The shop']);
  check('on the clock, the shop row is gone', await page.locator('#shopRow').isVisible(), false);
  await ctx.close();
  check('no page errors', errs, []);
}
{
  // Other shop work: the shop's own five, and nothing else.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await tap(page, '#shopOther', 600);
  check('Other shop work is the shop\'s own list', [await txt(page, '#sheetTitle'), await page.locator('.coderow .cname').allTextContents()],
    ['What are you doing?', ['Morning Clock-In', 'Training', 'Crew Labor - Monroe St.', 'Crew Labor - Bonnewitz Ave.', 'Shop Work/Maintenance']]);
  await ctx.close();
  check('no page errors', errs, []);
}
{
  // Administrative is an office code: the field never sees it on a sheet;
  // Operations does. An API from before T2.17 names no shop: no row.
  const fix = `window.__MOCK_FIX = { codes: [
    { id: 'ci1', name: 'General Requirements', number: '01GR', codeName: 'General Requirements', office: false },
    { id: 'ci2', name: 'Roofing', number: '07TM-1', codeName: 'Roofing', office: false },
    { id: 'ci3', name: 'Administrative', number: '99TM-7', codeName: 'Administrative', office: true } ] };`;
  for (const [role, want] of [['crew', ['General Requirements', 'Roofing']], ['siteManager', ['General Requirements', 'Roofing']], ['ops', ['General Requirements', 'Roofing', 'Administrative']]]) {
    const { ctx, page, errs } = await boot(`window.__MOCK_ROLE='${role}';window.__MOCK_NOSHOP=true;` + fix);
    await tap(page, '#clockIn', 500);
    check(`${role}: the code sheet`, await page.locator('.coderow .cname').allTextContents(), want);
    if (role === 'crew') check('an API that names no shop draws no shop row', await page.evaluate(() => [!!S.shop, document.getElementById('shopRow').classList.contains('hidden')]), [false, true]);
    await ctx.close();
    check('no page errors', errs, []);
  }
}

// ---- T2.18: the drive — from the shop to the job, the job back to the shop ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await tap(page, '#shopBtn', 600); await shoot(page); await settle(page);
  await tap(page, '#stopBtn', 300);
  check('at the shop, Stop offers Leave for the job', await txt(page, '#stopTravel .st'), 'Leave for the job');
  await tap(page, '#stopTravel', 500);
  check('…the end photo first, where you still are', [await page.evaluate(() => [S.tab, S.clockGate]), await txt(page, '#afterBarT')], [['cam', 'end-travel'], 'End photo of 99TM-1 · you start the drive when you shoot']);
  await shoot(page); await until(page, () => S.sheet === 'dest');
  check('…then Where are you going? — today\'s booked job, another job; no drive back from the shop', [await txt(page, '#sheetTitle'), await page.locator('#sheetBody .stoprow .st').allTextContents()],
    ['Where are you going?', ['Noah Webster', 'Another job']]);
  await tap(page, '[data-dest="j_2841"]', 300); await settle(page);
  let c = (await calls(page)).slice(-1)[0];
  check('one call: the drive opens on that job\'s travel line, with the shop\'s end photo, saying where to', [c[0], c[1], c[2], typeof c[3], c[4]],
    ['startTravel', 'j_2841', 'ci11', 'string', 'Drive to 26-0890 Noah Webster · from the shop']);
  check('the band is the drive; the buttons are the arrival', [await txt(page, '#band .lbl'), await txt(page, '#jobK'), await page.locator('#travelStack').isVisible(), await page.locator('#runStack').isVisible(), await txt(page, '#arriveBtn'), await txt(page, '#travelOut')],
    ['Driving to Noah Webster', 'Driving to · JT #26-0890', true, false, 'I’m here · start work', 'Clock out · done for the day']);
  await tap(page, '#arriveBtn', 600);
  check('I\'m here: no end photo, the job\'s codes — the travel line is not one of them', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), (await page.locator('.coderow .cname').allTextContents()).includes('Travel Related Labor'), await page.locator('.coderow').count()],
    [['job', null, 'codes'], false, 10]);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  check('…the start photo on site', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'start']);
  await shoot(page); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('…one switch, with no end photo for the drive', [c[0], c[1], c[2], c[3], typeof c[4], await page.evaluate(() => S.open.code.number)], ['switchCode', 'j_2841', 'ci9', null, 'string', '04MA']);
  // The end of the day: back to the shop, on this job's travel line.
  await tap(page, '#stopBtn', 300); await tap(page, '#stopTravel', 500); await shoot(page); await until(page, () => S.sheet === 'dest');
  check('away from the shop, the drive back is offered, on this job\'s line', [await page.locator('#sheetBody .stoprow .st').allTextContents(), await txt(page, '#destBack .ss')],
    [['Another job', 'Back to the shop · end of the day'], 'On 26-0890 Noah Webster’s travel line']);
  await tap(page, '#destBack', 300); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('the drive back is paid travel on the job just left', [c[0], c[1], c[2], c[4], await txt(page, '#band .lbl'), await txt(page, '#arriveBtn'), await txt(page, '#travelOut'), await page.locator('#travelElse').isVisible()],
    ['startTravel', 'j_2841', 'ci11', 'Drive back · end of the day · from 26-0890 Noah Webster', 'Driving back · end of the day', 'At the shop · shop work', 'Clock out · I’m back', false]);
  await tap(page, '#travelOut', 300); await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  c = (await calls(page)).slice(-1)[0];
  check('Clock out from the drive: no photo, and a site manager lands on the day log', [c, await page.evaluate(() => [!!S.open, S.tab])], [['clockOut', null], [false, 'log']]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // A job with no travel line: the drive asks which of its lines to drive on.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_NOTRAVEL=true;');
  await tap(page, '#clockIn', 400); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page);
  await tap(page, '#stopBtn', 300); await tap(page, '#stopTravel', 500); await shoot(page); await until(page, () => S.sheet === 'dest');
  await tap(page, '#destOther', 500);
  check('Another job is the job search', [await page.evaluate(() => [S.sheet, S.travelPick])], [['jobs', true]]);
  await tap(page, '.jobrow[data-job="j2"]', 600);
  check('no travel line there: its own lines, asked', [await txt(page, '#sheetTitle'), await page.locator('[data-tcode]').count() > 0], ['No travel line at Lucas', true]);
  await tap(page, '[data-tcode="ci2"]', 300); await settle(page);
  const c = (await calls(page)).slice(-1)[0];
  check('…and the drive goes on the line picked', [c[0], c[1], c[2], c[4], await page.evaluate(() => [S.job.id, onTravel()])], ['startTravel', 'j2', 'ci2', 'Drive to 26-1045 Lucas · from 26-0890 Noah Webster', ['j2', false]]);
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
