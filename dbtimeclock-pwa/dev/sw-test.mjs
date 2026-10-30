/* T2.30 (30 Oct 2026): the service worker's page rules, in Node with a fake
 * network and a fake cache. Nothing here ships.
 *
 *   node dev/sw-test.mjs
 *
 * A launch waits for the network NAV_WAIT_MS (3s), then opens the saved copy;
 * the late answer still refreshes the copy. Only a good answer is saved — an
 * error page or a hotspot's sign-in page never replaces the app.
 *
 * T2.32: the page's script is its own file, app.js?b=<build>. A fresh page is
 * saved only together with the script it names, so a page whose script never
 * arrived can never be the copy that opens with no signal. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ORIGIN = 'https://db-crews.web.app';
const BUILD = (/var BUILD = '([^']+)'/.exec(src) || [])[1];
const page = (b) => `<!DOCTYPE html><html data-build="${b}"><body><script src="app.js?b=${b}"></script></body></html>`;
const JS = (b) => `${ORIGIN}/app.js?b=${b}`;

// A worker with a cache that may hold the app (its page and its script), and
// a network that answers the page with `status` after `delay` ms ('fail' for
// no signal at all), naming the script of build `names`; the script itself
// answers `jsStatus`.
function worker({ delay = 0, status = 200, cached = true, type = 'basic', names = BUILD, html, jsStatus = 200 }) {
  const listeners = {}, store = new Map(), fetched = [];
  if (cached) { store.set('./index.html', { tag: 'saved copy' }); store.set(JS(BUILD), { tag: 'saved script' }); }
  const key = (k) => (typeof k === 'string' ? k : k.url);
  const caches = {
    open: async () => ({ put: async (k, v) => { store.set(key(k), v); }, match: async (k) => store.get(key(k)), addAll: async () => {} }),
    match: async (k) => store.get(key(k)) || undefined,
    keys: async () => [], delete: async () => true,
  };
  const answer = (tag, ok, st, body, ty = 'basic') => {
    const r = { tag, ok, status: st, type: ty, text: async () => body };
    r.clone = () => answer('saved ' + tag, ok, st, body, ty);
    return r;
  };
  const fetch = (req) => new Promise((res, rej) => {
    const url = key(req); fetched.push(url);
    if (/\/app\.js\?b=/.test(url)) {
      return setTimeout(() => jsStatus === 'fail' ? rej(new TypeError('Failed to fetch')) : res(answer('script ' + jsStatus, jsStatus >= 200 && jsStatus < 300, jsStatus, 'app')), 10);
    }
    setTimeout(() => {
      if (status === 'fail') return rej(new TypeError('Failed to fetch'));
      res(answer('network ' + status, status >= 200 && status < 300, status, html != null ? html : page(names), type));
    }, delay);
  });
  const self = { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: ORIGIN, href: ORIGIN + '/sw.js' }, skipWaiting() {}, clients: { claim() {} }, registration: {} };
  const ctx = vm.createContext({ self, caches, fetch, URL, setTimeout, clearTimeout, Promise, console });
  vm.runInContext(src, ctx);
  return { listeners, store, fetched, ctx };
}
async function visit(w, url = ORIGIN + '/', mode = 'navigate') {
  let answer; const t0 = Date.now();
  w.listeners.fetch({ request: { method: 'GET', url, mode }, respondWith(p) { answer = p; }, waitUntil() {} });
  const res = await answer;
  return { tag: res && res.tag, ms: Date.now() - t0 };
}

{
  const w = worker({ delay: 5000 });
  const r = await visit(w);
  check('weak signal: the saved copy opens after about three seconds', [r.tag, r.ms >= 2900 && r.ms < 3600], ['saved copy', true]);
  await sleep(2300);
  check('…and the late answer refreshes the copy for next time', w.store.get('./index.html').tag, 'saved network 200');
}
{
  const w = worker({ delay: 100 });
  const r = await visit(w);
  await sleep(50);
  check('good signal: the network\'s page, saved', [r.tag, w.store.get('./index.html').tag], ['network 200', 'saved network 200']);
}
{
  const w = worker({ delay: 100, status: 500 });
  const r = await visit(w);
  await sleep(50);
  check('an error page opens the saved app instead, and is never saved', [r.tag, w.store.get('./index.html').tag], ['saved copy', 'saved copy']);
}
{
  const w = worker({ delay: 100, type: 'opaqueredirect', status: 0 });
  const r = await visit(w);
  await sleep(50);
  check('a hotspot\'s redirect is not the app either', [r.tag, w.store.get('./index.html').tag], ['saved copy', 'saved copy']);
}
{
  const w = worker({ delay: 50, status: 'fail' });
  check('no signal: the saved copy at once', (await visit(w)).tag, 'saved copy');
}
{
  const w = worker({ delay: 3800, cached: false });
  const r = await visit(w);
  check('nothing saved yet: it waits for the network however long', [r.tag, r.ms >= 3700], ['network 200', true]);
}
{
  const w = worker({ delay: 20, status: 404, cached: false });
  const r = await visit(w, ORIGIN + '/fonts/missing.woff2', 'same-origin');
  await sleep(50);
  check('a file that is not there is not saved', [r.tag, w.store.has(ORIGIN + '/fonts/missing.woff2')], ['network 404', false]);
}

// ---- T2.32: the page and its script, saved as a pair ----
{
  const w = worker({});
  check('install saves the page with its own script (' + BUILD + ')', [BUILD, w.ctx.SHELL.includes('./app.js?b=' + BUILD), w.ctx.CACHE],
    [BUILD, true, 'dbtc-' + BUILD.toLowerCase().replace(/\./g, '-')]);
}
{
  const w = worker({ delay: 50 });
  await visit(w); await sleep(80);
  check('a fresh page of the same build: saved at once, the script it names already beside it',
    [w.store.get('./index.html').tag, w.fetched.filter((u) => /app\.js/.test(u)).length], ['saved network 200', 0]);
}
{
  const w = worker({ delay: 50, names: 'T9.99' });
  await visit(w); await sleep(120);
  check('a fresh page of a NEW build: its script is fetched and saved first, then the page',
    [w.store.get(JS('T9.99')) && w.store.get(JS('T9.99')).tag, w.store.get('./index.html').tag], ['script 200', 'saved network 200']);
}
{
  const w = worker({ delay: 50, names: 'T9.99', jsStatus: 'fail' });
  const r = await visit(w); await sleep(120);
  check('a fresh page whose script cannot be fetched opens, but is never saved: the last good pair stays',
    [r.tag, w.store.get('./index.html').tag, w.store.has(JS('T9.99')), w.store.get(JS(BUILD)).tag], ['network 200', 'saved copy', false, 'saved script']);
}
{
  const w = worker({ delay: 50, names: 'T9.99', jsStatus: 404 });
  await visit(w); await sleep(120);
  check('…nor when the script answers with an error', [w.store.get('./index.html').tag, w.store.has(JS('T9.99'))], ['saved copy', false]);
}
{
  const w = worker({ delay: 50, html: '<!DOCTYPE html><html><body><script>/* one file */</script></body></html>' });
  await visit(w); await sleep(80);
  check('a page that names no script file is saved as it always was', w.store.get('./index.html').tag, 'saved network 200');
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
