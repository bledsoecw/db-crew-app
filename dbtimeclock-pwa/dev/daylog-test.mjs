/* The week view, today's job from the schedule, a move between roofs, and
   the day log — end to end against dev/mock.js. Nothing here ships.

     node dev/daylog-test.mjs

   Needs a local static server on the port below and Playwright available.
   The mock records every daily log, note and later note it is handed
   (window.__LOGS, __NOTES, __LOGNOTES) so the payloads can be checked. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

async function boot(flags = {}, init = '') {
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
  await page.addInitScript(`window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;window.__MOCK_TWO_TODAY=${!!flags.twoToday};window.__MOCK_NOJOB=${!!flags.noJob};`);
  if (init) await page.addInitScript(init);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const cls = (page, sel) => page.locator(sel).first().getAttribute('class');
// textContent of a flex row has no spaces between cells; compare without any.
const compact = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, '');
const grab = (page, name) => page.evaluate((n) => JSON.parse(JSON.stringify(window[n] || [])), name);
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = new Date(), isoToday = iso(today), isoYday = iso(new Date(Date.now() - 86400000));
const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
const dayLabel = (d) => DOW3[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate();

// ---- the week: chips, day headings, who is with you, quiet future cards ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('fourteen day chips', await page.locator('#weekStrip .wday').count(), 14);
  check('one is today', await page.locator('#weekStrip .wday.today').count(), 1);
  check('a dot on every booked day: today, tomorrow, +2, +7, +8', await page.locator('#weekStrip .wday.booked').count(), 5);
  check('two dots where two visits overlap? no — one each', await page.locator('#weekStrip .wday.booked').nth(0).locator('.dots i').count(), 1);
  const heads = await page.locator('.dayhead .k').allTextContents();
  check('cards grouped under day headings, ended visits last', heads.map((h) => h.trim()), ['Today', dayLabel(plus(2)), dayLabel(plus(7)), 'Ended']);
  check('the roofing crew you are with, on the card', await txt(page, '.jcard:has-text("Lucas") .jwith'), 'with Platinum');
  check('no crew label on your own crew\'s job', await page.locator('.jcard:has-text("Webster") .jwith').count(), 0);
  check('a future roof has the button but not the words', [await page.locator('.jcard:has-text("Lucas") .jck').count(), await page.locator('.jcard:has-text("Lucas") [data-checks]').count()], [0, 1]);
  check('a roof that has started shows the words', await txt(page, '.jcard:has-text("Courtney") .jck'), 'Finishing up — 3 of 10 done, not signed off');
  await page.locator('#weekStrip .wday.booked').nth(2).click();
  await page.waitForTimeout(900);
  check('a chip scrolls to its day', await page.locator('#vJobs .scroll').evaluate((el) => el.scrollTop > 0), true);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- today's job from the schedule: one roof needs no picking, two ask once ----
{
  const { ctx, page, errs } = await boot({ noJob: true });
  await page.waitForTimeout(800);
  check('the day\'s one roof becomes today\'s job on its own', await txt(page, '#jobAddr'), '408 Euclid Ave');
  check('...and no chooser shows', /hidden/.test(await cls(page, '#todayPick')), true);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({ twoToday: true });
  check('two roofs booked: the clock screen asks', [/hidden/.test(await cls(page, '#todayPick')), await page.locator('#todayPick [data-today]').count()], [false, 2]);
  check('...and nothing was picked for you', await txt(page, '#jobAddr'), 'Pick a job');
  await tap(page, '#todayPick [data-today="j2"]', 500);
  check('a tap makes it today\'s job', await txt(page, '#jobAddr'), '812 S Washington St');
  check('...and the chooser goes', /hidden/.test(await cls(page, '#todayPick')), true);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('the pick survives a reload, and is not second-guessed', [await txt(page, '#jobAddr'), /hidden/.test(await cls(page, '#todayPick'))], ['812 S Washington St', true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the day log: draft, chips, notes, a photo, the send, and after ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  check('one job today: no chips to choose between', await page.locator('#dlChips .dlchip').count(), 0);
  check('the header names the job', await txt(page, '#logK'), 'Day log · JT #26-0890');
  check('the summary carries the hours by code', await compact(page, '.dlsum'), 'Todayat408EuclidAve02ST-1SitePrepLabor42m04MAMasonryLabor2h18mHourstoday3h00mPhotos0');
  check('not started', await txt(page, '#syncBadge'), 'Not started');
  await page.locator('#dlDone').fill('Tear-off and dry-in, north side shingled.');
  await page.waitForTimeout(200);
  check('typing makes a draft', await txt(page, '#syncBadge'), 'Draft');
  await tap(page, '[data-tog="crewOnSite"][data-val="true"]', 200);
  await tap(page, '[data-tog="tarped"][data-val="true"]', 200);
  check('condition chips toggle', [await cls(page, '[data-tog="crewOnSite"][data-val="true"]'), await cls(page, '[data-tog="tarped"][data-val="true"]')], ['togbtn on warn', 'togbtn on']);
  await page.locator('#dlProb').fill('Short 8 pieces of drip edge.');
  await page.locator('#dlNote').fill('Homeowner asked about the trailer spot');
  check('the note button says where a note goes', await txt(page, '#dlAddNote'), 'Add to the log');
  await tap(page, '#dlAddNote', 300);
  check('a plain note stays in the draft', [await page.locator('.notecard').count(), (await grab(page, '__NOTES')).length], [1, 0]);
  await page.locator('#dlNote').fill('Need drip edge before 3');
  await tap(page, '#dlUrgent', 150);
  await tap(page, '#dlAddNote', 600);
  const notes = await grab(page, '__NOTES');
  check('an urgent note goes to the PM straight away', [notes.length, notes[0] && notes[0].assignPm, notes[0] && notes[0].jobId], [1, true, 'j_2841']);
  check('...and the card says so', /sent to Neal/.test(await txt(page, '.notecard.urgent .nm')), true);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('the draft survives a reload', [await page.locator('#dlDone').inputValue(), await page.locator('.notecard').count()], ['Tear-off and dry-in, north side shingled.', 2]);

  await shoot(page);
  await page.waitForTimeout(1800);
  const photos = await page.evaluate(() => S.photos.map((p) => ({ jobId: p.jobId, fileId: p.fileId, pending: p.pending, tag: p.tag })));
  check('a photo knows its job and its JobTread file', photos, [{ jobId: 'j_2841', fileId: 'f1', pending: false, tag: 'before' }]);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('...and shows in the day\'s summary', /Photos1$/.test(await compact(page, '.dlsum')), true);

  await tap(page, '#dlSend', 500);
  check('the confirm names who it goes to', /To Neal Deitemeyer \(PM\), Justin Phillips \(sales\)/.test(await txt(page, '#sheetBody .body')), true);
  check('...and warns that the problems ping them', /problems also ping/.test(await txt(page, '#sheetBody .body')), true);
  await tap(page, '#slYes', 1500);
  const logs = await grab(page, '__LOGS');
  const L = logs[0] || {};
  check('one daily log, on the job, dated today', [logs.length, L.jobId, L.date, L.jobLabel], [1, 'j_2841', isoToday, '26-0890 Noah Webster']);
  check('what was typed', [L.done, L.crewOnSite, L.tarped, L.problems], ['Tear-off and dry-in, north side shingled.', true, true, 'Short 8 pieces of drip edge.']);
  check('the notes, the urgent one marked', L.notes.map((n) => [n.body, n.urgent]), [['Homeowner asked about the trailer spot', false], ['Need drip edge before 3', true]]);
  check('the photo by reference', L.photos.map((p) => [p.fileId, p.tag]), [['f1', 'before']]);
  check('the hours by code, from the clock', L.hours.map((h) => [h.number, h.minutes]), [['02ST-1', 42], ['04MA', 138]]);
  check('left-at falls back to the last clock-out here', typeof L.leftAt === 'string' && L.leftAt.length > 0, true);
  check('no site checks on a foundation job', L.checks, null);
  check('sent, and it says to whom', [/^Sent/.test(await txt(page, '#syncBadge')), /to Neal Deitemeyer, Justin Phillips/.test(await txt(page, '.dlsent .s')), /pinged/.test(await txt(page, '.dlsent .s'))], [true, true, true]);
  check('the questions are gone; a later note remains', [await page.locator('#dlDone').count(), await page.locator('#dlLater').count()], [0, 1]);
  await page.locator('#dlLater').fill('Kenton dropped the returns at 5.');
  await tap(page, '#dlLaterBtn', 600);
  const later = await grab(page, '__LOGNOTES');
  check('a later note is a note on the sent log', later, [{ jobId: 'j_2841', dailyLogId: 'dl1', message: 'Kenton dropped the returns at 5.' }]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('sent stays sent', /^Sent/.test(await txt(page, '#syncBadge')), true);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the moments: handing over prompts the log; a move prompts it for the roof you left ----
{
  const { ctx, page, errs } = await boot({ twoToday: true });
  await tap(page, '#todayPick [data-today="j_2841"]', 400);
  await tap(page, '.tab[data-tab="jobs"]', 800);
  await tap(page, '[data-checks="t2roof"]', 500);
  await tap(page, '.ckphase[data-phase="handover"] .ckph', 200);
  for (const k of ['tearoff', 'shingles', 'tarped', 'special', 'matcheck', 'photos1']) await tap(page, `.ckrow[data-line="${k}"]`, 60);
  check('no prompt until the phase is done', /hidden/.test(await cls(page, '#ckNudge')), true);
  await tap(page, '.ckrow[data-line="pm"]', 300);
  check('finishing "before the site manager leaves" asks for the log', [/hidden/.test(await cls(page, '#ckNudge')), await txt(page, '#ckNudge .nt')], [false, 'Send today’s log for Lucas?']);
  await tap(page, '#ckNudge', 500);
  check('...and opens that roof\'s log', [await txt(page, '#logK'), await txt(page, '#dlChips .dlchip.on')], ['Day log · JT #26-1045', 'Lucas']);
  check('two roofs today, two chips', await page.locator('#dlChips .dlchip').count(), 2);
  check('the checks ride in the summary', /SitechecksHandingover—7of7done/.test(await compact(page, '.dlsum')), true);

  // now clock in at Webster and move to Lucas
  await tap(page, '.tab[data-tab="job"]', 400);
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 700);
  await tap(page, '#pSkip', 300);
  check('on the clock, the card offers a move', await txt(page, '#pickJobLbl'), 'Move to another job');
  await tap(page, '#pickJobBtn', 400);
  check('the sheet says so', await txt(page, '#sheetTitle'), 'Move to which job?');
  await tap(page, '.jobrow[data-job="j2"]', 600);
  check('then asks for the code at the next roof', await txt(page, '#sheetTitle'), 'Code at Lucas');
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  check('then the same finished-question as any switch', await page.locator('#pNo').count(), 1);
  await tap(page, '#pNo', 1200);
  await tap(page, '#pSkip', 300);
  check('the clock is now at the next roof', [await txt(page, '#jobAddr'), await txt(page, '#bandCodeName')], ['812 S Washington St', 'Final Clean']);
  check('...and the roof you left is owed its log, first', [/hidden/.test(await cls(page, '#clockNudge')), /^Send today’s log for Noah Webster\?/.test(await txt(page, '#clockNudge .nt'))], [false, true]);
  const sw = await page.evaluate(() => S.open && S.open.job && S.open.job.id);
  check('one call closed the old entry and opened the new one there', sw, 'j2');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- yesterday's log, unsent ----
{
  const draft = { jobId: 'j_2841', date: isoYday, jobLabel: '26-0890 Noah Webster', jobNum: '26-0890', cust: 'Noah Webster', address: '', alongside: null, pm: '', reps: [],
    done: 'Footers poured.', condition: '', crewOnSite: null, tarped: null, leftAt: '', problems: '', notes: [], sent: null, wantSend: false, sending: false, err: '', prompt: false, activity: true, at: Date.now() - 86400000, seq: 1 };
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_daylog', ${JSON.stringify(JSON.stringify({ ['j_2841|' + isoYday]: draft }))});`);
  const items = await page.evaluate(() => nudgeItems().map((i) => [i.kind, i.text]));
  check('the morning after: the unsigned roof first, then the unsent log', items, [['unsigned', 'Yesterday’s roof at Courtney isn’t signed off'], ['log-late', 'Yesterday’s log for Noah Webster wasn’t sent']]);
  check('the banner counts the rest', /\+1 more/.test(await txt(page, '#clockNudge .nt')), true);
  await page.evaluate(() => nudgeItems()[1].go());
  await page.waitForTimeout(400);
  check('the late log opens on yesterday', [/^Yesterday ·/.test(await txt(page, '#logDate')), await page.locator('#dlDone').inputValue()], [true, 'Footers poured.']);
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 1200);
  const logs = await grab(page, '__LOGS');
  check('...and sends it dated yesterday, without today\'s hours', [logs.length, logs[0].date, logs[0].hours], [1, isoYday, []]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a dead spot, and a JobTread hiccup, on the send ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlDone').fill('Done.');
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(200);
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 600);
  check('offline: kept, will retry', [await txt(page, '#syncBadge'), (await grab(page, '__LOGS')).length], ['Not sent — will retry', 0]);
  await page.evaluate(() => { window.__MOCK_LOGFAIL = true; });
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1200);
  check('a JobTread hiccup: still kept, still retrying', [/^Not sent — trying again in \d+s$/.test(await txt(page, '#syncBadge')), (await grab(page, '__LOGS')).length], [true, 0]);
  await page.evaluate(() => { window.__MOCK_LOGFAIL = false; dlRetryPending(); });
  await page.waitForTimeout(1200);
  check('the retry lands', [/^Sent/.test(await txt(page, '#syncBadge')), (await grab(page, '__LOGS')).length], [true, 1]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a photo that cannot upload: the log says so and goes anyway ----
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_READONLY=true;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await shoot(page);
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => S.photos.map((x) => ({ pending: x.pending, err: x.err, fileId: x.fileId || '' })));
  check('a read-only refusal is written on the photo, not hidden', p, [{ pending: true, err: 'read-only build', fileId: '' }]);
  await tap(page, '.tab[data-tab="log"]', 400);
  check('...and the summary says so', /1notuploaded:read-onlybuild/.test(await compact(page, '.dlsum')), true);
  check('...and the Build panel has the reason', await page.evaluate(() => S.lastErr && S.lastErr.where), 'photo upload');
  await page.evaluate(() => { window.__MOCK_READONLY = false; });   // writes on for the log itself
  await page.locator('#dlDone').fill('Done.');
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 1500);
  const logs = await grab(page, '__LOGS');
  check('the log does not wait on a photo that cannot upload', [logs.length, logs[0].photos, logs[0].photosPending], [1, [], 1]);
  check('...and says it went without it', /Sent without 1 photo/.test(await txt(page, '.dlsent .s')), true);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_PUTREFUSED=true;');
  await shoot(page);
  await page.waitForTimeout(1800);
  const p = await page.evaluate(() => S.photos.map((x) => ({ pending: x.pending, fileId: x.fileId })));
  const via = await grab(page, '__VIAAPI');
  check('a refused direct PUT falls back to the API and still lands', [p, via.length, via[0] && via[0].mime], [[{ pending: false, fileId: 'f1' }], 1, 'image/jpeg']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a slow API at boot: the app asks again on its own ----
{
  // Four transient failures cover the client's own retries on one call; the
  // fifth answer is the good one, reached by the boot retry after 600ms.
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_STARTFAIL=4;window.__BOOT_RETRY_MS=[600,600,600];');
  await page.waitForTimeout(9000);
  check('boot recovered without a reopen', [await page.evaluate(() => !!S.me), await txt(page, '#jobAddr')], [true, '408 Euclid Ave']);
  check('...and loaded the rest', await page.evaluate(() => S.codes.length > 0), true);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a reload mid-send must not leave the log stuck ----
{
  const stuck = { jobId: 'j_2841', date: isoToday, jobLabel: '26-0890 Noah Webster', jobNum: '26-0890', cust: 'Noah Webster', address: '', alongside: null, pm: '', reps: [],
    done: 'Done.', condition: '', crewOnSite: null, tarped: null, leftAt: '', problems: '', notes: [], sent: null, wantSend: true, sending: true, err: '', prompt: false, activity: true, at: Date.now(), seq: 1 };
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_daylog', ${JSON.stringify(JSON.stringify({ ['j_2841|' + isoToday]: stuck }))});`);
  await page.waitForTimeout(2500);
  const logs = await grab(page, '__LOGS');
  check('a send that was in flight before the reload goes again', logs.length, 1);
  await ctx.close();
}


// ---- a slow extras call must not hold the log's send ----
// The read lane: extras is held nine seconds; the send goes now, in the main
// lane, and the Build panel's call log shows it waited for nothing.
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_SLOWEXTRAS=9000;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlDone').fill('Done.');
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 2500);
  check('the send went while extras was still out', [(await grab(page, '__LOGS')).length, await page.evaluate(() => S.codes.length)], [1, 0]);
  check('...in its own lane, not behind it', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return r && r.ok && r.wait < 1500; }), true);
  check('the reply\'s own timing is kept with the call', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return r.server && r.server.total === 1840 && r.server.pave === 1; }), true);
  check('...and the API\'s memory of its calls came with boot', await page.evaluate(() => S.recent.map(c => c.fn)), ['getStart', 'getExtras']);
  check('the Build panel shows both', await page.evaluate(() => { const b = document.getElementById('apiBox'); return [!b.classList.contains('hidden'), /sendDailyLog/.test(b.textContent), /getExtras 31\.4s \(4 JT 29\.8s\)/.test(b.textContent)]; }), [true, true, true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- "Sending…" says how long, and a failed send says when it tries again ----
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_SLOWLOG=9500;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlDone').fill('Done.');
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 8800);
  check('a long send counts the seconds', /^Sending… \d+s$/.test(await txt(page, '#syncBadge')), true);
  await page.waitForTimeout(1600);
  check('...and lands', /^Sent/.test(await txt(page, '#syncBadge')), true);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_LOGFAIL=true;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlDone').fill('Done.');
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 1500);
  check('a failed send says when it tries again', /^Not sent — trying again in (1[5-9]|20)s$/.test(await txt(page, '#syncBadge')), true);
  await page.waitForTimeout(2200);
  check('...and the number moves', /^Not sent — trying again in 1[3-7]s$/.test(await txt(page, '#syncBadge')), true);
  check('the failure is in the call log, with the reason and the API\'s own time', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return [r.ok, /boom/.test(r.err), !!(r.server && r.server.total === 1840)]; }), [false, true, true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a photo the old build stranded: named as gone, and dismissible ----
{
  const old = { id: 'ph_old', jobId: 'j_2841', tag: 'before', time: '3:41p', at: Date.now() - 120000, pending: true, thumb: '' };
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_prefs', ${JSON.stringify(JSON.stringify({ photos: [old] }))});`);
  await page.waitForTimeout(800);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('a stranded photo is marked as gone', await page.evaluate(() => S.photos.map(p => [p.err, !!p.lost])), [['not uploaded — take it again', true]]);
  check('...and the summary says so', /1notuploaded:notuploaded—takeitagain/.test(await compact(page, '.dlsum')), true);
  await page.locator('#dlDone').fill('Done.');
  await tap(page, '#dlSend', 400);
  await tap(page, '#slYes', 1500);
  const logs = await grab(page, '__LOGS');
  check('the log carries it as gone, not as coming', [logs[0].photosPending, logs[0].photosFailed], [0, 1]);
  check('...and the sent card says to take it again', /1 photo never uploaded and is gone from this phone/.test(await txt(page, '.dlsent .s')), true);
  await tap(page, '.dropph', 400);
  check('dismissed: the phone stops asking about it', await page.evaluate(() => S.photos.length), 0);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- JobTread's own daily-log fields, inherited: shown by type, sent with the log ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  check('the org\'s fields are on the form, in JobTread\'s order', await page.evaluate(() => [...document.querySelectorAll('#dlBody .dlf .fk')].map(x => x.textContent)), ['Material Pickups / Deliveries', 'Trades Onsite', 'Unplanned Tasks', 'Anticipated Delays', 'Delay Reason', 'Safety Incidents', 'Internal Notes']);
  check('each by its type: yes/no, a pick list, a text box', await page.evaluate(() => [document.querySelectorAll('button[data-fld="22PC7jQ6BkBC"]').length, document.querySelectorAll('button[data-fld="22PC7jNshbiK"]').length, !!document.querySelector('textarea[data-fld="22PLhcfDaJ7r"]')]), [2, 18, true]);
  await tap(page, 'button[data-fld="22PC7jQ6BkBC"][data-fval="true"]', 300);
  await tap(page, 'button[data-fld="22PLhdEgfHXF"][data-opt="Weather"]', 300);
  await tap(page, 'button[data-fld="22PC7jNshbiK"][data-opt="Roofing"]', 300);
  await tap(page, 'button[data-fld="22PC7jNshbiK"][data-opt="Masonry"]', 300);
  await page.locator('textarea[data-fld="22PLhcfDaJ7r"]').fill('Ladder slipped, nobody hurt');
  await page.locator('#dlDone').fill('Done.');
  check('several trades stay picked; the draft carries them', await page.evaluate(() => { const e = dlGet('j_2841', isoLocal()); return [document.querySelectorAll('button[data-fld="22PC7jNshbiK"].on').length, e.fields['22PC7jNshbiK'], e.fields['22PC7jQ6BkBC']]; }), [2, ['Roofing', 'Masonry'], true]);
  await tap(page, 'button[data-fld="22PC7jNshbiK"][data-opt="Roofing"]', 300);
  check('...and a second tap un-picks one', await page.evaluate(() => dlGet('j_2841', isoLocal()).fields['22PC7jNshbiK']), ['Masonry']);
  await tap(page, 'button[data-fld="22PC7jQ6BkBC"][data-fval="true"]', 300);
  check('...or clears a yes/no', await page.evaluate(() => 'fields' in dlGet('j_2841', isoLocal()) && !('22PC7jQ6BkBC' in dlGet('j_2841', isoLocal()).fields)), true);
  await tap(page, 'button[data-fld="22PC7jQ6BkBC"][data-fval="true"]', 300);
  check('the summary counts them', /JobTreadfields4filled/.test(await compact(page, '.dlsum')), true);
  await tap(page, '#dlSend', 400);
  check('the send sheet names them', /4 JobTread fields filled/.test(await txt(page, '.ckmiss')), true);
  await tap(page, '#slYes', 1500);
  const logs = await grab(page, '__LOGS');
  check('they go with the log as JobTread\'s own fields', logs[0].fields, { '22PLhdEgfHXF': ['Weather'], '22PC7jNshbiK': ['Masonry'], '22PLhcfDaJ7r': 'Ladder slipped, nobody hurt', '22PC7jQ6BkBC': true });
  check('...and the sent card says the feed was pinged about them', /pinged in the activity feed about what was flagged in the log fields/.test(await txt(page, '.dlsent .s')), true);
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
