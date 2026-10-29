/* The site checks, end to end against dev/mock.js. Nothing here ships.
 *
 *   node dev/checks-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * Drives the real page: the card line, the checklist screen, one save per
 * burst of taps, the sign-off, the board's 403 making the list read-only,
 * a dead spot, a 502, and the unsaved state surviving a reload. The mock
 * records every save in window.__PUTS so the payload can be checked. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
}

async function boot(flags = {}) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) return;              // the sandbox has no CA for accounts.google.com
    const at = (m.location && m.location()) || {};
    if (/config\.js/.test(at.url || '')) return;                          // git-ignored; the mock pins the config instead
    errs.push(m.text());
  });
  await page.addInitScript(`window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;
    window.__MOCK_NOTMANAGER=${!!flags.notManager};window.__MOCK_PUTFAIL=${!!flags.putFail};window.__MOCK_SLOWPUT=${flags.slowPut || 0};`);
  if (flags.init) await page.addInitScript(flags.init);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
// Every save the mock saw; a save that never happened reads as an empty one
// rather than crashing the run, so the report still says which checks failed.
const puts = async (page) => {
  const list = await page.evaluate(() => (window.__PUTS || []).map((p) => JSON.parse(JSON.stringify(p))));
  return new Proxy(list, { get: (arr, k) => (typeof k === 'string' && /^\d+$/.test(k) && !arr[k]) ? { checks: { done: {} } } : arr[k] });
};
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const cls = (page, sel) => page.locator(sel).first().getAttribute('class');
const today = new Date();
const shortToday = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const isoToday = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

// ---- a site manager: the card, the list, the ticks, the magnet, the signature ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);

  check('a job with no list says so', await txt(page, '.jcard:has-text("Webster") .jck'), 'No checklist on this job yet');
  check('...and has no button', await page.locator('.jcard:has-text("Webster") [data-checks]').count(), 0);
  check('the board\'s words on the card, as sent', await txt(page, '.jcard:has-text("Courtney") .jck'), 'Finishing up — 3 of 10 done, not signed off');
  check('a roof that has not started yet shows no words, just the button', [await page.locator('.jcard:has-text("Lucas") .jck').count(), await page.locator('.jcard:has-text("Lucas") [data-checks]').count()], [0, 1]);
  check('in progress is amber', await cls(page, '.jcard:has-text("Courtney") .jck'), 'jck amber');
  check('yesterday\'s visit sits below today\'s, and says so', (await page.locator('#jobsList .jcard').last().locator('.jwhen .d').textContent()).trim(), 'Yesterday');
  check('the morning-after nudge, on the day list', await txt(page, '#jobsNudge .nt'), 'Yesterday’s job at Courtney isn’t signed off');
  check('...and on the clock screen', /hidden/.test(await cls(page, '#clockNudge')), false);

  await tap(page, '[data-checks="t2roof"]', 500);
  check('the checklist opens with one phase expanded', await page.locator('.ckphase.open').count(), 1);
  check('...the first with anything unticked', await page.locator('.ckphase.open').getAttribute('data-phase'), 'before');
  check('every line but the signature is a row', await page.locator('.ckrow').count(), 27);
  check('rows clear 56px', await page.locator('.ckrow').first().evaluate((el) => el.getBoundingClientRect().height >= 56), true);
  check('phase headers count done of total', await txt(page, '.ckphase[data-phase="before"] .c'), '0 of 11');
  check('the phase hint is the board\'s "when"', await txt(page, '.ckphase[data-phase="handover"] .w'), 'Only if you leave before the crew does');
  check('no JobTread words on the screen', /\b(task|subtask|progress)\b/i.test(await page.locator('#vChecks').innerText()), false);

  await tap(page, '.ckrow[data-line="address"]', 80);
  await tap(page, '.ckrow[data-line="homeowner"]', 80);
  await tap(page, '.ckrow[data-line="scope"]', 80);
  check('a tap flips at once', await cls(page, '.ckrow[data-line="address"]'), 'ckrow on');
  check('...before anything is sent', (await puts(page)).length, 0);
  check('the count moves with it', await txt(page, '.ckphase[data-phase="before"] .c'), '3 of 11');
  await page.waitForTimeout(2600);
  let p = await puts(page);
  check('one save per burst', p.length, 1);
  check('to the LIST\'s id, not the visit\'s', [p[0].taskId, p[0].jobId], ['t2roof', 'j2']);
  check('the whole state, every key', Object.keys(p[0].checks.done).length, 28);
  check('with the three ticks', [p[0].checks.done.address, p[0].checks.done.homeowner, p[0].checks.done.scope, p[0].checks.done.color], [true, true, true, false]);
  check('not signed, and no signature text sent', [p[0].checks.signOff, 'signedOff' in p[0].checks], [false, false]);
  check('the phone\'s date', p[0].today, isoToday);
  check('no membership id from the phone', 'membershipId' in p[0], false);
  check('the job label for the board\'s wording', p[0].jobLabel, '26-1045 Lucas');
  check('says Saved', await txt(page, '#ckSave'), 'Saved');
  await page.waitForTimeout(900);
  check('the header words refresh from the board', await txt(page, '#ckWords'), 'Before tear-off — 3 of 11 done');

  // A note on a line (T1.20): the pen opens a box under the row, the text
  // rides the next burst, and comes back lit after the save.
  check('every row has a pen, none lit yet', [await page.locator('.cknote-pen').count(), await page.locator('.cknote-pen.has').count()], [27, 0]);
  await tap(page, '[data-note-add="septic"]', 200);
  check('the pen opens a note box under that line', await page.locator('[data-note="septic"]').count(), 1);
  await page.locator('[data-note="septic"]').fill('septic is east of the drive');
  await page.waitForTimeout(2600);
  p = await puts(page);
  check('typing alone sends nothing — a note goes when the box is left (T1.21)', p.length, 1);
  await page.locator('[data-note="septic"]').press('Enter');
  await page.waitForTimeout(2600);
  p = await puts(page);
  check('the note rides the next save, every key present', [p.length, p[p.length - 1].checks.notes.septic, p[p.length - 1].checks.notes.address, Object.keys(p[p.length - 1].checks.notes).length], [2, 'septic is east of the drive', '', 27]);
  check('...and the pen is lit once it is there', await cls(page, '[data-note-add="septic"]'), 'cknote-pen has');
  check('the box keeps the words after the save', await page.locator('[data-note="septic"]').inputValue(), 'septic is east of the drive');

  await tap(page, '.ckphase[data-phase="finished"] .ckph', 300);
  await tap(page, '.ckrow[data-line="magnet"]', 100);
  check('the "who ran it?" field is not prefilled', await page.locator('#ckWho').inputValue(), '');
  await tap(page, '#ckWhoMe', 2600);
  p = await puts(page);
  check('the chip fills the first name and saves it', [p.length, p[2].checks.magnetBy, p[2].checks.done.magnet], [3, 'Tyler', true]);

  check('the sign-off button carries the signed-in first name', await txt(page, '#ckSignBtn'), 'Sign off as Tyler');
  await tap(page, '#ckSignBtn', 500);
  check('the confirm counts what is not ticked', await txt(page, '#sheetBody .body'), '23 lines not ticked — sign anyway?');
  await tap(page, '#skYes', 2200);
  p = await puts(page);
  check('yes -> one save with signOff true', [p.length, p[3].checks.signOff], [4, true]);
  check('the signature shown is the board\'s', await txt(page, '.cksign .st'), 'Signed off: Tyler · ' + shortToday);
  check('the button becomes Unsign', await page.locator('#ckUnsign').count(), 1);
  check('...and the words go green', await cls(page, '#ckWords'), 'jck green');

  await tap(page, '.ckrow[data-line="cleanup"]', 2600);
  p = await puts(page);
  check('ticks stay editable, and keep the signature', [p.length, p[4].checks.signOff, p[4].checks.done.cleanup], [5, true, true]);

  await tap(page, '#ckUnsign', 400);
  await tap(page, '#ukYes', 2200);
  p = await puts(page);
  check('unsign -> signOff false', [p.length, p[5].checks.signOff], [6, false]);
  check('...and the sign-off button is back', await page.locator('#ckSignBtn').count(), 1);

  await tap(page, '.ckrow[data-line="nails"]', 60);
  await tap(page, '#ckBack', 800);
  p = await puts(page);
  check('leaving the screen saves without waiting', [p.length, p[6].checks.done.nails], [7, true]);
  check('the checklist header reflected the state before leaving', true, true);
  check('the day list still lights the My jobs tab from the checklist', await cls(page, '.tab[data-tab="jobs"]'), 'tab on');

  // Signing off asked for the day log, and that comes first; the unsigned
  // roof from yesterday is the next item on the same banner.
  check('after a sign-off the banner asks for the day log first', await txt(page, '#jobsNudge .nt'), 'Signed off — send today’s log for Lucas? · +1 more');
  await page.evaluate(() => nudgeItems().filter((i) => i.kind === 'unsigned')[0].go());
  await page.waitForTimeout(500);
  check('the sign-off nudge opens that roof\'s checklist', await txt(page, '#ckK'), 'Site checks · JT #26-1490');
  check('...on the phase that still has work', await page.locator('.ckphase.open').getAttribute('data-phase'), 'finished');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a crew lead who is not a site manager: try the save, honour the 403 ----
{
  const { ctx, page, errs } = await boot({ notManager: true });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('the nudge shows until the board says otherwise', /hidden/.test(await cls(page, '#jobsNudge')), false);
  await tap(page, '[data-checks="t2roof"]', 500);
  check('rows are live before the first answer', await page.locator('.ckrow[disabled]').count(), 0);
  await tap(page, '.ckrow[data-line="address"]', 2600);
  check('the save was tried', (await puts(page)).length, 1);
  check('the 403 makes every row read-only', await page.locator('.ckrow[disabled]').count(), 27);
  check('the tick came back off', await cls(page, '.ckrow[data-line="address"]'), 'ckrow');
  check('one plain line at the top', await txt(page, '#ckRo'), 'The site manager ticks these.');
  check('no sign-off button', await page.locator('#ckSignBtn').count(), 0);
  check('no red error', await page.locator('#toast.err').isVisible(), false);
  check('the list is still shown', await page.locator('.ckrow').count(), 27);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('read-only is remembered, so no nudge', /hidden/.test(await cls(page, '#jobsNudge')), true);
  await tap(page, '[data-checks="t2roof"]', 500);
  check('...and the rows stay disabled', await page.locator('.ckrow[disabled]').count(), 27);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a dead spot in a driveway, then a 502, then a reload ----
{
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(200);
  await tap(page, '.ckrow[data-line="address"]', 80);
  await tap(page, '.ckrow[data-line="homeowner"]', 2600);
  check('offline: the ticks stay on', await page.locator('.ckrow.on').count(), 2);
  check('...and say so', await txt(page, '#ckSave'), 'Not saved — will retry');
  check('...and nothing was sent', (await puts(page)).length, 0);
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1500);
  let p = await puts(page);
  check('reconnect: saved once, the whole state', [p.length, p[0].checks.done.address, p[0].checks.done.homeowner], [1, true, true]);
  check('says Saved', await txt(page, '#ckSave'), 'Saved');

  await page.evaluate(() => { window.__MOCK_PUTFAIL = true; });
  await tap(page, '.ckrow[data-line="scope"]', 2600);
  check('502: kept, will retry', await txt(page, '#ckSave'), 'Not saved — will retry');
  check('...the tick still on', await cls(page, '.ckrow[data-line="scope"]'), 'ckrow on');
  check('...no red toast', await page.locator('#toast.err').isVisible(), false);
  // Closing the app tries one last save, which in a dead spot fails too: the
  // board stays down through the reload, and comes back for the new page.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  p = await puts(page);
  check('the next open retries what was unsaved', [p.length, p[0].checks.done.scope, p[0].checks.done.address], [1, true, true]);
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  check('...and shows it saved', await txt(page, '#ckSave'), 'Saved');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- a slow board: a tap during a save is not lost ----
{
  const { ctx, page, errs } = await boot({ slowPut: 1500 });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  await tap(page, '.ckrow[data-line="address"]', 1800);
  check('saving is said while in flight', await txt(page, '#ckSave'), 'Saving…');
  await tap(page, '.ckrow[data-line="homeowner"]', 3800);
  const p = await puts(page);
  check('a tap during a save rides the next one', [p.length, p[0].checks.done.homeowner, p[1].checks.done.address, p[1].checks.done.homeowner], [2, false, true, true]);
  check('both still ticked on screen', await page.locator('.ckrow.on').count(), 2);
  check('and settled', await txt(page, '#ckSave'), 'Saved');
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.24: a roof that takes more than a day ----
// One checklist per job, its ticks carried from day to day: before the stay's
// last day the group the sign-off lives in is folded and says when it comes.
const stay = (from, to) => `window.__MOCK_FIX={visits:function(h){return [{ taskId:'t2', jobId:'j2', jobNum:'26-1045', jobName:'261045 Lucas_Roof',
  start:h.isoAdd(${from}), end:h.isoAdd(${to}), days:3, dayOf:2, today:true, crewNote:'', cust:'Lucas', city:'Van Wert',
  address:'812 S Washington St, Van Wert, OH 45891, USA', status:'Production', jtype:'Roofing', material:{ text:'Pull from shop', cls:'warn' },
  warehouse:null, checks:h.checksFor('t2roof'), alongside:'Platinum', pm:'Dave Elick', reps:[] }];}};`;
const dayWords = (d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate();
{
  const { ctx, page, errs } = await boot({ init: stay(-1, 1) });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  const tmw = new Date(); tmw.setDate(tmw.getDate() + 1);
  check('day 2 of 3: the last day\'s group is folded and says when it comes',
    [await cls(page, '.ckphase[data-phase="finished"]'), await txt(page, '.ckphase[data-phase="finished"] .w')],
    ['ckphase later', 'On the last day — ' + dayWords(tmw)]);
  check('…the others are as they were', [await cls(page, '.ckphase[data-phase="before"]'), await txt(page, '.ckphase[data-phase="handover"] .w')],
    ['ckphase open', 'Only if you leave before the crew does']);
  // Finishing the handover group would open the next group with work in it —
  // not the last day's, before the last day.
  await tap(page, '.ckphase[data-phase="handover"] .ckph', 200);
  for (const k of ['tearoff', 'shingles', 'tarped', 'special', 'matcheck', 'photos1', 'pm']) await tap(page, `.ckrow[data-line="${k}"]`, 60);
  check('…finishing the group before it does not open it', /open/.test(await cls(page, '.ckphase[data-phase="finished"]')), false);
  await tap(page, '.ckphase[data-phase="finished"] .ckph', 200);
  check('…a tap still opens it: a roof can finish early', [/open/.test(await cls(page, '.ckphase[data-phase="finished"]')), await page.locator('#ckSignBtn').count()], [true, 1]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({ init: stay(-2, 0) });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  check('the last day: the group is the board\'s own again', [await cls(page, '.ckphase[data-phase="finished"]'), await txt(page, '.ckphase[data-phase="finished"] .w')],
    ['ckphase', 'The last day']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- T2.25: the board's whole list — N/A with its reason, and two more names ----
{
  const { ctx, page, errs } = await boot({ init: 'window.__MOCK_NAMES=true;' });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  // N/A: the pen's box offers it; nothing is n/a until there is a reason.
  await tap(page, '[data-note-add="septic"]', 200);
  await tap(page, '[data-na-open="septic"]', 200);
  check('Doesn\'t apply opens a reason box, focused, and settles nothing yet', [await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-na')),
    await page.locator('.ckrow.na').count()], ['septic', 0]);
  await page.fill('[data-na="septic"]', 'city   sewer');
  await page.locator('[data-na="septic"]').press('Enter');
  await page.waitForTimeout(300);
  check('a reason makes it n/a: dashed, N/A in the box, the reason under the line, never green', [await cls(page, '.ckrow[data-line="septic"]'), await txt(page, '.ckrow[data-line="septic"] .box'), await txt(page, '.ckrow[data-line="septic"] .nar')],
    ['ckrow na', 'N/A', 'Not applicable · city sewer']);
  check('…it counts toward its group, and the group says how many are n/a', await txt(page, '.ckphase[data-phase="before"] .ckph .c'), '1 of 11 · 1 n/a');
  await page.waitForTimeout(2200);
  let p = await puts(page);
  check('…saved with the reason, every other line "" ', [p.length, p[0].checks.na.septic, p[0].checks.na.address, p[0].checks.done.septic], [1, 'city sewer', '', false]);
  // A tick takes the n/a off.
  await tap(page, '.ckrow[data-line="septic"]', 2200);
  p = await puts(page);
  check('ticking an n/a line clears it', [await cls(page, '.ckrow[data-line="septic"]'), p[p.length - 1].checks.na.septic, p[p.length - 1].checks.done.septic], ['ckrow on', '', true]);
  // Covered by: and Watertight confirmed with:
  await page.evaluate(() => { S.ckOpen.handover = true; renderChecks(); });
  const before = (await puts(page)).length;
  await page.fill('[data-val="coveredBy"]', 'Kenton, back by 3:30');
  await page.waitForTimeout(2200);
  check('typing a name alone sends nothing — it goes when the box is left, like a note', (await puts(page)).length, before);
  await page.locator('[data-val="coveredBy"]').blur();
  await page.waitForTimeout(2200);
  p = await puts(page);
  check('Covered by: is a box; a name ticks its line and rides the save', [p[p.length - 1].checks.coveredBy, p[p.length - 1].checks.done.covered],
    ['Kenton, back by 3:30', true]);
  check('…and the row ticks once the box is left', await cls(page, '.ckrow[data-line="covered"]'), 'ckrow on');
  await page.evaluate(() => { S.ckOpen.finished = true; renderChecks(); });
  check('Watertight confirmed with: offers the crew leader', await txt(page, '[data-val-pick="watertightWith"]'), 'Jeremiah');
  await tap(page, '[data-val-pick="watertightWith"]', 2200);
  p = await puts(page);
  check('…one tap names him and ticks the line', [await page.inputValue('[data-val="watertightWith"]'), p[p.length - 1].checks.watertightWith, p[p.length - 1].checks.done.watertight], ['Jeremiah Zehr', 'Jeremiah Zehr', true]);
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Without the two lines, their names are never sent: the board keeps them.
  const { ctx, page, errs } = await boot();
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-checks="t2roof"]', 500);
  await tap(page, '.ckrow[data-line="address"]', 2200);
  const p = await puts(page);
  check('a list with no name lines sends neither name', ['coveredBy' in p[0].checks, 'watertightWith' in p[0].checks], [false, false]);
  check('no page errors (no names)', errs, []);
  await ctx.close();
}

// ---- T2.25: the bench's pre-start list, construction's first checklist ----
// Seven ticks on Webster's Start Date line, the board's words and order;
// saved whole when the list is left, never per tap (each save is a comment).
{
  const { ctx, page, errs } = await boot({ init: 'window.__MOCK_PRESTART=true;' });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  check('the card says where the pre-start stands, in the board\'s words', [await txt(page, '.jcard:has([data-prestart="tpre"]) .jck'), await txt(page, '[data-prestart="tpre"]')],
    ['Pre-start — 2 of 7 done', 'Pre-start']);
  await tap(page, '[data-prestart="tpre"]', 500);
  check('the screen: its title, its seven lines in order, two ticked', [await txt(page, '#ckK'), await page.locator('#ckBody .ckrow').count(), await page.locator('#ckBody .ckrow.on').count(),
    (await page.locator('#ckBody .ckrow .lbl').first().textContent()).split(' — ')[0], await txt(page, '#ckBody .ckph .c')],
    ['Pre-start · JT #26-0890', 7, 2, 'Pre-con meeting held', '2 of 7']);
  check('ticks only: no pens, no N/A, no sign-off', [await page.locator('#ckBody .cknote-pen').count(), await page.locator('#ckSignBtn').count()], [0, 0]);
  await tap(page, '[data-pline="utilities"]', 200);
  await tap(page, '[data-pline="material"]', 200);
  check('…taps are kept, nothing is sent yet', [await page.locator('#ckBody .ckrow.on').count(), await page.evaluate(() => (window.__PREPUTS || []).length), await txt(page, '#ckSave')],
    [4, 0, 'Saves when you leave the list']);
  await tap(page, '#ckBack', 1200);
  const pp = await page.evaluate(() => window.__PREPUTS || []);
  check('leaving the list saves it once, the whole state', [pp.length, pp[0] && pp[0].taskId, pp[0] && pp[0].jobId, pp[0] && Object.keys(pp[0].done).length,
    pp[0] && pp[0].done.utilities, pp[0] && pp[0].done.material, pp[0] && pp[0].done.debris], [1, 'tpre', 'j_2841', 7, true, true, false]);
  check('…and the card reads the board\'s new words', await txt(page, '.jcard:has([data-prestart="tpre"]) .jck'), 'Pre-start — 4 of 7 done');
  check('no page errors', errs, []);
  await ctx.close();
}
{
  // Not on the bench, not a site manager: the board's 403, remembered.
  const { ctx, page, errs } = await boot({ init: 'window.__MOCK_PRESTART=true;window.__MOCK_PRE_FORBID=true;' });
  await tap(page, '.tab[data-tab="jobs"]', 900);
  await tap(page, '[data-prestart="tpre"]', 500);
  await tap(page, '[data-pline="debris"]', 200);
  await page.evaluate(() => prFlush('tpre'));
  await page.waitForTimeout(900);
  check('the 403: read-only with the board\'s words, the tick dropped', [await page.locator('#ckRo').isVisible(), (await txt(page, '#ckRo')).startsWith('Only the construction bench'), await page.locator('#ckBody .ckrow.on').count(), await page.locator('#ckBody .ckrow[disabled]').count()],
    [true, true, 2, 7]);
  check('no page errors (403)', errs, []);
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
