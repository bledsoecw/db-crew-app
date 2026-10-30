/* T2.30 (30 Oct 2026): the service worker's page rules, in Node with a fake
 * network and a fake cache. Nothing here ships.
 *
 *   node dev/sw-test.mjs
 *
 * A launch waits for the network NAV_WAIT_MS (3s), then opens the saved copy;
 * the late answer still refreshes the copy. Only a good answer is saved — an
 * error page or a hotspot's sign-in page never replaces the app. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const results = [];
const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A worker with a cache that may hold the app, and a network that answers
// `status` after `delay` ms ('fail' for no signal at all).
function worker({ delay = 0, status = 200, cached = true, type = 'basic' }) {
  const listeners = {}, store = new Map();
  if (cached) store.set('./index.html', { tag: 'saved copy' });
  const caches = {
    open: async () => ({ put: async (k, v) => { store.set(typeof k === 'string' ? k : k.url, v); }, addAll: async () => {} }),
    match: async (k) => store.get(typeof k === 'string' ? k : k.url) || undefined,
    keys: async () => [], delete: async () => true,
  };
  const fetch = () => new Promise((res, rej) => setTimeout(() => {
    if (status === 'fail') return rej(new TypeError('Failed to fetch'));
    res({ tag: 'network ' + status, ok: status >= 200 && status < 300, status, type, clone() { return { tag: 'saved network ' + status }; } });
  }, delay));
  const self = { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://db-crews.web.app' }, skipWaiting() {}, clients: { claim() {} }, registration: {} };
  const ctx = vm.createContext({ self, caches, fetch, URL, setTimeout, clearTimeout, Promise, console });
  vm.runInContext(src, ctx);
  return { listeners, store };
}
async function visit(w, url = 'https://db-crews.web.app/', mode = 'navigate') {
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
  const r = await visit(w, 'https://db-crews.web.app/fonts/missing.woff2', 'same-origin');
  await sleep(50);
  check('a file that is not there is not saved', [r.tag, w.store.has('https://db-crews.web.app/fonts/missing.woff2')], ['network 404', false]);
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? '  ok  ' : ' FAIL ') + r.name + (r.pass ? '' : '\n        got ' + JSON.stringify(r.actual) + '\n        want ' + JSON.stringify(r.expected)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
