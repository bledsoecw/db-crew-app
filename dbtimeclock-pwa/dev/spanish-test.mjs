/* Spanish across the Clock tab, its sheets and My jobs (T2.24), against
   dev/mock.js. Nothing here ships.

     node dev/spanish-test.mjs

   One switch: EN / ES on the Clock and My jobs headers as well as the Day log
   and Close Out. Every word those screens draw is looked up by its English
   (L / Lf); a word with no Spanish stays English. The walk below records every
   English word the screens asked for that has no Spanish (window.__miss), so a
   new sentence added without its Spanish shows up here by name. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

async function boot(init = '') {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;' + init);
  await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  // Every English word asked for in Spanish with no Spanish behind it.
  await page.evaluate(() => {
    window.__miss = {};
    var L0 = L;
    window.L = function(en){ if (S.lang === 'es' && en && !Object.prototype.hasOwnProperty.call(ES, en)) window.__miss[en] = 1; return L0(en); };
  });
  return { ctx, page, errs };
}
const tap = async (page, sel, ms = 300) => { await page.locator(sel).first().click(); await page.waitForTimeout(ms); };
const txt = async (page, sel) => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const settle = async (page) => { await page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 10000 }); await page.waitForTimeout(250); };
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
// Words that come from the board or JobTread, not this app: never looked up
// as Spanish on purpose, so not counted as missing.
const NOT_OURS = /^(Tarps checked|Dry-in|Material on site and counted)/;
// A toast is looked up again on its way out (the sink), so words already in
// Spanish come back through L as well; they are not missing anything.
const missing = async (page) => page.evaluate((notOurs) => {
  const re = new RegExp(notOurs), heads = Object.keys(ES).map((k) => ES[k].split('{')[0]).filter((h) => h.length >= 8);
  return Object.keys(window.__miss).filter((k) => !re.test(k) && !heads.some((h) => k.startsWith(h)) && !Object.values(ES).includes(k));
}, NOT_OURS.source);

// ---- the source: every literal handed to L( or Lf( has its Spanish ----
// The walk below only reaches the screens it opens; this reads them all.
{
  const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const lits = new Set(), re = /(?<![A-Za-z0-9_$.])(L|Lf)\(/g;
  let m;
  while ((m = re.exec(src))){
    let i = re.lastIndex, depth = 1, q = null, end = -1;
    for (; i < src.length; i++){
      const c = src[i];
      if (q){ if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === "'" || c === '"'){ q = c; continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)){ if (--depth === 0){ end = i; break; } }
      else if (c === ',' && depth === 1 && m[1] === 'Lf'){ end = i; break; }
    }
    const arg = src.slice(re.lastIndex, end);
    let d = 0, lq = false, lit = '';
    for (let j = 0; j < arg.length; j++){
      const c = arg[j];
      if (lq){ if (c === '\\'){ lit += c + arg[++j]; continue; } if (c === "'"){ lq = false; if (d === 0) lits.add(Function("return '" + lit + "'")()); continue; } lit += c; continue; }
      if (c === "'"){ lq = true; lit = ''; continue; }
      if (c === '(') d++; else if (c === ')') d--;
    }
  }
  const ES = {}, esAdd = (o) => Object.assign(ES, o);
  for (const b of src.match(/esAdd\(\{[\s\S]*?\n\}\);/g)) eval(b);
  // Ternary conditions ('start', 'end-out'…) are not words.
  const words = [...lits].filter((k) => /[\s·?.!—…]/.test(k) || /^[A-Z]/.test(k));
  check('every literal looked up has its Spanish (' + words.length + ' of them)', words.filter((k) => !(k in ES)), []);
}

// ---- a site manager: English until the switch, then all of it Spanish ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_KEEP_CLOCK=true;window.__MOCK_FIX={entries:function(){return [];}};');
  check('the Clock header carries EN / ES, English lit', [await page.locator('#clockLang [data-lang="en"]').getAttribute('class'), await txt(page, '#clockIn .big')], ['k9 on', 'Clock in']);
  check('My jobs carries the switch too', await page.locator('#jobsLang [data-lang]').count(), 2);
  const tapTargets = await page.evaluate(() => [].map.call(document.querySelectorAll('#clockLang button'), (b) => Math.round(b.getBoundingClientRect().height)));
  check('each half of the switch is 44px', tapTargets, [44, 44]);
  check('the header still fits: no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await tap(page, '#clockLang [data-lang="es"]', 400);
  check('ES lights, the page says es', [await page.locator('#clockLang [data-lang="es"]').getAttribute('class'), await page.evaluate(() => [S.lang, S.langSet, document.documentElement.lang])], ['k9 on', ['es', true, 'es']]);
  check('off the clock, in Spanish', [await txt(page, '#clockIn .big'), await txt(page, '#clockIn .sm'), await txt(page, '#shopBtn .b1'), await txt(page, '#shopBtn .b2'), await txt(page, '#shopOther'), await txt(page, '.tab[data-tab="job"] .tl'), await txt(page, '.tab[data-tab="jobs"] .tl')],
    ['Marcar entrada', 'Código, luego foto de inicio', 'En el taller', 'Entrada de la mañana · un toque', 'Otro trabajo en el taller', 'Reloj', 'Mis trabajos']);
  check('the job card and the day table', [(await txt(page, '#jobK')).replace(/ · JT #.*/, ''), await txt(page, '#pickJobLbl'), await txt(page, '#dayTbl .ttotal .l')], ['Trabajo de hoy', 'Cambiar de trabajo', 'Total de hoy']);
  check('the role under the name', await txt(page, '#hdrW'), 'Tyler B. · Encargado');

  // Clock in: the code sheet, the start-photo camera, the four buttons.
  await tap(page, '#clockIn', 400);
  check('the code sheet asks in Spanish', await txt(page, '#sheetTitle'), '¿Qué vas a hacer?');
  await tap(page, '.coderow:has-text("Masonry Labor")', 600);
  check('the locked camera', [await txt(page, '#afterBarT'), await txt(page, '#camBackLbl'), await txt(page, '.tagbtn.on .tl'), await txt(page, '#noSkip')], ['Foto de inicio · el reloj empieza al tomarla', 'Atrás', 'Inicio', 'No se salta']);
  await shoot(page);
  await settle(page);
  check('on the clock', [await txt(page, '#band .lbl'), await txt(page, '#breakBtn'), await txt(page, '#codeBtn'), await txt(page, '#leaveBtn'), await txt(page, '#outBtn'), await txt(page, '#photoBtn')],
    ['En el reloj', 'Descanso', 'Cambiar código', 'Salir de la obra', 'Marcar salida', 'Tomar una foto']);
  check('the band says when it began, in Spanish', /^Empezó a las .+ con foto de inicio · 1 foto en este código$/.test(await txt(page, '#bandSub')), true);
  check('Started earlier, in Spanish', await txt(page, '#earlierBtn'), '¿Empezaste antes? Di a qué hora');

  await tap(page, '#leaveBtn', 400);
  const leave = await page.locator('#sheetBody .stoprow .st').allTextContents();
  check('Leave the site: the four ways out', [(await txt(page, '#sheetTitle')).startsWith('Saliendo de '), leave],
    [true, ['Ir por material · regreso aquí después', 'Otro trabajo · regreso aquí más tarde', 'Otro trabajo · terminé aquí por hoy', 'Al taller · terminé aquí por hoy']]);
  await page.evaluate(() => closeSheet());
  await tap(page, '#breakBtn', 400);
  check('the break sheet', [await txt(page, '#sheetTitle'), /^regresas /.test(await txt(page, '.brkopt .bs'))], ['¿Cuánto descanso?', true]);
  await page.evaluate(() => closeSheet());
  await tap(page, '#earlierBtn', 400);
  check('Started earlier: the sheet', [await txt(page, '#sheetTitle'), await txt(page, '#earlierGo')], ['¿Cuándo empezaste?', 'Escoge una hora']);
  await page.evaluate(() => closeSheet());

  // My jobs.
  await tap(page, '.tab[data-tab="jobs"]', 800);
  check('My jobs in Spanish', [(await txt(page, '#jobsK')).replace(/ · .*/, ''), (await txt(page, '#boardStamp')).replace(/ · .*/, ''), await txt(page, '#jobsList .jnav')], ['Mis trabajos', 'Tablero', 'Cómo llegar']);
  const dows = await page.locator('#weekStrip .dn').allTextContents();
  check('the week strip names the days in Spanish', dows.every((d) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].includes(d)), true);
  check('a visit card says where you are', /^Estás aquí/.test(await txt(page, '#jobsList .jcard.today .jwhen .d')), true);
  check('no English left on the walk', await missing(page), []);

  // And back: one tap, all of it English again.
  await tap(page, '#jobsLang [data-lang="en"]', 400);
  check('EN puts it back', [(await txt(page, '#jobsK')).replace(/ · .*/, ''), await txt(page, '.tab[data-tab="job"] .tl'), await page.evaluate(() => S.lang)], ['My jobs', 'Clock', 'en']);
  await tap(page, '.tab[data-tab="job"]', 400);
  check('the Clock is English again', [await txt(page, '#band .lbl'), await txt(page, '#outBtn')], ['On the clock', 'Clock out']);
  check('no page errors', errs, []);
  await ctx.close();
}

// ---- the service crew read Spanish first, on the Clock tab too ----
{
  const { ctx, page, errs } = await boot('window.__MOCK_ROLE="service";window.__MOCK_FIX={entries:function(){return [];}};');
  await page.evaluate(() => setTab('job'));
  await page.waitForTimeout(300);
  check('Alberto opens in Spanish with nothing chosen', [await page.evaluate(() => [S.lang, S.langSet]), await txt(page, '#clockIn .big'), await txt(page, '.tab[data-tab="job"] .tl')], [['es', false], 'Marcar entrada', 'Reloj']);
  await tap(page, '#clockIn', 400);
  check('…his code sheet too', await txt(page, '#sheetTitle'), '¿Qué vas a hacer?');
  check('no page errors (service)', errs, []);
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'ok   ' : 'FAIL ') + r.name + (r.pass ? '' : '\n       got      ' + JSON.stringify(r.actual) + '\n       expected ' + JSON.stringify(r.expected)));
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed');
process.exit(fails.length ? 1 : 0);
