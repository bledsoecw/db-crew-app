/* T2.35 (2 Nov 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t235-test.mjs
 *
 * Step 3 of the second audit (https://claude.ai/artifact/FB4xEquJajG6UtLuarxmZr),
 * I10: a repair that cannot be finished today. It used to have one way out,
 * Done. Now the crew say why — waiting on material, no access, the weather, a
 * decision, or something else — with words where the PM needs them and a
 * photo if they want one. The repair stays open; DB CheckOut writes its
 * waiting line, takes its spent day off and tags the area's PM, who books it
 * again from the board's Close-out panel ("Couldn't finish"). The server half
 * is DB CheckOut's test/routes.test.ts and test/jt.test.ts; the Apps Script's
 * forwarding is apps-script/code-test.mjs; the board's reading of the line is
 * its closeout.test.ts and trades.test.ts. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };

async function boot(flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript(flags);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const coFresh = (page, jobId) => page.waitForFunction((id) => CO.jobFresh === id && !CO.jobLoading, jobId, { timeout: 15000 }).then(() => page.waitForTimeout(200));
const coOpen = async (page, jobId) => {
  await page.evaluate((id) => { setTab('co'); coOpenJob(id); }, jobId);
  await coFresh(page, jobId);
};
const openRepair = async (page, taskId) => { await page.evaluate((id) => { CO.taskId = id; coGo('repair'); }, taskId); await page.waitForTimeout(350); };
const english = (page) => page.evaluate(() => { S.lang = 'en'; S.langSet = true; savePrefs(); });
const addCantPhoto = (page, taskId) => page.evaluate(async (id) => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg'));
  await coAddPhoto({ kind: 'cant', jobId: CO.jobId, taskId: id }, new File([b], 'c.jpg', { type: 'image/jpeg' }), null);
  coRender();
}, taskId);
const sendState = (page) => page.evaluate(() => { const b = document.getElementById('coCantSend'); return b ? [b.disabled, b.nextElementSibling.textContent] : null; });
const outbox = (page) => page.evaluate(() => coObAll().then((all) => all.map((x) => [x.kind, x.id.replace(/^cb[^.]+/, 'cb'), x.status || ''])));
const calls = (page, fn) => page.evaluate((f) => (window.__CO || []).filter((x) => x.fn === f), fn);

// ---- the button, the screen, the rules for the words ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt1');
  check('I10: a repair has a second way out, under Done, saying what happens',
    [await txt(page, '#coCant'), (await page.locator('#coCant').evaluate((b) => b.nextElementSibling.textContent)).trim(), await page.locator('#coDone').count()],
    // Okafor is a service call, so since T2.41 (audit I15) the button is the
    // return visit; t241-test pins the plain words on a repair that is not one.
    ['Needs a return visit', 'It stays open — say why, and your PM books the next visit', 1]);
  const box = await page.locator('#coCant').boundingBox();
  check('…a 44-pixel target at least', box && box.height >= 44, true);
  await tap(page, '#coCant', 400);
  check('…it opens its own screen, under the repairs\' heading, with why it is there',
    [await page.evaluate(() => CO.screen), (await txt(page, '#coBody .foot'))],
    ['cant', 'The repair stays open. Your PM sees why on the Production Board and books it again.']);
  check('…five reasons, in order, none picked; Send waits on why',
    [await page.evaluate(() => [...document.querySelectorAll('[data-cocant]')].map((b) => [b.getAttribute('data-cocant'), b.getAttribute('aria-pressed'), b.querySelector('.es').textContent])),
     await sendState(page)],
    [[['material', 'false', 'Parts needed'], ['access', 'false', 'Customer not available'], ['weather', 'false', 'The weather'], ['decision', 'false', 'Needs a decision'], ['other', 'false', 'Something else']],
     [true, 'Missing: why']]);
  check('…no note box until a reason is picked', await page.locator('#coCantNote').count(), 0);

  await tap(page, '[data-cocant="material"]', 400);
  check('material: pressed, and the words are required — "What’s short?"',
    [await page.locator('[data-cocant="material"]').getAttribute('aria-pressed'),
     await page.evaluate(() => [...document.querySelectorAll('#coBody .k')].map((k) => k.textContent.replace(/\s+/g, ' ').trim())[1]), await sendState(page)],
    ['true', 'What’s short? — required', [true, 'Missing: a note']]);
  await page.locator('#coCantNote').fill('Short 2 bundles of ridge cap');
  check('…typed, Send lights at once, without a redraw under the finger',
    [await sendState(page), await page.evaluate(() => document.activeElement && document.activeElement.id)], [[false, 'Your PM books it again'], 'coCantNote']);
  await tap(page, '[data-cocant="access"]', 400);
  check('access: the words are optional, and kept while the reason changes',
    [await page.evaluate(() => [...document.querySelectorAll('#coBody .k')].map((k) => k.textContent.replace(/\s+/g, ' ').trim())[1]), await page.inputValue('#coCantNote'), await sendState(page)],
    ['What happened? — optional', 'Short 2 bundles of ridge cap', [false, 'Your PM books it again']]);
  await page.locator('#coCantNote').fill('');
  check('…and with nothing typed, access can still go', await sendState(page), [false, 'Your PM books it again']);
  for (const r of ['weather', 'decision', 'other']) {
    await tap(page, `[data-cocant="${r}"]`, 300);
    check(`${r}: ${r === 'weather' ? 'no words needed' : 'words needed'}`, (await sendState(page))[0], r !== 'weather');
  }
  check('…the draft is on the phone, so the visit is not idle and is not trimmed',
    await page.evaluate(() => { const v = coVisit('co-okafor'); v.cantNote.pt1 = 'x'; const busy = !coVisitIdle(v); v.cantNote.pt1 = ''; return [v.cantReason.pt1, busy]; }), ['other', true]);

  // Back goes to the repair, the draft kept.
  await page.evaluate(() => coBack());
  await page.waitForTimeout(300);
  check('Back goes to the repair, and the draft is still there when it is opened again',
    [await page.evaluate(() => CO.screen), await (async () => { await tap(page, '#coCant', 300); return page.evaluate(() => document.querySelector('[data-cocant="other"]').getAttribute('aria-pressed')); })()],
    ['repair', 'true']);
  await page.evaluate(() => { window.__MOCK_CO_REMOVED = 'pt1'; coLoadJob('co-okafor'); });
  await coFresh(page, 'co-okafor');
  check('the office takes the repair off while this is open: said, never "Loading…" for good',
    [await page.evaluate(() => CO.screen), await txt(page, '#coRepairGone')],
    ['cant', 'This repair isn’t on the job any more — the office took it off in JobTread. Ask your PM if it still needs doing.']);
  await tap(page, '#coRepairGoneBack', 400);
  check('…and Back goes straight to the repairs, not to the repair that is gone', await page.evaluate(() => [CO.screen, CO.taskId]), ['repairs', null]);
  await page.evaluate(() => { window.__MOCK_CO_REMOVED = null; });
  check('no page errors (the screen)', errs, []);
  await ctx.close();
}

// ---- sent: the photo first, then the reason; the repair says it waits ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt1');
  await tap(page, '#coCant', 300);
  await tap(page, '[data-cocant="material"]', 300);
  await page.locator('#coCantNote').fill('Short 2 bundles of ridge cap');
  await page.locator('#coCantNote').blur();
  await page.waitForTimeout(400);
  await addCantPhoto(page, 'pt1');
  check('a photo is optional, and shows as a tile once taken', await page.locator('#coBody .photos .ph:not(.add)').count(), 1);
  await page.evaluate(() => { window.__CO = []; });
  await tap(page, '#coCantSend', 300);
  check('Send: saved at the tap, said, and back to the repairs', [await txt(page, '#toast'), await page.evaluate(() => CO.screen)], ['Saved — it goes to your PM', 'repairs']);
  await page.waitForFunction(() => (window.__CO || []).some((x) => x.fn === 'coBlocked'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const order = await page.evaluate(() => (window.__CO || []).filter((x) => x.fn === 'coPhoto' || x.fn === 'coBlocked').map((x) => x.fn));
  const ph = (await calls(page, 'coPhoto'))[0], bl = (await calls(page, 'coBlocked'))[0];
  check('…the photo goes first, riding the send\'s reference + ".m0" as a repair\'s extra photos do, on the repair',
    [order, ph && ph.photo.label, ph && ph.photo.taskId, ph && bl && ph.ref === bl.ref + '.m0'], [['coPhoto', 'coBlocked'], 'REPAIR', 'pt1', true]);
  check('…then the reason and the words, for that repair on that job', bl && [bl.taskId, bl.jobId, bl.reason, bl.note, /^cb/.test(bl.ref)],
    ['pt1', 'co-okafor', 'material', 'Short 2 bundles of ridge cap', true]);
  check('…nothing left waiting, and the draft cleared', [await outbox(page), await page.evaluate(() => { const v = coVisit('co-okafor'); return [v.cantReason.pt1, v.cantNote.pt1, v.cantPhotos.pt1]; })],
    [[], [null, null, null]]);
  await coFresh(page, 'co-okafor');
  check('…the repairs say it went, and who it went to',
    [await txt(page, '#coCantSent .sl'), await txt(page, '#coCantSent .ss')], ['Couldn’t finish · sent', 'Sent to Dave Elick. Your PM books it again']);
  check('…the repair is still open on the list, marked with why',
    await page.evaluate(() => { const b = document.querySelector('[data-corepair="pt1"]'); return [b.classList.contains('done'), b.querySelector('.chip.cowait') && b.querySelector('.chip.cowait').textContent]; }),
    [false, 'Waiting on material']);
  await openRepair(page, 'pt1');
  check('…opened, it says why it waits, the words as the server wrote them, and who books it',
    [await txt(page, '#coWaitCard .sl'), await page.evaluate(() => [...document.querySelectorAll('#coWaitCard .ss')].map((s) => s.textContent))],
    ['Waiting on material', ['Short 2 bundles of ridge cap (Alberto Gonzalez, Nov 3)', 'Your PM books it again']]);
  check('…the waiting line is never read as what to do', (await txt(page, '#coBody')).indexOf('⏳') === -1, true);
  check('…the button now changes why, and Done is still there for when it is finished',
    [await txt(page, '#coCant'), await page.locator('#coDone').count()], ['Change why it’s waiting', 1]);
  check('no page errors (sent)', errs, []);
  await ctx.close();
}

// ---- no signal: kept, said, sent when it comes back ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await page.evaluate(() => { window.__MOCK_NONET = true; window.dispatchEvent(new Event('offline')); });
  await openRepair(page, 'pt2');
  await tap(page, '#coCant', 300);
  await tap(page, '[data-cocant="access"]', 300);
  await page.evaluate(() => { window.__CO = []; });
  await tap(page, '#coCantSend', 600);
  check('no signal: kept on the phone, with no words needed for access — tried, and waiting its turn', await outbox(page), [['blocked', 'cb', 'queued']]);
  check('…the list marks it as still to send', await page.evaluate(() => { const c = document.querySelector('[data-corepair="pt2"] .chip.cowait'); return c && c.textContent; }), 'No access · Waiting to send');
  await openRepair(page, 'pt2');
  check('…opened, the repair says so — saved, going to the PM', [await txt(page, '#coWaitCard .sl'), await page.evaluate(() => [...document.querySelectorAll('#coWaitCard .ss')].map((s) => s.textContent))],
    ['No access', ['Saved on this phone — going to your PM']]);
  await page.evaluate(() => { window.__MOCK_NONET = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => (window.__CO || []).some((x) => x.fn === 'coBlocked'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  check('signal back: it goes, nothing is left waiting', [(await calls(page, 'coBlocked')).map((x) => [x.taskId, x.reason, x.note]), await outbox(page)],
    [[['pt2', 'access', '']], []]);
  check('no page errors (no signal)', errs, []);
  await ctx.close();
}

// ---- refused: not sent, said where to look ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';window.__MOCK_CO_GONE='pt2';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt2');
  await tap(page, '#coCant', 300);
  await tap(page, '[data-cocant="weather"]', 300);
  await tap(page, '#coCantSend', 300);
  await page.waitForFunction(() => coObAll().then((a) => a.some((x) => x.kind === 'blocked' && x.status === 'rejected')), null, { timeout: 15000 }).catch(() => {});
  check('a repair taken off in JobTread: refused, kept for the crew to see, never retried', await outbox(page), [['blocked', 'cb', 'rejected']]);
  await page.evaluate(() => { window.__MOCK_CO_GONE = null; CO.taskId = 'pt2'; coGo('repair'); });
  await page.waitForTimeout(400);
  check('…the repair says it was not sent, and where to look',
    await page.evaluate(() => [...document.querySelectorAll('#coWaitCard .ss')].map((s) => s.textContent)), ['Not sent — see Waiting to send']);
  check('…and the Waiting to send list can let it go', await page.evaluate(() => coObAll().then((a) => coCanDiscard(a.filter((x) => x.kind === 'blocked')[0]))), true);
  check('no page errors (refused)', errs, []);
  await ctx.close();
}

// ---- Spanish: a Spanish phone, a note said in Spanish ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await page.evaluate(() => { S.lang = 'es'; S.langSet = true; savePrefs(); });
  await coOpen(page, 'co-okafor');
  await openRepair(page, 'pt1');
  check('Spanish: the button and what it does', [await txt(page, '#coCant'), (await page.locator('#coCant').evaluate((b) => b.nextElementSibling.textContent)).trim()],
    ['Necesita otra visita', 'Sigue abierta — di por qué, y tu PM programa la próxima visita']);
  await tap(page, '#coCant', 300);
  check('…the five reasons', await page.evaluate(() => [...document.querySelectorAll('[data-cocant] .es')].map((b) => b.textContent)),
    ['Faltan piezas', 'El cliente no está', 'El clima', 'Hay que decidir algo', 'Otra cosa']);
  await tap(page, '[data-cocant="decision"]', 300);
  check('…a decision needs words', [await page.evaluate(() => [...document.querySelectorAll('#coBody .k')].map((k) => k.textContent.replace(/\s+/g, ' ').trim())[1]), await sendState(page)],
    ['¿Qué hay que decidir? — obligatoria', [true, 'Falta: una nota']]);
  await page.locator('#coCantNote').fill('El cliente no sabe qué color quiere');
  await page.locator('#coCantNote').blur();
  await page.waitForTimeout(700);
  check('…said in Spanish, the English is shown before it goes', await page.evaluate(() => { const r = document.querySelector('#coBody .rvstory .rt'); return r && r.textContent; }), 'EN: El cliente no sabe qué color quiere');
  await page.evaluate(() => { window.__CO = []; });
  await tap(page, '#coCantSend', 300);
  await page.waitForFunction(() => (window.__CO || []).some((x) => x.fn === 'coBlocked'), null, { timeout: 15000 }).catch(() => {});
  const bl = (await calls(page, 'coBlocked'))[0];
  check('…the office gets the English, with the words as said beside it', bl && bl.note, 'EN: El cliente no sabe qué color quiere\n\n(El cliente no sabe qué color quiere)');
  check('…the toast in Spanish', await txt(page, '#toast'), 'Guardado — se manda a tu PM');
  await coFresh(page, 'co-okafor');
  check('…the list\'s mark in Spanish', await page.evaluate(() => { const c = document.querySelector('[data-corepair="pt1"] .chip.cowait'); return c && c.textContent; }), 'Falta una decisión');
  check('no page errors (Spanish)', errs, []);
  await ctx.close();
}

// ---- the contract level: the phone needs 4, and draws no door an older server lacks ----
{
  const { ctx, page, errs } = await boot("window.__MOCK_ROLE='service';");
  await english(page);
  await coOpen(page, 'co-okafor');
  await page.evaluate(() => { S.builds = { api: APP_BUILD, closeOut: { configured: true, ok: true, contract: 3 } }; CO.taskId = 'pt1'; coGo('repair'); });
  await page.waitForTimeout(300);
  check('a Close Out server older than contract 4 has no door for it: no button, Done as before', [await page.locator('#coCant').count(), await page.locator('#coDone').count()], [0, 1]);
  await page.evaluate(() => { S.builds = { api: APP_BUILD, closeOut: { configured: true, ok: true, contract: 4 } }; coRender(); });
  await page.waitForTimeout(200);
  check('…at 4 it is drawn', await page.locator('#coCant').count(), 1);
  await page.evaluate(() => { S.builds = null; coRender(); });
  await page.waitForTimeout(200);
  check('…and while the level is not known yet, it is drawn too (the server refuses what it cannot do)', await page.locator('#coCant').count(), 1);
  await page.evaluate(() => { const v = coVisit('co-okafor'); v.doneTasks.pt1 = 'queued'; coPersist(); coRender(); });
  await page.waitForTimeout(200);
  check('…never beside a Done this phone is still sending: Done and Can\'t finish would contradict each other', await page.locator('#coCant').count(), 0);
  await page.evaluate(() => { const v = coVisit('co-okafor'); delete v.doneTasks.pt1; coPersist(); coRender(); });
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(900);
  // The level is read off the page, never pinned (the T2.30 lesson): T2.40 raised it to 5.
  const need = await page.evaluate(() => CO_CONTRACT_NEED);
  check('the phone needs Close Out contract 4 or more, and the mock server at its level raises no warning', [need >= 4, await page.locator('#verWarn').isHidden()], [true, true]);
  await page.evaluate(() => { window.__MOCK_BUILDS = { api: APP_BUILD, closeOut: { configured: true, ok: true, build: { on: 'vercel', commit: '831136a' }, deployed: '831136a', contract: 3 } }; return loadBuilds(); });
  await page.waitForTimeout(300);
  check('…a server still at 3 (T2.34) is called behind, in words that say what to deploy',
    [await page.locator('#verWarn').isVisible(), (await txt(page, '#verWarn')).indexOf(`The Close Out server is older than this app needs (contract 3, needs ${need}). Deploy DB CheckOut’s main.`) > -1], [true, true]);
  check('no word added twice with different words (T2.35)', await page.evaluate(() => I18N_CLASH), []);
  check('no page errors (contract)', errs, []);
  await ctx.close();
}

await browser.close();
let pass = 0;
for (const r of results) {
  console.log((r.pass ? '  ok  ' : 'FAIL  ') + r.name + (r.pass ? '' : `\n        got:  ${JSON.stringify(r.actual)}\n        want: ${JSON.stringify(r.expected)}`));
  if (r.pass) pass++;
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
