/* Exercises the push-registration paths without a real Firebase project.
 * Stubs Notification, the service worker registration and the Firebase compat
 * SDK, then checks each branch of enablePush() plus the #TE: description tag
 * the server-side sweep matches on.
 *
 *   node dev/push-test.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const APP_URL = process.env.PREVIEW_URL || 'http://localhost:8100/';
const mock = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
}

/** Boot the app with push config injected and the browser push stack faked. */
async function boot({ permission = 'granted', ios = false, installed = false, configured = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    permissions: ['camera'],
    ...(ios ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' } : {}),
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'warning' && m.type() !== 'error') return;
    // The sandbox has no CA for accounts.google.com; that's the environment,
    // not the app.
    if (/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) return;
    errs.push(m.type() + ': ' + m.text());
  });
  await page.addInitScript('window.__MOCK_FOREMAN=false;window.__MOCK_READONLY=false;');
  await page.addInitScript(mock);
  await page.addInitScript(`
    window.__pushCalls = [];
    ${configured ? `
      window.DBTC_CONFIG.firebase = { apiKey:'k', projectId:'p', messagingSenderId:'s', appId:'a' };
      window.DBTC_CONFIG.vapidKey = 'vapid-public-key';
    ` : ''}
    // Fake the browser push stack.
    window.Notification = function(){};
    window.Notification.permission = ${JSON.stringify(permission)};
    window.Notification.requestPermission = function(){ return Promise.resolve(${JSON.stringify(permission)}); };
    window.PushManager = function(){};
    ${installed ? `Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });` : ''}
    ${ios && !installed ? `
      // iOS in a browser tab: no Notification / PushManager at all.
      delete window.Notification; delete window.PushManager;
    ` : ''}
    // Fake the Firebase compat SDK so no network is needed.
    window.__fbTokenArgs = null;
    Object.defineProperty(window, 'firebase', {
      value: {
        apps: [],
        initializeApp: function(c){ window.firebase.apps.push(c); },
        messaging: function(){
          return { getToken: function(o){ window.__fbTokenArgs = o; return Promise.resolve('FAKE-FCM-TOKEN'); } };
        }
      },
      writable: true, configurable: true
    });
  `);
  // The SDK <script> tags must resolve without hitting gstatic.
  await page.route((u) => u.hostname.endsWith('gstatic.com'),
    (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' }));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Record every registerPushToken call the app makes.
  await page.evaluate(() => {
    const real = window.apiCall;
    window.apiCall = function (fn, args) {
      if (fn === 'registerPushToken' || fn === 'markNudged') window.__pushCalls.push({ fn, args });
      return real(fn, args);
    };
  });
  return { ctx, page, errs };
}

const clockIn = async (page) => {
  await page.locator('#clockIn').click();
  await page.locator('.coderow:has-text("Masonry Labor")').first().click();
  await page.waitForTimeout(900);
};

// 1. Happy path: configured, permission granted -> token registered.
{
  const { ctx, page, errs } = await boot();
  await clockIn(page);
  await page.waitForTimeout(600);
  const calls = await page.evaluate(() => window.__pushCalls);
  const vapid = await page.evaluate(() => window.__fbTokenArgs && window.__fbTokenArgs.vapidKey);
  const state = await page.evaluate(() => window.pushState);
  check('granted -> registerPushToken called with the FCM token',
    calls.filter((c) => c.fn === 'registerPushToken').map((c) => c.args[0]), ['FAKE-FCM-TOKEN']);
  check('granted -> vapidKey passed to getToken', vapid, 'vapid-public-key');
  check('granted -> pushState on', state, 'on');
  check('granted -> no page errors', errs, []);
  await ctx.close();
}

// 2. Permission denied: no registration, no throw.
{
  const { ctx, page, errs } = await boot({ permission: 'denied' });
  await clockIn(page);
  await page.waitForTimeout(500);
  const calls = await page.evaluate(() => window.__pushCalls.filter((c) => c.fn === 'registerPushToken'));
  check('denied -> nothing registered', calls, []);
  check('denied -> pushState off', await page.evaluate(() => window.pushState), 'off');
  check('denied -> no page errors', errs, []);
  await ctx.close();
}

// 3. Not configured: the app must still work, silently.
{
  const { ctx, page, errs } = await boot({ configured: false });
  await clockIn(page);
  await page.waitForTimeout(500);
  check('unconfigured -> nothing registered',
    await page.evaluate(() => window.__pushCalls.filter((c) => c.fn === 'registerPushToken')), []);
  check('unconfigured -> pushState off', await page.evaluate(() => window.pushState), 'off');
  check('unconfigured -> no page errors', errs, []);
  await ctx.close();
}

// 4. iPhone in a Safari tab: must report needs-install rather than failing mute.
{
  const { ctx, page, errs } = await boot({ ios: true, installed: false });
  await clockIn(page);
  await page.waitForTimeout(500);
  check('ios tab -> pushState needs-install', await page.evaluate(() => window.pushState), 'needs-install');
  check('ios tab -> no page errors', errs, []);
  await ctx.close();
}

// 5. The description tag the server sweep greps for.
{
  const { ctx, page } = await boot();
  await clockIn(page);
  const desc = await page.evaluate(() =>
    window.fileDescription({ tag: 'before', entryId: 'open1', codeLabel: '04MA Masonry Labor' }));
  check('description carries #BEFORE and #TE:<entryId>', desc, '#BEFORE #TE:open1 04MA Masonry Labor');
  const re = /#TE:([A-Za-z0-9]+)/.exec(desc);
  check('server-side regex extracts the entry id', re && re[1], 'open1');
  await ctx.close();
}

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}` + (r.pass ? '' : `\n      got ${JSON.stringify(r.actual)} want ${JSON.stringify(r.expected)}`));
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
