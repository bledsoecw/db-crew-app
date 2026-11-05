/* T2.40 (audit I13 step 2): a construction job's final inspection, end to end
 * against dev/mock.js. Nothing here ships.
 *
 *   node dev/t240-test.mjs
 *
 * Needs a local static server on the port below and Playwright available.
 * DB CheckOut lists a Construction job's inspection as one notes-and-photos
 * area, `construction`, on the job's own Final inspection line (Carl, 3–4 Nov
 * 2026: the job's sales rep does it, the PM covers when the rep is busy or
 * already on site; "notes a photos for now"). The phone draws it on the
 * work-area screens it already has, but says it as the one inspection — not a
 * list of areas — and says what Close Out does with the job, which is what it
 * does with any job that has no work areas. Opening it asks nobody to clock
 * in. The service crew see it the same way. A job with no areas (an older
 * server) still reads as it did. */
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

// The rep's own work: the construction job's inspection line (the mock's co-prentice).
const MINE = { 'co-prentice': { inspect: 'fi-prentice' } };

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
  await page.addInitScript(`window.__MOCK_ROLE=${JSON.stringify(flags.role || 'crew')};window.__MOCK_CO_ASSIGNED=${JSON.stringify(flags.assigned === undefined ? MINE : flags.assigned)};window.__MOCK_CO_CONSTRUCTION=${JSON.stringify(flags.construction === undefined ? true : flags.construction)};`);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (flags.lang) { await page.evaluate((l) => { S.lang = l; S.langSet = true; coOnLang(); render(); }, flags.lang); await page.waitForTimeout(300); }
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => { const l = page.locator(sel); return (await l.count()) ? (await l.first().textContent()).replace(/\s+/g, ' ').trim() : ''; };
const visibleTabs = (page) => page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].filter((b) => !b.classList.contains('hidden')).map((b) => b.getAttribute('data-tab')));
const coCalls = (page) => page.evaluate(() => (window.__CO || []).map((c) => JSON.parse(JSON.stringify(c))));
const addPhoto = async (page, sel) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.locator(sel).first().click({ timeout: 5000 })]);
  await chooser.setFiles({ name: 'shot.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForTimeout(700);
};
// The rest of the site photos, put on the phone the way the camera would (closeout-test's seedSite).
const seedPhotos = (page, jobId, area, n) => page.evaluate(async ([jobId, area, n]) => {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
    await coAddPhoto({ kind: 'area', jobId, area }, new File([b], 'site' + i + '.jpg', { type: 'image/jpeg' }));
  }
  coPersist(); coRender();
}, [jobId, area, n]);
const allErrs = [];

// ---- the rep: the inspection is theirs, notes and photos, sent once ----
{
  const { ctx, page, errs } = await boot({ role: 'crew', lang: 'en' });
  check('the rep (role crew) gets the Close Out tab for the construction inspection assigned to them', (await visibleTabs(page)).includes('co'), true);
  await tap(page, '.tab[data-tab="co"]', 900);
  check('…one card: the construction job', await page.evaluate(() => (CO.jobs || []).map((j) => j.id)), ['co-prentice']);
  check('…an inspection to do', await page.evaluate(() => coKindOf(coJobById('co-prentice'))), 'inspect');
  await tap(page, '[data-cojob="co-prentice"]', 900);
  const job = await page.evaluate(() => ({
    head: (document.querySelector('#coBody .k') || {}).textContent,
    rows: [...document.querySelectorAll('#coAreas .rvrow')].map((r) => [r.querySelector('.rk').textContent, r.querySelector('.rv').textContent]),
    tiles: [...document.querySelectorAll('#coBody [data-coarea]')].map((b) => b.getAttribute('data-coarea')),
    roof: !!document.querySelector('#coBody [data-coscreen="inspect"]'),
    review: !!document.getElementById('coReview'),
  }));
  check('the job says it is the final inspection, notes and photos — not a list of work areas', job.head, 'Final inspection · notes and photos');
  check('…its one row names the rep and the PM on it', [job.rows.length, job.rows[0][0], /^Booked .+ · Justin, Neal$/.test(job.rows[0][1])], [1, 'Construction', true]);
  check('…one tile for it, and no roof checklist or Review & send', [job.tiles, job.roof, job.review], [['construction'], false, false]);
  await tap(page, '[data-coarea="construction"]', 600);
  check('opening it asks nobody to clock in: no code sheet, no hand-back held', await page.evaluate(() => [CO.screen, CO.areaKey, S.sheet || null, S.coReturn || null, (window.__CLOCK || []).length]), ['area', 'construction', null, null, 0]);
  check('…named in the header, the rule in its hint', [await txt(page, '#coK'), await txt(page, '#coTitle'), await txt(page, '#coBody > .foot')],
    ['Inspection · JT #26-0950', 'Construction', 'Photos of the finished work, and a note on what you saw. The sales rep does it, and the PM covers when the rep is busy or already on site — whoever is there sends it, once for both of you.']);
  check('…the send waits on the photos and the note, and says so', await page.evaluate(() => [document.getElementById('coAreaSend').disabled, document.querySelector('#coAreaSend + .foot').textContent.startsWith('Missing:')]), [true, true]);
  let picked = true;
  try { await addPhoto(page, '#coBody [data-cophoto]'); } catch (e) { picked = false; }
  check('…the camera button answers: nothing is in front of it', picked, true);
  await seedPhotos(page, 'co-prentice', 'construction', picked ? 8 : 9);
  await page.locator('#coAreaNote').fill('Ceiling patched and painted, trim back on, site clean.');
  await page.locator('#coAreaNote').blur();
  await page.waitForTimeout(800);
  check('nine photos and a note: ready, and the line under it says what Close Out does with the job',
    await page.evaluate(() => [coVisit('co-prentice').areas.construction.photos.length, document.getElementById('coAreaSend').disabled, document.querySelector('#coAreaSend + .foot').textContent]),
    [9, false, 'The job moves to PM Review in JobTread.']);
  await tap(page, '#coAreaSend', 3500);
  const sent = (await coCalls(page)).filter((c) => c.fn === 'coCloseArea');
  check('the close goes as the construction area, notes and no form', sent.map((c) => [c.jobId, c.body.area, /Ceiling patched/.test(c.body.notes || ''), c.body.form === undefined, c.body.problemsReported]), [['co-prentice', 'construction', true, true, 0]]);
  check('…its photos went with the area named', await page.evaluate(() => (window.__CALLS || []).filter((f) => f === 'coPhoto').length), 9);
  check('the receipt: sent to the PM, and where Close Out put the job', await txt(page, '#coReceipt .ss'), 'Sent to Neal Deitemeyer · The job moved to PM Review');
  check('…nothing waiting, and the inspection is done on the phone', await page.evaluate(() => [coOutboxFor('co-prentice').length, coAreaByKey(CO.job || coJobById('co-prentice'), 'construction').inspected]), [0, true]);
  allErrs.push(...errs); await ctx.close();
}

// ---- in Spanish ----
{
  const { ctx, page, errs } = await boot({ role: 'crew', lang: 'es' });
  await tap(page, '.tab[data-tab="co"]', 900);
  await tap(page, '[data-cojob="co-prentice"]', 900);
  const es = await page.evaluate(() => ({ head: (document.querySelector('#coBody .k') || {}).textContent, row: (document.querySelector('#coAreas .rvrow .rk') || {}).textContent, tile: (document.querySelector('#coBody [data-coarea] .es') || {}).textContent }));
  check('Spanish: Inspección final · notas y fotos, and Construcción', [es.head, es.row, es.tile], ['Inspección final · notas y fotos', 'Construcción', 'Construcción']);
  await tap(page, '[data-coarea="construction"]', 600);
  check('…the hint in Spanish', await txt(page, '#coBody > .foot'), 'Fotos del trabajo terminado y una nota de lo que viste. La hace el vendedor, y el PM la cubre cuando el vendedor está ocupado o ya está en la obra — el que esté ahí la manda, una vez por los dos.');
  allErrs.push(...errs); await ctx.close();
}

// ---- nobody on it yet: said for construction, not the board's "books it" ----
{
  const { ctx, page, errs } = await boot({ role: 'service', construction: [] });
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; coOnLang(); render(); });
  await tap(page, '.tab[data-tab="co"]', 900);
  await page.evaluate(() => { CO.filter = 'all'; coRender(); });
  await page.waitForTimeout(300);
  check('the service crew see the construction job in All', await page.evaluate(() => (CO.jobs || []).some((j) => j.id === 'co-prentice')), true);
  await tap(page, '[data-cojob="co-prentice"]', 900);
  await page.evaluate(() => { const a = CO.job.areas[0]; a.inspectionDate = null; a.mine = false; a.assigneeNames = []; coRender(); });
  await page.waitForTimeout(300);
  check('…with nobody on it: it says the office puts the rep and the PM on it', await page.evaluate(() => (document.querySelector('#coAreas .rvrow .rv') || {}).textContent),
    'Nobody on it yet — the office puts the sales rep and the PM on it from the board');
  check('…and it is still open to inspect at Final Inspection (a tile)', await page.evaluate(() => [...document.querySelectorAll('#coBody [data-coarea]')].map((b) => b.getAttribute('data-coarea'))), ['construction']);
  allErrs.push(...errs); await ctx.close();
}

// ---- an older server: a construction job with no areas reads as it always did ----
{
  const { ctx, page, errs } = await boot({ role: 'service' });
  await page.evaluate(() => { S.lang = 'en'; S.langSet = true; coOnLang(); render(); });
  await tap(page, '.tab[data-tab="co"]', 900);
  await page.evaluate(() => { CO.filter = 'all'; coRender(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const j = coJobById('co-prentice'); if (j) delete j.areas; });
  await tap(page, '[data-cojob="co-prentice"]', 900);
  await page.evaluate(() => { if (CO.job) delete CO.job.areas; coRender(); });
  await page.waitForTimeout(300);
  check('no areas from the server: the job draws the inspection checklist as before', await page.evaluate(() => [!!document.querySelector('#coBody [data-coscreen="inspect"]'), document.querySelectorAll('#coBody [data-coarea]').length]), [true, 0]);
  allErrs.push(...errs); await ctx.close();
}

// ---- the contract: the phone needs at least 5, and the mock's server says what it needs ----
// Read off the page, never pinned (the T2.30 lesson: T2.41 raised it to 6).
{
  const { ctx, page, errs } = await boot({ role: 'ops' });
  const need = await page.evaluate(() => CO_CONTRACT_NEED);
  await page.evaluate(() => loadBuilds()); await page.waitForTimeout(500);
  check('the phone needs Close Out contract 5 or later, and the server it talks to says at least that',
    [need >= 5, await page.evaluate((n) => !!(S.builds && S.builds.closeOut && S.builds.closeOut.contract >= n), need)], [true, true]);
  allErrs.push(...errs); await ctx.close();
}

check('no page errors', allErrs, []);
await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : '\n   got:  ' + JSON.stringify(r.actual) + '\n   want: ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
