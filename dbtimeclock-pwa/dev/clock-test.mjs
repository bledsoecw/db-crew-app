/* The clock with its photo gates, end to end against dev/mock.js. Nothing
   here ships.

     node dev/clock-test.mjs

   Needs a local static server on the port below and Playwright available.
   The mock records every clock call it is handed (window.__CLOCK) and asks
   for photos the way Code.gs does since T2.23 — a start photo when work
   starts at a site not started today, an end photo when a site is left for
   the day, none at the shop — so where a photo is owed, the shutter really
   is the only way through. */
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
  check('the band says so', [/^Started \d+:\d\d[ap] with a start photo · 1 photo on this code$/.test(await txt(page, '#bandSub')), await txt(page, '#stopFoot')], [true, 'A start photo when you start here, an end photo when you leave for the day — nothing in between.']);
  check('the four buttons (T2.23), Take a photo under them, no remind strip', [await page.locator('.clkgrid .cbtn').allTextContents(), await txt(page, '#photoBtn'), await txt(page, '#photoNote'), await page.locator('#remind').count()],
    [['Break', 'Change code', 'Leave the site', 'Clock out'], 'Take a photo', 'Photos through the day go in DB Cam.', 0]);
  const cb = await page.locator('.clkgrid .cbtn').first().boundingBox();
  check('…big enough for a glove', cb.height >= 90, true);

  // a progress shot
  await tap(page, '#photoBtn', 500);
  s = await st(page);
  check('Take a photo: the camera, unlocked, During, tagged to the running code', [s.tab, s.gate, await page.evaluate(() => S.capture), await page.locator('.tagbtn.dim').count(), await page.locator('#modeBtn').isVisible(), await page.locator('#afterBar').isVisible()], ['cam', null, 'during', 0, true, false]);
  check('...with this code\'s counts', await page.locator('.tagbtn .tc').allTextContents(), ['01', '00', '00']);
  await shoot(page);
  await page.waitForTimeout(1200);
  s = await st(page);
  check('...and back to the clock after the shot', [s.tab, s.photos.length, await page.evaluate(() => fileDescription({ tag: 'during', entryId: 'x', codeLabel: '' }))], ['job', 2, '#DURING #TE:x']);

  // Leave the site (T2.23): four ways out, each saying what it costs.
  await tap(page, '#leaveBtn', 400);
  check('Leave the site: four rows and the fine print', [await txt(page, '#sheetTitle'), await page.locator('.stoprow .st').allTextContents(), await page.locator('.stoprow .ss').allTextContents(), await txt(page, '#sheetBody .fine')],
    ['Leaving Noah Webster', ['Supply run · back here after', 'Another job · back here later', 'Another job · done here today', 'Back to the shop · done here today'],
     ['On this job’s travel line · no photo', 'The drive · no photo — you’re coming back', 'Today’s log, the end photo, then the drive', 'Today’s log, the end photo, then the drive back — paid travel'],
     'Going home? Clock out instead. Site managers send today’s log before leaving the site for the day.']);
  await tap(page, '#sheetClose', 300);

  // a break (T2.13): pick how long; JobTread's shape — the block ends, the
  // next one waits in JobTread for when the break is over. No photo.
  await tap(page, '#breakBtn', 300);
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

  // Change code (T2.23): the same site, no photos — one call, the code changes.
  const before = (await st(page)).photos.length;
  await tap(page, '#codeBtn', 400);
  check('Change code: this job\'s codes', [await txt(page, '#sheetTitle'), (await page.locator('.coderow.on .cname').allTextContents())], ['Change code', ['Masonry Labor']]);
  await tap(page, '.coderow:has-text("Final Clean")', 300);
  await settle(page);
  s = await st(page);
  const sw = (await calls(page)).slice(-1)[0];
  check('…no camera: one switch with no photo ids, and the clock on the new code', [s.tab, s.gate, s.code, sw, s.photos.length], ['job', null, '02ST-1', ['switchCode', 'j_2841', 'ci5', null, null, null], before]);

  // Clock out (T2.23): a site manager sends today's log first, on site;
  // then the end photo of the site clocks out.
  await tap(page, '#outBtn', 600);
  s = await st(page);
  check('Clock out: the Day log first, saying why', [s.tab, s.gate, await txt(page, '.promptbox .pe'), await txt(page, '.promptbox .pt'), (await calls(page)).slice(-1)[0][0]],
    ['log', null, 'Leaving Noah Webster for the day', 'Send today’s log first', 'switchCode']);
  await tap(page, '#dlNormal', 900);
  check('…the log on its way, the end photo next', [await page.evaluate(() => [S.tab, S.clockGate]), await txt(page, '#afterBarT')], [['cam', 'end-out'], 'End photo of Noah Webster · you clock out when you shoot']);
  await shoot(page);
  await settle(page);
  s = await st(page);
  const out = (await calls(page)).slice(-1)[0];
  check('the shutter clocks out, with the photo id', [s.open, s.gate, out[0], typeof out[1]], [null, null, 'clockOut', 'string']);
  check('…and the log already went, so it lands on the clock', [s.tab, await page.evaluate(() => (window.__LOGS || []).length)], ['job', 1]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- My jobs: Go here instead, on the clock, asks what happened (T2.23) ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('the other cards say it moves the clock', await page.locator('.jcard:has-text("Lucas") .jact .a1, .jcard:has-text("Lucas") .jact .a2').allTextContents(), ['Go here instead', 'Moves the clock']);
  await tap(page, '.jcard:has-text("Lucas") [data-go]', 600);
  check('…not an end photo of somewhere they may have left: what happened?', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet, S.pendingJob && S.pendingJob.id]), await txt(page, '#sheetTitle'), await page.locator('#sheetBody .stoprow .st').allTextContents()],
    [['job', null, 'moveHow', 'j2'], 'Still on the clock', ['Driving there · back here later', 'Driving there · done here today', 'Already there — I left Noah Webster at…', 'Wrong job — I was never at Noah Webster']]);
  await tap(page, '#sheetClose', 300);
  check('backing out: still at Webster, nothing moved', await page.evaluate(() => [S.sheet, S.pendingJob, S.moving, S.job.id, (window.__CLOCK || []).length]), [null, null, false, 'j_2841', 1]);
  await tap(page, '.tab[data-tab="jobs"]', 600);
  await tap(page, '.jcard:has-text("Lucas") [data-go]', 600);
  await tap(page, '[data-move="wrong"]', 600);
  check('Wrong job: the next job\'s codes', await txt(page, '#sheetTitle'), 'Code at Lucas');
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  check('…a job not started today owes its start photo', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'start']);
  await shoot(page);
  await settle(page);
  const c = (await calls(page)).slice(-1)[0];
  check('…one switch, no end photo, and the entry says it was the wrong job', [await txt(page, '#jobAddr'), (await st(page)).code, c[0], c[1], c[2], c[3], typeof c[4], c[5]],
    ['812 S Washington St', '02ST-1', 'switchCode', 'j2', 'ci5', null, 'string', 'Changed from Noah Webster in DB Crew — wrong job']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- Go here instead, then Driving there · back here later: the drive, no photo, no log ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  await shoot(page);
  await settle(page);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '.jcard:has-text("Lucas") [data-go]', 600);
  await tap(page, '[data-move="drive-later"]', 600); await settle(page);
  const c = (await calls(page)).slice(-1)[0];
  check('coming back to Webster: no camera, no log, straight to the drive to Lucas', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet, onTravel()]), c[0], c[1], c[3], c[5]],
    [['job', null, null, true], 'startTravel', 'j2', null, false]);
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

// ---- the API refuses a write with no photo where one is owed (T2.23) ----
{
  const { ctx, page, errs } = await boot();
  const tryCall = (fn, args) => page.evaluate(([f, a]) => apiCall(f, a).then(() => 'ok', (e) => e.message), [fn, args]);
  check('clockIn at a site not started today, without a photo', /PHOTO_REQUIRED/.test(await tryCall('clockIn', ['j_2841', 'ci9', null, ''])), true);
  check('…at the shop, none is owed', await tryCall('clockIn', ['shop', 'sh1', null, '']), 'ok');
  check('…and a move from the shop to a site owes its start photo', /PHOTO_REQUIRED/.test(await tryCall('switchCode', ['j_2841', 'ci9', null, '', ''])), true);
  await tryCall('switchCode', ['j_2841', 'ci9', null, '', 'x']);
  check('a code change on that site owes none', await tryCall('switchCode', ['j_2841', 'ci5', null, '', '']), 'ok');
  check('clockOut from a site without the end photo', /PHOTO_REQUIRED/.test(await tryCall('clockOut', [null, ''])), true);
  check('…the drive away for the day without it', /PHOTO_REQUIRED/.test(await tryCall('startTravel', ['j2', 'ci11', null, '', 'Drive to 26-1045 Lucas', { doneHere: true }])), true);
  check('…a supply run, coming back, owes none', await tryCall('startTravel', ['j_2841', 'ci11', null, '', 'Supply run · 26-0890 Noah Webster · back to 02ST-1 Final Clean', { doneHere: false }]), 'ok');
  await page.evaluate(() => { window.__CLOCK = []; S.open = null; });
  await page.evaluate(() => apiCall('clockOut', [null, ''])).catch(() => {});
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
  await tap(page, '#breakBtn', 300);
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
  await tap(page, '#breakBtn', 300);
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
  await tap(page, '#breakBtn', 300);
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
// T2.23: no photo at the shop, and the first clock-in of the day there is
// checked against where the shop and the office are.
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  check('off the clock: At the shop sits under Clock in', [await page.locator('#shopRow').isVisible(), await txt(page, '#shopBtn'), await txt(page, '#shopOther')],
    [true, 'At the shopMorning clock-in · one tap', 'Other shop work']);
  await tap(page, '#shopBtn', 400); await settle(page);
  let s = await st(page);
  check('one tap: the shop\'s Morning Clock-In, no camera', [s.tab, s.gate, (await calls(page)).map((c) => c.slice(0, 4)), s.code, await txt(page, '#jobK'), await txt(page, '#jobAddr')],
    ['job', null, [['clockIn', 'shop', 'sh1', null]], '99TM-1', 'At the shop · JT #25-0011', 'The shop']);
  check('…at the shop, nothing said', await page.evaluate(() => (window.__NOTES || []).filter((n) => n.kind === 'morning').length), 0);
  check('on the clock, the shop row is gone; Leave reads Leave the shop', [await page.locator('#shopRow').isVisible(), await txt(page, '#leaveBtn'), await txt(page, '#stopFoot')], [false, 'Leave the shop', 'At the shop no photo is asked for.']);
  await ctx.close();
  check('no page errors', errs, []);
}
for (const [away, words] of [['far', 'Not at the shop or the office · your PM and the Ops Director are told'], ['noloc', 'No location from the phone · your PM and the Ops Director are told']]) {
  const { ctx, page, errs } = await boot(`window.__MOCK_KEEP_CLOCK=true;window.__MOCK_AWAY=${JSON.stringify(away)};window.__MOCK_FIX={entries:function(){return [];}};`);
  await tap(page, '#shopBtn', 400); await settle(page);
  check(`the morning clock-in away from the shop (${away}): in all the same, and the phone says who is told`, [(await st(page)).code, await txt(page, '#toast span')], ['99TM-1', words]);
  check('…the notice goes on today\'s job', await page.evaluate(() => (window.__NOTES || []).filter((n) => n.kind === 'morning').map((n) => n.jobId)), [(await calls(page))[0][4] || 'shop']);
  await ctx.close();
  check('no page errors', errs, []);
}
{
  // Other shop work: the shop's own six, and nothing else.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await tap(page, '#shopOther', 600);
  check('Other shop work is the shop\'s own list', [await txt(page, '#sheetTitle'), await page.locator('.coderow .cname').allTextContents()],
    ['What are you doing?', ['Morning Clock-In', 'Training', 'Crew Labor - Monroe St.', 'Crew Labor - Bonnewitz Ave.', 'Shop Work/Maintenance', 'Hauling & Disposal (Direct)']]);
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

// ---- T2.23: your codes first, all of them one tap away ----
{
  const { ctx, page, errs } = await boot(`window.__MOCK_RECENT=${JSON.stringify([{ number: '04MA', name: 'Masonry Labor', n: 9 }, { number: '02ST-1', name: 'Final Clean', n: 3 }, { number: '99XX', name: 'Not on this job', n: 2 }])};`);
  await until(page, () => Array.isArray(S.recentCodes));
  await tap(page, '#clockIn', 400);
  check('the code sheet: your codes, in the order you use them, then All codes', [await page.locator('.codesk').allTextContents(), await page.locator('.coderow .cname').allTextContents(), await txt(page, '#allCodes')],
    [['Your codes'], ['Masonry Labor', 'Final Clean'], 'All codes · 10']);
  await tap(page, '#allCodes', 300);
  check('…All codes opens the rest under them, travel still not among them', [await page.locator('.codesk').allTextContents(), await page.locator('.coderow').count(), (await page.locator('.coderow .cname').allTextContents()).includes('Travel Related Labor')],
    [['Your codes', 'All codes'], 10, false]);
  await tap(page, '#sheetClose', 300); await tap(page, '#clockIn', 400);
  check('…and it folds up again next time', await page.locator('#allCodes').count(), 1);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.18: the drive — from the shop to the job, the job back to the shop ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;');
  await tap(page, '#shopBtn', 400); await settle(page);
  await tap(page, '#leaveBtn', 500);
  check('Leave the shop: no photo at the shop, straight to Where are you going? — today\'s booked job, another job; no drive back from the shop', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), await page.locator('#sheetBody .stoprow .st').allTextContents()],
    [['job', null, 'dest'], ['Noah Webster', 'Another job']]);
  await tap(page, '[data-dest="j_2841"]', 300); await settle(page);
  let c = (await calls(page)).slice(-1)[0];
  check('one call: the drive opens on that job\'s travel line, saying where to', [c[0], c[1], c[2], c[3], c[4], c[5]],
    ['startTravel', 'j_2841', 'ci11', null, 'Drive to 26-0890 Noah Webster · from the shop', false]);
  check('the band is the drive; the buttons are the arrival', [await txt(page, '#band .lbl'), await txt(page, '#jobK'), await page.locator('#travelStack').isVisible(), await page.locator('#runStack').isVisible(), await txt(page, '#arriveBtn'), await txt(page, '#travelOut')],
    ['Driving to Noah Webster', 'Driving to · JT #26-0890', true, false, 'I’m here · start work', 'Clock out · done for the day']);
  await tap(page, '#arriveBtn', 600);
  check('I\'m here: no end photo, the job\'s codes — the travel line is not one of them', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), (await page.locator('.coderow .cname').allTextContents()).includes('Travel Related Labor'), await page.locator('.coderow').count()],
    [['job', null, 'codes'], false, 10]);
  check('…asked as the start of the work, not a switch (T2.22)', await txt(page, '#sheetTitle'), 'What are you doing?');
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  check('…the start photo on site', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'start']);
  await shoot(page); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('…one switch, with no end photo for the drive', [c[0], c[1], c[2], c[3], typeof c[4], await page.evaluate(() => S.open.code.number)], ['switchCode', 'j_2841', 'ci9', null, 'string', '04MA']);

  // A supply run (T2.23): this job's travel line, no photo, one tap back.
  await tap(page, '#leaveBtn', 400); await tap(page, '[data-leave="supply"]', 300); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('Supply run: one call, no photo, the notes say where back to', c, ['startTravel', 'j_2841', 'ci11', null, 'Supply run · 26-0890 Noah Webster · back to 04MA Masonry Labor', false]);
  check('…the band says so, and the arrival is the way back', [await txt(page, '#band .lbl'), await txt(page, '#arriveBtn'), await page.locator('#travelElse').isVisible()],
    ['Supply run · back to Noah Webster', 'Back at Noah Webster · Masonry Labor', true]);
  await tap(page, '#arriveBtn', 400); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('Back at the job: the same code again, no photo', [c, await page.evaluate(() => [S.tab, S.open.code.number, onTravel()])], [['switchCode', 'j_2841', 'ci9', null, null, null], ['job', '04MA', false]]);

  // Another job and back the same day: no photo either way back.
  await tap(page, '#leaveBtn', 400); await tap(page, '[data-leave="later"]', 300);
  check('Another job · back here later: no photo, no log, Where are you going?', await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), ['job', null, 'dest']);
  await tap(page, '#destOther', 500); await tap(page, '.jobrow[data-job="j2"]', 300); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('…the drive to Lucas, no photo', [c[0], c[1], c[3], c[5]], ['startTravel', 'j2', null, false]);
  await tap(page, '#arriveBtn', 500); await tap(page, '.coderow:has-text("Final Clean")', 500);
  check('…at Lucas, not started today: the start photo', await page.evaluate(() => S.clockGate), 'start');
  await shoot(page); await settle(page);
  // Done at Lucas for today: the log, the end photo, then back to Webster.
  await tap(page, '#leaveBtn', 400); await tap(page, '[data-leave="done-job"]', 500);
  check('Another job · done here today: the site manager\'s log first', [await page.evaluate(() => [S.tab, S.dlJobId]), await txt(page, '.promptbox .pt')], [['log', 'j2'], 'Send today’s log first']);
  await tap(page, '#dlNormal', 900);
  check('…then the end photo of Lucas', [await page.evaluate(() => S.clockGate), await txt(page, '#afterBarT')], ['end-travel', 'End photo of Lucas · you start the drive when you shoot']);
  await shoot(page); await until(page, () => S.sheet === 'dest');
  await tap(page, '[data-dest="j_2841"]', 300); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('…the drive back to Webster carries the end photo, done here', [c[0], c[1], typeof c[3], c[5]], ['startTravel', 'j_2841', 'string', true]);
  await tap(page, '#arriveBtn', 500); await tap(page, '.coderow:has-text("Masonry Labor")', 500); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('Back at Webster, started this morning: no start photo', [c, await page.evaluate(() => S.tab)], [['switchCode', 'j_2841', 'ci9', null, null, null], 'job']);

  // The end of the day: back to the shop, on this job's travel line.
  await tap(page, '#leaveBtn', 400); await tap(page, '[data-leave="done-shop"]', 500);
  await tap(page, '#dlNormal', 900);
  check('Back to the shop: the log, then the end photo', [await page.evaluate(() => S.clockGate), await page.evaluate(() => (window.__LOGS || []).map((l) => l.jobId))], ['end-travel', ['j2', 'j_2841']]);
  await shoot(page); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('the drive back is paid travel on the job just left', [c[0], c[1], c[2], typeof c[3], c[4], c[5], await txt(page, '#band .lbl'), await txt(page, '#arriveBtn'), await txt(page, '#travelOut'), await page.locator('#travelElse').isVisible()],
    ['startTravel', 'j_2841', 'ci11', 'string', 'Drive back · end of the day · from 26-0890 Noah Webster', true, 'Driving back · end of the day', 'At the shop · shop work', 'Clock out · I’m back', false]);
  await tap(page, '#travelOut', 300); await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  c = (await calls(page)).slice(-1)[0];
  check('Clock out from the drive: no photo, and the logs already went', [c, await page.evaluate(() => [!!S.open, S.tab])], [['clockOut', null], [false, 'job']]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // A job with no travel line: the drive asks which of its lines to drive on.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_NOTRAVEL=true;');
  await tap(page, '#clockIn', 400); await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page);
  await tap(page, '#leaveBtn', 300); await tap(page, '[data-leave="later"]', 500); await until(page, () => S.sheet === 'dest');
  await tap(page, '#destOther', 500);
  check('Another job is the job search', [await page.evaluate(() => [S.sheet, S.travelPick])], [['jobs', true]]);
  await tap(page, '.jobrow[data-job="j2"]', 600);
  check('no travel line there: its own lines, asked', [await txt(page, '#sheetTitle'), await page.locator('[data-tcode]').count() > 0], ['No travel line at Lucas', true]);
  await tap(page, '[data-tcode="ci2"]', 300); await settle(page);
  const c = (await calls(page)).slice(-1)[0];
  check('…and the drive goes on the line picked — still a drive, by its notes', [c[0], c[1], c[2], c[4], await page.evaluate(() => [S.job.id, onTravel()])], ['startTravel', 'j2', 'ci2', 'Drive to 26-1045 Lucas · from 26-0890 Noah Webster', ['j2', true]]);
  check('…so it shows the arrival, not the four buttons', [await page.locator('#travelStack').isVisible(), await page.locator('#runStack').isVisible()], [true, false]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.19: already left the job — say when, no photo ----
{
  // A move with no drive (T2.23): they are at Lucas now — Already there.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500);
  check('a move with no drive asks what happened', [await page.evaluate(() => [S.clockGate, S.sheet]), await txt(page, '[data-move="left"] .st')],
    [[null, 'moveHow'], 'Already there — I left Noah Webster at…']);
  await tap(page, '[data-move="left"]', 500);
  check('…When did you leave? — only times after the block began', [await txt(page, '#sheetTitle'), await page.locator('[data-leftat] .bt').allTextContents(), await page.locator('#leftGo').isDisabled()],
    ['When did you leave?', ['Just now', '15 min ago', '30 min ago', '45 min ago', '1 hour ago'], true]);
  await tap(page, '[data-leftat]:has-text("30 min ago")', 200);
  check('…a time picked, the button says it', /^I left at \d+:\d\d[ap]$/.test(await txt(page, '#leftGo')), true);
  await tap(page, '#leftGo', 600);
  check('…then the next job\'s codes, as a move goes', [await page.evaluate(() => [S.sheet, S.pendingJob && S.pendingJob.id, S.switching && !!S.switching.leftAt]), await txt(page, '#sheetTitle')], [['codes', 'j2', true], 'Code at Lucas']);
  await tap(page, '.coderow:has-text("Masonry Labor")', 600); await shoot(page); await settle(page);
  let c = (await calls(page)).slice(-1)[0];
  check('one call: Webster ends when they left, the drive to Lucas on its travel line, the work from now', [c[0], c[2], c[3], c[4], c[5], typeof c[6], c[7], await page.evaluate(() => [S.job.id, S.open.code.id])],
    ['leftSite', 'work', 'j2', 'ci9', 'ci11', 'string', 'Drive to 26-1045 Lucas · from 26-0890 Noah Webster', ['j2', 'ci9']]);
  check('…and it was 30 minutes ago', Math.round((Date.now() - Date.parse(c[1])) / 60000), 30);
  // A code change where you still stand: no camera at all.
  await tap(page, '#codeBtn', 300); await tap(page, '.coderow:has-text("Final Clean")', 300); await settle(page);
  check('a code change at the same job: no camera, one switch', [await page.evaluate(() => [S.tab, S.clockGate]), (await calls(page)).slice(-1)[0]], [['job', null], ['switchCode', 'j2', 'ci5', null, null, null]]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // The end of the day, gone home without clocking out: the log first, then
  // the end-photo camera's way round.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await tap(page, '#outBtn', 500); await tap(page, '#dlNormal', 900);
  check('the camera of the clock-out offers the way round', [await page.evaluate(() => S.clockGate), await txt(page, '#leftBtn')], ['end-out', 'Already left Noah Webster? Say when — no photo']);
  await tap(page, '#leftBtn', 500);
  await tap(page, '[data-leftat]:has-text("15 min ago")', 200);
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  const c = (await calls(page)).slice(-1)[0];
  check('out: one call, at the time they left; the log already went', [c[0], c[2], Math.round((Date.now() - Date.parse(c[1])) / 60000), await page.evaluate(() => [!!S.open, S.tab])], ['leftSite', 'out', 15, [false, 'job']]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // On the road already: the drive starts when they left.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await tap(page, '#leaveBtn', 300); await tap(page, '[data-leave="done-job"]', 500); await tap(page, '#dlNormal', 900);
  await tap(page, '#leftBtn', 500);
  await tap(page, '[data-leftat]:has-text("45 min ago")', 200);
  await tap(page, '#leftGo', 500);
  check('the drive: Where are you going? next', await page.evaluate(() => S.sheet), 'dest');
  await tap(page, '#destOther', 500); await tap(page, '.jobrow[data-job="j2"]', 300); await settle(page);
  const c = (await calls(page)).slice(-1)[0];
  check('…and the drive starts when they left, on that job\'s travel line', [c[0], c[2], c[3], c[4], Math.round((Date.now() - Date.parse(c[1])) / 60000), await page.evaluate(() => onTravel())],
    ['leftSite', 'drive', 'j2', 'ci11', 45, true]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Still on the clock from yesterday: the clock screen asks, on that day.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_YESTERDAY=true;');
  check('a block still open from yesterday is the first thing on the clock', [await txt(page, '#clockNudge .nk'), /^Since \w{3} \w{3} \d+ at Noah Webster — when did you leave\?/.test(await txt(page, '#clockNudge .nt'))], ['Still on the clock', true]);
  await tap(page, '#clockNudge', 500);
  check('…the question has no "minutes ago", only the time on that day', [await txt(page, '#sheetTitle'), await page.locator('[data-leftat]').count(), await page.locator('#leftTime').isVisible()], ['When did you leave?', 0, true]);
  await page.locator('#leftTime').fill('16:30'); await page.waitForTimeout(200);
  check('…I left at 4:30p', await txt(page, '#leftGo'), 'I left at 4:30p');
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  const c = (await calls(page)).slice(-1)[0];
  const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(16, 30, 0, 0);
  check('…ended at 4:30p the day it began, and the day starts clean', [c[0], c[2], Date.parse(c[1]) === y.getTime(), await page.evaluate(() => [!!S.open, S.tab, document.getElementById('clockIn').classList.contains('hidden')])],
    ['leftSite', 'out', true, [false, 'job', false]]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.20: before you roll out — a hard stop at the shop ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_YARD=true;');
  await page.waitForFunction(() => S.assign && S.assign.source === 'board', null, { timeout: 10000 });
  await tap(page, '#shopBtn', 400); await settle(page);
  await tap(page, '#leaveBtn', 500);
  const rollRows = () => page.locator('#sheetBody .ckrow .lbl').allTextContents();
  check('leaving the shop: Before you roll out, not the camera', [await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), await txt(page, '#sheetTitle')], [['job', null, 'roll'], 'Before you roll out']);
  check('…today\'s roof: its yard lines and the shop material, nothing else', (await rollRows()).map((t) => t.split(' — ')[0].split(' · ')[0]),
    ['Tarps checked and loaded', 'Dry-in supplies loaded', 'Material loaded for the crew']);
  check('…and the drive waits for them', [await page.locator('#rollGo').isDisabled(), await txt(page, '#rollGo')], [true, '3 left to check']);
  await tap(page, '[data-rline="tarps"]', 200); await tap(page, '[data-rline="dryin"]', 200);
  check('ticks land as the checklist screen\'s do', [await txt(page, '#rollGo'), await page.evaluate(() => ckStateFor(visitForChecks('t2roof')).done.tarps)], ['1 left to check', true]);
  await tap(page, '[data-rloaded="j2"]', 900);
  check('…Material loaded through the board\'s door, and the drive is free', [await page.evaluate(() => (window.__LOADS || []).map((l) => [l.jobId, l.loaded])), await page.locator('#rollGo').isDisabled(), await txt(page, '#rollGo')],
    [[['j2', true]], false, 'All done · start the drive']);
  await page.waitForTimeout(1800);
  check('the yard ticks went to the board in one save', await page.evaluate(() => (window.__PUTS || []).map((p) => [p.taskId, p.checks.done.tarps, p.checks.done.dryin])), [['t2roof', true, true]]);
  await tap(page, '#rollGo', 500);
  check('…then Where are you going? — no photo at the shop', await page.evaluate(() => [S.tab, S.clockGate, S.sheet]), ['job', null, 'dest']);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // A move from the shop is held the same way; backing out stays at the shop.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_YARD=true;');
  await page.waitForFunction(() => S.assign && S.assign.source === 'board', null, { timeout: 10000 });
  await tap(page, '#shopBtn', 400); await settle(page);
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500);
  check('Move to another job from the shop: held too', await page.evaluate(() => [S.sheet, S.clockGate, S.pendingJob && S.pendingJob.id]), ['roll', null, 'j2']);
  await tap(page, '#sheetClose', 300);
  check('…backing out: still at the shop, nothing moved', await page.evaluate(() => [S.sheet, S.pendingJob, S.moving, S.open.code.number, (window.__CLOCK || []).length]), [null, null, false, '99TM-1', 1]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Forgot: clocked in at the roof without the yard done — in all the same, told.
  const { ctx, page, errs } = await boot('window.__MOCK_YARD=true;');
  await page.waitForFunction(() => S.assign && S.assign.source === 'board', null, { timeout: 10000 });
  await page.evaluate(() => { pickJobObj(visitAsJob(S.assign.visits.filter((v) => v.jobId === 'j2')[0]), false); });
  await page.waitForTimeout(400);
  await tap(page, '#clockIn', 400); await tap(page, '.coderow:has-text("Crew Labor")', 500);
  check('at the roof, the yard not done: say so, then clock in', [await page.evaluate(() => [S.sheet, S.clockGate]), await txt(page, '#sheetTitle'), await page.locator('#sheetBody .trow .nm').count(), await txt(page, '#forgotGo')],
    [['forgot', null], 'Shop checks not done', 3, 'Clock in · the PM and the Ops Director are told']);
  await tap(page, '#forgotGo', 500);
  check('…on to the start photo, nobody told yet', await page.evaluate(() => [S.tab, S.clockGate, (window.__ROLL || []).length]), ['cam', 'start', 0]);
  await shoot(page); await settle(page);
  check('…clocked in at the roof', (await calls(page)).slice(-1)[0].slice(0, 2), ['clockIn', 'j2']);
  check('…and then told once, with what was missing', await page.evaluate(() => (window.__ROLL || []).map((r) => [r.jobId, r.missing.length])), [['j2', 3]]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Not a site manager: nothing to hold.
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_YARD=true;window.__MOCK_ROLE="crew";');
  await page.waitForTimeout(800);
  await tap(page, '#shopBtn', 400); await settle(page);
  await tap(page, '#leaveBtn', 500);
  check('the crew leave the shop with no hold and no photo', await page.evaluate(() => [S.sheet, S.clockGate]), ['dest', null]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the review's findings (28 Oct): nothing left half-done, no night as a drive ----
{
  // Yesterday's block, Already left on the camera of a move: out on that day,
  // then the next job's clock-in from scratch — never a drive from last night.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_YESTERDAY=true;');
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500);
  await tap(page, '[data-move="left"]', 500);
  await page.locator('#leftTime').fill('16:30'); await page.waitForTimeout(200);
  await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => S.sheet === 'codes' && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  let c = (await calls(page)).slice(-1)[0];
  check('yesterday\'s block on a move: out on its day, and no drive', [c[0], c[2], await page.evaluate(() => [!!S.open, S.job.id, !!S.switching, S.pendingJob])], ['leftSite', 'out', [false, 'j2', false, null]]);
  await tap(page, '.coderow:has-text("Masonry Labor")', 500); await shoot(page); await settle(page);
  c = (await calls(page)).slice(-1)[0];
  check('…then a plain clock-in where they are', c.slice(0, 3), ['clockIn', 'j2', 'ci9']);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Backing out of Where are you going? after Already left: the next
  // clock-out is an ordinary one, not a leftSite that is refused.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await tap(page, '#leaveBtn', 300); await tap(page, '[data-leave="done-job"]', 500); await tap(page, '#dlNormal', 900);
  await tap(page, '#leftBtn', 500); await tap(page, '[data-leftat]:has-text("15 min ago")', 200); await tap(page, '#leftGo', 500);
  await tap(page, '#sheetClose', 300);
  check('out of Where are you going?: nothing carried', await page.evaluate(() => [S.sheet, S.switching, S.travelPick, !!S.open]), [null, null, false, true]);
  await tap(page, '#outBtn', 500); await shoot(page);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  check('…the clock-out is an ordinary one, with its photo', (await calls(page)).slice(-1)[0][0], 'clockOut');
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Another job's search backed out of: the next move is a move, with its camera.
  const { ctx, page, errs } = await boot('window.__MOCK_OPEN_AGO=90;');
  await tap(page, '#leaveBtn', 300); await tap(page, '[data-leave="later"]', 500);
  await page.waitForFunction(() => S.sheet === 'dest', null, { timeout: 10000 });
  await tap(page, '#destOther', 500); await tap(page, '#sheetClose', 300);
  check('out of the drive\'s job search: nothing carried', await page.evaluate(() => [S.travelPick, S.switching, S.leaveMode]), [false, null, 'later']);
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500);
  check('…a later move is a move: What happened?, not a drive', await page.evaluate(() => [S.sheet, (window.__CLOCK || []).some((x) => x[0] === 'startTravel')]), ['moveHow', false]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Yard checks not done, backed out of; and the notice only once the clock is on.
  const { ctx, page, errs } = await boot('window.__MOCK_YARD=true;window.__MOCK_OPEN_AGO=90;');
  await page.waitForFunction(() => S.assign && S.assign.source === 'board', null, { timeout: 10000 });
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500); await tap(page, '[data-move="wrong"]', 500);
  await page.waitForFunction(() => S.sheet === 'codes', null, { timeout: 10000 });
  await tap(page, '.coderow:has-text("Crew Labor")', 500);
  check('the move meets Shop checks not done', await page.evaluate(() => S.sheet), 'forgot');
  await tap(page, '#sheetClose', 300);
  check('…backed out: no half-move left', await page.evaluate(() => [S.pendingJob, S.moving, S.switching, S.job.id, S.gateCode]), [null, false, null, 'j_2841', null]);
  await tap(page, '#pickJobBtn', 500); await tap(page, '.jobrow[data-job="j2"]', 500); await tap(page, '[data-move="wrong"]', 500);
  await page.waitForFunction(() => S.sheet === 'codes', null, { timeout: 10000 });
  await tap(page, '.coderow:has-text("Crew Labor")', 500); await tap(page, '#forgotGo', 500);
  check('…Clock in: not told yet, the camera first', await page.evaluate(() => [(window.__ROLL || []).length, S.clockGate]), [0, 'start']);
  await tap(page, '#camBack', 400);
  check('…backing out of the camera tells nobody', await page.evaluate(() => (window.__ROLL || []).length), 0);
  await tap(page, '.coderow:has-text("Crew Labor")', 500); await shoot(page); await settle(page);
  check('…the start photo clocks in, and then they are told, once', await page.evaluate(() => [(window.__CLOCK || []).slice(-1)[0][0], (window.__ROLL || []).map((r) => r.jobId)]), ['switchCode', ['j2']]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // The drive back never ended: the next morning asks when it did.
  const { ctx, page, errs } = await boot('window.__MOCK_DRIVE_YESTERDAY=true;');
  check('a drive from yesterday is still on the clock, and asked about', [await txt(page, '#clockNudge .nk'), await txt(page, '#arriveBtn')], ['Still on the clock', 'When did the drive end?']);
  await tap(page, '#travelOut', 500);
  check('…Clock out asks when, too', await page.evaluate(() => S.sheet), 'left');
  await page.locator('#leftTime').fill('17:05'); await page.waitForTimeout(200); await tap(page, '#leftGo', 300);
  await page.waitForFunction(() => !S.open && document.body.style.pointerEvents === '', null, { timeout: 10000 });
  const c = (await calls(page)).slice(-1)[0];
  const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(17, 5, 0, 0);
  check('…the drive ends at 5:05p yesterday', [c[0], c[2], Date.parse(c[1]) === y.getTime()], ['leftSite', 'out', true]);
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
