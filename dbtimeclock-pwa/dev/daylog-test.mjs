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
  check('a JobTread hiccup: still kept, still retrying', [await txt(page, '#syncBadge'), (await grab(page, '__LOGS')).length], ['Not sent — will retry', 0]);
  await page.evaluate(() => { window.__MOCK_LOGFAIL = false; dlRetryPending(); });
  await page.waitForTimeout(1200);
  check('the retry lands', [/^Sent/.test(await txt(page, '#syncBadge')), (await grab(page, '__LOGS')).length], [true, 1]);
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
