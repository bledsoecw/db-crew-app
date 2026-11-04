/* T2.39 (audit I13): Close Out for anyone the work is assigned to, end to end
 * against dev/mock.js. Nothing here ships.
 *
 *   node dev/t239-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * Outside the service crew and Operations a person gets the Close Out tab
 * while JobTread holds close-out work assigned to them, and it shows that
 * work only: their repairs (not a partner's on the same job), the inspection
 * that is theirs (a service call's, a work area's), never a job the Close Out
 * server's name match calls theirs when JobTread does not. Anything else is
 * refused by the API (the mock answers as Code.gs does) and the phone says so
 * in the person's language. The service crew's Close Out is unchanged. */
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
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

// Made-up jobs, in DB CheckOut's shapes. `mine` here is what the Close Out
// server's NAME match says; who the work is assigned to is __MOCK_CO_ASSIGNED.
const FIX = `window.__MOCK_FIX = { coJobs: function (h) { return [
  { id: 'co-a', number: '26-1301', name: '261301 Adler_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
    projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '12 Oak St, Van Wert, OH 45891, USA', openPunchCount: 0, mine: false, openPunchTotal: 2,
    punchTasks: [
      { id: 'pa1', name: 'Tyler — Reseal the pipe boot', description: 'Rear slope boot is cracked.', progress: 0, endDate: null, createdAt: '2026-10-30T12:00:00.000Z', assignees: [], assigneeNames: ['Tyler B.'], mine: true },
      { id: 'pa2', name: 'Alberto — Replace two shingles', description: 'Two creased tabs on the front slope.', progress: 0, endDate: null, createdAt: '2026-10-30T12:00:00.000Z', assignees: [], assigneeNames: ['Alberto Gonzalez'], mine: false }
    ], soldScope: [] },
  { id: 'co-b', number: '26-1355', name: '261355 Bricker_Service', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Repairs/Service'], isService: true,
    projectManager: 'Dave Elick', salesRep: 'Sam Black', address: '40 Elm St, Ohio City, OH 45874, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [], soldScope: [] },
  { id: 'co-c', number: '26-1360', name: '261360 Cole_Roof', status: 'Punch List', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
    projectManager: 'Kyle Akerman', salesRep: null, address: '7 Pine St, Delphos, OH 45833, USA', openPunchCount: 1, mine: true, openPunchTotal: 1,
    punchTasks: [{ id: 'pc1', name: 'REPORT: Ridge vent', description: 'Nails backing out on the ridge vent.', progress: 0, endDate: null, createdAt: '2026-10-30T12:00:00.000Z', assignees: [], assigneeNames: ['Tyler B.'], mine: true }], soldScope: [] },
  { id: 'co-d', number: '26-1370', name: '261370 Dunn_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles', 'R-Gutters'], isService: false,
    projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '3 Lake Rd, Celina, OH 45822, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [],
    areas: [
      { key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-d', inspectionDate: h.isoAdd(0), assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: false, inspected: false, openRepairs: 0 },
      { key: 'gutters', label: 'Gutters', line: false, form: 'notes', inspectionTaskId: 'fg-d', inspectionDate: h.isoAdd(0), assigneeNames: ['Tyler B.'], mine: true, inspected: false, openRepairs: 0 }
    ], soldScope: [] }
]; } };`;
const TYLERS = { 'co-a': { repairs: ['pa1'] }, 'co-b': { inspect: true }, 'co-d': { inspect: 'fg-d' } };

async function boot(flags = {}, ctx0 = null) {
  const ctx = ctx0 || await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
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
  await page.addInitScript(`window.__MOCK_ROLE=${JSON.stringify(flags.role || 'siteManager')};window.__MOCK_CO_ASSIGNED=${JSON.stringify(flags.assigned || null)};window.__MOCK_CO_UNSET=${!!flags.unset};window.__MOCK_CO_NOTLISTED=${!!flags.notListed};`);
  await page.addInitScript(FIX);
  await page.addInitScript(mock);
  await page.goto(APP_URL + (flags.query || ''), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => { const l = page.locator(sel); return (await l.count()) ? (await l.first().textContent()).replace(/\s+/g, ' ').trim() : ''; };
const visibleTabs = (page) => page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].filter((b) => !b.classList.contains('hidden')).map((b) => b.getAttribute('data-tab')));
const calls = (page) => page.evaluate(() => (window.__CALLS || []).filter((f) => /^co[A-Z]/.test(f)));
const addPhoto = async (page, sel) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(sel).first().click()]);
  await chooser.setFiles({ name: 'shot.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForTimeout(700);
};
const screen = (page) => page.evaluate(() => ({
  tiles: [...document.querySelectorAll('#coBody [data-coscreen]')].map((b) => b.getAttribute('data-coscreen')),
  areas: [...document.querySelectorAll('#coBody [data-coarea]')].map((b) => b.getAttribute('data-coarea')),
  send: !!document.getElementById('coReview'),
  done: !!document.getElementById('coMyPartDone'),
}));
const allErrs = [];

// ---- nothing assigned: no tab, and the Close Out server never asked ----
{
  const { ctx, page, errs } = await boot({ role: 'siteManager' });
  check('a site manager with nothing assigned: the same three tabs as before', await visibleTabs(page), ['job', 'jobs', 'log']);
  check('…the phone asked once how much is theirs, and never for the list', await calls(page), ['coMine']);
  check('…and kept the answer for this person', await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('dbtc_comine')); return [m.scope, m.count, m.who === myEmail()]; }), ['assigned', 0, true]);
  check('…a Close Out link does not open a tab they do not have', await page.evaluate(() => { setTab('co'); return S.tab; }), 'job');
  allErrs.push(...errs); await ctx.close();
}

// ---- work assigned: the tab, and their work only ----
{
  const { ctx, page, errs } = await boot({ role: 'siteManager', assigned: TYLERS });
  check('work assigned to a site manager: the Close Out tab, beside their own', await visibleTabs(page), ['job', 'jobs', 'log', 'co']);
  check('…their list was fetched behind the clock, for Today and the arrival', [(await calls(page)).filter((f) => f === 'coQueue').length, await page.evaluate(() => (CO.jobs || []).map((j) => j.id))], [1, ['co-a', 'co-b', 'co-d']]);
  check('…not the job the Close Out server\'s name match calls theirs (co-c), with nothing of theirs in JobTread', await page.evaluate(() => (CO.jobs || []).some((j) => j.id === 'co-c')), false);
  check('…still the clock first: launching does not move them off it', await page.evaluate(() => S.tab), 'job');
  await tap(page, '.tab[data-tab="co"]', 900);
  check('the list: three cards, each for them', await page.evaluate(() => [document.querySelectorAll('#coBody [data-cojob].jmain').length, document.querySelectorAll('#coBody .badge.go').length]), [3, 3]);
  check('…no Assigned / All: there is nothing else to see', await page.evaluate(() => document.getElementById('coSeg').classList.contains('hidden')), true);
  check('…and the foot says the list is their own work', (await txt(page, '#coBody .foot')).startsWith('Only the Close Out work JobTread has assigned to you shows here.'), true);
  check('…what each is: a repair at a job still at Final Inspection, a service call\'s inspection, a work area\'s inspection',
    await page.evaluate(() => (CO.jobs || []).map((j) => [j.id, coKindOf(j), j.myRepairs, j.myInspect])), [['co-a', 'repairs', 1, false], ['co-b', 'inspect', 0, true], ['co-d', 'inspect', 0, true]]);
  check('…one repair reads "1 repair", not "1 repairs"', await txt(page, '#coBody [data-costart="co-a"] .a2'), '1 repair');
  check('…the repair\'s card starts the clock on the repair, the inspections\' on the inspection',
    await page.evaluate(() => ['co-a', 'co-b', 'co-d'].map((id) => { const b = document.querySelector('#coBody [data-costart="' + id + '"]'); return b ? b.classList.contains('warn') ? 'repairs' : 'inspect' : '—'; })), ['repairs', 'inspect', 'inspect']);

  // A repair of theirs on a job at Final Inspection: the repair, never the roof checklist.
  await tap(page, '#coBody [data-cojob="co-a"].jmain', 900);
  check('co-a: the repairs only — no checklist, no Review & send', await screen(page), { tiles: ['repairs'], areas: [], send: false, done: false });
  check('…and only their repair came (pa2 is Alberto\'s)', await page.evaluate(() => CO.job.punchTasks.map((t) => [t.id, t.mine])), [['pa1', true]]);
  await tap(page, '[data-coscreen="repairs"]', 700);
  check('…the list has no Mine / Everyone: there is only theirs', [await page.evaluate(() => [...document.querySelectorAll('#coBody .rep')].map((r) => r.getAttribute('data-corepair'))), await page.evaluate(() => document.getElementById('coSeg').classList.contains('hidden'))], [['pa1'], true]);
  await tap(page, '[data-corepair="pa1"]', 500);
  await addPhoto(page, '.phbig.need'); await page.waitForFunction(() => !!coVisit('co-a').before.pa1, null, { timeout: 10000 });
  await addPhoto(page, '.phbig.need'); await page.waitForFunction(() => !!coVisit('co-a').after.pa1, null, { timeout: 10000 });
  await page.locator('#coRepairNote').fill('New boot, sealed'); await page.locator('#coRepairNote').blur(); await page.waitForTimeout(500);
  await tap(page, '#coDone', 2500);
  const sent = await page.evaluate(() => (window.__CO || []).filter((c) => c.fn === 'coPhoto' || c.fn === 'coComplete').map((c) => c.fn === 'coPhoto' ? [c.fn, c.photo.label, c.photo.taskId] : [c.fn, c.taskId, c.jobId]));
  check('…their repair done: the photos and the Done go, with the job named', sent, [['coPhoto', 'BEFORE', 'pa1'], ['coPhoto', 'AFTER', 'pa1'], ['coComplete', 'pa1', 'co-a']]);
  await page.evaluate(() => coGo('job')); await page.waitForTimeout(900);
  check('…and the job then says their part is done, with no checklist offered in its place', await screen(page), { tiles: ['repairs'], areas: [], send: false, done: true });
  check('…in their words', [await txt(page, '#coMyPartDone .rk'), await txt(page, '#coMyPartDone .rt')], ['Your part of this job is done', 'Nothing else on this job is assigned to you.']);
  check('…and no clock-in offered for work that is done', await page.evaluate(() => !!document.querySelector('#coBody [data-coclockhere], #coBody #coClockHere')), false);

  // A service call's final inspection: the checklist, as the service crew have it.
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(400);
  await tap(page, '#coBody [data-cojob="co-b"].jmain', 900);
  const b = await screen(page);
  check('co-b: the inspection, with Review & send', [b.tiles.includes('inspect'), b.tiles.includes('repairs'), b.send], [true, false, true]);

  // A two-area job where only the gutters are theirs.
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(400);
  await tap(page, '#coBody [data-cojob="co-d"].jmain', 900);
  check('co-d: only the gutters, which are theirs — not the shingle roof\'s checklist', await screen(page), { tiles: [], areas: ['gutters'], send: false, done: false });
  check('…the job came with only that area', await page.evaluate(() => CO.job.areas.map((a) => a.key)), ['gutters']);

  // A job that is not theirs, opened anyway (a saved place, an old link).
  await page.evaluate(() => { localStorage.setItem('dbtc_co_job_co-c', JSON.stringify({ id: 'co-c', number: '26-1360', status: 'Punch List', punchTasks: [{ id: 'pc1', name: 'REPORT: Ridge vent', progress: 0, mine: true }] })); coOpenJob('co-c'); });
  await page.waitForTimeout(1200);
  check('a job that is not theirs: refused in their words, and the copy on the phone does not stand in for it',
    [await txt(page, '#coBody .jempty'), await page.evaluate(() => [CO.job, localStorage.getItem('dbtc_co_job_co-c')])], ['This isn’t assigned to you any more — ask the office.', [null, null]]);
  // Somebody else's repair, sent anyway: refused, kept as refused, in their words.
  const no = await page.evaluate(async () => { try { await apiCall('coComplete', ['pa2', 'co-a', 'x', 'r-t239-1']); return 'went'; } catch (e) { return String(e.message).slice(0, 17); } });
  check('the API refuses Done on somebody else\'s repair', no, 'NO_CLOSEOUT_WORK:');
  check('…and the outbox keeps such an item as refused, saying why', await page.evaluate(() => coSendItemNow({ kind: 'complete', taskId: 'pa2', jobId: 'co-a', payload: { note: '' }, id: 'r-t239-2' }).then((r) => [r.reject, r.err])),
    [true, 'This isn’t assigned to you any more — ask the office.']);
  check('…an inspection photo on a job where no inspection is theirs is refused too', await page.evaluate(async () => { try { await apiCall('coPhoto', ['co-a', { label: 'INSPECTION', imageBase64: 'data:x' }, 'r-t239-3']); return 'went'; } catch (e) { return /^NO_CLOSEOUT_WORK/.test(e.message); } }), true);

  // In Spanish.
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; coGo('queue'); render(); }); await page.waitForTimeout(500);
  check('in Spanish: the foot says it, then the English', await page.evaluate(() => document.querySelector('#coBody .foot').innerHTML.split('<br>').map((x) => x.trim())),
    ['Aquí sale solo el trabajo de Close Out que JobTread te asignó.', 'Only the Close Out work JobTread has assigned to you shows here.']);
  await page.evaluate(() => { CO.jobId = 'co-c'; CO.job = null; CO.jobErr = co('notYoursWork'); coGo('job'); coRender(); }); await page.waitForTimeout(300);
  check('…and the refusal', await txt(page, '#coBody .jempty'), 'Esto ya no está asignado a ti — pregunta en la oficina.');
  await page.evaluate(() => { S.lang = 'en'; render(); });

  // The work all done: the tab stays while they are on it, and goes when they leave it.
  await page.evaluate(() => { window.__MOCK_CO_ASSIGNED = {}; coGo('queue'); coMineLoad(true); }); await page.waitForTimeout(900);
  check('nothing left assigned: the tab stays while they are on it', [await page.evaluate(() => S.tab), (await visibleTabs(page)).includes('co')], ['co', true]);
  await tap(page, '.tab[data-tab="job"]', 400);
  check('…and is gone once they leave it', await visibleTabs(page), ['job', 'jobs', 'log']);
  check('…an empty list, were they to see it, says so in their words', await page.evaluate(() => { CO.jobs = []; CO.reason = ''; return coQueueHtml(); }).then((h) => /Nothing is assigned to you right now/.test(h)), true);
  allErrs.push(...errs); await ctx.close();
}

// ---- the answer kept: the tab is there at once on the next launch ----
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  let r = await boot({ role: 'siteManager', assigned: TYLERS }, ctx);
  check('a launch that asked: the tab', (await visibleTabs(r.page)).includes('co'), true);
  allErrs.push(...r.errs); await r.page.close();
  r = await boot({ role: 'siteManager', assigned: TYLERS }, ctx);
  check('the next launch, within the half hour: the tab from the answer kept, and nobody asked again', [(await visibleTabs(r.page)).includes('co'), (await calls(r.page)).includes('coMine')], [true, false]);
  check('…and their list still fetched behind the clock', [(await calls(r.page)).includes('coQueue'), await r.page.evaluate(() => (CO.jobs || []).length)], [true, 3]);
  check('…another person signed in on this phone is not given it: the answer was about somebody else', await r.page.evaluate(() => { S.coMine.who = 'someone.else@deitemeyerbrothers.com'; return coAssignedTab(); }), false);
  allErrs.push(...r.errs); await ctx.close();
}

// ---- a Close Out push, before the phone knew the work was theirs ----
{
  const { ctx, page, errs } = await boot({ role: 'crew', assigned: { 'co-a': { repairs: ['pa1'] } }, query: '?tab=co' });
  check('a crew member opening a Close Out push lands on Close Out once the phone hears the work is theirs', [await page.evaluate(() => S.tab), await visibleTabs(page)], ['co', ['job', 'jobs', 'co']]);
  check('…and sees their one job', await page.evaluate(() => (CO.jobs || []).map((j) => j.id)), ['co-a']);
  allErrs.push(...errs); await ctx.close();
}

// ---- a Gmail sign-in the Close Out server does not know yet ----
{
  const { ctx, page, errs } = await boot({ role: 'siteManager', assigned: TYLERS, notListed: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  check('a sign-in Close Out does not know: the tab says so, naming the address — not "can\'t reach Close Out"',
    await page.evaluate(() => { const e = document.querySelector('#coBody .jempty'); return e ? e.textContent.replace(myEmail(), '{email}') : ''; }),
    'Close Out doesn’t know {email} yet — ask the office to add it to Close Out’s list. What you saved here stays on this phone until then.');
  check('…and a send is kept as refused with the same words, for Retry once they are added', await page.evaluate(() => coSendItemNow({ kind: 'complete', taskId: 'pa1', jobId: 'co-a', payload: { note: '' }, id: 'r-t239-9' }).then((r) => [r.reject, r.err.replace(myEmail(), '{email}').slice(0, 40)])),
    [true, 'Close Out doesn’t know {email} yet — ask']);
  allErrs.push(...errs); await ctx.close();
}

// ---- Close Out not set up: nothing asked, no tab ----
{
  const { ctx, page, errs } = await boot({ role: 'siteManager', assigned: TYLERS, unset: true });
  check('Close Out not set up on the API: no tab, and nothing asked', [await visibleTabs(page), await calls(page)], [['job', 'jobs', 'log'], []]);
  allErrs.push(...errs); await ctx.close();
}

// ---- the service crew: unchanged ----
{
  const { ctx, page, errs } = await boot({ role: 'service', assigned: TYLERS });
  check('the service crew: Close Out as before, and never asked how much is theirs', [await visibleTabs(page), (await calls(page)).includes('coMine')], [['job', 'co'], false]);
  await page.waitForTimeout(600);
  check('…every job listed, Asignados / Todos there', [await page.evaluate(() => (CO.jobs || []).length), await page.evaluate(() => !document.getElementById('coSeg').classList.contains('hidden'))], [4, true]);
  await tap(page, '[data-cofilter="all"]', 400);
  await tap(page, '#coBody [data-cojob="co-a"].jmain', 900);
  check('…a job opened whole: both repairs', await page.evaluate(() => CO.job.punchTasks.map((t) => t.id)), ['pa1', 'pa2']);
  allErrs.push(...errs); await ctx.close();
}

// ---- Operations borrowing the crew's view: no Close Out there ----
{
  const { ctx, page, errs } = await boot({ role: 'ops', assigned: TYLERS });
  await page.evaluate(() => setViewAs('crew')); await page.waitForTimeout(300);
  check('Operations viewing as the crew: the crew\'s tabs, no Close Out', await visibleTabs(page), ['job', 'jobs']);
  allErrs.push(...errs); await ctx.close();
}

await browser.close();
let pass = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got ${JSON.stringify(r.actual)}\n     want ${JSON.stringify(r.expected)}`));
  if (r.pass) pass++;
}
const errOk = allErrs.length === 0;
console.log((errOk ? 'PASS  ' : 'FAIL  ') + 'no page errors' + (errOk ? '' : '\n      ' + allErrs.join('\n      ')));
console.log(`\n${pass + (errOk ? 1 : 0)}/${results.length + 1} passed`);
process.exit(pass === results.length && errOk ? 0 : 1);
