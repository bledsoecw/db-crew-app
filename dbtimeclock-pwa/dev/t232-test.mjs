/* T2.32 (30 Oct 2026), against dev/mock.js. Nothing here ships.
 *
 *   node dev/t232-test.mjs
 *
 * Step 3 of the audit, second half: the app's script is its own file, paired
 * with the page by build, and the root address is never an hour-old copy
 * (I5, D20); the security policy goes out report-only, and Diagnostics says
 * what it would block (D13); My jobs is drawn again only when it changed
 * (I9); one rule for every translation table (I6); and on a computer the app
 * sits in a centered column (D19). The service worker's half is sw-test.mjs,
 * the deploy check's is check-build.mjs itself. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');
const PUB = (f) => readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');
const PAGE = PUB('index.html'), APP = PUB('app.js'), SW = PUB('sw.js');
const FB = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const SITE = FB.hosting.find((h) => h.site === 'db-crews');
const hdr = (src, key) => (SITE.headers.filter((h) => h.source === src).flatMap((h) => h.headers).find((x) => x.key === key) || {}).value;
const POLICY = hdr('/', 'Content-Security-Policy-Report-Only') || '';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const txt = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();
const shoot = (page) => page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  c.getContext('2d').fillRect(0, 0, 8, 8);
  c.toBlob((b) => { captured(b, 'image/jpeg'); res(true); }, 'image/jpeg');
}));
const settle = (page) => page.waitForFunction(() => S.clockGate == null && document.body.style.pointerEvents === '', null, { timeout: 15000 }).catch(() => {});

// `serve(route)`: the page as the hosting would send it — with these headers,
// or another page altogether. Every other file comes from the server as is.
async function boot(flags = '', { size = [402, 874], headers = null, html = null, mockOff = false, block = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, permissions: ['camera'] });
  const page = await ctx.newPage();
  const errs = [], cspConsole = [], loads = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) cspConsole.push(m.text().slice(0, 200)); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) loads.push(f.url()); });
  if (headers || html != null) {
    await page.route((u) => u.href === APP_URL || u.href === APP_URL + 'index.html', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), ...(headers || {}) }, body: html != null ? html : await res.text() });
    });
  }
  if (block) await page.route(block, (route) => route.abort());
  await page.addInitScript(flags);
  if (!mockOff) await page.addInitScript(mock);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return { ctx, page, errs, cspConsole, loads };
}

// ---- I5 + D20: the files, as they will be deployed ----
{
  const build = (re, s) => (re.exec(s) || [])[1];
  const b = { page: build(/<html[^>]*data-build="([^"]+)"/, PAGE), ask: build(/<script src="app\.js\?b=([^"]+)"><\/script>/, PAGE),
              sw: build(/var BUILD = '([^']+)'/, SW), app: build(/var APP_BUILD = '([^ ']+)/, APP) };
  check('I5: the page carries no inline script, and asks for app.js by build',
    [(PAGE.match(/<script(?![^>]*\ssrc=)[^>]*>/g) || []).length, !!b.ask], [0, true]);
  check('…one build in all four places: the page, its request, the worker, the script', [b.page, b.ask, b.sw], [b.app, b.app, b.app]);
  check('D20: the root address is no-cache, as /index.html is', [hdr('/', 'Cache-Control'), hdr('/index.html', 'Cache-Control')], ['no-cache', 'no-cache']);
  check('…and every deploy checks the build first (check-build.mjs)', SITE.predeploy, ['node ./check-config.mjs', 'node ./check-build.mjs']);
  const scriptSrc = (/script-src ([^;]+)/.exec(POLICY) || [])[1] || '';
  check('D13: the policy goes out report-only on the page, wherever it is served, and is not yet enforced',
    [!!POLICY, hdr('/index.html', 'Content-Security-Policy-Report-Only') === POLICY, !!hdr('/', 'Content-Security-Policy')], [true, true, false]);
  check('…its script rule allows no inline script and no eval, only this site, Google sign-in and the Firebase SDK',
    [/unsafe-inline|unsafe-eval/.test(scriptSrc), scriptSrc.trim()], [false, "'self' https://accounts.google.com/gsi/ https://www.gstatic.com/firebasejs/"]);
}

// ---- I5: the app runs from its own file ----
{
  const { ctx, page, errs } = await boot();
  check('I5: the app runs from app.js, the page and the script one build',
    await page.evaluate(() => [APP_BUILD, PAGE_BUILD, !document.getElementById('gateSlow'), !document.getElementById('app').classList.contains('hidden')]),
    ['T2.32 (2026-10-30)', 'T2.32', true, true]);
  check('no page errors (I5)', errs, []);
  await ctx.close();
}
{
  // The script never arrives: the gate says so after six seconds, in both languages.
  const { ctx, page } = await boot('', { mockOff: true, block: /\/app\.js/ });
  await page.waitForTimeout(6200);
  const slow = await page.evaluate(() => { const g = document.getElementById('gateSlow'); return g ? [getComputedStyle(g).opacity, g.textContent] : null; });
  check('…if the script never arrives, the gate says so after six seconds, in English and Spanish',
    [slow && Number(slow[0]) > 0.9, slow && /Still loading/.test(slow[1]) && /Sigue cargando/.test(slow[1])], [true, true]);
  await ctx.close();
}
{
  // A page of one build meeting a script of another: one reload, then it carries on and says so.
  const { ctx, page, errs, loads } = await boot('', { html: PAGE.replace(/data-build="[^"]+"/, 'data-build="T2.31"') });
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => [sessionStorage.getItem('dbtc_buildfix'), PAGE_BUILD, buildWarnings().filter((w) => /different builds/.test(w)).length]);
  check('…a page and a script of different builds: loads once more, fresh, then carries on and Diagnostics says so',
    [loads.length, s[0], s[1], s[2]], [2, 'T2.31>T2.32', 'T2.31', 1]);
  check('…the only error is the one that stopped the first load', errs.map((e) => /different builds/.test(e)), [true]);
  await ctx.close();
}

// ---- D13: the policy, switched ON, breaks nothing the app does itself ----
{
  const { ctx, page, errs, cspConsole } = await boot("window.__MOCK_ROLE='ops';", { headers: { 'content-security-policy': POLICY } });
  await page.locator('#clockIn').click(); await page.waitForTimeout(400);
  await page.locator('.coderow').first().click(); await page.waitForTimeout(600);
  await shoot(page); await settle(page);
  for (const t of ['jobs', 'log', 'co', 'people', 'diag', 'job']) { await page.evaluate((t) => setTab(t), t); await page.waitForTimeout(500); }
  check('D13: with the policy enforced, a clock-in with its photo and every tab draw with nothing blocked',
    [await page.evaluate(() => !!S.open), await page.evaluate(() => cspSeen.map((x) => x.k)), cspConsole], [true, [], []]);
  check('no page errors (policy enforced)', errs, []);
  await ctx.close();
}
{
  // Report-only: nothing is blocked, and what WOULD be is kept — the site only, never the address.
  const { ctx, page, errs } = await boot('', { headers: { 'content-security-policy-report-only': POLICY } });
  await page.evaluate(() => { localStorage.removeItem('dbtc_csp'); cspSeen.length = 0; });
  await page.evaluate(() => { const i = new Image(); i.src = 'http://example.invalid/roof.png?token=SECRET123'; document.body.appendChild(i); });
  await page.waitForTimeout(700);
  const kept = await page.evaluate(() => [cspSeen.map((x) => [x.k, x.n, x.how]), localStorage.getItem('dbtc_csp') || '']);
  check('…report-only: what it would block is kept, the rule and the site only — never the address or its token',
    [kept[0], /SECRET123|roof\.png/.test(kept[1])], [[['img-src http://example.invalid', 1, 'report']], false]);
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(900);
  const rows = await page.evaluate(() => [].map.call(document.querySelectorAll('#verTbl .trow'), (r) => [].map.call(r.children, (c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim()));
  const sec = rows.findIndex((r) => /^Security/.test(r));
  check('…Diagnostics says the policy is report-only and what it would block, under it',
    [rows[sec], /^img-src http:\/\/example\.invalid · 1× · \d+:\d\d[ap]$/.test(rows[sec + 1] || '')], ['Security report-only · 1 kind it would block', true]);
  const cut = await page.evaluate(() => { const n = [].filter.call(document.querySelectorAll('#verTbl .trow .nm'), (x) => x.textContent === 'Security')[0]; return n.scrollWidth > n.clientWidth; });
  check('…the Security label is not cut short', cut, false);
  check('no page errors (report-only)', errs, []);
  await ctx.close();
}
{
  // A page sent with no policy says so, rather than "nothing it would block".
  const { ctx, page } = await boot();
  await page.evaluate(() => setTab('diag')); await page.waitForTimeout(900);
  check('…a page sent with no policy says it was not sent', await page.evaluate(() => cspWords()), 'not sent · nothing it would block so far');
  await ctx.close();
}

// ---- I9: My jobs is drawn again only when it changed ----
{
  const { ctx, page, errs } = await boot();
  await page.evaluate(() => setTab('jobs')); await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelector('#jobsList .jcard').__mark = 1; const d = document.querySelector('#weekStrip .wday'); if (d) d.__mark = 1; });
  await page.evaluate(() => { for (let i = 0; i < 5; i++) render(); });
  check('I9: render() five times over the same jobs leaves the same cards and the same week strip in place',
    await page.evaluate(() => [document.querySelector('#jobsList .jcard').__mark === 1, (document.querySelector('#weekStrip .wday') || { __mark: 1 }).__mark === 1]), [true, true]);
  await page.evaluate(() => { S.assign.visits.forEach((v) => { v.cust = 'Okafor-Renamed'; }); render(); });
  check('…a change to the jobs draws it again, with the change in it',
    await page.evaluate(() => [document.querySelector('#jobsList .jcard').__mark === undefined, /Okafor-Renamed/.test(document.getElementById('jobsList').textContent)]), [true, true]);
  // A tap while the app keeps drawing: it lands.
  await page.evaluate(() => { window.__rr = setInterval(render, 25); });
  const pick = page.locator('#jobsList [data-pick], #jobsList [data-go]').first();
  const has = await pick.count();
  if (has) { await pick.click(); await page.waitForTimeout(300); }
  await page.evaluate(() => clearInterval(window.__rr));
  check('…a tap on a card while the app keeps drawing lands', has ? await page.evaluate(() => S.tab) : 'job', 'job');
  check('no page errors (I9)', errs, []);
  await ctx.close();
}

// ---- I6: one rule for every translation table ----
{
  const { ctx, page, errs } = await boot();
  const r = await page.evaluate(() => {
    const before = I18N_CLASH.length;
    esAdd({ 'Photo': 'Otra cosa' }); const a = [I18N_CLASH.slice(before), ES['Photo']];
    esAdd({ 'Photo': 'Foto' }); const b = I18N_CLASH.length - before;
    coAdd({ en: { tab: 'Something else' }, es: { tab: 'Otra' } }); const c = [I18N_CLASH.slice(before + 1), co('tab')];
    return [before, a, b, c, [CO_L10N.en.beforeSub, CO_L10N.es.beforeSub]];
  });
  check('I6: nothing clashes as the app loads', r[0], 0);
  check('…a key added again with different words is refused and named; the first words stay', r[1], [['ES Photo'], 'Foto']);
  check('…the same words again are harmless', r[2], 1);
  check('…Close Out\'s table follows the same rule', r[3], [['CO.en tab', 'CO.es tab'], 'Close Out']);
  check('…and the repair\'s before photo still reads as required, in both languages', r[4], ['Required — before you start', 'Obligatoria — antes de empezar']);
  check('no page errors (I6)', errs, []);
  await ctx.close();
}

// ---- D19: a centered column on a computer, the phone as it was ----
{
  const { ctx, page, errs } = await boot('', { size: [1280, 800] });
  const rect = (s) => page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; }, s);
  const body = await rect('body'), clock = await rect('#clockIn');
  await page.locator('#clockIn').click(); await page.waitForTimeout(400);
  check('D19: on a computer the app is a 640px column in the middle, its sheets too, nothing scrolls sideways',
    [body, clock[0] >= 320 && clock[0] + clock[1] <= 960, await rect('#sheet'), await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)],
    [[320, 640], true, [320, 640], 0]);
  check('no page errors (D19, computer)', errs, []);
  await ctx.close();
}
{
  const { ctx, page } = await boot();
  check('…and on a phone it is the phone layout, edge to edge', await page.evaluate(() => { const b = document.body.getBoundingClientRect(); return [b.left, b.width]; }), [0, 402]);
  await ctx.close();
}

// ---- I5 with a real service worker: the pair opens with no signal, and a new build after it ----
// Its own server over a copy of public/, with a config.js (git-ignored, so the
// usual server has none and the worker's precache would refuse to install).
{
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dbcrew-t232-'));
  cpSync(new URL('../public/', import.meta.url), dir, { recursive: true });
  writeFileSync(path.join(dir, 'config.js'), "window.DBTC_CONFIG = window.DBTC_CONFIG || { apiUrl: '', clientId: '' };");
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
    try { const body = readFileSync(path.join(dir, p)); res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.addInitScript(mock);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  const cached = await page.evaluate(async () => {
    const c = await caches.open((await caches.keys()).find((k) => /^dbtc-/.test(k)) || 'none');
    return [(await caches.keys()), !!(await c.match('./app.js?b=' + PAGE_BUILD)), !!(await c.match('./index.html'))];
  });
  check('I5 + worker: installed, it keeps the page and its script under the build\'s own cache',
    [cached[0], cached[1], cached[2]], [['dbtc-t2-32'], true, true]);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(1500);
  check('…with no signal the app opens from the saved pair, page and script one build',
    await page.evaluate(() => [typeof APP_BUILD === 'string' ? APP_BUILD.split(' ')[0] : null, typeof PAGE_BUILD === 'string' ? PAGE_BUILD : null, !document.getElementById('gateSlow')]),
    ['T2.32', 'T2.32', true]);
  // A new build is deployed: the page, its script and the worker all say T2.99.
  await ctx.setOffline(false);
  const bump = (f, a, b) => { const q = path.join(dir, f); writeFileSync(q, readFileSync(q, 'utf8').replace(a, b)); };
  bump('index.html', 'data-build="T2.32"', 'data-build="T2.99"'); bump('index.html', 'app.js?b=T2.32', 'app.js?b=T2.99');
  bump('app.js', "var APP_BUILD = 'T2.32 (2026-10-30)';", "var APP_BUILD = 'T2.99 (2026-10-30)';"); bump('sw.js', "var BUILD = 'T2.32';", "var BUILD = 'T2.99';");
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(async () => (await caches.keys()).includes('dbtc-t2-99'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);   // the new worker takes over, and the page reloads itself once
  check('…a new build online: its page and script arrive together, and the new worker keeps them',
    await page.evaluate(async () => [APP_BUILD.split(' ')[0], PAGE_BUILD, (await caches.keys()).join(',')]), ['T2.99', 'T2.99', 'dbtc-t2-99']);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(1500);
  check('…and then with no signal it opens as the new build, page and script together',
    await page.evaluate(() => [typeof APP_BUILD === 'string' ? APP_BUILD.split(' ')[0] : null, typeof PAGE_BUILD === 'string' ? PAGE_BUILD : null]), ['T2.99', 'T2.99']);
  check('no page errors (worker)', errs, []);
  await ctx.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}

await browser.close();
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got  ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
