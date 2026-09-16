/* The week view, today's job from the schedule, a move between roofs, and
   the day log — end to end against dev/mock.js. Nothing here ships.

     node dev/daylog-test.mjs

   Needs a local static server on the port below and Playwright available.
   The mock records every daily log, PM line and later note it is handed
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
const grab = (page, name) => page.evaluate((n) => JSON.parse(JSON.stringify(window[n] || [])), name);
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
// A gate commit waits on the phone's location (up to 2.5s here): wait for it.
const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(200); };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = new Date(), isoToday = iso(today), isoYday = iso(new Date(Date.now() - 86400000));
const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
const dayLabel = (d) => DOW3[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate();
// A draft in the shape the phone keeps, for the fixtures below.
const draftOf = (over) => Object.assign({ jobId: 'j_2841', date: isoToday, jobLabel: '26-0890 Noah Webster', jobNum: '26-0890', cust: 'Noah Webster', address: '', alongside: null, pm: '', reps: [],
  story: '', lines: [], fields: {}, safety: null, alert: null, notes: [], sent: null, wantSend: false, sending: false, err: '', prompt: false, activity: true, at: Date.now(), seq: 1 }, over);

// ---- the week: chips, day headings, who is with you, quiet future cards ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('fourteen day chips', await page.locator('#weekStrip .wday').count(), 14);
  check('one is today', await page.locator('#weekStrip .wday.today').count(), 1);
  check('a dot on every booked day: today, tomorrow, +2, +7, +8', await page.locator('#weekStrip .wday.booked').count(), 5);
  check('two dots where two visits overlap? no — one each', await page.locator('#weekStrip .wday.booked').nth(0).locator('.dots i').count(), 1);
  const heads = await page.locator('#jobsList > .k, #jobsList > .dayhead .k').allTextContents();
  check('today first, then Next up, ended visits last', heads.map((h) => h.trim()), ['Next up', 'Ended']);
  check('the header: the crew, the date, when the board answered', [await txt(page, '#jobsK'), await txt(page, '#jobsCrew'), /^Board · \d+:\d\d[ap]$/.test(await txt(page, '#boardStamp'))], ['My jobs · Alberto', today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), true]);
  check('today\'s card: you\'re here, the type after the city, the material in the card\'s words, and the log cell', [await txt(page, '.jcard.today .jwhen .d'), await txt(page, '.jcard.today .sub'), await txt(page, '.jcard.today .jmat'), await page.locator('.jcard.today .jact .a1, .jcard.today .jact .a2').allTextContents(), await txt(page, '.jcard.today .jnav')], ['You’re here · day 2 of 3', 'Noah Webster · Van Wert · foundation', 'Material on site', ['Log not sent', 'Tap to do it'], 'Directions']);
  check('a card further out than tomorrow shrinks: no material row, the words folded in, go here instead', [await page.locator('.jcard:has-text("Lucas") .jmat').count(), await txt(page, '.jcard:has-text("Lucas") .sub'), await cls(page, '.jcard:has-text("Lucas")'), await page.locator('.jcard:has-text("Lucas") .jact .a1, .jcard:has-text("Lucas") .jact .a2').allTextContents()], [0, 'Lucas · Van Wert · roofing · pull from shop', 'jcard far', ['Go here instead']]);
  check('a part order keeps the board\'s own warning', [await txt(page, '.jcard:has-text("Harmon") .sub'), await page.locator('.jcard:has-text("Harmon") .jmat').count()], ['Dale Harmon · Delphos · siding · part order — check first', 0]);
  check('yesterday\'s roof carries its log cell too', await page.locator('.jcard:has-text("Courtney") .jact .a1').allTextContents(), ['Log not sent']);
  check('the foot says where the list is from', /^From the production board at \d+:\d\d[ap]\. If a job is missing, the office hasn’t put it on the board yet\.$/.test(await txt(page, '#jobsList .foot')), true);
  await tap(page, '.jcard.today [data-log]', 500);
  check('Log not sent · tap to do it opens today\'s log for that roof', [await page.evaluate(() => S.tab), await txt(page, '#logK')], ['log', 'Day log · JT #26-0890']);
  await tap(page, '#dlNormal', 1500);
  await tap(page, '.tab[data-tab="jobs"]', 500);
  check('...and once it went, the card says so', [await cls(page, '.jcard.today .jact'), /^Log sent · \d+:\d\d[ap]$/.test(await txt(page, '.jcard.today .jact'))], ['jact ok', true]);
  await tap(page, '.jcard:has-text("Lucas") [data-go]', 500);
  check('Go here instead, off the clock, just makes it today\'s job', [await page.evaluate(() => S.tab), await txt(page, '#jobAddr')], ['job', '812 S Washington St']);
  await tap(page, '.tab[data-tab="jobs"]', 500);
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

// ---- the day log: the story, the PM line, JobTread's own questions, the review, the send, and after ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  check('one job today: no chips to choose between', await page.locator('#dlChips .dlchip').count(), 0);
  check('the header names the job', await txt(page, '#logK'), 'Day log · JT #26-0890');
  check('not sent', await txt(page, '#syncBadge'), 'Not sent');
  check('a blank log: Talk and Type, the one-tap, and Send log inert', [await page.locator('#dlTalkRow').isVisible(), await page.locator('#dlNormal').isVisible(), await txt(page, '#dlReview'), await cls(page, '#dlReview')], [true, true, 'Send log', 'btn btn-go sendbig off']);
  check('the story box is a real text box with the four placeholder lines', (await page.locator('#dlStory').getAttribute('placeholder')).split('\n'), ['Tap here and type, or use Talk below', 'When did you get on the job?', 'What got done?', 'Anything in the way?']);
  await page.locator('#dlStory').fill('Got on the job after 8 a.m. due to appointment');
  await page.waitForTimeout(200);
  check('typing switches the card in place: Add more and the PM row, no Talk / Type, Review & send, no one-tap', [await page.locator('#dlTalkRow').isVisible(), await page.locator('#dlAddMore').isVisible(), await page.locator('#dlPmRow').isVisible(), await txt(page, '#dlReview'), await page.locator('#dlNormal').isVisible()], [false, true, true, 'Review & send', false]);
  check('...still not sent', await txt(page, '#syncBadge'), 'Not sent');
  await tap(page, '#dlTellPm', 700);
  const notes = await grab(page, '__NOTES');
  check('Tell the PM now goes to the PM this minute', [notes.length, notes[0] && notes[0].assignPm, notes[0] && notes[0].message, notes[0] && notes[0].jobId], [1, true, 'Got on the job after 8 a.m. due to appointment', 'j_2841']);
  check('...and stays in the log as a timestamped line, tagged', [await page.locator('.dlline').count(), await txt(page, '.dlline .pm'), await page.locator('#dlStory').inputValue()], [1, 'PM told', '']);
  await page.locator('#dlStory').fill('Tear-off and dry-in, north side shingled.');
  check('the questions are JobTread\'s own daily-log fields, in its order, the safety one last', await page.locator('.dlh').allTextContents(),
    ['How did today go?', 'Any material pickups or deliveries?', 'Who else was on site? · tap all that fit', 'Any delays?', 'Anyone hurt or a close call?']);
  check('a pick list carries the list\'s own options', await page.locator('[data-opt="22PC7jNshbiK"]').allTextContents(),
    ['Carpentry', 'Concrete', 'Electrical', 'Engineering', 'Excavation', 'Foundation', 'Framing', 'HVAC', 'Masonry', 'Mechanical', 'Painting', 'Plumbing', 'Roofing', 'Tile', 'Other', 'Production Manager', 'Site Manager', 'Sales Rep']);
  await tap(page, '[data-yn="f:22PC7jNSGzEb"][data-v="0"]', 200);
  await tap(page, '[data-opt="22PC7jNshbiK"][data-val="Roofing"]', 200);
  await tap(page, '[data-opt="22PC7jNshbiK"][data-val="Site Manager"]', 200);
  await tap(page, '[data-yn="f:22PC7jQ6BkBC"][data-v="1"]', 300);
  check('delays yes opens the reasons', [await cls(page, '[data-yn="f:22PC7jQ6BkBC"][data-v="1"]'), await page.locator('[data-opt="22PLhdEgfHXF"]').count()], ['ynbtn on', 4]);
  check('...the four chips, as JobTread spells them', await page.locator('[data-opt="22PLhdEgfHXF"]').allTextContents(), ['Weather', 'Short Labor', 'Short Material', 'Other']);
  await tap(page, '[data-opt="22PLhdEgfHXF"][data-val="Weather"]', 200);
  await tap(page, '[data-opt="22PLhdEgfHXF"][data-val="Other"]', 200);
  await tap(page, '[data-opt="22PLhdEgfHXF"][data-val="Other"]', 200);
  await tap(page, '[data-opt="22PLhdEgfHXF"][data-val="Short Labor"]', 200);
  check('chips are multi-select, and a second tap un-picks', await page.locator('[data-opt="22PLhdEgfHXF"].on').allTextContents(), ['Weather', 'Short Labor']);
  await tap(page, '[data-yn="safety"][data-v="0"]', 300);
  check('safety no', await cls(page, '[data-yn="safety"][data-v="0"]'), 'ynbtn on');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('the draft survives a reload', [await page.locator('#dlStory').inputValue(), await page.locator('.dlline').count(), await page.locator('[data-opt].on').count(), await cls(page, '[data-yn="safety"][data-v="0"]')], ['Tear-off and dry-in, north side shingled.', 1, 4, 'ynbtn on']);

  await shoot(page);
  await page.waitForTimeout(1800);
  const photos = await page.evaluate(() => S.photos.map((p) => ({ jobId: p.jobId, fileId: p.fileId, pending: p.pending, tag: p.tag })));
  check('a photo knows its job and its JobTread file', photos, [{ jobId: 'j_2841', fileId: 'f1', pending: false, tag: 'before' }]);

  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '#dlReview', 500);
  check('the review: the hours, the photos, every answer under JobTread\'s own name for the field', [await page.locator('.rvrow .rk').allTextContents(), await page.locator('.rvrow .rv').allTextContents()],
    [['Hours', 'Photos', 'Material Pickups / Deliveries', 'Trades Onsite', 'Anticipated Delays', 'Safety Incidents'], ['3h 00m · 2 codes', '1', 'No', 'Roofing, Site Manager', 'Yes · Weather, Short Labor', 'None']]);
  check('...and the story, the PM line with its time', (await txt(page, '.rvstory .rt')).replace(/^\d+:\d\d[ap] — /, 'H:MM — '), 'H:MM — Got on the job after 8 a.m. due to appointment Tear-off and dry-in, north side shingled.');
  check('...names who it goes to', await txt(page, '.rvfoot'), 'Goes on JT #26-0890 as today’s daily log for Neal Deitemeyer and Justin Phillips. Hours and photos are already there.');
  await tap(page, '#dlBack', 300);
  check('go back keeps everything', [await page.locator('#dlStory').inputValue(), await page.locator('[data-opt].on').count()], ['Tear-off and dry-in, north side shingled.', 4]);
  await tap(page, '#dlReview', 300);
  await tap(page, '#dlSend', 1500);
  const logs = await grab(page, '__LOGS');
  const L = logs[0] || {};
  check('one daily log, on the job, dated today', [logs.length, L.jobId, L.date, L.jobLabel], [1, 'j_2841', isoToday, '26-0890 Noah Webster']);
  check('the story and the PM line, timed and tagged', [L.story, (L.lines || []).map((l) => [l.text, l.pmTold, /^\d+:\d\d[ap]$/.test(l.time)])], ['Tear-off and dry-in, north side shingled.', [['Got on the job after 8 a.m. due to appointment', true, true]]]);
  check('the answers by field id, as JobTread takes them, and the names for the notes', [L.fields, L.fieldNames, L.safety, L.alert],
    [{ '22PC7jNSGzEb': false, '22PC7jNshbiK': ['Roofing', 'Site Manager'], '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather', 'Short Labor'] },
     { '22PC7jNSGzEb': 'Material Pickups / Deliveries', '22PC7jNshbiK': 'Trades Onsite', '22PC7jQ6BkBC': 'Anticipated Delays', '22PLhdEgfHXF': 'Delay Reason' }, false, null]);
  check('nothing of the old form rides along', ['done' in L, 'delays' in L, 'problems' in L], [false, false, false]);
  check('the photo by reference', L.photos.map((p) => [p.fileId, p.tag]), [['f1', 'before']]);
  check('the hours by code, from the clock', L.hours.map((h) => [h.number, h.minutes]), [['02ST-1', 42], ['04MA', 138]]);
  check('no site checks on a foundation job', L.checks, null);
  check('sent: the badge, the card, who has it', [await txt(page, '#syncBadge'), /^Log sent · \d+:\d\d[ap]$/.test(await txt(page, '.sentcard .sl')), await txt(page, '.sentcard .st'), await txt(page, '.sentcard .ss')], ['Sent', true, 'You’re done for today', 'Neal Deitemeyer and Justin Phillips have it on JT #26-0890.']);
  check('...and the rows, without the story', await page.locator('.rvrow .rv').allTextContents(), ['3h 00m', '1', 'No', 'Roofing, Site Manager', 'Yes · Weather, Short Labor', 'None']);
  check('the form is gone', await page.locator('#dlStory').count(), 0);
  await tap(page, '#dlLaterBtn', 300);
  check('add a line opens a box', await page.locator('#dlLaterBox').isVisible(), true);
  await page.locator('#dlLater').fill('Kenton dropped the returns at 5.');
  await tap(page, '#dlLaterBtn', 600);
  const later = await grab(page, '__LOGNOTES');
  check('a later line is a note on the sent log', later, [{ jobId: 'j_2841', dailyLogId: 'dl1', message: 'Kenton dropped the returns at 5.' }]);
  check('...and shows under the card with its time', [await page.locator('.dlline').count(), await txt(page, '.dlline .lt')], [1, 'Kenton dropped the returns at 5.']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('sent stays sent', await txt(page, '#syncBadge'), 'Sent');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a normal day is one tap ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '[data-yn="f:22PC7jQ6BkBC"][data-v="0"]', 200);
  check('no to a question keeps the one-tap', await page.locator('#dlNormal').isVisible(), true);
  await tap(page, '#dlNormal', 1500);
  const logs = await grab(page, '__LOGS');
  check('one tap: every yes/no field No, nothing picked, no incident, the words', [logs.length, logs[0].story, logs[0].fields, logs[0].safety, logs[0].lines], [1, 'Normal day, nothing to report.', { '22PC7jNSGzEb': false, '22PC7jQ6BkBC': false }, false, []]);
  check('...and it is sent, the rows saying so', [await txt(page, '#syncBadge'), await page.locator('.rvrow .rv').allTextContents()], ['Sent', ['3h 00m', '0', 'No', '—', 'No', 'None']]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- anyone hurt or a close call: the alert goes the second it is sent, and the log waits for it ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '[data-yn="safety"][data-v="1"]', 400);
  check('yes is amber, and opens the alert card', [await cls(page, '[data-yn="safety"][data-v="1"]'), await page.locator('#alertCard').count(), await txt(page, '#alertCard .warnbar')], ['ynbtn on amber', 1, 'Goes to the PM, Shawn, Neal and Carl the second you send']);
  check('the review waits until the alert has gone', [await cls(page, '#dlReview'), await txt(page, '#dlBlockedFoot'), await page.locator('#dlNormal').isVisible()], ['btn btn-go sendbig off', 'Day log waits until the alert has gone.', false]);
  check('the five kinds, single-select; hurt or nobody hurt', [await page.locator('[data-kind]').allTextContents(), await page.locator('[data-hurt]').allTextContents()], [['Fall', 'Cut', 'Heat', 'Close call', 'Other'], ['Hurt', 'Nobody hurt']]);
  await tap(page, '#alertSend', 400);
  check('no alert without hurt or nobody hurt', [(await grab(page, '__ALERTS')).length, await txt(page, '#toast span')], [0, 'Tap Hurt or Nobody hurt']);
  await tap(page, '[data-kind="fall"]', 200);
  await tap(page, '[data-kind="close"]', 200);
  check('one kind at a time', await page.locator('[data-kind].on').allTextContents(), ['Close call']);
  await page.locator('#alertText').fill('Bundle slid off the ridge, landed about three feet from Marcos. Nobody hit.');
  await tap(page, '[data-hurt="0"]', 300);
  check('nobody hurt, navy', await cls(page, '[data-hurt="0"]'), 'ynbtn on');
  await tap(page, '#alertCam', 900);
  check('the camera square opens the camera, During, with the Day log lit', [await page.evaluate(() => S.tab), await page.evaluate(() => S.capture), await txt(page, '.tab.on .tl')], ['cam', 'during', 'Day log']);
  await shoot(page);
  await page.waitForTimeout(1500);
  check('...and the shot comes back to the card, on the alert', [await page.evaluate(() => S.tab), await page.evaluate(() => dlGet(S.dlJobId, isoLocal()).alert.photoIds.length), await txt(page, '#alertCam .k9')], ['log', 1, '1']);
  await tap(page, '#alertSend', 900);
  const alerts = await grab(page, '__ALERTS');
  check('Send alert now goes at once, with the kind, hurt, the words, the photo and the job', [alerts.length, alerts[0].jobId, alerts[0].alert.kind, alerts[0].alert.hurt, alerts[0].alert.text, alerts[0].alert.photoIds, alerts[0].alert.photos, alerts[0].alert.jobLabel],
    [1, 'j_2841', 'close', false, 'Bundle slid off the ridge, landed about three feet from Marcos. Nobody hit.', ['f1'], 1, '26-0890 Noah Webster']);
  check('...before the log went', (await grab(page, '__LOGS')).length, 0);
  check('the strip says it went, the card collapses, the review comes back', [/^Alert sent \d+:\d\d[ap] · PM, Shawn, Neal, Carl$/.test(await txt(page, '#alertCard .warnbar')), await txt(page, '.alertsum'), await cls(page, '#dlReview'), await page.locator('#dlBlockedFoot').count()],
    [true, 'Close call · Nobody hurt · Bundle slid off the ridge, landed about three feet from Marcos. Nobody hit. · 1 photo', 'btn btn-go sendbig', 0]);
  await tap(page, '[data-yn="safety"][data-v="0"]', 300);
  check('no after a sent alert stays yes: the incident happened', await cls(page, '[data-yn="safety"][data-v="1"]'), 'ynbtn on amber');
  await tap(page, '#dlReview', 400);
  check('the review names it', await page.locator('.rvrow .rv').allTextContents(), ['3h 00m · 2 codes', '1', '—', '—', '—', 'Yes · Close call']);
  await tap(page, '#dlSend', 1500);
  const logs = await grab(page, '__LOGS');
  check('the log carries the alert for its Safety field', [logs[0].safety, logs[0].alert.kind, logs[0].alert.hurt, logs[0].alert.text.slice(0, 26), typeof logs[0].alert.sentAt, logs[0].alert.to.length], [true, 'close', false, 'Bundle slid off the ridge,', 'number', 4]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_ALERTFAIL=true;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '[data-yn="safety"][data-v="1"]', 400);
  await tap(page, '[data-hurt="1"]', 200);
  await tap(page, '#alertSend', 1500);
  check('an alert that could not go stays unsent, said in red, and can be tried again', [/boom/.test(await txt(page, '#toast span')), await txt(page, '#alertSend'), await cls(page, '#dlReview')], [true, 'Send alert now', 'btn btn-go sendbig off']);
  await page.evaluate(() => { window.__MOCK_ALERTFAIL = false; });
  await tap(page, '#alertSend', 900);
  check('...and lands the second time', [(await grab(page, '__ALERTS')).length, await cls(page, '#dlReview')], [1, 'btn btn-go sendbig']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- Talk: no dictation in this browser, so the keyboard's mic is the way, said once ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '#dlTalk', 900);
  check('Talk focuses the box', await page.evaluate(() => document.activeElement && document.activeElement.id), 'dlStory');
  check('...and says, once, to use the keyboard mic', await txt(page, '#toast span'), 'Tap the mic on your keyboard');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- EN / ES ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await tap(page, '[data-lang="es"]', 400);
  check('Spanish: the header, the badge, the questions, the buttons, the tabs',
    [await txt(page, '#logK'), await txt(page, '#syncBadge'), await page.locator('.dlh').allTextContents(), await txt(page, '#dlTalk'), await txt(page, '#dlType'), await page.locator('[data-yn]').allTextContents(), await txt(page, '#dlReview'), await txt(page, '#dlNormal'), await page.locator('#tabs .tl').allTextContents()],
    ['Registro · JT #26-0890', 'Sin enviar', ['¿Cómo fue el día?', '¿Recogiste o recibiste material?', '¿Quién más estuvo en el sitio? · toca lo que aplique', '¿Hubo retrasos?', '¿Alguien lastimado o casi?'], 'Hablar', 'Escribir', ['Sí', 'No', 'Sí', 'No', 'Sí', 'No'], 'Enviar registro', 'Día normal · nada que reportar', ['Reloj', 'Mis trabajos', 'Registro']]);
  check('...the date in Spanish', /^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb), \d+ (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$/.test(await txt(page, '#logDate')), true);
  check('...the placeholder too', (await page.locator('#dlStory').getAttribute('placeholder')).split('\n')[0], 'Toca aquí y escribe, o usa Hablar');
  await tap(page, '[data-yn="f:22PC7jQ6BkBC"][data-v="1"]', 300);
  check('...and the reasons, to the eye', await page.locator('[data-opt="22PLhdEgfHXF"]').allTextContents(), ['Clima', 'Falta gente', 'Falta material', 'Otro']);
  check('...a trade too, while the value stays JobTread\'s', [await txt(page, '[data-opt="22PC7jNshbiK"][data-val="Roofing"]'), await page.locator('[data-opt="22PC7jNshbiK"][data-val="Roofing"]').count()], ['Techado', 1]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('the language is remembered', await page.locator('#tabs .tl').allTextContents(), ['Reloj', 'Mis trabajos', 'Registro']);
  await tap(page, '.tab[data-tab="log"]', 400);
  await tap(page, '[data-lang="en"]', 300);
  check('...and switches back', await page.locator('#tabs .tl').allTextContents(), ['Clock', 'My jobs', 'Day log']);
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

  // now clock in at Webster and move to Lucas
  await tap(page, '.tab[data-tab="job"]', 400);
  await tap(page, '#clockIn', 300);
  await tap(page, '.coderow:has-text("Masonry Labor")', 700);
  check('the code opens the camera, locked to the start photo', [await page.evaluate(() => S.tab), await page.evaluate(() => S.clockGate)], ['cam', 'start']);
  await shoot(page);
  await settle(page);
  check('on the clock, the card offers a move', await txt(page, '#pickJobLbl'), 'Move to another job');
  await tap(page, '#pickJobBtn', 400);
  check('the sheet says so', await txt(page, '#sheetTitle'), 'Move to which job?');
  await tap(page, '.jobrow[data-job="j2"]', 600);
  check('then the end photo of this code first', [await page.evaluate(() => S.tab), await page.evaluate(() => S.clockGate), await txt(page, '#afterBarT')], ['cam', 'end-switch', 'End photo of 04MA · you switch when you shoot']);
  await shoot(page);
  await page.waitForTimeout(900);
  await settle(page);
  check('then asks for the code at the next roof', await txt(page, '#sheetTitle'), 'Code at Lucas');
  await tap(page, '.coderow:has-text("Final Clean")', 500);
  check('then the start photo there', [await page.evaluate(() => S.clockGate), await txt(page, '#afterBarT')], ['start', 'Start photo · the clock starts when you shoot']);
  await shoot(page);
  await settle(page);
  check('the clock is now at the next roof', [await txt(page, '#jobAddr'), await txt(page, '#bandCodeName')], ['812 S Washington St', 'Final Clean']);
  check('...and the roof you left is owed its log, first', [/hidden/.test(await cls(page, '#clockNudge')), /^Send today’s log for Noah Webster\?/.test(await txt(page, '#clockNudge .nt'))], [false, true]);
  const sw = await page.evaluate(() => S.open && S.open.job && S.open.job.id);
  const last = await page.evaluate(() => window.__CLOCK.slice(-1)[0]);
  check('one call closed the old entry and opened the new one there, carrying both photos', [sw, last.slice(0, 3), !!last[3], !!last[4]], ['j2', ['switchCode', 'j2', 'ci5'], true, true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- yesterday's log, unsent ----
{
  const draft = draftOf({ date: isoYday, story: 'Footers poured.', at: Date.now() - 86400000 });
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_daylog', ${JSON.stringify(JSON.stringify({ ['j_2841|' + isoYday]: draft }))});`);
  const items = await page.evaluate(() => nudgeItems().map((i) => [i.kind, i.text]));
  check('the morning after: the unsigned roof first, then the unsent log', items, [['unsigned', 'Yesterday’s roof at Courtney isn’t signed off'], ['log-late', 'Yesterday’s log for Noah Webster wasn’t sent']]);
  check('the banner counts the rest', /\+1 more/.test(await txt(page, '#clockNudge .nt')), true);
  await page.evaluate(() => nudgeItems()[1].go());
  await page.waitForTimeout(400);
  check('the late log opens on yesterday', [/^Yesterday ·/.test(await txt(page, '#logDate')), await page.locator('#dlStory').inputValue()], [true, 'Footers poured.']);
  await tap(page, '#dlReview', 400);
  check('the review says yesterday', [/as yesterday’s daily log/.test(await txt(page, '.rvfoot')), await txt(page, '#dlSend')], [true, 'Send yesterday’s log']);
  await tap(page, '#dlSend', 1200);
  const logs = await grab(page, '__LOGS');
  check('...and sends it dated yesterday, without today\'s hours', [logs.length, logs[0].date, logs[0].hours], [1, isoYday, []]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a dead spot, and a JobTread hiccup, on the send ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlStory').fill('Done.');
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(200);
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 600);
  check('offline: queued, kept, will retry', [await txt(page, '#syncBadge'), await txt(page, '#dlQueued'), (await grab(page, '__LOGS')).length], ['Queued', 'Not sent — will retry', 0]);
  await page.evaluate(() => { window.__MOCK_LOGFAIL = true; });
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1200);
  check('a JobTread hiccup: still queued, still retrying', [await txt(page, '#syncBadge'), /^Not sent — trying again in \d+s$/.test(await txt(page, '#dlQueued')), (await grab(page, '__LOGS')).length], ['Queued', true, 0]);
  await page.evaluate(() => { window.__MOCK_LOGFAIL = false; dlRetryPending(); });
  await page.waitForTimeout(1200);
  check('the retry lands', [await txt(page, '#syncBadge'), (await grab(page, '__LOGS')).length], ['Sent', 1]);
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
  check('...and Diagnostics has the reason', await page.evaluate(() => S.lastErr && S.lastErr.where), 'photo upload');
  await page.evaluate(() => { window.__MOCK_READONLY = false; });   // writes on for the log itself
  await tap(page, '.tab[data-tab="log"]', 400);
  await page.locator('#dlStory').fill('Done.');
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 1500);
  const logs = await grab(page, '__LOGS');
  check('the log does not wait on a photo that cannot upload', [logs.length, logs[0].photos, logs[0].photosPending], [1, [], 1]);
  check('...and says it went without it', /Sent without 1 photo/.test(await txt(page, '.sentcard .ss')), true);
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
  const stuck = draftOf({ story: 'Done.', wantSend: true, sending: true });
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_daylog', ${JSON.stringify(JSON.stringify({ ['j_2841|' + isoToday]: stuck }))});`);
  await page.waitForTimeout(2500);
  const logs = await grab(page, '__LOGS');
  check('a send that was in flight before the reload goes again', logs.length, 1);
  await ctx.close();
}

// ---- a slow extras call must not hold the log's send ----
// The read lane: extras is held nine seconds; the send goes now, in the main
// lane, and the Diagnostics call log shows it waited for nothing.
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_SLOWEXTRAS=9000;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlStory').fill('Done.');
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 2500);
  check('the send went while extras was still out', [(await grab(page, '__LOGS')).length, await page.evaluate(() => S.codes.length)], [1, 0]);
  check('...in its own lane, not behind it', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return r && r.ok && r.wait < 1500; }), true);
  check('the reply\'s own timing is kept with the call', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return r.server && r.server.total === 1840 && r.server.pave === 1; }), true);
  check('...and the API\'s memory of its calls came with boot', await page.evaluate(() => S.recent.map(c => c.fn)), ['getStart', 'getExtras']);
  check('Diagnostics shows both', await page.evaluate(() => { const b = document.getElementById('apiBox'); return [!b.classList.contains('hidden'), /sendDailyLog/.test(b.textContent), /getExtras 31\.4s \(4 JT 29\.8s\)/.test(b.textContent)]; }), [true, true, true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- "Sending…" says how long, and a failed send says when it tries again ----
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_SLOWLOG=9500;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlStory').fill('Done.');
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 8800);
  check('a long send counts the seconds', [await txt(page, '#syncBadge'), /^Sending… \d+s$/.test(await txt(page, '#dlQueued'))], ['Queued', true]);
  await page.waitForTimeout(1600);
  check('...and lands', await txt(page, '#syncBadge'), 'Sent');
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({}, 'window.__MOCK_LOGFAIL=true;');
  await tap(page, '.tab[data-tab="log"]', 500);
  await page.locator('#dlStory').fill('Done.');
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 1500);
  check('a failed send says when it tries again', /^Not sent — trying again in (1[5-9]|20)s$/.test(await txt(page, '#dlQueued')), true);
  await page.waitForTimeout(2200);
  check('...and the number moves', /^Not sent — trying again in 1[3-7]s$/.test(await txt(page, '#dlQueued')), true);
  check('the failure is in the call log, with the reason and the API\'s own time', await page.evaluate(() => { const r = S.apiLog.filter(x => x.fn === 'sendDailyLog')[0]; return [r.ok, /boom/.test(r.err), !!(r.server && r.server.total === 1840)]; }), [false, true, true]);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a photo the old build stranded: named as gone, and the log says so ----
{
  const old = { id: 'ph_old', jobId: 'j_2841', tag: 'before', time: '3:41p', at: Date.now() - 120000, pending: true, thumb: '' };
  const { ctx, page, errs } = await boot({}, `localStorage.setItem('dbtc_prefs', ${JSON.stringify(JSON.stringify({ photos: [old] }))});`);
  await page.waitForTimeout(800);
  await tap(page, '.tab[data-tab="log"]', 500);
  check('a stranded photo is marked as gone', await page.evaluate(() => S.photos.map(p => [p.err, !!p.lost])), [['not uploaded — take it again', true]]);
  await page.locator('#dlStory').fill('Done.');
  await tap(page, '#dlReview', 400);
  await tap(page, '#dlSend', 1500);
  const logs = await grab(page, '__LOGS');
  check('the log carries it as gone, not as coming', [logs[0].photosPending, logs[0].photosFailed], [0, 1]);
  check('...and the sent card says to take it again', /1 photo never uploaded and is gone from this phone/.test(await txt(page, '.sentcard .ss')), true);
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
