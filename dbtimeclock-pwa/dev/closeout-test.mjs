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
    window.__MOCK_CO_REJECT=${!!flags.reject};window.__MOCK_CO_DOWN=${!!flags.down};window.__MOCK_CO_UNSET=${!!flags.unset};window.__MOCK_CO_AREAS=${!!flags.areas};window.__MOCK_CO_DAYS=${!!flags.days};`);
  if (flags.fix) await page.addInitScript(flags.fix);
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

// A real 1x1 JPEG carrying an EXIF block: DateTimeOriginal, and the zone tag
// when given — what a phone camera writes and the gallery hands back (T2.9).
function exifJpeg(when, zone) {
  const entries = [[0x9003, when]].concat(zone ? [[0x9011, zone]] : []);
  const exifIfdAt = 26, stringsAt = exifIfdAt + 2 + 12 * entries.length + 4;
  const strs = entries.map(([, v]) => Buffer.from(v + '\0', 'ascii'));
  const tiff = Buffer.alloc(stringsAt + strs.reduce((n, b) => n + b.length, 0));
  tiff.write('II', 0, 'ascii'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x8769, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(exifIfdAt, 18); tiff.writeUInt32LE(0, 22);
  tiff.writeUInt16LE(entries.length, exifIfdAt);
  let at = stringsAt;
  entries.forEach(([tag], i) => {
    const e = exifIfdAt + 2 + 12 * i;
    tiff.writeUInt16LE(tag, e); tiff.writeUInt16LE(2, e + 2); tiff.writeUInt32LE(strs[i].length, e + 4); tiff.writeUInt32LE(at, e + 8);
    strs[i].copy(tiff, at); at += strs[i].length;
  });
  tiff.writeUInt32LE(0, exifIfdAt + 2 + 12 * entries.length);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const head = Buffer.alloc(4); head.writeUInt16BE(0xFFE1, 0); head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([JPEG.subarray(0, 2), head, body, JPEG.subarray(2)]);
}
const pickFrom = async (page, sel, files) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(sel).first().click()]);
  const multiple = chooser.isMultiple();
  await chooser.setFiles(files.map((buffer, i) => ({ name: 'IMG_' + i + '.jpg', mimeType: 'image/jpeg', buffer })));
  await page.waitForTimeout(900 + 500 * files.length);
  return multiple;
};
const allErrs = [];

// ---- the tabs each role gets, and the service crew opening in Spanish ----
{
  for (const [role, want] of [['crew', ['job', 'jobs']], ['siteManager', ['job', 'jobs', 'log']], ['service', ['job', 'co']], ['ops', ['job', 'jobs', 'log', 'co', 'people']]]) {
    const { ctx, page, errs } = await boot({ role });
    check(`${role}: the tabs`, await visibleTabs(page), want);
    if (role === 'service') {
      check('service: Spanish first on this phone', await page.evaluate(() => S.lang), 'es');
      check('service: the header names the role — in Spanish, the service crew\'s first language (T2.24)', await txt(page, '#hdrW'), 'Alberto Gonzalez · Servicio');
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
  check('the queue: my jobs first', await page.evaluate(() => [...document.querySelectorAll('#coBody .jcard .h-addr')].map((n) => n.textContent)), ['26-0418', '26-0415']);
  // T2.7: the number large, the street, customer · city · type, and the rep where the number was.
  check('the card reads number, street, customer, rep', await page.evaluate(() => { const c = document.querySelector('#coBody .jcard'); return [c.querySelector('.sub').textContent, c.querySelector('.jwith').textContent, c.querySelector('.jwhen .n').textContent]; }),
    ['1427 Prairie View Dr', 'Hartman · Lima · roofing', 'Rep · Austin Leeth']);
  // T2.7: Asignados / Todos keeps answering, however many times it is switched.
  const flips = [];
  for (const f of ['all', 'mine', 'all', 'mine', 'all', 'mine']) { await tap(page, `[data-cofilter="${f}"]`, 150); flips.push(await page.evaluate(() => [CO.filter, document.querySelectorAll('#coBody .jcard').length])); }
  check('Asignados / Todos switches back and forth', flips, [['all', 4], ['mine', 2], ['all', 4], ['mine', 2], ['all', 4], ['mine', 2]]);
  // T2.7: the search filters the list as you type, and keeps the keyboard.
  await page.locator('#coSearch').fill('cedar'); await page.waitForTimeout(200);
  check('the search filters as you type', await page.evaluate(() => [[...document.querySelectorAll('#coBody .jcard .h-addr')].map((n) => n.textContent), document.activeElement.id]), [['26-0415'], 'coSearch']);
  await page.locator('#coSearch').fill('walnut'); await page.waitForTimeout(200);
  check('a match only under Todos says so', await txt(page, '#coBody .jempty'), 'Nada asignado coincide. Toca Todos para buscar en el resto.');
  await tap(page, '[data-cofilter="all"]', 200);
  check('Todos shows it', await page.evaluate(() => document.querySelectorAll('#coBody .jcard').length), 1);
  await page.locator('#coSearch').fill(''); await tap(page, '[data-cofilter="mine"]', 200);
  check('the badges say what each is', await page.evaluate(() => [...document.querySelectorAll('#coBody .jcard')].map((c) => c.querySelector('.badge').textContent)), ['Inspección final', 'Reparaciones · 2']);
  await tap(page, '[data-cojob="co-hartman"]', 800);
  // Blocked, not disabled (T2.12): a tap says what is left.
  check('the job home: four tiles and a blocked send', await page.evaluate(() => [[...document.querySelectorAll('#coBody .jtile:not([data-coclockhere]) .es')].map((e) => e.textContent), document.getElementById('coReview').classList.contains('blocked')]), [['Inspección', 'Limpieza', 'Problemas', 'Fotos de la visita', 'Trabajo vendido'], true]);
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
  check('…not the last open repair, so the button is plain Terminado', await txt(page, '#coDone'), 'Terminado');
  await addPhoto(page, '.phbig.need');
  check('the after photo unlocks Terminado', await page.evaluate(() => [document.querySelectorAll('.phbig.empty').length, document.getElementById('coDone').disabled]), [1, false]);
  await page.locator('#coRepairNote').fill('Bota nueva y sellada');
  await tap(page, '#coDone', 2500);
  const done = (await calls(page)).filter((c) => c.fn === 'coPhoto' || c.fn === 'coComplete');
  check('the after photo goes on the task, then the completion with the note', done.map((c) => c.fn === 'coPhoto' ? [c.fn, c.photo.label, c.photo.taskId] : [c.fn, c.taskId, c.note]), [['coPhoto', 'AFTER', 'pt1'], ['coComplete', 'pt1', 'Bota nueva y sellada']]);
  check('back on the list, the repair reads done', await page.evaluate(() => [CO.screen, [...document.querySelectorAll('#coBody .rep')].filter((r) => r.classList.contains('done')).length]), ['repairs', 1]);
  // T2.8.2: the LAST repair moves the job to PM Review by itself (the
  // server's rule), and the job screen then says whose turn it is — no
  // checklists, no Review & send asking for thirteen checks the crew never
  // had to do (Carl, 25-0001, 13 Oct 2026).
  await tap(page, '[data-corepair="pt2"]', 500);
  // T2.8.3: the last open repair on the job says what pressing it does.
  check('the last open repair: the button says it sends the job to the PM', [await txt(page, '#coDone'), (await txt(page, '#coBody .foot')).startsWith('Es la última reparación del trabajo.')], ['Terminar y mandar al PM', true]);
  await addPhoto(page, '.phbig.need');
  await tap(page, '#coDone', 2500);
  check('…and once the server moves the job, the list says so, with the time', await page.evaluate(() => [CO.screen, !!document.getElementById('coRepairsSent'), document.querySelector('#coRepairsSent .sl').textContent, document.querySelector('#coRepairsSent .ss').textContent]),
    ['repairs', true, 'Reparaciones listas', 'Mandado al PM para revisar. No queda nada para el equipo en este trabajo.']);
  check('the last repair: the server flips the job to PM Review', (await calls(page)).filter((c) => c.fn === 'coComplete').map((c) => c.taskId), ['pt1', 'pt2']);
  await page.evaluate(() => coGo('job')); await page.waitForTimeout(900);
  const jobScreen = () => page.evaluate(() => ({
    status: (CO.job || coJobById(CO.jobId) || {}).status,
    sent: !!document.getElementById('coRepairsSent'),
    waiting: !!document.getElementById('coReviewNote'),
    tiles: [...document.querySelectorAll('#coBody [data-coscreen]')].map((b) => b.getAttribute('data-coscreen')),
    send: !!document.getElementById('coReview'),
  }));
  check('…the job screen: sent to the PM, the repairs only, no send', await jobScreen(), { status: 'PM Review', sent: true, waiting: false, tiles: ['repairs'], send: false });
  check('…and its header names the PM, not the inspection', await txt(page, '#coK'), 'PM Review · JT #26-0415');
  // Opened again later, the done screen has gone and the job reads as the PM's.
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(300);
  await page.evaluate(() => { CO.filter = 'all'; coRender(); }); await page.waitForTimeout(200);
  await tap(page, '[data-cojob="co-okafor"]', 900);
  check('opened again: waiting on the PM, in the crew\'s words', [await jobScreen(), await txt(page, '#coBody .rvstory .rk'), await txt(page, '#coReviewNote')],
    [{ status: 'PM Review', sent: false, waiting: true, tiles: ['repairs'], send: false }, 'PM Review · esperando al PM', 'No queda nada para el equipo en este trabajo. El PM lo revisa y luego el cierre final del vendedor lo termina.']);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- T2.8.2: Operations sees no inspection on a Punch List or PM Review job ----
{
  const { ctx, page, errs } = await boot({ role: 'ops' });
  await tap(page, '.tab[data-tab="co"]', 900);
  await page.evaluate(() => { CO.filter = 'all'; coRender(); }); await page.waitForTimeout(200);
  const screen = () => page.evaluate(() => ({
    waiting: !!document.getElementById('coReviewNote'),
    tiles: [...document.querySelectorAll('#coBody [data-coscreen]')].map((b) => b.getAttribute('data-coscreen')),
    send: !!document.getElementById('coReview'),
  }));
  await tap(page, '[data-cojob="co-okafor"]', 900);
  check('ops on a Punch List job: the repairs, no checklists', await screen(), { waiting: false, tiles: ['repairs'], send: false });
  check('…headed Repairs', await txt(page, '#coK'), 'Repairs · JT #26-0415');
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(300);
  await tap(page, '[data-cojob="co-bell"]', 900);
  check('ops on a PM Review job with no repairs: waiting on the PM, nothing to tap', await screen(), { waiting: true, tiles: [], send: false });
  // A visit already started on this phone keeps its checklists and its send,
  // and the card says why they are still there.
  await page.evaluate(() => { var v = coVisit('co-bell'); v.answers.inspection[CO_INSPECT[0].key] = CO_ANS.OK; coPersist(); coRender(); }); await page.waitForTimeout(300);
  check('…unless a visit was started here: the checklists and the send stay', await screen(), { waiting: true, tiles: ['inspect', 'cleanup', 'problems', 'photos'], send: true });
  check('…and the card says it moves nothing', (await page.locator('#coBody .rvstory .rt').nth(1).textContent()).startsWith('An inspection was started on this phone'), true);
  // Final Inspection is untouched: the checklists and the send are the job.
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(300);
  await tap(page, '[data-cojob="co-reyes"]', 900);
  check('ops on a Final Inspection job: the four checklists and the send', await screen(), { waiting: false, tiles: ['inspect', 'cleanup', 'problems', 'photos'], send: true });
  check('…headed Inspection', await txt(page, '#coK'), 'Inspection · JT #26-0421');
  allErrs.push(...errs);
  await ctx.close();
}

// ---- T2.9: photos from the phone's own gallery ----
{
  const { ctx, page, errs } = await boot({ role: 'service' });
  await tap(page, '.tab[data-tab="co"]', 900);
  await page.evaluate(() => { S.lang = 'en'; CO.filter = 'all'; coRender(); }); await page.waitForTimeout(200);
  // Visit photos: the camera and the gallery side by side, several at once.
  await tap(page, '[data-cojob="co-hartman"]', 900);
  await tap(page, '[data-coscreen="photos"]', 500);
  check('visit photos: Photo and From my photos side by side', [await page.locator('#coBody [data-cophoto]').count(), await txt(page, '#coBody [data-cogallery]')], [1, 'From my photos']);
  const many = await pickFrom(page, '#coBody [data-cogallery]', [exifJpeg('2026:10:12 14:10:05'), JPEG]);
  const taken = await page.evaluate(() => new Date(2026, 9, 12, 14, 10, 5).toISOString());
  check('…several at once, each read for when it was taken (or not)', [many, await page.evaluate(() => coVisit('co-hartman').photos.map((p) => [p.fromPhone, p.takenAt]))], [true, [[true, taken], [true, null]]]);
  check('…the tiles say PHONE and the day, or No time', [await page.locator('#coBody .ph .src').allTextContents(), await page.locator('#coBody .ph .tag').allTextContents()],
    [['Phone', 'Phone'], [await page.evaluate((iso) => phoneWhenShort(iso), taken), 'No time']]);
  check('…and the server is told where they came from', await page.evaluate(() => coVisit('co-hartman').photos.map((p) => coPayload({ label: 'INSPECTION' }, p))),
    [{ label: 'INSPECTION', source: 'phone', takenAt: taken }, { label: 'INSPECTION', source: 'phone' }]);
  check('a zone in the photo is honoured', await page.evaluate(() => exifIso('2026:10:12 14:10:05', '-04:00')), '2026-10-12T18:10:05.000Z');
  check('a camera with its clock unset is no time at all', await page.evaluate(() => [exifIso('0000:00:00 00:00:00', ''), exifIso('1970:01:01 00:00:00', ''), exifIso('', '')]), [null, null, null]);

  // A repair: the AFTER photo from the phone must postdate the repair.
  await page.evaluate(() => coGo('queue')); await page.waitForTimeout(300);
  await tap(page, '[data-cojob="co-okafor"]', 900);
  await tap(page, '[data-coscreen="repairs"]', 700);
  await tap(page, '[data-corepair="pt1"]', 500);
  check('one repair: From my photos under both empty slots', await page.locator('#coBody .phrow2 [data-cogallery]').count(), 2);
  const one = await pickFrom(page, '#coBody .phrow2 [data-cogallery]:nth-child(2)', [exifJpeg('2026:09:20 10:00:00')]);
  const afterNow = () => page.evaluate(() => [!!coVisit('co-okafor').after.pt1, document.getElementById('coDone').disabled, (document.getElementById('coPhotoNote') || {}).textContent || '']);
  let a = await afterNow();
  check('an after photo is one at a time', one, false);
  check('…taken before the repair was asked for: refused, and it says why', [a[0], a[1], a[2].startsWith('That photo was taken before the repair was asked for (')], [false, true, true]);
  await pickFrom(page, '#coBody .phrow2 [data-cogallery]:nth-child(2)', [JPEG]);
  a = await afterNow();
  check('…with no date on it: refused too', [a[0], a[1], a[2].startsWith('That photo has no date on it')], [false, true, true]);
  await pickFrom(page, '#coBody .phrow2 [data-cogallery]:nth-child(2)', [exifJpeg('2026:10:12 14:10:05')]);
  a = await afterNow();
  check('…taken after: kept, Done unlocks, the note goes', [a[0], a[1], a[2]], [true, false, '']);
  check('…and the tile says it came from the phone, and when', await txt(page, '#coBody .phbig .src'), 'Phone · ' + await page.evaluate((iso) => phoneWhenLong(iso), taken));
  await pickFrom(page, '#coBody .phrow2 [data-cogallery]', [JPEG]);
  check('a BEFORE photo with no date is fine — it shows the problem, not the fix', await page.evaluate(() => [!!coVisit('co-okafor').before.pt1, coVisit('co-okafor').before.pt1.takenAt]), [true, null]);
  await tap(page, '#coDone', 2500);
  const sent = (await calls(page)).filter((c) => c.fn === 'coPhoto').map((c) => [c.photo.label, c.photo.source, c.photo.takenAt || null]);
  check('both go to the repair marked as from the phone, the after with its time', sent, [['BEFORE', 'phone', null], ['AFTER', 'phone', taken]]);
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
  check('…and it opens the clock, with its four buttons (T2.23)', await page.evaluate(() => [S.tab, S.sheet, !document.getElementById('runStack').classList.contains('hidden')]), ['job', null, true]);

  // On the clock here, Start on ANOTHER inspection (T2.23): what happened?
  // Driving there · done here today is leaving this site for the day — its end photo —
  // then the drive on that job's travel line, over its Close Out screen;
  // there, the arrival is its code and its start photo.
  await page.evaluate(() => { setTab('co'); CO.screen = 'queue'; CO.jobId = null; CO.job = null; CO.filter = 'all'; coRender(); });
  await tap(page, '[data-costart="co-reyes"]', 900);
  check('Start elsewhere while on the clock: what happened?', await page.evaluate(() => [S.tab, S.clockGate, S.sheet, S.pendingJob && S.pendingJob.id, S.coReturn, CO.jobId]), ['co', null, 'moveHow', 'co-reyes', 'co-reyes', 'co-reyes']);
  await tap(page, '[data-move="drive"]', 600);
  check('…Driving there · done here today: the end photo of the site, left for the day', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'end-travel']);
  await shoot(page); await settle(page);
  check('…the drive on that job\'s travel line, back on its Close Out screen', [(await clockCalls(page)).slice(-1)[0], await page.evaluate(() => [S.tab, CO.screen, CO.jobId, onTravel()])], [['startTravel', 'co-reyes', 'ci11'], ['co', 'job', 'co-reyes', true]]);
  await tap(page, '[data-coclockhere]', 900);
  check('…there, the arrival asks its code over its Close Out screen (from the phone\'s copy)', await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.sheet, !!codesCached('co-reyes')]), ['co', 'job', 'co-reyes', 'codes', true]);
  await tap(page, '[data-code="ci4"]', 500);
  check('…the start photo', await page.evaluate(() => [S.tab, S.clockGate]), ['cam', 'start']);
  await shoot(page); await settle(page);
  check('…one switch call, and the clock and Close Out both on the new job', [await clockCalls(page), await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.job && S.job.id, S.open && S.open.code && S.open.code.id, S.coReturn, S.moving, S.pendingJob])], [[['clockIn', 'co-hartman', 'ci2'], ['startTravel', 'co-reyes', 'ci11'], ['switchCode', 'co-reyes', 'ci4']], ['co', 'job', 'co-reyes', 'co-reyes', 'ci4', null, false, null]]);

  // A tab tapped by hand clears the hand-back, so a later clock-in from the
  // Clock tab lands on the clock as it always did.
  await tap(page, '.tab[data-tab="job"]', 400);
  check('a tab tap is remembered and clears the hand-back', await page.evaluate(() => [S.tab, S.tabTouched, S.coReturn]), ['job', true, null]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- T2.16: repairs that are yours start the clock from their card ----
{
  const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(300); };
  const shoot = (page) => page.evaluate(() => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    c.getContext('2d').fillRect(0, 0, 8, 8);
    c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
  }));
  const clockCalls = (page) => page.evaluate(() => (window.__CLOCK || []).map((c) => c.slice(0, 3)));
  // A service job's codes the way the org names them, with both a service
  // and a warranty line and the travel line beside them.
  const fix = `window.__MOCK_FIX = { codes: [
    { id: 'ci1', name: 'Final Clean', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci2', name: 'Crew Labor', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci3', name: 'Service Repair Labor', number: '01GR-4', codeName: 'Service Repair Labor' },
    { id: 'ci4', name: 'Warranty Service', number: '01GR-5', codeName: 'Warranty Work' },
    { id: 'ci5', name: 'Travel Related Labor', number: '01GR-9', codeName: 'Travel Related Costs' } ] };`;
  const { ctx, page, errs } = await boot({ role: 'service', fix });
  check('a repairs card that is yours reads Start, with its count under it', [await txt(page, '[data-costart="co-okafor"] .a1'), await txt(page, '[data-costart="co-okafor"] .a2')], ['Empezar', '2 reparaciones']);
  await tap(page, '[data-costart="co-okafor"]', 900);
  check('Start on a service call: the service code without asking (not the warranty one, never travel), the start photo', await page.evaluate(() => [S.tab, S.clockGate, S.gateCode && S.gateCode.id, S.sheet, S.coReturn]), ['cam', 'start', 'ci3', null, 'co-okafor']);
  await shoot(page); await settle(page);
  check('…clocked in on the repair job and back on its Close Out screen', [await clockCalls(page), await page.evaluate(() => [S.tab, CO.screen, CO.jobId])], [[['clockIn', 'co-okafor', 'ci3']], ['co', 'job', 'co-okafor']]);
  check('…on the clock here, the job screen offers no second clock-in', await page.evaluate(() => !!document.querySelector('[data-coclockhere]')), false);
  await page.evaluate(() => { CO.screen = 'queue'; CO.jobId = null; CO.job = null; coRender(); });
  await page.waitForTimeout(300);
  check('…and the card reads Continue', await txt(page, '[data-costart="co-okafor"] .a1'), 'Continuar');
  // A job reached another way (here someone else's inspection, from All):
  // the clock is one tap away, and says where it is now.
  await page.evaluate(() => { CO.filter = 'all'; coRender(); });
  await page.waitForTimeout(300);
  await tap(page, '.jmain[data-cojob="co-reyes"]', 900);
  check('a job opened without Start offers to move the clock here', await page.evaluate(() => { const b = document.querySelector('[data-coclockhere]'); return b ? [b.querySelector('.es').textContent, b.querySelector('.en').textContent] : null; }),
    ['Pasar el reloj aquí', 'estás en el reloj en Okafor']);
  await tap(page, '[data-coclockhere]', 900);
  check('…and it is the move: what happened? (T2.23)', await page.evaluate(() => [S.tab, S.clockGate, S.sheet, S.pendingJob && S.pendingJob.id, S.coReturn]), ['co', null, 'moveHow', 'co-reyes', 'co-reyes']);
  await page.evaluate(() => backOutOfSheet());
  await page.waitForTimeout(400);
  // The code a repair prefers, by the kind of job.
  check('which code a Start picks', await page.evaluate(() => {
    const codes = window.__MOCK_FIX.codes, pick = (j) => { const c = coPreferredCode(codes, j); return c ? c.id : null; };
    return [pick({ status: 'Punch List', projectTypes: ['R-Warranty'], isService: true, openPunchCount: 1, name: '268049 Sinclair_Warranty' }),
            pick({ status: 'Punch List', projectTypes: ['R-Repairs/Service'], isService: true, openPunchCount: 1 }),
            pick({ status: 'Final Inspection', projectTypes: ['R-Shingles'], isService: false }),
            coPreferredCode([codes[4], codes[1]], { status: 'Final Inspection' }).id];
  }), ['ci4', 'ci3', null, 'ci2']);
  // Someone else's repairs still only open.
  check('repairs that are not yours keep the plain opener', await page.evaluate(() => { const j = Object.assign({}, coJobById('co-okafor'), { mine: false }); return /data-costart=/.test(coQueueCard(j)); }), false);
  // T2.22: driving there is not having started — the card still reads Start.
  check('driving to a repairs job, its card reads Start, not Continue', await page.evaluate(() => {
    const keep = { open: S.open, job: S.job };
    S.job = coClockJob(coJobById('co-okafor'));
    S.open = { id: 'drv', startedAt: new Date(Date.now() - 60000).toISOString(), notes: 'Drive to 26-0412 Okafor', code: { id: 'ci11', name: 'Travel Related Labor', number: '01GR-9', travel: true } };
    const m = /data-costart="co-okafor"><span class="a1">([^<]*)</.exec(coQueueCard(coJobById('co-okafor')));
    S.open = keep.open; S.job = keep.job;
    return m && m[1];
  }), 'Empezar');

  // T2.18: driving to the next job, its Start is the arrival — no end photo
  // for the drive, the job's code, its start photo.
  await page.evaluate(() => { setTab('job'); });
  await tap(page, '#leaveBtn', 400); await tap(page, '[data-leave="done-job"]', 500); await shoot(page);
  await page.waitForFunction(() => S.sheet === 'dest', null, { timeout: 10000 });
  await tap(page, '#destOther', 500);
  await page.locator('#jobSearch').fill('26-0418'); await page.waitForTimeout(700);
  await tap(page, '.jobrow[data-job="co-hartman"]', 300); await settle(page);
  check('the drive to the inspection is on its travel line', (await clockCalls(page)).slice(-1)[0], ['startTravel', 'co-hartman', 'ci5']);
  await tap(page, '.tab[data-tab="co"]', 600);
  await page.evaluate(() => { CO.screen = 'queue'; CO.jobId = null; CO.job = null; CO.filter = 'mine'; coRender(); });
  await page.waitForTimeout(300);
  await tap(page, '[data-costart="co-hartman"]', 900);
  check('Start on the job driven to: no end photo, straight to its code', await page.evaluate(() => [S.tab, S.clockGate, S.sheet, S.coReturn]), ['co', null, 'codes', 'co-hartman']);
  await tap(page, '[data-code="ci1"]', 500);
  await shoot(page); await settle(page);
  check('…the arrival is one switch with the start photo only, and back on its Close Out screen', [(await page.evaluate(() => (window.__CLOCK || []).slice(-1)[0])).slice(0, 4), await page.evaluate(() => [S.tab, CO.screen, CO.jobId, S.open.code.id])],
    [['switchCode', 'co-hartman', 'ci1', null], ['co', 'job', 'co-hartman', 'ci1']]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- T2.21: Yahir's "Clock in Alberto too" ----
{
  const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(300); };
  const shoot = (page) => page.evaluate(() => new Promise((res) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8); c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg'); }));
  { const { ctx, page, errs } = await boot({ role: 'service' });
    check('no partner named: no box', await page.evaluate(() => [!!S.partner, !!document.querySelector('[data-copartner]'), document.getElementById('partnerBtn').classList.contains('hidden')]), [false, false, true]);
    allErrs.push(...errs); await ctx.close(); }
  const { ctx, page, errs } = await boot({ role: 'service', fix: 'window.__MOCK_PARTNER=true;' });
  await page.waitForFunction(() => !!S.partner, null, { timeout: 10000 }); await page.evaluate(() => coRender()); await page.waitForTimeout(300);
  check('Yahir\'s queue carries the box, not ticked', [await txt(page, '[data-copartner] .lbl'), await page.evaluate(() => [S.partnerOn, document.querySelector('[data-copartner]').classList.contains('on')])],
    ['Marcar a Alberto Gonzalez contigo', [false, false]]);
  await tap(page, '[data-copartner]', 400);
  check('…a tap ticks it, kept on the phone', await page.evaluate(() => [S.partnerOn, document.querySelector('[data-copartner]').classList.contains('on'), JSON.parse(localStorage.getItem('dbtc_prefs')).partnerOn]), [true, true, true]);
  await tap(page, '[data-costart="co-hartman"]', 900);
  await tap(page, '[data-code="ci2"]', 500); await shoot(page); await settle(page);
  check('…and the clock-in goes for Alberto too', await page.evaluate(() => [(window.__PARTNER || []), (window.__CLOCK || []).slice(-1)[0].slice(0, 2)]), [['clockIn'], ['clockIn', 'co-hartman']]);
  await page.evaluate(() => { S.partnerOn = false; savePrefs(); });
  await page.evaluate(() => { setTab('job'); }); await tap(page, '#outBtn', 500); await shoot(page); await settle(page);
  check('box off: the clock-out is Yahir\'s alone', await page.evaluate(() => [(window.__PARTNER || []), (window.__CLOCK || []).slice(-1)[0][0]]), [['clockIn'], 'clockOut']);
  check('the clock tab has the same box', await page.evaluate(() => !document.getElementById('partnerBtn').classList.contains('hidden')), true);
  allErrs.push(...errs); await ctx.close();
  // Alberto on the clock somewhere else: Yahir is in, and told Alberto was not moved.
  { const { ctx, page, errs } = await boot({ role: 'service', fix: 'window.__MOCK_PARTNER=true;window.__MOCK_PARTNER_AWAY=true;' });
    await page.waitForFunction(() => !!S.partner, null, { timeout: 10000 });
    await page.evaluate(() => { S.partnerOn = true; savePrefs(); coRender(); });
    await tap(page, '[data-costart="co-hartman"]', 900); await tap(page, '[data-code="ci2"]', 500); await shoot(page); await settle(page);
    await page.waitForTimeout(1900);
    check('Alberto elsewhere: Yahir is in, and the phone says Alberto was not moved', [await page.evaluate(() => !!S.open), await txt(page, '#toast')], [true, 'No se cambió a Alberto Gonzalez — en el reloj en 26-0890 · 04MA']);
    allErrs.push(...errs); await ctx.close(); }
}

// ---- work areas (Carl, 23 Oct 2026): a roof and its gutters, each on its own ----
{
  const { ctx, page, errs } = await boot({ role: 'service', areas: true });
  await tap(page, '.tab[data-tab="co"]', 900);
  // One roof on its own reads exactly as before: no list of areas, the four tiles.
  await tap(page, '[data-cojob="co-hartman"]', 800);
  check('one roof: no area list, the four tiles', await page.evaluate(() => [!!document.getElementById('coAreas'), [...document.querySelectorAll('#coBody .jcard .jtile:not([data-coclockhere]) .es')].map((e) => e.textContent)]),
    [false, ['Inspección', 'Limpieza', 'Problemas', 'Fotos de la visita']]);
  // A draft nobody saved never goes (it has no note, and the server would refuse it).
  await page.evaluate(() => { const v = coVisit('co-hartman'); CO_INSPECT.forEach((i) => { v.answers.inspection[i.key] = 'OK'; }); CO_CLEAN.forEach((i) => { v.answers.cleanup[i.key] = 'OK'; });
    v.reports.push({ ref: 'rdraft', itemKey: '', itemN: '', area: '', location: '', locationText: '', locationWords: '', note: '', noteEn: '', fixed: false, photos: [], saved: false, at: Date.now() }); coPersist(); coGo('send'); });
  await page.waitForTimeout(300);
  await tap(page, '#coSend', 2500);
  check('the roof send: no unsaved draft, just the close', (await calls(page)).map((c) => c.fn), ['coClose']);
  check('the receipt names who it went to and where the board put the job', await txt(page, '#coReceipt .ss'), 'Enviado a Dave Elick · El trabajo pasó a PM Review');
  await page.evaluate(() => { CO.receipt = null; CO.screen = 'queue'; CO.jobId = null; CO.job = null; coRender(); });
  await page.waitForTimeout(300);

  await tap(page, '[data-cojob="co-mason"]', 900);
  const areaRows = () => page.evaluate(() => [...document.querySelectorAll('#coAreas .rvrow')].map((r) => [r.querySelector('.rk').textContent, r.querySelector('.rv').textContent]));
  const masonRows = await areaRows();
  check('two areas: the roof inspected with its repair, the gutters booked for Alberto', [masonRows[0], masonRows[1][0], /^Agendada .+ · Alberto$/.test(masonRows[1][1])],
    [['Techo de tejas', 'Revisada · 1 reparación pendiente'], 'Canales', true]);
  check('the roof is done: no checklist, no Review & send; the gutters and the repairs are the tiles', await page.evaluate(() => [!!document.querySelector('[data-coscreen="inspect"]'), !!document.getElementById('coReview'), [...document.querySelectorAll('#coBody .jtile:not([data-coclockhere]) .es')].map((e) => e.textContent)]),
    [false, false, ['Canales', 'Reparaciones']]);
  await tap(page, '[data-coarea="gutters"]', 500);
  // T2.15: the gutters' Start puts the clock on this job, as Start on a card
  // does — here off the clock, so it asks the code, then the start photo, and
  // hands back to the gutters.
  check('the gutters\' Start asks the code question over the gutters', await page.evaluate(() => [CO.screen, CO.areaKey, S.sheet, S.coReturn, S.coReturnArea]), ['area', 'gutters', 'codes', 'co-mason', 'gutters']);
  await tap(page, '[data-code="ci2"]', 500);
  await page.evaluate(() => new Promise((res) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8); c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg'); }));
  await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(300);
  check('…clocked in on this job, and back on the gutters', [(await page.evaluate(() => (window.__CLOCK || []).map((c) => c.slice(0, 3)))), await page.evaluate(() => [S.tab, CO.screen, CO.areaKey, S.job && S.job.id, S.coReturn, S.coReturnArea])],
    [[['clockIn', 'co-mason', 'ci2']], ['co', 'area', 'gutters', 'co-mason', null, null]]);
  await tap(page, '#coBack', 600);
  await tap(page, '[data-coarea="gutters"]', 500);
  check('…and on the clock here, the gutters simply open', await page.evaluate(() => [(window.__CLOCK || []).length, CO.screen, S.sheet, S.coReturn]), [1, 'area', null, null]);
  check('the gutters: notes and photos, named in the header, the send waits on a photo', await page.evaluate(() => [CO.screen, document.getElementById('coK').textContent, document.getElementById('coTitle').textContent, document.getElementById('coAreaSend').disabled]),
    ['area', 'Inspección · JT #26-0502', 'Canales', true]);
  await addPhoto(page, '#coBody [data-cophoto]');
  check('a photo lands on the area and unlocks the send', await page.evaluate(() => [coVisit('co-mason').areas.gutters.photos.length, document.getElementById('coAreaSend').disabled]), [1, false]);
  await page.locator('#coAreaNote').fill('El bajante del noreste está flojo');
  await page.locator('#coAreaNote').blur();
  await page.waitForTimeout(700);
  check('the note gets its English for the office', await page.evaluate(() => coVisit('co-mason').areas.gutters.noteEn), 'EN: El bajante del noreste está flojo');
  // T2.14: leaving the note box re-draws the screen, and the tap that left it
  // still has to land — one tap on Stop stops the recording.
  await page.evaluate(() => { window.SpeechRecognition = function(){ const r = this; r.start = () => { window.__srLive = r; }; r.stop = () => setTimeout(() => r.onend && r.onend(), 10); }; });
  await tap(page, '#coAreaRec', 300);
  check('Record listens, with the note box focused', await page.evaluate(() => [dlRec.want, document.activeElement && document.activeElement.id]), [true, 'coAreaNote']);
  // New words, so leaving the box has a new English note to draw.
  await page.evaluate(() => { const row = [{ transcript: 'and the elbow is loose' }]; row.isFinal = true; window.__srLive.onresult({ resultIndex: 0, results: [row] }); });
  await page.waitForTimeout(200);
  {
    // A finger, not a script: press, a moment, release.
    const b = await page.locator('#coAreaRec').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  }
  await page.waitForTimeout(500);
  check('one tap on Stop stops it, though the press took the focus from the note box', await page.evaluate(() => dlRec.want), false);
  await page.locator('#coAreaNote').fill('El bajante del noreste está flojo');   // the note the send checks below expect
  await page.locator('#coAreaNote').blur();
  await page.waitForTimeout(700);
  await tap(page, '#coAreaReport', 500);
  check('a problem on the gutters is filed against them', await page.evaluate(() => { const r = coVisit('co-mason').reports[CO.reportIdx]; return [CO.screen, r.area, document.getElementById('coTitle').textContent]; }), ['report', 'gutters', 'Canales']);
  await addPhoto(page, '#coBody [data-cophoto]');
  await page.locator('#coNote').fill('Falta un tornillo en el codo');
  await page.locator('#coNote').blur();
  await page.waitForTimeout(600);
  await tap(page, '#coSaveReport', 600);
  check('saved: back on the gutters, the problem listed there and not on the roof', await page.evaluate(() => [CO.screen, document.querySelectorAll('#coBody [data-cofrom="area"]').length, coRoofReports(coVisit('co-mason')).length]), ['area', 1, 0]);
  await tap(page, '#coAreaSend', 3000);
  const ac = (await calls(page)).filter((c) => c.jobId === 'co-mason' && c.fn !== 'coTranslate');
  check('the area send in order: the finding, its photo, the area photo, the close', ac.map((c) => c.fn + (c.photo ? ':' + c.photo.label : '')), ['coReport', 'coPhoto:REPORT', 'coPhoto:INSPECTION', 'coCloseArea']);
  check('every item names the gutters', [ac[0].report.area, ac[1].photo.area, ac[2].photo.area, ac[3].body.area], ['gutters', 'gutters', 'gutters', 'gutters']);
  check('the finding reads in English, located by its area', [ac[0].report.englishNote, ac[0].report.location], ['EN: Falta un tornillo en el codo', 'Gutters']);
  check('the close carries the English note with what was said, and the problem count', [ac[3].body.notes, ac[3].body.problemsReported], ['EN: El bajante del noreste está flojo\n\n(El bajante del noreste está flojo)', 1]);
  check('the receipt: the gutters went to Neal, the board moved the job', [await txt(page, '#coReceipt .sl'), await txt(page, '#coReceipt .ss')], ['Enviado a JobTread · Canales', 'Enviado a Neal Deitemeyer · El trabajo pasó a Punch List']);
  check('the phone\'s copy of the gutters is cleared', await page.evaluate(() => { const v = coVisit('co-mason'); return [v.areas.gutters.photos.length, v.areas.gutters.note, v.reports.length]; }), [0, '', 0]);
  await tap(page, '#coAreaBack', 900);
  const after = await areaRows();
  check('back on the job: the gutters read inspected, and are not offered again', [after[1], await page.evaluate(() => !!document.querySelector('[data-coarea="gutters"]'))], [['Canales', 'Revisada · 1 reparación pendiente'], false]);
  // The last repair on ONE area sends that area to its PM; the job goes on.
  await tap(page, '[data-coscreen="repairs"]', 700);
  check('the repair says which area it is for', await txt(page, '#coBody .rep .en'), 'Techo de tejas · ES: Counter-flashing lifted on the left side of the chimney.');
  await tap(page, '[data-corepair="pt9"]', 500);
  check('the last repair on the roof says so, not that the job moves', [await txt(page, '#coDone'), /^Es la última reparación en el techo de tejas\./.test(await txt(page, '#coBody > .foot:last-child'))], ['Terminar y mandar al PM', true]);
  await addPhoto(page, '.phbig.need');
  await tap(page, '#coDone', 2500);
  check('…finished: the roof\'s repairs went to Dave', [await txt(page, '#coRepairsSent .sl'), await txt(page, '#coRepairsSent .ss')], ['Reparaciones listas en el techo de tejas', 'Enviado a Dave Elick.']);
  // A job still in production offers no roof checklist until the roof is booked.
  check('a roof not yet booked, job in production: no checklist', await page.evaluate(() => [coKindOf({ status: 'Production', openPunchCount: 0 }),
    coRoofOpen({ status: 'Production', areas: [{ key: 'shingle', line: true, form: 'roof', inspected: false, assigneeNames: [], inspectionDate: null }] }, coVisit('x-none')),
    coRoofOpen({ status: 'Production', areas: [{ key: 'shingle', line: true, form: 'roof', inspected: false, assigneeNames: ['Yahir Gonzalez'], inspectionDate: null }] }, coVisit('x-none'))]), ['inspect', false, true]);
  allErrs.push(...errs);
  await ctx.close();
}

// ---- the days (T2.11, Carl 26 Oct 2026): "I do not know when this
// inspection is scheduled for", and no more words on the cards. A strip of
// your booked days, and the Assigned list filed under day headings.
{
  // A server older than `booked`: no strip, no headings — the list as it was.
  const { ctx, page, errs } = await boot({ role: 'service' });
  await tap(page, '#tabs [data-tab="co"]', 900);
  check('an older server: no strip and no day headings', await page.evaluate(() => [document.getElementById('coStrip').classList.contains('hidden'), document.querySelectorAll('#coBody .dayhead').length]), [true, 0]);
  const plainCard = await page.evaluate(() => Math.round(document.querySelector('#coBody .jcard').getBoundingClientRect().height));
  allErrs.push(...errs);
  await ctx.close();

  const s2 = await boot({ role: 'service', days: true });
  const pg = s2.page;
  await tap(pg, '#tabs [data-tab="co"]', 900);
  const day = (n) => pg.evaluate((k) => addDaysLocal(isoLocal(), k), n);
  const [d0, d4, d5] = [await day(0), await day(4), await day(5)];
  const groups = () => pg.evaluate(() => [...document.querySelectorAll('#coBody .dayhead')].map((h) => {
    const out = [h.querySelector('.k').textContent];
    for (let el = h.nextElementSibling; el && el.classList.contains('jcard'); el = el.nextElementSibling) out.push(el.querySelector('.h-addr').textContent);
    return out;
  }));
  check('the Assigned list is filed under its days: slipped, today, ahead, no day', await groups(), [
    ['Antes · sigue abierto', '26-0415'],
    ['Hoy', '26-0418'],
    [await pg.evaluate((k) => logDateWords(k), d4), '26-0533'],
    ['Sin día todavía', '26-0540'],
  ]);
  check('a slipped day reads in amber, and says so in words', await pg.evaluate(() => document.querySelector('#coBody .dayhead').classList.contains('late')), true);
  check('the cards are the size they were', await pg.evaluate(() => Math.round([...document.querySelectorAll('#coBody .jcard')].filter((c) => c.querySelector('.h-addr').textContent === '26-0418')[0].getBoundingClientRect().height)), plainCard);
  const strip = () => pg.evaluate(() => [...document.querySelectorAll('#coStrip .wday')].map((b) => [b.querySelector('.dd').textContent, b.querySelectorAll('.dots i').length, b.disabled]));
  const st = await strip();
  check('fourteen days from today, a dot where your work is booked', [st.length, st[0][1], st[4][1], st[5][1], st.filter((x) => x[1]).length, st[1][2]], [14, 1, 1, 1, 3, true]);
  check('every day on the strip is a 44px target or wider', await pg.evaluate(() => [...document.querySelectorAll('#coStrip .wday')].every((b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44)), true);
  // All: one list as before, and the strip stays so nothing moves under a thumb.
  await tap(pg, '#coSeg [data-cofilter="all"]', 500);
  check('All: one list, no headings, the strip still there', await pg.evaluate(() => [document.querySelectorAll('#coBody .dayhead').length, document.getElementById('coStrip').classList.contains('hidden')]), [0, false]);
  // A tap on a day goes back to Assigned and brings that day's heading up —
  // the second day of a two-day stay goes to the heading it is filed under.
  await tap(pg, `#coStrip [data-coday="${d4}"] >> nth=1`, 900);
  check('a day tapped from All: back on Assigned, the day brought into view', await pg.evaluate((k) => {
    const h = document.getElementById('co-day-' + k), box = h.closest('.scroll').getBoundingClientRect();
    return [CO.filter, Math.abs(h.getBoundingClientRect().top - box.top) < 30];
  }, d4), ['mine', true]);
  // A search that hides the day is cleared rather than leaving the tap dead.
  await pg.locator('#coSearch').fill('Lane');
  await pg.waitForTimeout(300);
  await tap(pg, `#coStrip [data-coday="${d0}"]`, 900);
  check('a search hiding the day is cleared by the tap', await pg.evaluate((k) => [CO.search, document.getElementById('coSearch').value, !!document.getElementById('co-day-' + k)], d0), ['', '', true]);
  // English
  await tap(pg, '#coQueueHead [data-lang="en"]', 600);
  check('in English', (await groups()).map((g) => g[0]), ['Earlier · still open', 'Today', await pg.evaluate((k) => logDateWords(k), d4), 'No day set yet']);
  check('the strip names the day and the count for a screen reader', await pg.evaluate(() => document.querySelector('#coStrip .wday').getAttribute('aria-label')), (await pg.evaluate(() => logDateWords(isoLocal()))) + ' · 1 job');
  check('no horizontal scroll at phone width', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  void d5;
  allErrs.push(...s2.errs);
  await s2.ctx.close();
}

// ---- the send that answers (T2.12, Carl 26 Oct 2026): "the button is
// greyed out … there is nothing to let me know", with every list done and
// eight visit photos. A visit's "sending" mark was cleared only when its
// close landed, so a close taken off the outbox (or an outbox the phone
// lost) left Review & send dead on that job for good, with no words.
{
  const { ctx, page, errs } = await boot({ role: 'service' });
  await tap(page, '#tabs [data-tab="co"]', 900);
  await page.evaluate(() => coOpenJob('co-hartman'));
  await page.waitForTimeout(900);
  // Every item answered, and the stale mark a lost send leaves behind.
  await page.evaluate(() => {
    const v = coVisit('co-hartman');
    CO_INSPECT.forEach((i) => { v.answers.inspection[i.key] = CO_ANS.OK; });
    CO_CLEAN.forEach((i) => { v.answers.cleanup[i.key] = CO_ANS.OK; });
    v.sending = true; delete v.sendingAt; coPersist(); coRender();
  });
  check('a stale send mark: the button looks off but is no dead control', await page.evaluate(() => {
    const b = document.getElementById('coReview');
    return [b.classList.contains('blocked'), b.disabled, getComputedStyle(b).pointerEvents !== 'none', b.getBoundingClientRect().height >= 44];
  }), [true, false, true, true]);
  await tap(page, '#coReview', 500);
  check('…a tap says why, in a popup', await page.evaluate(() => [S.sheet, document.getElementById('sheetTitle').textContent,
    [...document.querySelectorAll('#sheetBody .jtile .es')].map((e) => e.textContent)]), ['coWhy', 'Antes de enviar', ['Tu último envío de este trabajo todavía está saliendo']]);
  check('…and says the visit photos never hold it up', await txt(page, '#sheetBody .foot'), 'Las fotos de la visita son opcionales — no detienen el envío.');
  await page.evaluate(() => closeSheet());
  // The outbox read clears a mark with no close behind it.
  await page.evaluate(() => coRefreshOutbox().then(coRender));
  await page.waitForTimeout(400);
  check('the outbox read heals it: nothing left, the button sends', await page.evaluate(() => [coVisit('co-hartman').sending, document.getElementById('coReview').classList.contains('blocked'), JSON.parse(localStorage.getItem(CO_KEY)).visits['co-hartman'].sending]), [false, false, false]);
  await tap(page, '#coReview', 600);
  check('…a tap goes straight to the review', await page.evaluate(() => CO.screen), 'send');
  // A send just made is not healed away while its items are still being written.
  await page.evaluate(() => { const v = coVisit('co-hartman'); v.sending = true; v.sendingAt = Date.now(); coHealSending(); });
  check('a fresh send keeps its mark through the grace', await page.evaluate(() => coVisit('co-hartman').sending), true);
  await page.evaluate(() => { const v = coVisit('co-hartman'); v.sending = false; coPersist(); coGo('job'); });
  await page.waitForTimeout(400);

  // Something genuinely left: each thing is a row that goes where it is fixed.
  await page.evaluate(() => {
    const v = coVisit('co-hartman');
    delete v.answers.inspection[CO_INSPECT[0].key]; delete v.answers.inspection[CO_INSPECT[1].key];
    v.answers.inspection[CO_INSPECT[2].key] = CO_ANS.FIX;
    coPersist(); coRender();
  });
  // The job screen carries no ES/EN toggle; the language is the phone's.
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; coOnLang(); render(); });
  await page.waitForTimeout(400);
  check('the line under the button says what is left and to tap', await txt(page, '#coReviewFoot'), `Missing: inspection (2) · fix ${await page.evaluate(() => CO_INSPECT[2].n)} — Tap Review & send to see what is left`);
  await tap(page, '#coReview', 500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#sheetBody .jtile')].map((b) => [b.querySelector('.es').textContent, b.getAttribute('data-cowhy') || 'report:' + b.getAttribute('data-cowhyreport')]));
  check('the popup lists each thing, in English now', rows, [['Inspection · 2 left', 'inspect'], [`Report the problem on item ${await page.evaluate(() => CO_INSPECT[2].n)}`, 'report:' + (await page.evaluate(() => CO_INSPECT[2].key))]]);
  check('every row is a 44px target', await page.evaluate(() => [...document.querySelectorAll('#sheetBody .jtile')].every((b) => b.getBoundingClientRect().height >= 44)), true);
  await tap(page, '#sheetBody [data-cowhy="inspect"]', 500);
  check('a row closes the popup and opens that list', await page.evaluate(() => [S.sheet, CO.screen]), [null, 'inspect']);
  await page.evaluate(() => coGo('job'));
  await page.waitForTimeout(300);
  await tap(page, '#coReview', 500);
  await tap(page, '#sheetBody [data-cowhyreport]', 500);
  check('the Fix row opens that item\'s report', await page.evaluate(() => [S.sheet, CO.screen, coVisit('co-hartman').reports[CO.reportIdx].itemKey === CO_INSPECT[2].key]), [null, 'report', true]);
  check('no horizontal scroll at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  allErrs.push(...errs);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n      got ${JSON.stringify(r.actual)}\n     want ${JSON.stringify(r.expected)}`));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (allErrs.length) console.log('CONSOLE ERRORS:', JSON.stringify([...new Set(allErrs)].slice(0, 12), null, 1));
process.exit(failed.length || allErrs.length ? 1 : 0);
