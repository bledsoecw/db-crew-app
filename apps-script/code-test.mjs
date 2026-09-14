/* getMyJobs against a stubbed Apps Script runtime.
 *
 *   node apps-script/code-test.mjs
 *
 * No dependencies and no network: Code.gs is evaluated in a vm context with
 * just enough of PropertiesService / CacheService / UrlFetchApp / Utilities to
 * run the assigned-jobs path, and the board's HTTP answer is whatever the test
 * says it is.
 *
 * The point is the failure paths. getMyJobs must never throw for a board
 * problem — the clock is payroll and cannot be blocked by a second system being
 * down, unconfigured, or answering 307 because the sign-in matcher is wrong.
 * Those states are hard to produce by hand and easy to regress. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

// Minimal Apps Script stubs — enough to run the assigned-jobs path.
let props = {}, cacheStore = {}, fetched = [];
let fetchImpl = () => ({ code: 200, body: '{"crew":null,"visits":[]}' });
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k,v)=>{props[k]=v;} }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k,v)=>{cacheStore[k]=v;} }) },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  Utilities: {
    formatDate: (d, tz, fmt) => new Date(d.getTime() - 4*3600*1000).toISOString().slice(0,10),
    base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url'),
    computeDigest: (_a, s) => Buffer.from(String(s)),
    DigestAlgorithm: { SHA_256: 1 },
    sleep: () => {},
  },
  UrlFetchApp: { fetch: (url, opts) => { fetched.push({url, opts}); const r = fetchImpl(url, opts);
    return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const ME = { email:'t@deitemeyerbrothers.com', name:'Tyler B.', userId:'u1', membershipId:'m1', role:'Crew' };
let pass=0, fail=0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'PASS  ':'FAIL  ')+name + (ok?'':`\n      got ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`));
  ok?pass++:fail++;
};

const today = sandbox.isoDay_(new Date());
console.log('script "today" =', today, '\n');

// ---- addDays_ ----
t('addDays_ forward',  sandbox.addDays_('2026-09-14', 13), '2026-09-27');
t('addDays_ backward', sandbox.addDays_('2026-09-14', -30), '2026-08-15');
t('addDays_ across month', sandbox.addDays_('2026-08-31', 1), '2026-09-01');
t('addDays_ across DST (US fall back Nov 1 2026)', sandbox.addDays_('2026-10-31', 2), '2026-11-02');

// ---- not configured -> fallback, no fetch ----
props = {}; cacheStore = {}; fetched = [];
sandbox.getJobOptions = () => [{ id:'j1', name:'x', number:'1' }];
let r = sandbox.getMyJobs(ME);
t('unconfigured -> fallback', [r.source, r.reason, r.jobs.length], ['fallback','not-configured',1]);
t('unconfigured -> board never called', fetched.length, 0);

// ---- no membership ----
r = sandbox.getMyJobs({ ...ME, membershipId:'' });
t('no membership -> reason', [r.source, r.reason], ['fallback','no-membership']);

// ---- configured, board 200 with visits ----
props = { BOARD_API_URL:'https://ops.example.com/', CREW_APP_SECRET:'s3cret' };
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code:200, body: JSON.stringify({
  crew:{ id:'c1', name:'Alberto', leadMembershipId:'m1' },
  visits:[
    { taskId:'t2', jobId:'j2', jobNum:'26-1045', start: sandbox.addDays_(today,3), end: sandbox.addDays_(today,3), days:1 },
    { taskId:'t1', jobId:'j1', jobNum:'26-0890', start: sandbox.addDays_(today,-1), end: sandbox.addDays_(today,1), days:3, crewNote:'gate 1412', material:{text:'Material ordered ✓',cls:'good'} }
  ] }) });
r = sandbox.getMyJobs(ME);
t('board -> source', [r.source, r.crew.name, r.visits.length], ['board','Alberto',2]);
t('board -> sorted by start', r.visits.map(v=>v.taskId), ['t1','t2']);
t('board -> day n of m on the running visit', [r.visits[0].dayOf, r.visits[0].days, r.visits[0].today], [2,3,true]);
t('board -> future visit has no dayOf', [r.visits[1].dayOf, r.visits[1].today], [null,false]);
t('board -> trailing slash stripped from URL', fetched[0].url.indexOf('https://ops.example.com/api/crew/assignments?'), 0);
t('board -> bearer header', fetched[0].opts.headers.Authorization, 'Bearer s3cret');
t('board -> does not follow redirects', fetched[0].opts.followRedirects, false);

// ---- cache: second call does not refetch ----
const before = fetched.length;
sandbox.getMyJobs(ME);
t('success is cached', fetched.length, before);

// ---- failures are NOT cached (so refresh works) ----
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code:502, body:'{"error":"boom"}' });
r = sandbox.getMyJobs(ME);
t('502 -> fallback', [r.source, r.reason], ['fallback','board-http-502']);
const afterFail = fetched.length;
sandbox.getMyJobs(ME);
t('failure is NOT cached (refresh can retry)', fetched.length > afterFail, true);

// ---- 307 sign-in bounce is reported distinctly ----
cacheStore = {}; fetchImpl = () => ({ code:307, body:'' });
r = sandbox.getMyJobs(ME);
t('307 -> proxy matcher reason', r.reason, 'board-signin-bounce');

// ---- network throw ----
cacheStore = {}; fetchImpl = () => { throw new Error('dns'); };
r = sandbox.getMyJobs(ME);
t('throw -> unreachable, never propagates', r.reason, 'board-unreachable');

// ---- range clamping ----
cacheStore = {}; fetchImpl = () => ({ code:200, body:'{"crew":null,"visits":[]}' });
r = sandbox.getMyJobs(ME, '2000-01-01', '2099-01-01');
const span = (new Date(r.range.to) - new Date(r.range.from)) / 86400000;
t('absurd range clamped to 60 days', span, 60);
t('backdate floored to 30 days', r.range.from, sandbox.addDays_(today,-30));
r = sandbox.getMyJobs(ME, 'nonsense', 'also-nonsense');
t('garbage dates -> default window', [r.range.from, r.range.to], [today, sandbox.addDays_(today,13)]);
r = sandbox.getMyJobs(ME, sandbox.addDays_(today,5), sandbox.addDays_(today,1));
t('to before from -> collapses, no negative span', r.range.from === r.range.to, true);

// ---- crew resolves but nothing booked ----
cacheStore = {};
fetchImpl = () => ({ code:200, body:'{"crew":{"id":"c1","name":"Alberto"},"visits":[]}' });
r = sandbox.getMyJobs(ME);
t('empty schedule still offers recent jobs', [r.source, r.crew.name, r.visits.length, r.jobs.length], ['board','Alberto',0,1]);

// ---- getJobOptions throwing must not break the tab ----
cacheStore = {}; props = {};
sandbox.getJobOptions = () => { throw new Error('pave down'); };
r = sandbox.getMyJobs(ME);
t('fallback survives getJobOptions throwing', [r.source, r.jobs.length], ['fallback',0]);

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
