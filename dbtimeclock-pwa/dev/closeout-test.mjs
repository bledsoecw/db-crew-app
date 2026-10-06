/* Close Out, the roles and the People tab, end to end against dev/mock.js.
 * Nothing here ships.
 *
 *   node dev/closeout-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * Drives the real page: which tabs each role gets, a borrowed view, the
 * queue, an inspection with a Falla and its report (photo, note, the English
 * note), the cleanup, the one send and the ORDER its outbox delivers in
 * (report, its photo, the close), a photo the server answers 409 to being
 * kept and retried, a report the server refuses being kept as rejected with
 * the reason and discardable, a repair finished with its after photo, and
 * Operations setting a role. The mock records every forwarded call in
 * window.__CO and every role change in window.__ROLES. */
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
// A real JPEG, 1x1, for the file input: the app downscales through a canvas,
// which refuses anything that is not an image.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

async function boot(flags = {}) {
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
  await page.addInitScript(`window.__MOCK_ROLE=${JSON.stringify(flags.role || 'siteManager')};window.__MOCK_CO_PHOTO409=${!!flags.photo409};
    window.__MOCK_CO_REJECT=${!!flags.reject};window.__MOCK_CO_DOWN=${!!flags.down};window.__MOCK_CO_UNSET=${!!flags.unset};`);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const visibleTabs = (page) => page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].filter((b) => !b.classList.contains('hidden')).map((b) => b.getAttribute('data-tab')));
const calls = (page) => page.evaluate(() => (window.__CO || []).map((c) => JSON.parse(JSON.stringify(c))));
const addPhoto = async (page, sel) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(sel).first().click()]);
  await chooser.setFiles({ name: 'shot.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForTimeout(700);
};
const allErrs = [];

// ---- the tabs each role gets, and the service crew opening in Spanish ----
{
  for (const [role, want] of [['crew', ['job', 'jobs']], ['siteManager', ['job', 'jobs', 'log']], ['service', ['job', 'co']], ['ops', ['job', 'jobs', 'log', 'co', 'people']]]) {
    const { ctx, page, errs } = await boot({ role });
    check(`${role}: the tabs`, await visibleTabs(page), want);
    if (role === 'service') {
      check('service: Spanish first on this phone', await page.evaluate(() => S.lang), 'es');
      check('service: the header names the role', await txt(page, '#hdrW'), 'Alberto Gonzalez · Service');
      // A crew member's card never sends them to a Day log they do not have.
      check('service: no day-log tab, no log nudge', await page.evaluate(() => nudgeItems().filter((i) => /^log/.test(i.kind)).length), 0);
    }
    if (role === 'crew') check('crew: the job card offers the clock, not the log', await page.evaluate(() => /data-go=/.test(actionCellHtml({ jobId: 'j2', today: true })) && !/data-log=/.test(actionCellHtml({ jobId: 'j2', today: true }))), true);
    allErrs.push(...errs);
    await ctx.close();
  }
}

// ---- Operations: People, a role change, and a borrowed view ----
{
  const { ctx, page, errs } = await boot({ role: 'ops' });
  await tap(page, '.tab[data-tab="people"]', 900);
  check('People lists the roles in groups', await page.evaluate(() => [...document.querySelectorAll('#peopleBody .k')].map((k) => k.textContent.split(' ·')[0])), ['View the app as', 'Service', 'Site managers', 'Crew', 'Operations']);
  check('a seed not yet signed in is marked pending', await page.evaluate(() => [...document.querySelectorAll('.pcard')].filter((c) => /Not signed in yet/.test(c.textContent)).map((c) => c.querySelector('.pname').textContent)), ['Yahir Gonzalez']);
  check('Operations has no role chips of its own', await page.evaluate(() => [...document.querySelectorAll('.pcard')].filter((c) => /operations@/.test(c.textContent))[0].querySelectorAll('[data-role]').length), 0);
  await tap(page, '[data-email="zac@deitemeyerbrothers.com"][data-role="siteManager"]', 700);
  check('a tap sets the role through the API', await page.evaluate(() => window.__ROLES), [{ email: 'zac@deitemeyerbrothers.com', role: 'siteManager' }]);
  check('…and the card moves to its new group', await page.evaluate(() => [...document.querySelectorAll('.pcard')].findIndex((c) => /Zac/.test(c.textContent)) < [...document.querySelectorAll('.pcard')].findIndex((c) => /Brian/.test(c.textContent))), true);
  await tap(page, '#peopleBody [data-viewas="service"]', 600);
  check('viewing as service: the tabs are theirs', await visibleTabs(page), ['job', 'co']);
  check('…and the bar says so, with the way back', [await txt(page, '#viewBar .vb-t'), await txt(page, '#viewBar button')], ['Viewing as Service · Alberto & Yahir’s app', 'Back to my own view']);
  check('…and it is remembered', await page.evaluate(() => JSON.parse(localStorage.getItem('dbtc_prefs')).viewAs), 'service');
  await tap(page, '#viewBar [data-viewas]', 500);
  check('back to my own view', await visibleTabs(page), ['job', 'jobs', 'log', 'co', 'people']);
  await tap(page, '.tab[data-tab="co"]', 900);
  check('ops sees every job, with who it is for', await page.evaluate(() => { CO.filter = 'all'; coRender(); return [...document.querySelectorAll('#coBody .jcard')].length; }), 4);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the service crew: an inspection, a Falla, its report, the send ----
{
  const { ctx, page, errs } = await boot({ role: 'service', photo409: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  check('the queue: my jobs first', await page.evaluate(() => [...document.querySelectorAll('#coBody .jcard .n')].map((n) => n.textContent)), ['JT #26-0418', 'JT #26-0415']);
  check('the badges say what each is', await page.evaluate(() => [...document.querySelectorAll('#coBody .jcard')].map((c) => c.querySelector('.badge').textContent)), ['Inspección final', 'Reparaciones · 2']);
  await tap(page, '[data-cojob="co-hartman"]', 800);
  check('the job home: four tiles and a disabled send', await page.evaluate(() => [[...document.querySelectorAll('#coBody .jtile .es')].map((e) => e.textContent), document.getElementById('coReview').disabled]), [['Inspección', 'Limpieza', 'Problemas', 'Fotos de la visita', 'Trabajo vendido'], true]);
  await tap(page, '[data-coscreen="inspect"]', 500);
  check('eight lines, three answers each', await page.evaluate(() => [document.querySelectorAll('#coBody .ans').length, [...document.querySelectorAll('#coBody .ans')][0].querySelectorAll('button').length]), [8, 3]);
  for (let i = 0; i < 8; i++) if (i !== 3) await tap(page, `.ans[data-key="${['22PdEQfPnVqh','22PdEQfPnVqi','22PdEQfPnVqj','22PdEQfPnVqk','22PdEQfPnVqm','22PdEQfPnVqn','22PdEQfPnVqp','22PdEQfPnVqq'][i]}"] .ok`, 120);
  check('the count follows', await txt(page, '#coState'), '7 de 8');
  // Falla opens the report, prefilled with the line.
  await tap(page, '.ans[data-key="22PdEQfPnVqk"] .fix', 600);
  check('a Falla opens the report for that line', await page.evaluate(() => [CO.screen, document.getElementById('coK').textContent, document.getElementById('coSaveReport').disabled]), ['report', 'Problemas · punto 4 · JT #26-0418', true]);
  await addPhoto(page, '[data-cophoto]');
  check('a photo lands on the report', await page.evaluate(() => coVisit('co-hartman').reports[0].photos.length), 1);
  await tap(page, '[data-cowhere="back"]', 200);
  await page.locator('#coNote').fill('La bota del tubo de atrás está rota, le entra agua');
  await page.locator('#coNote').blur();
  await page.waitForTimeout(700);
  check('the note gets its English for the office', await page.evaluate(() => coVisit('co-hartman').reports[0].noteEn), 'EN: La bota del tubo de atrás está rota, le entra agua');
  check('…shown under the box', await txt(page, '#coBody .rvstory .rt'), 'EN: La bota del tubo de atrás está rota, le entra agua');
  await tap(page, '#coSaveReport', 600);
  check('saved: back on the list, the line says so', await page.evaluate(() => [CO.screen, document.querySelector('[data-coreport]').textContent.replace(/\s+/g, ' ').trim()]), ['inspect', 'Falla · punto 4Problema guardado · 1 foto ›']);
  await tap(page, '#coNext', 500);
  check('next: the cleanup', await txt(page, '#coK'), 'Limpieza · JT #26-0418');
  for (const k of ['22PdEQhB6rSR', '22PdEQhB6rSS', '22PdEQhB6rST', '22PdEQhB6rSU', '22PdEQhB6rSV']) await tap(page, `.ans[data-key="${k}"] .ok`, 120);
  await tap(page, '#coNext', 500);
  check('the job home: everything in, send enabled', await page.evaluate(() => [document.getElementById('coReview').disabled, [...document.querySelectorAll('#coBody .jtile .cnt')].map((c) => c.textContent)]), [false, ['8 de 8', '5 de 5', '1', '—', '1']]);
  await tap(page, '#coReview', 500);
  check('review: what will be said', await page.evaluate(() => [...document.querySelectorAll('#coBody .rvrow .rv')].map((c) => c.textContent)), ['7 bien · 1 falla', '5 de 5', '1 reportados', '0']);
  await tap(page, '#coSend', 2500);
  const sent = await calls(page);
  check('the outbox delivers in order: the report, its photo, the close', sent.filter((c) => c.fn !== 'coTranslate').map((c) => c.fn), ['coReport', 'coPhoto', 'coClose']);
  check('the report carries the English note, the line and where', [sent[1].report.englishNote, sent[1].report.itemKey, sent[1].report.location, sent[1].report.fixedOnSite, sent[1].report.heardText], ['EN: La bota del tubo de atrás está rota, le entra agua', '22PdEQfPnVqk', 'Back', false, 'La bota del tubo de atrás está rota, le entra agua']);
  check('the photo names its report and the line', [sent[2].photo.label, sent[2].photo.reportRef === sent[1].ref, sent[2].photo.itemKey, /^data:image\/jpeg;base64,/.test(sent[2].photo.imageBase64)], ['REPORT', true, '22PdEQfPnVqk', true]);
  check('the close carries both lists, the finding and the problem count', [Object.keys(sent[3].visit.answers.inspection).length, Object.keys(sent[3].visit.answers.cleanup).length, sent[3].visit.findings.length, sent[3].visit.problemsReported, sent[3].visit.answers.inspection['22PdEQfPnVqk']], [8, 5, 1, 1, 'ACTION']);
  check('every item carried its own client reference', sent.filter((c) => c.ref).map((c) => /^[A-Za-z0-9._-]{1,64}$/.test(c.ref)), [true, true, true]);
  check('the phone says it went, and where the job moved', await page.evaluate(() => [CO.screen, document.querySelector('#coBody .hero .ss').textContent]), ['send', 'El trabajo pasó a Punch List']);
  check('the phone\'s copy is cleared for the next visit', await page.evaluate(() => { const v = coVisit('co-hartman'); return [Object.keys(v.answers.inspection).length, v.reports.length, v.photos.length, v.sentAt > 0]; }), [0, 0, 0, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- a photo the server answers 409 to is kept and retried; a refusal is kept and shown ----
{
  const { ctx, page, errs } = await boot({ role: 'service', reject: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  await tap(page, '[data-cojob="co-hartman"]', 800);
  await page.evaluate(() => {
    const v = coVisit('co-hartman');
    CO_INSPECT.forEach((i) => { v.answers.inspection[i.key] = 'OK'; });
    CO_CLEAN.forEach((i) => { v.answers.cleanup[i.key] = 'OK'; });
    v.reports.push({ ref: 'rfix1', itemKey: '', itemN: '', location: 'front', locationText: '', locationWords: 'Front', note: 'Gutter loose', noteEn: 'Gutter loose', fixed: false, photos: [], saved: true, at: Date.now() });
    coPersist(); coRender();
  });
  await tap(page, '#coReview', 400);
  await tap(page, '#coSend', 2500);
  check('a refused report is kept as rejected with the reason, the close still goes', await page.evaluate(() => CO.outbox.map((it) => [it.kind, it.status, it.err])), [['report', 'rejected', 'location and englishNote are required']]);
  check('…and the screen says so', await page.evaluate(() => [...document.querySelectorAll('#coBody .obrow .st')].map((s) => s.textContent)), ['rechazado']);
  const closeCalls = (await calls(page)).filter((c) => c.fn === 'coClose');
  check('the close went past it', closeCalls.length, 1);
  await tap(page, '[data-codiscard]', 500);
  check('discarded on request', await page.evaluate(() => CO.outbox.length), 0);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({ role: 'service', down: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  check('the server down: the last copy, said so', await page.evaluate(() => [CO.reason, document.getElementById('coBar').classList.contains('hidden') ? '' : document.getElementById('coBar').textContent]), ['unreachable', '']);
  await page.evaluate(() => { localStorage.setItem('dbtc_co_queue', JSON.stringify({ at: Date.now() - 60000, jobs: [{ id: 'co-hartman', number: '26-0418', name: '260418 Hartman_Roof', status: 'Final Inspection', mine: true, address: '1427 Prairie View Dr, Lima, OH', projectTypes: [] }] })); CO.jobs = null; coLoadQueue(true); });
  await page.waitForTimeout(1200);
  check('…a saved copy is shown with the bar', await page.evaluate(() => [CO.jobsSource, document.getElementById('coBar').textContent]), ['copy', 'Sin conexión — mostrando la última copia']);
  await page.evaluate(() => { CO.jobId = 'co-hartman'; const v = coVisit('co-hartman'); v.reports.push({ ref: 'rdown', itemKey: '', location: '', locationWords: 'Front', note: 'x', noteEn: 'x', fixed: false, photos: [], saved: true, at: Date.now() }); coPersist(); coSendVisit('co-hartman'); });
  await page.waitForTimeout(1500);
  check('with the server down the items wait, nothing is lost', await page.evaluate(() => CO.outbox.map((it) => [it.kind, it.status])), [['report', 'queued'], ['close', 'queued']]);
  allErrs.push(...errs);
  await ctx.close();
}
{
  const { ctx, page, errs } = await boot({ role: 'service', unset: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  check('not connected yet: the tab says so', await txt(page, '#coBody .jempty'), 'Close Out no está conectado todavía — pide a la oficina que ponga CLOSEOUT_API_URL.');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- repairs: the list, one repair, the after photo gate, Terminado ----
{
  const { ctx, page, errs } = await boot({ role: 'service' });
  await tap(page, '.tab[data-tab="co"]', 900);
  await tap(page, '[data-cojob="co-okafor"]', 900);
  await tap(page, '[data-coscreen="repairs"]', 700);
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#coBody .rep')].map((r) => [r.querySelector('.es').textContent, r.classList.contains('done')]));
  check('the repairs: mine, in Spanish, the REPORT marker gone', await rows(), [['ES: Reseal the pipe boot', false], ['ES: Reconnect the downspout', false]]);
  await tap(page, '[data-colist="all"]', 300);
  check('…Todos adds the other person\'s, done and struck', await rows(), [['ES: Reseal the pipe boot', false], ['ES: Reconnect the downspout', false], ['ES: Exposed nails sealed', true]]);
  await tap(page, '[data-colist="mine"]', 300);
  check('the to-dos were asked for in Spanish once', (await calls(page)).filter((c) => c.fn === 'coTranslate' && c.to === 'es').length, 1);
  await tap(page, '[data-corepair="pt1"]', 500);
  check('one repair: what to do, the after photo required, Terminado off', await page.evaluate(() => [document.querySelector('#coBody .rvstory .rt').textContent.slice(0, 12), document.querySelectorAll('.phbig.empty').length, document.getElementById('coDone').disabled]), ['ES: Rear slo', 2, true]);
  await addPhoto(page, '.phbig.need');
  check('the after photo unlocks Terminado', await page.evaluate(() => [document.querySelectorAll('.phbig.empty').length, document.getElementById('coDone').disabled]), [1, false]);
  await page.locator('#coRepairNote').fill('Bota nueva y sellada');
  await tap(page, '#coDone', 2500);
  const done = (await calls(page)).filter((c) => c.fn === 'coPhoto' || c.fn === 'coComplete');
  check('the after photo goes on the task, then the completion with the note', done.map((c) => c.fn === 'coPhoto' ? [c.fn, c.photo.label, c.photo.taskId] : [c.fn, c.taskId, c.note]), [['coPhoto', 'AFTER', 'pt1'], ['coComplete', 'pt1', 'Bota nueva y sellada']]);
  check('back on the list, the repair reads done', await page.evaluate(() => [CO.screen, [...document.querySelectorAll('#coBody .rep')].filter((r) => r.classList.contains('done')).length]), ['repairs', 1]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- T2.4: a service phone lands on Close Out; Start clocks in; the send offers the clock ----
{
  const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(300); };
  const until = async (page, fn) => { await page.waitForFunction(fn, null, { timeout: 10000 }); await page.waitForTimeout(200); };
  // The shutter, as captured() sees it.
  const shoot = (page) => page.evaluate(() => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    c.getContext('2d').fillRect(0, 0, 8, 8);
    c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
  }));
  const clockCalls = (page) => page.evaluate(() => (window.__CLOCK || []).map((c) => c.slice(0, 3)));

  { const { ctx, page, errs } = await boot({ role: 'crew' });
    check('a crew phone still opens on the clock', await page.evaluate(() => S.tab), 'job');
    allErrs.push(...errs); await ctx.close(); }

  const { ctx, page, errs } = await boot({ role: 'service' });
  check('a service phone opens on Close Out', await page.evaluate(() => [S.tab, CO.screen, S.tabTouched]), ['co', 'queue', false]);

  // Off the clock: Start opens the job and asks for the code (nothing on this
  // job's list reads like inspection work, so it is the sheet). The code list
  // is slow here, on purpose: the curtain is up from the tap until the
  // question is on screen (T2.5), so nothing else takes a finger meanwhile.
  // (The queue's prefetch had already put this job's codes on the phone — the
  // fast path; forget them so the slow path shows.)
  await page.evaluate(() => { const m = codesCache(); delete m['co-hartman']; localStorage.setItem('dbtc_codes', JSON.stringify(m)); });
  await page.evaluate(() => { const real = window.apiCall; window.__slowCodes = true; window.apiCall = (fn, args, co) => fn === 'getJobCodes' && window.__slowCodes ? new Promise((res) => setTimeout(() => res(real(fn, args, co)), 1200)) : real(fn, args, co); });
  await tap(page, '[data-costart="co-hartman"]', 300);
  check('Start: the curtain is up while the codes are fetched, and nothing else opens', await page.evaluate(() => [document.getElementById('wait').classList.contains('on'), document.getElementById('waitT').textContent, document.body.style.pointerEvents, S.sheet, CO.screen]), [true, 'Marcando entrada…', 'none', null, 'job']);
  await page.waitForTimeout(1500);
  check('…and down once the code question is on screen', await page.evaluate(() => [document.getElementById('wait').classList.contains('on'), document.body.style.pointerEvents, !!codesCached('co-hartman')]), [false, '', true]);
  await page.evaluate(() => { window.__slowCodes = false; });
  check('Start opens the job and asks the code question', await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.sheet, S.job && S.job.id, S.coReturn]), ['co', 'job', 'co-hartman', 'codes', 'co-hartman', 'co-hartman']);
  await tap(page, '[data-code="ci2"]', 500);
  check('the code picked, the camera is locked to the start photo', await page.evaluate(() => [S.tab, S.clockGate, S.gateCode && S.gateCode.id]), ['cam', 'start', 'ci2']);
  await shoot(page); await settle(page);
  check('the shutter clocks in on that job and hands back to its Close Out screen', [await clockCalls(page), await page.evaluate(() => [S.tab, CO.screen, CO.jobId, !!S.open, S.coReturn])], [[['clockIn', 'co-hartman', 'ci2']], ['co', 'job', 'co-hartman', true, null]]);

  // Start again on the same job: already on the clock here, nothing opens.
  await page.evaluate(() => { CO.screen = 'queue'; CO.jobId = null; CO.job = null; coRender(); });
  await tap(page, '[data-costart="co-hartman"]', 600);
  check('Start while on the clock here: the job opens, no second entry, no sheet', [await clockCalls(page), await page.evaluate(() => [CO.screen, CO.jobId, S.sheet, S.coReturn])], [[['clockIn', 'co-hartman', 'ci2']], ['job', 'co-hartman', null, null]]);

  // The send, with the clock running: the row that offers the Stop sheet.
  await page.evaluate(() => { const v = coVisit('co-hartman'); CO_INSPECT.forEach((i) => { v.answers.inspection[i.key] = 'OK'; }); CO_CLEAN.forEach((i) => { v.answers.cleanup[i.key] = 'OK'; }); coPersist(); coGo('send'); });
  await page.waitForTimeout(300);
  check('before the send: the button, no clock row', await page.evaluate(() => [!!document.getElementById('coSend'), !!document.querySelector('[data-coclock]')]), [true, false]);
  await tap(page, '#coSend', 2500);
  check('after the send: the clock row names the running code', await page.evaluate(() => { const b = document.querySelector('[data-coclock]'); return [!!b, !!b && b.querySelector('.es').textContent.indexOf('01GR Crew Labor') !== -1, !!CO.receipt]; }), [true, true, true]);
  await tap(page, '[data-coclock]', 400);
  check('…and it is the Stop sheet: break, switch code or job, clock out', await page.evaluate(() => [S.sheet, document.getElementById('sheetTitle').textContent, !!document.getElementById('stopBreak'), !!document.getElementById('stopSwitch'), !!document.getElementById('stopOut')]), ['stop', 'Stop the clock', true, true, true]);
  await page.evaluate(() => closeSheet());

  // On the clock here, Start on ANOTHER inspection: the move, as the Clock
  // tab does it — end photo, the next job's code over its Close Out screen,
  // start photo — and back to that job.
  await page.evaluate(() => { CO.screen = 'queue'; CO.jobId = null; CO.job = null; CO.filter = 'all'; coRender(); });
  await tap(page, '[data-costart="co-reyes"]', 900);
  check('Start elsewhere while on the clock: the end photo first', await page.evaluate(() => [S.tab, S.clockGate, S.moving, S.pendingJob && S.pendingJob.id, S.coReturn, CO.jobId]), ['cam', 'end-switch', true, 'co-reyes', 'co-reyes', 'co-reyes']);
  await shoot(page); await until(page, () => S.sheet === 'codes');
  check('…then the next job\'s code sheet, over its Close Out screen (from the phone\'s copy, prefetched with the queue)', await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.sheet, !!S.switching, !!codesCached('co-reyes')]), ['co', 'job', 'co-reyes', 'codes', true, true]);
  await tap(page, '[data-code="ci4"]', 500);
  check('…the start photo', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'start']);
  await shoot(page); await settle(page);
  check('…one switch call, and the clock and Close Out both on the new job', [await clockCalls(page), await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.job && S.job.id, S.open && S.open.code && S.open.code.id, S.coReturn, S.moving, S.pendingJob])], [[['clockIn', 'co-hartman', 'ci2'], ['switchCode', 'co-reyes', 'ci4']], ['co', 'job', 'co-reyes', 'co-reyes', 'ci4', null, false, null]]);

  // A tab tapped by hand clears the hand-back, so a later clock-in from the
  // Clock tab lands on the clock as it always did.
  await tap(page, '.tab[data-tab="job"]', 400);
  check('a tab tap is remembered and clears the hand-back', await page.evaluate(() => [S.tab, S.tabTouched, S.coReturn]), ['job', true, null]);
  allErrs.push(...errs);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got ${JSON.stringify(r.actual)}\n     want ${JSON.stringify(r.expected)}`));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (allErrs.length) console.log('CONSOLE ERRORS:', JSON.stringify([...new Set(allErrs)].slice(0, 12), null, 1));
process.exit(failed.length || allErrs.length ? 1 : 0);
