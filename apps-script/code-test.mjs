/* getMyJobs and saveSiteChecks against a stubbed Apps Script runtime.
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
let props = {}, cacheStore = {}, fetched = [], trips = 0;
let fetchImpl = () => ({ code: 200, body: '{"crew":null,"visits":[]}' });
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k,v)=>{props[k]=v;},
    getProperties: () => ({ ...props }), deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k,v)=>{cacheStore[k]=v;}, remove: k => { delete cacheStore[k]; } }) },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      if (fmt === 'H') return String(sandbox.__hour != null ? sandbox.__hour : new Date(d.getTime() - 4*3600*1000).getUTCHours());
      if (fmt === 'EEE MMM d') { const x = new Date(d); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.getUTCDay()] + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getUTCMonth()] + ' ' + x.getUTCDate(); }
      return new Date(d.getTime() - 4*3600*1000).toISOString().slice(0,10);
    },
    computeRsaSha256Signature: () => Buffer.from('sig'),
    base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url'),
    computeDigest: (_a, s) => Buffer.from(String(s)),
    DigestAlgorithm: { SHA_256: 1 },
    sleep: () => {},
  },
  UrlFetchApp: { fetch: (url, opts) => { fetched.push({url, opts}); const r = fetchImpl(url, opts);
    return { getResponseCode: () => r.code, getContentText: () => r.body }; },
    // One round trip for several requests, the way Apps Script offers it.
    fetchAll: (reqs) => { trips++; return reqs.map(r => sandbox.UrlFetchApp.fetch(r.url, r)); } },
  ContentService: { createTextOutput: (txt) => ({ setMimeType() { return this; }, getContent: () => txt }), MimeType: { JSON: 'application/json' } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create: () => {} }), everyMinutes: () => ({ create: () => {} }) }) }) },
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
// Yesterday, not today: the morning-after nudge needs the roof that ended
// yesterday and was never signed off, and it needs the data to say so.
t('garbage dates -> default window, from yesterday', [r.range.from, r.range.to], [sandbox.addDays_(today,-1), sandbox.addDays_(today,13)]);
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

// ---- memberFor_ must ask for a field JobTread actually has ----
// This is the regression test for the bug that made every sign-in fail: the
// lookup filtered on ['user','email'], which does not exist, so Pave rejected
// the whole query and memberFor_'s catch turned that into "No JobTread user is
// linked to you". The stub can't know JobTread's schema, so assert the field
// name in the query that actually goes out.
props = {}; cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 200, body: JSON.stringify({
  organization: { memberships: { nodes: [
    { id: 'm1', role: { name: 'Crew' }, user: { id: 'u1', name: 'Tyler B.' } }
  ] } } }) });
const me = sandbox.memberFor_('tyler.b@deitemeyerbrothers.com');
const sentWhere = JSON.parse(fetched[0].opts.payload).query
  .organization.memberships.$.where;
t('memberFor_ filters on user.emailAddress, not user.email', sentWhere[0], ['user', 'emailAddress']);
t('memberFor_ returns the resolved member', [me.userId, me.membershipId, me.name], ['u1', 'm1', 'Tyler B.']);

// ---- a slow board must not be allowed to queue the clock behind it ----
// UrlFetchApp has no timeout and Apps Script serialises executions per user,
// so an overrunning board call stalls getBoot too. One slow answer trips a
// breaker; the next calls skip the board instead of waiting again.
//
// The vm context has its own Date intrinsic, so the clock has to be installed
// inside it — patching the host's Date.now is invisible to Code.gs.
vm.runInContext(
  'globalThis.__realNow = Date.now;' +
  'Date.now = function(){ return globalThis.__now != null ? globalThis.__now : globalThis.__realNow(); };',
  sandbox);
const clearResponseCache = () =>
  Object.keys(cacheStore).filter(k => k.startsWith('mj_')).forEach(k => delete cacheStore[k]);

props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' };
cacheStore = {}; fetched = [];
sandbox.getJobOptions = () => [{ id: 'j1', name: 'x', number: '1' }];
sandbox.__now = 1000;
fetchImpl = () => { sandbox.__now += 9000; return { code: 200, body: '{"crew":null,"visits":[]}' }; };

const slow = sandbox.getMyJobs(ME);
t('a slow call still returns its answer', [slow.source, slow.boardMs], ['board', 9000]);
t('and trips the breaker', typeof cacheStore['board_slow'], 'string');

clearResponseCache();
const callsBefore = fetched.length;
const next = sandbox.getMyJobs(ME);
t('the next call skips the board entirely', fetched.length, callsBefore);
t('and says why, over the fallback list', [next.source, next.reason, next.jobs.length], ['fallback', 'board-slow', 1]);

// a quick board leaves the breaker alone
cacheStore = {}; fetched = [];
fetchImpl = () => { sandbox.__now += 300; return { code: 200, body: '{"crew":null,"visits":[]}' }; };
const fast = sandbox.getMyJobs(ME);
t('a fast call does not trip it', [fast.boardMs, cacheStore['board_slow']], [300, undefined]);
sandbox.__now = null;

// ---- the code list is pages of Pave, so it is cached ----
// A real job carries 294 Labor cost items, which is three full pages to find
// the ten that are actually budget lines. Budgets change on the office's
// timescale, so the second ask inside the window must cost nothing.
props = {}; cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 200, body: JSON.stringify({
  job: { costItems: { nextPage: null, nodes: [
    { id: 'ci1', name: 'Crew Labor', costCode: { number: '01GR', name: 'General Requirements' } },
    { id: 'ci2', name: 'Copy on an estimate', document: { id: 'd1' }, costCode: { number: '01GR' } }
  ] } } }) });
t('getJobCodes drops the per-document copies', sandbox.getJobCodes('j1').map(c => c.id), ['ci1']);
const afterFirst = fetched.length;
t('a second ask is served from cache', [sandbox.getJobCodes('j1').map(c => c.id), fetched.length], [['ci1'], afterFirst]);
t('a different job is not', [sandbox.getJobCodes('j2').length, fetched.length > afterFirst], [1, true]);

// A router for the stubbed fetch: by URL, then by the shape of the Pave query.
// The org's daily-log custom fields as JobTread returned them on 2026-09-15.
const LOG_FIELDS = [
  { id: '22PC7jNSGzEb', name: 'Material Pickups / Deliveries', type: 'boolean', options: null, minValuesRequired: 0, maxValuesAllowed: 1, position: 'n' },
  { id: '22PC7jNshbiK', name: 'Trades Onsite', type: 'option', options: ['Carpentry', 'Concrete', 'Electrical', 'Engineering', 'Excavation', 'Foundation', 'Framing', 'HVAC', 'Masonry', 'Mechanical', 'Painting', 'Plumbing', 'Roofing', 'Tile', 'Other', 'Production Manager', 'Site Manager', 'Sales Rep'], minValuesRequired: 0, maxValuesAllowed: null, position: 't' },
  { id: '22PC7jPsepri', name: 'Unplanned Tasks', type: 'text', options: null, minValuesRequired: 0, maxValuesAllowed: 1, position: 'w' },
  { id: '22PC7jQ6BkBC', name: 'Anticipated Delays', type: 'boolean', options: null, minValuesRequired: 0, maxValuesAllowed: 1, position: 'y' },
  { id: '22PLhdEgfHXF', name: 'Delay Reason', type: 'option', options: ['Weather', 'Short Labor', 'Short Material', 'Other'], minValuesRequired: 0, maxValuesAllowed: null, position: 'yab' },
  { id: '22PLhcfDaJ7r', name: 'Safety Incidents', type: 'text', options: null, minValuesRequired: 0, maxValuesAllowed: 1, position: 'yb' },
  { id: '22PLbmgVwteK', name: 'Internal Notes', type: 'text', options: null, minValuesRequired: 0, maxValuesAllowed: 1, position: 'z' }
];
const paveOf = (opts) => { try { return JSON.parse(opts.payload).query; } catch { return null; } };
function route(handlers) {
  return (url, opts) => {
    if (url.indexOf('/api/crew/assignments') > -1) return handlers.board(url, opts);
    if (url.indexOf('oauth2.googleapis.com/tokeninfo') > -1) return { code: 200, body: JSON.stringify({ aud: 'cid', email_verified: 'true', email: 't@deitemeyerbrothers.com', exp: Math.floor(Date.now() / 1000) + 3600 }) };
    if (url.indexOf('oauth2.googleapis.com/token') > -1) return { code: 200, body: '{"access_token":"at","expires_in":3600}' };
    if (url.indexOf('fcm.googleapis.com') > -1) { pushes.push(JSON.parse(opts.payload).message); return handlers.fcm ? handlers.fcm() : { code: 200, body: '{}' }; }
    const q = paveOf(opts) || {};
    if (q.organization && q.organization.tasks) return handlers.tasks ? handlers.tasks(q) : { code: 200, body: '{"organization":{"tasks":{"nodes":[]}}}' };
    if (q.organization && q.organization.jobs && q.organization.jobs.nodes && q.organization.jobs.nodes.customFieldValues) return handlers.people ? handlers.people(q) : { code: 200, body: '{"organization":{"jobs":{"nodes":[]}}}' };
    if (q.organization && q.organization.memberships) return handlers.member ? handlers.member(q) : { code: 200, body: '{"organization":{"memberships":{"nodes":[]}}}' };
    if (q.createDailyLog) return handlers.dailyLog ? handlers.dailyLog(q) : { code: 200, body: '{"createDailyLog":{"createdDailyLog":{"id":"dl1"}}}' };
    if (q.createComment) return handlers.comment ? handlers.comment(q) : { code: 200, body: '{"createComment":{"createdComment":{"id":"c1","createdAt":"2026-09-15T20:00:00Z"}}}' };
    if (q.job && q.job.costItems) return handlers.codes ? handlers.codes(q) : { code: 200, body: '{"job":{"costItems":{"nextPage":null,"nodes":[]}}}' };
    if (q.organization && q.organization.customFields) return handlers.fields ? handlers.fields(q) : { code: 200, body: JSON.stringify({ organization: { customFields: { nodes: LOG_FIELDS } } }) };
    if (q.organization && q.organization.jobs) return handlers.jobs ? handlers.jobs(q) : { code: 200, body: '{"organization":{"jobs":{"nodes":[]}}}' };
    if (q.createTimeEntry) return { code: 200, body: '{"createTimeEntry":{"createdTimeEntry":{"id":"te_new"}}}' };
    if (q.updateTimeEntry) return { code: 200, body: '{"updateTimeEntry":{}}' };
    if (q.organization && q.organization.timeEntries) return handlers.entries ? handlers.entries(q) : { code: 200, body: '{"organization":{"timeEntries":{"nodes":[]}}}' };
    return { code: 200, body: '{}' };
  };
}
let pushes = [];

// ---- boot: the clock first, everything else after — and together ----
// Collapsing all of boot into one call fixed the queueing and created a worse
// problem — seven-plus sequential Pave round trips in a single execution, which
// overran the client's 25-second ceiling and failed boot outright. Two rules
// came out of it. getStart stays down to what the first screen cannot be drawn
// without; the code list, the job picker and the crew block are behind a tap,
// so they belong in getExtras, after the app is usable. And questions that do
// not depend on each other go out in ONE round trip (paveAll_ on fetchAll): a
// round trip from Apps Script costs seconds, and the phone's ceiling is fixed.
const kindOf = (f) => {
  const q = paveOf(f.opts) || {}, o = q.organization || {};
  if (q.job) return 'codes';
  if (o.customFields) return 'fields';
  if (o.jobs) return o.jobs.nodes && o.jobs.nodes.customFieldValues ? 'people' : 'job';
  if (o.timeEntries) {
    const a = o.timeEntries.$;
    return a.size === 1 ? 'open' : a.where[0] === 'endedAt' ? 'crew' : o.timeEntries.nodes.id ? 'day' : 'recent';
  }
  return '?';
};
const JOBS = (q) => ({ code: 200, body: JSON.stringify({ organization: { jobs: { nodes:
  q.organization.jobs.$.where.in ? [{ id: 'j1', name: 'Webster', number: '26-0890' }, { id: 'j2', name: 'Lucas', number: '26-1204' }]
                                 : [{ id: 'j1', name: 'Webster', number: '26-0890' }] } } }) });
const ENTRIES = (q) => {
  const k = kindOf({ opts: { payload: JSON.stringify({ query: q }) } });
  const nodes = k === 'crew' ? [{ id: 'te9', startedAt: '2026-09-15T12:00:00Z', minutes: 30, user: { id: 'u2', name: 'Alberto' }, job: { id: 'j1', name: 'Webster', number: '26-0890' }, costItem: { id: 'ci1', name: 'Crew Labor', costCode: { number: '01GR' } } }]
              : k === 'recent' ? [{ startedAt: '2026-09-15T11:00:00Z', job: { id: 'j1' } }, { startedAt: '2026-09-14T11:00:00Z', job: { id: 'j2' } }]
              : [];
  return { code: 200, body: JSON.stringify({ organization: { timeEntries: { nodes } } }) };
};
const CODES = () => ({ code: 200, body: JSON.stringify({ job: { costItems: { nextPage: null, nodes: [
  { id: 'ci1', name: 'Crew Labor', costCode: { number: '01GR', name: 'General Requirements' } } ] } } }) });
const DOWN = () => ({ code: 500, body: '{"errors":[{"message":"down"}]}' });

props = {}; cacheStore = {}; fetched = []; trips = 0;
fetchImpl = route({ jobs: JOBS, entries: ENTRIES, codes: CODES });
const crewMe = { ...ME, role: 'Crew' };
const s1 = sandbox.getStart(crewMe, 'j1');
t('getStart carries the profile', [s1.me.name, s1.me.userId, s1.me.build], ['Tyler B.', 'u1', sandbox.APP_BUILD]);
t('getStart carries the clock', [s1.job.id, s1.open, s1.entries.length], ['j1', null, 0]);
t('getStart asks JobTread once: the open entry, the day and the last job together', [trips, fetched.map(kindOf)], [1, ['open', 'day', 'job']]);
t('...and hands back the API\'s recent-calls log', Array.isArray(s1.recent), true);

fetched = []; trips = 0;
fetchImpl = route({ jobs: JOBS, entries: (q) => kindOf({ opts: { payload: JSON.stringify({ query: q }) } }) === 'open' ? DOWN() : ENTRIES(q) });
let bootErr = '';
try { sandbox.getStart(crewMe, 'j1'); } catch (e) { bootErr = e.message; }
t('the open entry failing fails boot — the phone\'s retry gets it', /Pave error/.test(bootErr), true);
fetchImpl = route({ jobs: DOWN, entries: ENTRIES });
const s2 = sandbox.getStart(crewMe, 'j1');
t('the last job failing does not', [s2.open, s2.job, s2.entries.length], [null, null, 0]);

cacheStore = {}; fetched = []; trips = 0;
fetchImpl = route({ jobs: JOBS, entries: ENTRIES, codes: CODES });
const x1 = sandbox.getExtras(crewMe, 'j1');
t('getExtras carries the codes and the picker', [x1.codes.length, x1.jobOptions.length], [1, 2]);
t('a crew member gets no crew block', [x1.crew.length, fetched.map(kindOf).indexOf('crew')], [0, -1]);
t('cold: one round trip for the codes, the recent jobs and the log fields, then the picker\'s details', [trips, fetched.map(kindOf)], [1, ['codes', 'recent', 'fields', 'job']]);
fetched = []; trips = 0;
const x2 = sandbox.getExtras(crewMe, 'j1');
t('warm: nothing is asked at all', [x2.codes.length, x2.jobOptions.length, fetched.length], [1, 2, 0]);

const bossMe = { ...ME, role: 'Sales Team Manager' };
t('a manager is a foreman', sandbox.getStart(bossMe, null).me.isForeman, true);
fetched = []; trips = 0;
t('and gets the crew block, in the same round trip', [sandbox.getExtras(bossMe, 'j1').crew.length, trips, fetched.map(kindOf)], [1, 1, ['crew']]);

// no extra is worth failing for, and none may take the others down with it
cacheStore = {}; fetched = [];
fetchImpl = route({ codes: DOWN, entries: DOWN, jobs: DOWN });
const x3 = sandbox.getExtras(bossMe, 'j1');
t('a failing extra returns empty, not an error', [x3.codes.length, x3.jobOptions.length, x3.crew.length], [0, 0, 0]);
cacheStore = {}; fetched = [];
fetchImpl = route({ codes: DOWN, entries: ENTRIES, jobs: JOBS });
const x4 = sandbox.getExtras(bossMe, 'j1');
t('one failing beside the others leaves theirs alone', [x4.codes.length, x4.jobOptions.length, x4.crew.length], [0, 2, 1]);

// ---- JobTread's own daily-log fields, inherited ----
cacheStore = {}; fetched = []; trips = 0;
fetchImpl = route({ jobs: JOBS, entries: ENTRIES, codes: CODES });
const xf = sandbox.getExtras(crewMe, 'j1');
t('extras carries the org\'s daily-log fields, in JobTread\'s order', xf.logFields.map(f => f.name), ['Material Pickups / Deliveries', 'Trades Onsite', 'Unplanned Tasks', 'Anticipated Delays', 'Delay Reason', 'Safety Incidents', 'Internal Notes']);
t('...typed, with their options, and whether several may be picked', [xf.logFields[1].type, xf.logFields[1].multi, xf.logFields[1].options.length, xf.logFields[3].type, xf.logFields[3].multi, xf.logFields[0].required], ['option', true, 18, 'boolean', false, false]);
fetched = [];
t('...and from the cache the second time', [sandbox.getExtras(crewMe, 'j1').logFields.length, fetched.map(kindOf).indexOf('fields')], [7, -1]);
cacheStore = {}; fetched = [];
fetchImpl = route({ jobs: JOBS, entries: ENTRIES, codes: CODES, fields: DOWN });
t('could not ask is null, so the phone keeps what it has; no fields is []', [sandbox.getExtras(crewMe, 'j1').logFields, (fetchImpl = route({ jobs: JOBS, entries: ENTRIES, codes: CODES, fields: () => ({ code: 200, body: '{"organization":{"customFields":{"nodes":[]}}}' }) }), cacheStore = {}, sandbox.getExtras(crewMe, 'j1').logFields)], [null, []]);

// ---- paveAll_: one round trip, the answers kept apart ----
fetched = []; trips = 0; sandbox.PAVE_T.n = 0;
fetchImpl = (url, opts) => { const q = paveOf(opts); return q.a ? { code: 200, body: '{"a":1}' } : q.b ? { code: 502, body: '<html>bad gateway</html>' } : { code: 400, body: '{"errors":[{"message":"nope"}]}' }; };
const pr = sandbox.paveAll_([{ a: {} }, { b: {} }, { c: {} }]);
t('paveAll_ keeps each answer apart', [pr[0].data, /Pave HTTP 502/.test(pr[1].error.message), /nope/.test(pr[2].error.message)], [{ a: 1 }, true, true]);
t('...a gateway page gets pave()\'s own second try; the rest went once', [trips, fetched.length], [1, 5]);
t('...and the tally counts every round trip', sandbox.PAVE_T.n, 4);
t('nothing to ask is no round trip', [sandbox.paveAll_([]).length, trips], [0, 1]);

// ---- doPost: every reply says where its time went, and the API remembers ----
props = { OAUTH_CLIENT_ID: 'cid' }; cacheStore = {}; fetched = []; trips = 0;
const MEMBER_ME = () => ({ code: 200, body: JSON.stringify({ organization: { memberships: { nodes: [{ id: 'm1', role: { name: 'Crew' }, user: { id: 'u1', name: 'Tyler B.' } }] } } }) });
fetchImpl = route({ codes: CODES, jobs: JOBS, entries: ENTRIES, member: MEMBER_ME });
const post = (fn, args) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ t: 'tok', fn, args }) } }).getContent());
const r1 = post('getJobCodes', ['j1']);
t('a reply carries its timing: total, the sign-in check, the work, and JobTread inside it', [r1.ok, r1.data.length, typeof r1.ms.total, typeof r1.ms.auth, r1.ms.member, r1.ms.pave, typeof r1.ms.paveMs], [true, 1, 'number', 'number', 0, 1, 'number']);
const r2 = post('getStart', ['j1']);
t('a signed-in call counts the membership lookup apart from the work', [r2.ok, typeof r2.ms.member, r2.ms.pave], [true, 'number', 4]);
t('...and getStart hands back the log, with the call before it', r2.data.recent.map(c => [c.fn, c.who, c.ok, c.pave]), [['getJobCodes', 't', 1, 1]]);
const r3 = post('nope', []);
t('a failed call is logged too, with its error', [r3.ok, r3.ms.pave, sandbox.recentCalls_().slice(-1)[0].err], [false, 0, 'Unknown function: nope']);
for (let i = 0; i < 40; i++) post('getJobCodes', ['j1']);
t('the log is capped', sandbox.recentCalls_().length, 30);

// ---- DB Hub's "App access" panel ----
// The hub decides who may use the clock, but it must never be able to lock
// the crew out by accident: unset, empty, or unreachable is "no opinion", not
// a denial. Only an explicit Off / left-the-company row closes the door.
//
// And it must never be FETCHED on the request path. The hub is another Apps
// Script; fetching it inline on a cold cache put a second cold start in front
// of the clock and past the 25-second boot ceiling on every reopen. A trigger
// keeps a copy warm (refreshAccessFeed); doPost only ever reads it.
props = {}; cacheStore = {}; fetched = [];
t('no feed configured -> no opinion', sandbox.assertAccess_(ME.email), null);
t('no feed configured -> nothing fetched', fetched.length, 0);
t('no feed configured -> refresh says so', /not set/.test(sandbox.refreshAccessFeed()), true);
t('   ...and fetched nothing', fetched.length, 0);

// The request path reads; it never fetches — even cold, even when the hub
// would answer instantly and say Off. This is the whole fix.
props = { ACCESS_FEED_URL: 'https://hub.example.com/exec', ACCESS_FEED_KEY: 'k' };
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 200, body: JSON.stringify({ people: { [ME.email]: { timeClock: 'Off' } } }) });
t('cold copy -> request path has no opinion', sandbox.assertAccess_(ME.email), null);
t('cold copy -> request path fetched NOTHING', fetched.length, 0);

const denied = () => { try { sandbox.assertAccess_(ME.email); return ''; } catch (e) { return String(e.message).slice(0, 10); } };

// The trigger does the fetching, once, and the request path reads the result.
t('refresh fetches once', (sandbox.refreshAccessFeed(), fetched.length), 1);
t('feed key appended to the url', /[?&]feed=k$/.test(fetched[0].url), true);
t('warm copy -> access turned Off -> NO_ACCESS', denied(), 'NO_ACCESS:');
t('reading the copy fetched nothing more', fetched.length, 1);

// A cache eviction is not an outage: the durable copy in Properties answers.
cacheStore = {};
t('cache evicted -> durable copy still denies', denied(), 'NO_ACCESS:');
t('   ...without fetching', fetched.length, 1);

// A trigger that quietly died must not leave a stale roster in charge.
cacheStore = {};
props[sandbox.ACCESS_FEED_PROP] = JSON.stringify({ at: Date.now() - 2 * 24 * 3600 * 1000,
  feed: { people: { [ME.email]: { timeClock: 'Off' } } } });
t('copy older than a day -> no opinion', sandbox.assertAccess_(ME.email), null);

// A hub that is down keeps the last good copy rather than opening the door.
cacheStore = {}; fetched = []; delete props[sandbox.ACCESS_FEED_PROP];
fetchImpl = () => ({ code: 200, body: JSON.stringify({ people: { [ME.email]: { timeClock: 'Off' } } }) });
sandbox.refreshAccessFeed();
fetchImpl = () => ({ code: 500, body: 'hub is down' });
t('failed refresh says so', /failed/i.test(sandbox.refreshAccessFeed()), true);
t('failed refresh keeps the last good copy', denied(), 'NO_ACCESS:');

const denial = rec => {
  cacheStore = {}; fetched = []; delete props[sandbox.ACCESS_FEED_PROP];
  fetchImpl = () => ({ code: 200, body: JSON.stringify({ people: { [ME.email]: rec } }) });
  sandbox.refreshAccessFeed();
  return denied();
};
t('someone who left -> NO_ACCESS', denial({ status: 'Left 2026-01-02' }), 'NO_ACCESS:');
t('a blank row still passes', denial({ timeClock: '' }), '');

cacheStore = {}; fetched = []; delete props[sandbox.ACCESS_FEED_PROP];
fetchImpl = () => ({ code: 200, body: JSON.stringify({ people: { [ME.email]: { timeClock: 'Manager' } } }) });
sandbox.refreshAccessFeed();
t('a hub Manager gets the crew block', sandbox.bootProfile_(ME).isForeman, true);

cacheStore = {}; fetched = []; delete props[sandbox.ACCESS_FEED_PROP];
fetchImpl = () => ({ code: 200, body: '{"people":{}}' });
sandbox.refreshAccessFeed();
t('no row -> JobTread role decides', sandbox.bootProfile_(ME).isForeman, false);
t('getStart agrees with getBoot about foreman', sandbox.getStart(ME, null).me.isForeman, false);


// ============================================================
// SITE CHECKS — the site manager's checklist, owned by the board.
// This script forwards; it never touches JobTread for any of it.
// ============================================================
sandbox.__now = null;
props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' };
cacheStore = {}; fetched = [];
sandbox.getJobOptions = () => [{ id: 'j1', name: 'x', number: '1' }];

// ---- the GET passes the board's checklist and each visit's checks through ----
const SHAPE = {
  phases: [{ key: 'before', label: 'Before the tear-off', tag: null, when: 'the morning the crew starts' }],
  lines: [{ key: 'address', phase: 'before', label: 'Right address, right roof' }]
};
const yday = sandbox.addDays_(today, -1);
fetchImpl = () => ({ code: 200, body: JSON.stringify({
  crew: { id: 'c9', name: 'Tyler', leadMembershipId: 'm1' },
  checklist: SHAPE,
  visits: [
    { taskId: 't_mine', jobId: 'j9', jobNum: '26-1490', start: yday, end: yday, days: 1, cust: 'Courtney',
      warehouse: { delivered: false, pulled: true, staged: true, where: 'Bay 3', loaded: false,
                   toWarehouse: false, words: 'Staged at Bay 3' },
      checks: { taskId: 't_roof', state: { done: { address: true }, magnetBy: null, signedOff: null },
                progress: [{ phase: 'before', label: 'Before the tear-off', done: 1, total: 11 }],
                words: 'Before tear-off — 1 of 11 done' } },
    { taskId: 't_found', jobId: 'j1', jobNum: '26-0890', start: today, end: today, days: 1, checks: null }
  ] }) });
r = sandbox.getMyJobs(ME);
t('the board is asked from yesterday', fetched[0].url.indexOf('from=' + yday + '&to=' + sandbox.addDays_(today, 13)) > -1, true);
t('the checklist shape passes through untouched', r.checklist, SHAPE);
t('checks pass through; taskId is the LIST\'s, not the visit\'s',
  [r.visits[0].checks.taskId, r.visits[0].taskId, r.visits[0].checks.words], ['t_roof', 't_mine', 'Before tear-off — 1 of 11 done']);
t('a job with no list is null, never invented', r.visits[1].checks, null);
t('the warehouse half rides through untouched, null when the job has none',
  [r.visits[0].warehouse, r.visits[1].warehouse],
  [{ delivered: false, pulled: true, staged: true, where: 'Bay 3', loaded: false, toWarehouse: false, words: 'Staged at Bay 3' }, null]);
t('a visit that ended yesterday is kept — no re-filter on start >= from', r.visits.map(v => v.taskId), ['t_mine', 't_found']);
t('a current visit means no recent-jobs list is needed', r.jobs.length, 0);

// Only yesterday's visit -> nothing to clock into today, so the recent list rides along.
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 200, body: JSON.stringify({ crew: { id: 'c9', name: 'Tyler' }, checklist: SHAPE,
  visits: [{ taskId: 't_mine', jobId: 'j9', jobNum: '26-1490', start: yday, end: yday, days: 1, checks: null }] }) });
r = sandbox.getMyJobs(ME);
t('only yesterday\'s visit -> recent jobs still offered', [r.visits.length, r.jobs.length], [1, 1]);

// ---- the PUT: membership from the token, whole state, the phone's date ----
cacheStore = {}; fetched = [];
const written = { done: { address: true, homeowner: true, scope: false }, magnetBy: 'Kenton', signedOff: null };
fetchImpl = () => ({ code: 200, body: JSON.stringify({
  human: '26-1490 Courtney — before tear-off — 2 of 11 done', api: [], checks: written, previous: { done: {}, magnetBy: null, signedOff: null } }) });
r = sandbox.saveSiteChecks(ME, 't_roof', 'j9', '26-1490 Courtney', '2026-09-15',
  { done: { address: true, homeowner: 1, scope: 0 }, magnetBy: '  Kenton ', signOff: false, signedOff: 'Forged · Jan 1' });
const put = fetched[0];
t('PUT /api/crew/checks on the board', [put.url, put.opts.method], ['https://ops.example.com/api/crew/checks', 'put']);
const sent = JSON.parse(put.opts.payload);
t('membershipId is the verified caller\'s, never the phone\'s', sent.membershipId, 'm1');
t('the ids, the label and the PHONE\'s date ride along', [sent.taskId, sent.jobId, sent.jobLabel, sent.today], ['t_roof', 'j9', '26-1490 Courtney', '2026-09-15']);
t('done coerced to booleans, magnetBy trimmed', [sent.checks.done, sent.checks.magnetBy, sent.checks.signOff],
  [{ address: true, homeowner: true, scope: false }, 'Kenton', false]);
t('never sends a name or a date for the signature', Object.keys(sent.checks).sort(), ['done', 'magnetBy', 'notes', 'signOff']);
t('no notes sent -> an empty notes map, never a missing key', sent.checks.notes, {});
t('bearer header, JSON body, no redirects', [put.opts.headers.Authorization, put.opts.contentType, put.opts.followRedirects], ['Bearer s3cret', 'application/json', false]);
t('200 -> status and body come back verbatim', [r.status, r.reason, r.body.checks], [200, '', written]);

// ---- the notes (T1.20): one clean line per key, "" carried so the board clears it ----
cacheStore = {}; fetched = [];
sandbox.saveSiteChecks(ME, 't_roof', 'j9', '26-1490 Courtney', '2026-09-20',
  { done: { septic: true }, magnetBy: null, signOff: false,
    notes: { septic: '  Tank lid   is under\n the back deck  ', address: '', photos: 'x'.repeat(200), bogus: null } });
const notesSent = JSON.parse(fetched[0].opts.payload).checks.notes;
t('a note is collapsed to one line and trimmed', notesSent.septic, 'Tank lid is under the back deck');
t('an emptied note is sent as "" so the board takes it off', notesSent.address, '');
t('a note is cut at 140 characters, the board\'s NOTE_MAX', notesSent.photos.length, 140);
t('a null note reads as cleared, not the word null', notesSent.bogus, '');


// A bad date from the phone falls back to the script's own today, not to nothing.
cacheStore = {}; fetched = [];
sandbox.saveSiteChecks(ME, 't_roof', 'j9', '', 'yesterday-ish', { done: {} });
t('a garbage date -> the script\'s today', JSON.parse(fetched[0].opts.payload).today, today);
t('an empty magnet name is null, not ""', JSON.parse(fetched[0].opts.payload).checks.magnetBy, null);

// A save drops the cached job list, so the card's words don't lag the ticks.
cacheStore = {}; fetched = [];
const winKey = sandbox.myJobsCacheKey_('m1', sandbox.addDays_(today, -1), sandbox.addDays_(today, 13));
cacheStore[winKey] = '{"stale":1}';
sandbox.saveSiteChecks(ME, 't_roof', 'j9', '', today, { done: {} });
t('a written save drops the cached job list', cacheStore[winKey], undefined);

// ---- the answers that aren't 200 come back as data, never thrown ----
const save = () => sandbox.saveSiteChecks(ME, 't_roof', 'j9', '26-1490 Courtney', today, { done: { address: true } });
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 403, body: '{"error":"Only a site manager can tick the site checks — ask the office."}' });
r = save();
t('403 -> returned with the board\'s own words', [r.status, r.reason, r.body.error.slice(0, 25)], [403, 'board-http-403', 'Only a site manager can t']);
cacheStore[winKey] = '{"kept":1}';
save();
t('a refused save leaves the cached list alone', cacheStore[winKey], '{"kept":1}');
fetchImpl = () => ({ code: 502, body: '{"error":"JobTread write failed"}' });
r = save();
t('502 -> status for the app to keep the state and retry', [r.status, r.reason], [502, 'board-http-502']);
fetchImpl = () => ({ code: 401, body: '{"error":"Not authorized"}' });
r = save();
t('401 -> a config problem, said as such', [r.status, r.reason], [401, 'board-http-401']);
fetchImpl = () => ({ code: 307, body: '' });
r = save();
t('307 -> the sign-in bounce, named', [r.status, r.reason], [307, 'board-signin-bounce']);
fetchImpl = () => ({ code: 500, body: '<html>oops' });
r = save();
t('a non-JSON body is kept as text, not a parse error', [r.status, r.body, r.text], [500, null, '<html>oops']);
fetchImpl = () => { throw new Error('dns'); };
r = save();
t('a thrown request never propagates', [r.status, r.reason, r.error], [0, 'board-unreachable', 'dns']);
props = {};
r = save();
t('unconfigured -> says so, no fetch', [r.status, r.reason], [0, 'not-configured']);
props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' };
r = sandbox.saveSiteChecks({ ...ME, membershipId: '' }, 't_roof', 'j9', '', today, { done: {} });
t('no membership -> says so', r.reason, 'no-membership');
let bad = '';
try { sandbox.saveSiteChecks(ME, '', 'j9', '', today, { done: {} }); } catch (e) { bad = e.message; }
t('a missing checklist id is the app\'s bug and is thrown', /checklist id/.test(bad), true);

/* ---- MATERIAL LOADED: one boolean, and it must stay one boolean ----
   The staged LOCATION is free text somebody in the yard typed. A phone that
   posted a whole state would have to guess at it and would blank it, which is
   why this call carries `loaded` and nothing else. */
props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' };
cacheStore = {}; fetched = [];
fetchImpl = () => ({ code: 200, body: JSON.stringify({ human: '26-1490 Courtney — pulled, staged and loaded for the crew', api: [] }) });
r = sandbox.saveMaterialLoaded(ME, 'j9', '26-1490 Courtney', 1);
const mput = fetched[0], msent = JSON.parse(mput.opts.payload);
t('PUT /api/crew/loaded on the board', [mput.url, mput.opts.method], ['https://ops.example.com/api/crew/loaded', 'put']);
t('membershipId is the verified caller\'s, never the phone\'s', msent.membershipId, 'm1');
t('one boolean and the ids — never a state the phone had to guess',
  [Object.keys(msent).sort(), msent.loaded, msent.jobId], [['jobId', 'jobLabel', 'loaded', 'membershipId'], true, 'j9']);
t('bearer header, JSON body, no redirects', [mput.opts.headers.Authorization, mput.opts.contentType, mput.opts.followRedirects], ['Bearer s3cret', 'application/json', false]);
t('200 comes back as data', [r.status, r.reason], [200, '']);

// Taking it back off the truck is the same call.
cacheStore = {}; fetched = [];
sandbox.saveMaterialLoaded(ME, 'j9', '', false);
t('unloading is the same call with false', JSON.parse(fetched[0].opts.payload).loaded, false);

// The card says "staged at Bay 3" until the list is re-read, so drop the copy.
cacheStore = {}; fetched = [];
cacheStore[winKey] = '{"stale":1}';
sandbox.saveMaterialLoaded(ME, 'j9', '', true);
t('a written load drops the cached job list', cacheStore[winKey], undefined);

// The board decides who may: a site manager, exactly as for the site checks.
fetchImpl = () => ({ code: 403, body: '{"error":"Only a site manager can record the material loaded — ask the office."}' });
r = sandbox.saveMaterialLoaded(ME, 'j9', '', true);
t('403 -> the board\'s own words, never thrown', [r.status, r.body.error.slice(0, 22)], [403, 'Only a site manager ca']);
fetchImpl = () => { throw new Error('dns'); };
r = sandbox.saveMaterialLoaded(ME, 'j9', '', true);
t('a thrown request never propagates', [r.status, r.reason], [0, 'board-unreachable']);
r = sandbox.saveMaterialLoaded({ ...ME, membershipId: '' }, 'j9', '', true);
t('no membership -> says so', r.reason, 'no-membership');
bad = '';
try { sandbox.saveMaterialLoaded(ME, '', '', true); } catch (e) { bad = e.message; }
t('a missing job id is the app\'s bug and is thrown', /job id/.test(bad), true);
fetchImpl = () => ({ code: 200, body: '{"human":"x","api":[]}' });

// A slow board trips the breaker for the NEXT job-list fetch, but an open
// breaker never blocks a save: the manager tapped, on their own slot, and a
// cold board at 6:45am is exactly when the before-tear-off ticks happen.
cacheStore = {}; fetched = [];
sandbox.__now = 1000;
fetchImpl = () => { sandbox.__now += 9000; return { code: 200, body: '{"checks":{"done":{}}}' }; };
r = save();
t('a slow save still returns its answer', [r.status, r.boardMs], [200, 9000]);
t('and trips the breaker', typeof cacheStore['board_slow'], 'string');
fetchImpl = () => { sandbox.__now += 200; return { code: 200, body: '{"checks":{"done":{}}}' }; };
const before2 = fetched.length;
r = save();
t('an open breaker does not stop a save', [fetched.length - before2, r.status], [1, 200]);
sandbox.__now = null;

// ---- the door: the company domain, plus an explicit list — never "any Google account" ----
props = {};
t('company domain allowed', sandbox.emailAllowed_('Tyler.B@deitemeyerbrothers.com'), true);
t('the two Gmail site managers are allowed', [sandbox.emailAllowed_('tylermohr94@gmail.com'), sandbox.emailAllowed_('KentonMcComas@gmail.com')], [true, true]);
t('any other Google account is not', [sandbox.emailAllowed_('someone@gmail.com'), sandbox.emailAllowed_('')], [false, false]);
props = { EXTRA_ALLOWED_EMAILS: ' New.Manager@gmail.com, other@outlook.com ' };
t('EXTRA_ALLOWED_EMAILS adds one without a deploy', [sandbox.emailAllowed_('new.manager@gmail.com'), sandbox.emailAllowed_('nope@gmail.com')], [true, false]);

props = { OAUTH_CLIENT_ID: 'cid' }; cacheStore = {}; fetched = [];
const tokeninfo = email => () => ({ code: 200, body: JSON.stringify({ aud: 'cid', email_verified: 'true', email, exp: Math.floor(Date.now() / 1000) + 3600 }) });
fetchImpl = tokeninfo('TylerMohr94@gmail.com');
t('a Gmail site manager gets through the token check, lowercased', sandbox.verifyIdToken_('tok-tyler'), 'tylermohr94@gmail.com');
fetchImpl = tokeninfo('stranger@gmail.com');
let refused = '';
try { sandbox.verifyIdToken_('tok-stranger'); } catch (e) { refused = e.message; }
t('a stranger on Gmail does not', refused, 'AUTH');

// ---- and memberFor_ finds them: `=` first, then `like`, as the board does ----
props = {}; cacheStore = {}; fetched = [];
let lookups = 0;
fetchImpl = () => { lookups++; return { code: 200, body: JSON.stringify({ organization: { memberships: { nodes:
  lookups === 1 ? [] : [{ id: 'm7', role: { name: 'Site Manager' }, user: { id: 'u7', name: 'Kenton McComas' } }] } } }) }; };
const km = sandbox.memberFor_('kentonmccomas@gmail.com');
const secondWhere = JSON.parse(fetched[1].opts.payload).query.organization.memberships.$.where;
t('an exact miss retries with like', [lookups, secondWhere[0], secondWhere[1], secondWhere[2]], [2, ['user', 'emailAddress'], 'like', 'kentonmccomas@gmail.com']);
t('and resolves the membership and the JobTread role', [km.userId, km.membershipId, km.role], ['u7', 'm7', 'Site Manager']);


// ============================================================
// THE DAY, ON THE JOB — labels on the list, the daily log, the pushes.
// ============================================================
// A router: the board's GET, then Pave by what the query asks for.
const PEOPLE = (q) => ({ code: 200, body: JSON.stringify({ organization: { jobs: { nodes: [
  { id: 'j9', customFieldValues: { nodes: [
    { customField: { id: sandbox.CF_PROJECT_MANAGER }, value: 'Dave Elick' },
    { customField: { id: sandbox.CF_SALES_REP }, value: 'Shawn Deitemeyer' },
    { customField: { id: sandbox.CF_SALES_REP }, value: 'Jenn Grubb' } ] } },
  { id: 'j1', customFieldValues: { nodes: [] } } ] } } }) });
const MEMBERS = { 'Dave Elick': 'm_dave', 'Shawn Deitemeyer': 'm_shawn' };
const MEMBER = (q) => { const name = q.organization.memberships.$.where[1]; const id = MEMBERS[name];
  return { code: 200, body: JSON.stringify({ organization: { memberships: { nodes: id ? [{ id }] : [] } } }) }; };
const BOARD = (visits) => () => ({ code: 200, body: JSON.stringify({ crew: { id: 'c9', name: 'Tyler' }, checklist: SHAPE, visits }) });
const VIS = [
  { taskId: 't_mine', jobId: 'j9', jobNum: '26-1490', cust: 'Courtney', address: '1140 Bittersweet Ln, Ohio City, OH 45874, USA',
    start: sandbox.addDays_(today, 1), end: sandbox.addDays_(today, 1), days: 1, material: { text: 'Material ordered ✓', cls: 'good' },
    checks: { taskId: 't_roof', state: { done: {}, magnetBy: null, signedOff: null }, progress: [], words: 'Site checks not started' } },
  { taskId: 't_own', jobId: 'j1', jobNum: '26-0890', cust: 'Noah Webster', start: today, end: today, days: 1,
    checks: { taskId: 't_own', state: { done: {}, magnetBy: null, signedOff: null }, progress: [], words: 'Site checks not started' } }
];

// ---- getMyJobs carries who is on the roof with you, and the job's people ----
props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' };
cacheStore = {}; fetched = []; sandbox.__now = null;
fetchImpl = route({ board: BOARD(VIS),
  tasks: () => ({ code: 200, body: JSON.stringify({ organization: { tasks: { nodes: [{ id: 't_roof', name: 'Roof install — Platinum (Shingle)' }] } } }) }),
  people: PEOPLE });
r = sandbox.getMyJobs(ME);
// The list comes back sorted by start, so find each visit by its task.
const mine = r.visits.find(v => v.taskId === 't_mine'), own = r.visits.find(v => v.taskId === 't_own');
t('alongside is the checklist task\'s crew, as a label', mine.alongside, 'Platinum (Shingle)');
t('...and never your own crew', own.alongside, null);
t('the job\'s PM and every sales rep, as names', [mine.pm, mine.reps, own.pm, own.reps], ['Dave Elick', ['Shawn Deitemeyer', 'Jenn Grubb'], '', []]);
t('only the list\'s task is asked for, not the visit\'s own', JSON.parse(fetched[1].opts.payload).query.organization.tasks.$.where.and[0][2], ['t_roof']);
t('crewLabelFromTaskName_ handles the plain prefix', [sandbox.crewLabelFromTaskName_('Install — Tyler'), sandbox.crewLabelFromTaskName_('Order materials')], ['Tyler', null]);

cacheStore = {}; fetched = [];
fetchImpl = route({ board: BOARD(VIS), tasks: () => { throw new Error('pave down'); }, people: () => { throw new Error('pave down'); } });
r = sandbox.getMyJobs(ME);
t('labels failing never fail the list', [r.source, r.visits.length, r.visits[0].alongside, r.visits[0].pm], ['board', 2, null, '']);

// ---- the daily log ----
const LOG = { jobId: 'j9', date: '2026-09-15', jobLabel: '26-1490 Courtney', alongside: 'Platinum (Shingle)',
  done: 'Tear-off and dry-in, north side shingled.', condition: 'Two sheets of decking replaced.', crewOnSite: true, tarped: true, leftAt: '4:30',
  problems: 'Short 8 pieces of drip edge, one box of nails.',
  notes: [{ time: '10:12a', body: 'Homeowner asked about the trailer spot', urgent: false }, { time: '2:40p', body: 'Need drip edge', urgent: true }],
  photos: [{ fileId: 'f1', name: 'a.jpg', tag: 'before' }, { fileId: 'f2', name: 'b/c.jpg', tag: 'after' }, { name: 'not-uploaded.jpg', tag: 'after' }],
  hours: [{ number: '04MA', name: 'Masonry Labor', minutes: 138 }, { number: '02ST-1', name: 'Site Prep Labor', minutes: 42 }],
  checks: { words: 'Handing over — 7 of 7 done', magnetBy: 'Kenton', signedOff: null } };

props = {}; cacheStore = {}; fetched = [];
let threw2 = '';
try { sandbox.sendDailyLog(ME, LOG); } catch (e) { threw2 = e.message; }
t('a read-only build sends no log', threw2.indexOf('READ_ONLY'), 0);

props = { WRITE_ENABLED: 'true' }; cacheStore = {}; fetched = [];
const jtCalls = [];
// Each scenario below is its own day: forget the day-log memory between sends.
const freshDay = () => { for (const k of Object.keys(props)) if (k.indexOf('dl_') === 0) delete props[k]; jtCalls.length = 0; };
fetchImpl = route({ people: PEOPLE, member: MEMBER,
  dailyLog: (q) => { jtCalls.push(['dailyLog', q.createDailyLog.$]); return { code: 200, body: '{"createDailyLog":{"createdDailyLog":{"id":"dl1"}}}' }; },
  comment: (q) => { jtCalls.push(['comment', q.createComment.$]); return { code: 200, body: '{"createComment":{"createdComment":{"id":"c1"}}}' }; } });
r = sandbox.sendDailyLog(ME, LOG);
const dl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('one daily log on the job, dated, notify on', [dl.jobId, dl.date, dl.notify], ['j9', '2026-09-15', true]);
t('assigned to the PM and the reps JobTread knows', dl.assignees, [{ membershipId: 'm_dave' }, { membershipId: 'm_shawn' }]);
t('photos ride by reference, only the uploaded ones, names made safe', dl.files, [{ copyFromFileId: 'f1', name: 'a.jpg' }, { copyFromFileId: 'f2', name: 'b-c.jpg' }]);
const N = dl.notes;
t('the notes read in the owner\'s order', [N.indexOf('WHAT GOT DONE') > -1, N.indexOf('WHAT GOT DONE') < N.indexOf('CONDITION WHEN I LEFT'), N.indexOf('CONDITION WHEN I LEFT') < N.indexOf('PROBLEMS, EXTRAS, RETURNS')], [true, true, true]);
t('...with the condition chips, the checks, the hours and the photo count',
  ['Crew still on site · Tarped · Left at 4:30', 'Handing over — 7 of 7 done · Magnet run by Kenton', '04MA Masonry Labor — 2h 18m', 'Total 3h 00m', '2 attached (1 before, 1 after)', 'with Platinum (Shingle)', '(sent to the office at the time)'].map(x => N.indexOf(x) > -1), [true, true, true, true, true, true, true]);
t('the answer says who was assigned and who could not be', [r.dailyLogId, r.assigned, r.unresolved, r.photos], ['dl1', ['Dave Elick', 'Shawn Deitemeyer'], ['Jenn Grubb'], 2]);
const cm = jtCalls.find(c => c[0] === 'comment')[1];
t('a problem pings the same people in the feed, once', [r.flag, r.commented, cm.targetType, cm.targetId, cm.assignees.length, cm.message.indexOf('Short 8 pieces of drip edge') > -1], ['problems', true, 'job', 'j9', 2, true]);

freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: false });
t('a routine day is the log alone, no comment', [r.flag, r.commented, jtCalls.map(c => c[0])], ['', false, ['dailyLog']]);
freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: true });
t('a crew left on site without a sign-off is flagged', [r.flag, r.commented, jtCalls[1][1].message.indexOf('crew still on site when Tyler left at 4:30') > -1], ['crew-on-site', true, true]);
freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: true, checks: { words: 'Signed off — Tyler · Sep 15', magnetBy: null, signedOff: 'Tyler · Sep 15' } });
t('...but not once it is signed off', [r.flag, jtCalls.map(c => c[0])], ['', ['dailyLog']]);
// JobTread's own fields: sent as fields, repeated in the notes, and a delay
// or an incident pings the feed the way a problem does.
freshDay(); cacheStore = {};
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: false, fields: { '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather', 'Not a reason'], '22PC7jNshbiK': ['Roofing', 'Masonry'], '22PLhcfDaJ7r': '  Ladder slipped, nobody hurt ', '22PC7jPsepri': '   ', '22PC7jNSGzEb': false, 'zz_gone_field': 'x' } });
const dlf = jtCalls.filter(c => c[0] === 'dailyLog')[0][1];
t('the answers ride on the log as JobTread\'s own fields, cleaned', dlf.customFieldValues, { '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather'], '22PC7jNshbiK': ['Roofing', 'Masonry'], '22PLhcfDaJ7r': 'Ladder slipped, nobody hurt', '22PC7jNSGzEb': false });
t('...and read in the notes under their own names', ['LOG FIELDS', 'Anticipated Delays: Yes', 'Delay Reason: Weather', 'Trades Onsite: Roofing, Masonry', 'Safety Incidents: Ladder slipped, nobody hurt', 'Material Pickups / Deliveries: No'].map(x => dlf.notes.indexOf(x) > -1), [true, true, true, true, true, true]);
t('a delay or a safety incident pings the feed like a problem does', [r.flag, r.commented, r.fields, /Anticipated Delays: Yes · Delay Reason: Weather · Safety Incidents: Ladder slipped, nobody hurt/.test(jtCalls.filter(c => c[0] === 'comment')[0][1].message)], ['fields', true, 5, true]);
t('the field definitions were asked for alongside the people, once', fetched.map(kindOf).filter(k => k === 'fields').length, 1);
freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: false, fields: { '22PC7jNshbiK': ['Roofing'], '22PLbmgVwteK': 'for the office' } });
t('trades on site and internal notes do not', [r.flag, jtCalls.map(c => c[0])], ['', ['dailyLog']]);
props.DAILY_LOG_PING_FIELDS = 'internal';
freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: false, fields: { '22PLbmgVwteK': 'for the office' } });
t('...unless the office says so in DAILY_LOG_PING_FIELDS', r.flag, 'fields');
delete props.DAILY_LOG_PING_FIELDS;
freshDay();
r = sandbox.sendDailyLog(ME, { ...LOG, problems: 'Short 8 pieces of drip edge.', fields: { '22PC7jQ6BkBC': true } });
t('with problems too, the pointer carries both', /Short 8 pieces of drip edge\. · Anticipated Delays: Yes/.test(jtCalls.filter(c => c[0] === 'comment')[0][1].message), true);
freshDay();
t('no fields, no field on the log', 'customFieldValues' in (sandbox.sendDailyLog(ME, LOG), jtCalls.filter(c => c[0] === 'dailyLog')[0][1]), false);
freshDay();
t('a bad date falls back to the script\'s today', sandbox.sendDailyLog(ME, { ...LOG, date: 'soon' }).date, today);
freshDay();
sandbox.sendDailyLog(ME, { ...LOG, photos: [], photosPending: 2 });
t('photos left uploading are named in the log', jtCalls[0][1].notes.indexOf('2 more still to upload from the phone when this was sent') > -1, true);
freshDay();
sandbox.sendDailyLog(ME, { ...LOG, photos: [], photosPending: 0, photosFailed: 1 });
t('a photo gone from the phone is named as gone, not as coming', jtCalls[0][1].notes.indexOf('1 photo did not upload and is gone from the phone — to be taken again') > -1, true);

// A phone that timed out waiting for the answer sends the same day again.
freshDay();
const first = sandbox.sendDailyLog(ME, LOG);
const again = sandbox.sendDailyLog(ME, LOG);
t('the same day sent twice is one log, the second answer pointing at the first', [jtCalls.filter(c => c[0] === 'dailyLog').length, again.dailyLogId, again.duplicate, again.assigned], [1, first.dailyLogId, true, first.assigned]);
t('a different day or job is its own log', (sandbox.sendDailyLog(ME, { ...LOG, date: '2026-09-16' }), jtCalls.filter(c => c[0] === 'dailyLog').length), 2);
props['dl_old|x|2026-01-01'] = JSON.stringify({ id: 'dl_old', at: Date.now() - 10 * 86400000 });
sandbox.sendDailyLog(ME, { ...LOG, jobId: 'j1' });
t('old memories are pruned', 'dl_old|x|2026-01-01' in props, false);

jtCalls.length = 0;
r = sandbox.addDailyLogNote(ME, 'j9', 'dl1', 'Kenton dropped the returns at 5.');
t('a later note is a comment on the log itself, signed', [jtCalls[0][1].targetType, jtCalls[0][1].targetId, jtCalls[0][1].message], ['dailyLog', 'dl1', 'Tyler B.: Kenton dropped the returns at 5.']);

jtCalls.length = 0;
r = sandbox.postJobNote('j9', 'Need drip edge now', 'Tyler B.', true);
t('an urgent note is assigned to the PM', [jtCalls[0][1].assignees, r.assigned], [[{ membershipId: 'm_dave' }], ['Dave Elick']]);
jtCalls.length = 0;
sandbox.postJobNote('j9', 'FYI', 'Tyler B.');
t('a plain note is not', 'assignees' in jtCalls[0][1], false);

// ---- the pushes: "Tomorrow: …" once, after four, and "Schedule changed" ----
props = { BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret', PUSH_ENABLED: 'true', FCM_PROJECT_ID: 'p',
  FCM_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'a@b', private_key: 'k' }), APP_URL: 'https://db-time-clock.web.app/' };
cacheStore = {}; fetched = []; pushes = [];
sandbox.registerPushToken(ME, 'tok-1', 'ios');
t('the token record carries the membership', JSON.parse(props['pt_u1']).membershipId, 'm1');
fetchImpl = route({ board: BOARD(VIS),
  tasks: () => ({ code: 200, body: JSON.stringify({ organization: { tasks: { nodes: [{ id: 't_roof', name: 'Roof install — Platinum' }] } } }) }),
  people: PEOPLE });
sandbox.__hour = 9;
let sw = sandbox.sweepSchedulePushes();
t('before four o\'clock: only the snapshot is taken', [sw.devices, sw.plans, sw.changes, pushes.length, typeof props['sched_u1']], [1, 0, 0, 0, 'string']);
sandbox.__hour = 17;
sw = sandbox.sweepSchedulePushes();
t('after four: one "Tomorrow" line', [sw.plans, pushes.length, pushes[0].notification.title, pushes[0].notification.body],
  [1, 1, 'Tomorrow', '1140 Bittersweet Ln · Courtney · with Platinum · Material ordered']);
t('...tagged and linked to My jobs, not the camera', [pushes[0].data.kind, pushes[0].data.tag, pushes[0].webpush.fcmOptions.link, pushes[0].webpush.notification.requireInteraction], ['schedule', 'dbtc-schedule', 'https://db-time-clock.web.app/?tab=jobs', false]);
sw = sandbox.sweepSchedulePushes();
t('...and only once a day', [sw.plans, pushes.length], [0, 1]);
const MOVED = [{ ...VIS[0], start: sandbox.addDays_(today, 2), end: sandbox.addDays_(today, 2) }, VIS[1],
  { taskId: 't_new', jobId: 'j5', jobNum: '26-1102', cust: 'Dale Harmon', start: sandbox.addDays_(today, 2), end: sandbox.addDays_(today, 2), days: 1, checks: null }];
fetchImpl = route({ board: BOARD(MOVED), people: PEOPLE });
sw = sandbox.sweepSchedulePushes();
t('a changed schedule is one push naming the change', [sw.changes, pushes[1].notification.title, pushes[1].notification.body],
  [1, 'Schedule changed', 'Moved: Courtney to ' + sandbox.fmtDayShortDow_(sandbox.addDays_(today, 2)) + '. Added: Dale Harmon ' + sandbox.fmtDayShortDow_(sandbox.addDays_(today, 2))]);
sw = sandbox.sweepSchedulePushes();
t('...and not again for the same schedule', [sw.changes, pushes.length], [0, 2]);
fetchImpl = route({ board: () => ({ code: 502, body: '{"error":"x"}' }) });
sw = sandbox.sweepSchedulePushes();
t('a board failure is counted, never thrown', [sw.failed, pushes.length], [1, 2]);
props.PUSH_ENABLED = 'false';
t('push off -> nothing runs', sandbox.sweepSchedulePushes().skipped, 'PUSH_ENABLED is not true');
sandbox.__hour = null;

// ---- the story shape (T1.14): one story, JobTread's own fields as answered on the phone ----
// The phone sends the story and the timestamped lines the PM was told (the
// log's notes), the org's daily-log fields it asked — by id, as JobTread takes
// them — and yes or no to an incident with the alert, which the API lands on
// the Safety Incidents field by name. The notes carry every answer under the
// field's own name either way.
const STORY = { jobId: 'j9', date: '2026-09-16', jobLabel: '26-1490 Courtney', alongside: 'Platinum (Shingle)',
  story: 'The crew had all shingles on by 10.', lines: [{ time: '8:14a', text: 'Got on the job after 8 due to appointment', pmTold: true }],
  fields: { '22PC7jNSGzEb': false, '22PC7jNshbiK': ['Roofing', 'Not a trade'], '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather', 'Short Labor'] },
  fieldNames: { '22PC7jNSGzEb': 'Material Pickups / Deliveries', '22PC7jNshbiK': 'Trades Onsite', '22PC7jQ6BkBC': 'Anticipated Delays', '22PLhdEgfHXF': 'Delay Reason' },
  safety: false, alert: null,
  photos: [{ fileId: 'f1', name: 'a.jpg', tag: 'before' }], hours: [{ number: '07SH', name: 'Shingle Labor', minutes: 270 }], checks: null };
const STORY_ROUTE = (extra) => route(Object.assign({ people: PEOPLE, member: MEMBER,
  dailyLog: (q) => { jtCalls.push(['dailyLog', q.createDailyLog.$]); return { code: 200, body: '{"createDailyLog":{"createdDailyLog":{"id":"dl1"}}}' }; },
  comment: (q) => { jtCalls.push(['comment', q.createComment.$]); return { code: 200, body: '{"createComment":{"createdComment":{"id":"c1"}}}' }; } }, extra || {}));
props = { WRITE_ENABLED: 'true', BOARD_API_URL: 'https://ops.example.com', CREW_APP_SECRET: 's3cret' }; cacheStore = {}; fetched = []; freshDay();
fetchImpl = STORY_ROUTE();
r = sandbox.sendDailyLog(ME, STORY);
const sdl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('the answers ride on the log as JobTread\'s own fields, as the phone answered them, checked against the org\'s list', sdl.customFieldValues,
  { '22PC7jNSGzEb': false, '22PC7jNshbiK': ['Roofing'], '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather', 'Short Labor'] });
t('the notes: the PM line with its time, the story, every answer by name, the hours, the photos',
  ['8:14a — Got on the job after 8 due to appointment  (told the PM at the time)', 'The crew had all shingles on by 10.', 'Material Pickups / Deliveries: No', 'Trades Onsite: Roofing', 'Anticipated Delays: Yes', 'Delay Reason: Weather, Short Labor', 'Hurt / close call: None', '07SH Shingle Labor — 4h 30m', '1 attached (1 before)', 'with Platinum (Shingle)'].map(x => sdl.notes.indexOf(x) > -1),
  [true, true, true, true, true, true, true, true, true, true]);
t('...and none of the old sections', /WHAT GOT DONE|CONDITION WHEN I LEFT|PROBLEMS|LOG FIELDS/.test(sdl.notes), false);
t('a delay pings the feed, naming the fields', [r.flag, r.commented, r.fields, /Anticipated Delays: Yes · Delay Reason: Weather, Short Labor/.test(jtCalls.find(c => c[0] === 'comment')[1].message)], ['fields', true, 4, true]);
freshDay();
r = sandbox.sendDailyLog(ME, { ...STORY, fields: { '22PC7jNSGzEb': false, '22PC7jQ6BkBC': false }, story: 'Normal day, nothing to report.', lines: [] });
const ndl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('a normal day: every yes/no field No, the words in the notes, no comment', [ndl.customFieldValues, ndl.notes.indexOf('Normal day, nothing to report.') > -1, r.flag, jtCalls.map(c => c[0])], [{ '22PC7jNSGzEb': false, '22PC7jQ6BkBC': false }, true, '', ['dailyLog']]);
freshDay();
r = sandbox.sendDailyLog(ME, { ...STORY, fields: {}, fieldNames: {}, safety: true, alert: { kind: 'close', hurt: false, text: 'Bundle slid off the ridge', sentAt: 1, to: ['PM', 'Shawn', 'Neal', 'Carl'] } });
const adl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('an incident is the Safety Incidents field, found by name, as one line', adl.customFieldValues, { '22PLhcfDaJ7r': 'Close call · Nobody hurt · Bundle slid off the ridge — alert sent to PM, Shawn, Neal, Carl' });
t('...unanswered delays is no field at all', '22PC7jQ6BkBC' in adl.customFieldValues, false);
t('...and pings the feed', [r.flag, /Safety Incidents: Close call · Nobody hurt/.test(jtCalls.find(c => c[0] === 'comment')[1].message)], ['fields', true]);
// The field list cannot be had: the phone's answers still go as it sent them,
// the notes name them from the phone's own copy, and the ping says what.
freshDay(); cacheStore = {};
fetchImpl = STORY_ROUTE({ fields: DOWN });
r = sandbox.sendDailyLog(ME, STORY);
const fdl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('without the field list the answers still go as sent, and the notes still name them', [fdl.customFieldValues, fdl.notes.indexOf('Anticipated Delays: Yes') > -1, fdl.notes.indexOf('Delay Reason: Weather, Short Labor') > -1],
  [{ '22PC7jNSGzEb': false, '22PC7jNshbiK': ['Roofing', 'Not a trade'], '22PC7jQ6BkBC': true, '22PLhdEgfHXF': ['Weather', 'Short Labor'] }, true, true]);
t('...and the ping still says what', [r.flag, /Anticipated Delays: Yes · Delay Reason: Weather, Short Labor/.test(jtCalls.find(c => c[0] === 'comment')[1].message)], ['fields', true]);
// The older shape still goes, as before.
freshDay(); cacheStore = {};
fetchImpl = STORY_ROUTE();
r = sandbox.sendDailyLog(ME, LOG);
t('a phone on the old build still sends its log', [jtCalls.filter(c => c[0] === 'dailyLog').length, r.flag, jtCalls[0][1].notes.indexOf('WHAT GOT DONE') > -1], [1, 'problems', true]);
// ---- the safety alert: a comment assigned to the PM, and a text to the office's list ----
let mails = [];
sandbox.MailApp = { sendEmail: (o) => { if (/fail/.test(o.to)) throw new Error('bounce'); mails.push(o); } };
props.SAFETY_ALERT_TO = 'pm@x.com, 4195551234@vtext.com;fail@x.com';
jtCalls.length = 0; mails = [];
r = sandbox.sendSafetyAlert(ME, 'j9', { kind: 'close', hurt: false, text: 'Bundle slid off the ridge', photoIds: ['f1'], photos: 2, jobLabel: '26-1490 Courtney' });
t('the alert is a comment on the job, assigned to the PM, saying what', [jtCalls[0][0], jtCalls[0][1].assignees, /^🚨 Safety alert — 26-1490 Courtney: Close call · Nobody hurt · Bundle slid off the ridge · 2 photos in DB Cam on the job \(Tyler B\., \d+:\d\d[ap]\)$/.test(jtCalls[0][1].message)], ['comment', [{ membershipId: 'm_dave' }], true]);
t('...and a text to each address, the one that bounced named', [mails.map(m => m.to), mails[0].subject, mails[0].body === jtCalls[0][1].message, r.to, r.failed, r.commented, r.assigned], [['pm@x.com', '4195551234@vtext.com'], 'Safety alert — 26-1490 Courtney', true, ['pm@x.com', '4195551234@vtext.com'], ['fail@x.com'], true, ['Dave Elick']]);
jtCalls.length = 0; mails = [];
r = sandbox.sendSafetyAlert(ME, 'j9', { kind: 'fall', hurt: true, text: '' });
t('hurt is said loudly', /Fall · HURT \(/.test(jtCalls[0][1].message), true);
delete props.SAFETY_ALERT_TO; jtCalls.length = 0; mails = [];
r = sandbox.sendSafetyAlert(ME, 'j9', { kind: 'cut', hurt: true, text: 'x' });
t('no list: the comment alone still counts as sent', [mails.length, r.commented, r.to], [0, true, []]);
let noHurt = '';
try { sandbox.sendSafetyAlert(ME, 'j9', { kind: 'cut', text: 'x' }); } catch (e) { noHurt = e.message; }
t('hurt or nobody hurt is required', /hurt/.test(noHurt), true);
props.SAFETY_ALERT_TO = 'fail@x.com'; jtCalls.length = 0;
fetchImpl = STORY_ROUTE({ comment: () => { throw new Error('pave down'); } });
let none = '';
try { sandbox.sendSafetyAlert(ME, 'j9', { kind: 'cut', hurt: true, text: 'x' }); } catch (e) { none = e.message; }
t('neither channel going is an error, so the phone keeps it unsent', /did not go/.test(none), true);
delete props.SAFETY_ALERT_TO;
props.WRITE_ENABLED = '';
let ro = '';
try { sandbox.sendSafetyAlert(ME, 'j9', { kind: 'cut', hurt: true, text: 'x' }); } catch (e) { ro = e.message; }
t('a read-only build sends no alert', ro.indexOf('READ_ONLY'), 0);
props.WRITE_ENABLED = 'true';
fetchImpl = STORY_ROUTE();

jtCalls.length = 0;
r = sandbox.tellPm(ME, 'j9', 'Need drip edge now');
t('tellPm is a comment on the job, signed, assigned to the PM', [jtCalls[0][1].targetType, jtCalls[0][1].message, jtCalls[0][1].assignees, r.assigned], ['job', 'Tyler B.: Need drip edge now', [{ membershipId: 'm_dave' }], ['Dave Elick']]);

// ---- the photo gates, server side ----
// The shutter commits on the phone, so a clock-in carries its start photo's
// id, a clock-out its end photo's, a switch both — and the API refuses the
// write without them, so the gate cannot be skipped by asking it directly.
// A break is the one photo-less write.
props = { WRITE_ENABLED: 'true' }; cacheStore = {}; fetched = [];
const OPEN_TE = { id: 'te9', startedAt: '2026-09-16T12:00:00Z', minutes: 30, job: { id: 'j1', name: 'Webster', number: '26-0890', location: {} }, costItem: { id: 'ci1', name: 'Crew Labor', costCode: { number: '01GR', name: 'General Requirements' } } };
const withOpen = (open) => route({ jobs: JOBS, entries: (q) => {
  const k = kindOf({ opts: { payload: JSON.stringify({ query: q }) } });
  return { code: 200, body: JSON.stringify({ organization: { timeEntries: { nodes: k === 'open' && open ? [OPEN_TE] : [] } } }) };
} });
const paveKinds = () => fetched.map(f => { const q = paveOf(f.opts) || {}; return q.createTimeEntry ? 'create' : q.updateTimeEntry ? 'close' : kindOf(f); });
const refusedBy = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };
fetchImpl = withOpen(false);
t('no start photo, no clock-in', /^PHOTO_REQUIRED/.test(refusedBy(() => sandbox.clockIn(ME, 'j1', 'ci1', null, ''))), true);
t('...and nothing was written', paveKinds().includes('create'), false);
fetched = [];
sandbox.clockIn(ME, 'j1', 'ci1', null, 'ph_start');
t('with one, the block opens', paveKinds().includes('create'), true);
fetchImpl = withOpen(true); fetched = [];
t('no end photo, no clock-out', /^PHOTO_REQUIRED/.test(refusedBy(() => sandbox.clockOut(ME, null))), true);
t('...and the block is still open', paveKinds().includes('close'), false);
fetched = [];
r = sandbox.clockOut(ME, null, 'ph_end');
t('with one, the block closes', [r.closed, paveKinds().includes('close')], ['te9', true]);
fetched = [];
t('a switch needs the end photo', /end photo/.test(refusedBy(() => sandbox.switchCode(ME, 'j1', 'ci2', null, '', 'ph_s'))), true);
t('...and the start photo', /start photo/.test(refusedBy(() => sandbox.switchCode(ME, 'j1', 'ci2', null, 'ph_e', ''))), true);
t('...and nothing moved meanwhile', paveKinds().some(k => k === 'close' || k === 'create'), false);
fetched = [];
sandbox.switchCode(ME, 'j1', 'ci2', null, 'ph_e', 'ph_s');
t('with both, one call closes the old block and opens the next', paveKinds().filter(k => k === 'close' || k === 'create'), ['close', 'create']);
fetched = [];
r = sandbox.startBreak(ME, null);
t('a break closes the block with no photo', [r.closed, paveKinds().includes('close')], ['te9', true]);
fetched = [];
sandbox.endBreak(ME, 'j1', 'ci1', null);
t('...and back to work opens a new one, no start photo', paveKinds().includes('create'), true);
fetched = [];
fetchImpl = route({ entries: () => ({ code: 200, body: '{"organization":{"files":{"nodes":[{"description":"#START #TE:te1 01GR x"},{"description":"#BEFORE #TE:te2 01GR y"}]}}}' }) });
fetchImpl = (url, opts) => ({ code: 200, body: '{"organization":{"files":{"nextPage":null,"nodes":[{"description":"#START #TE:te1 01GR x"},{"description":"#BEFORE #TE:te2 01GR y"}]}}}' });
const have = sandbox.entryIdsWithBeforePhoto_('2026-09-16T00:00:00Z');
const fq = paveOf(fetched[0].opts).organization.files.$.where.and[0];
t('the nudge sweep greps for #START, and still for #BEFORE from older phones', [have, JSON.stringify(fq).includes('%#START%'), JSON.stringify(fq).includes('%#BEFORE%')], [{ te1: true, te2: true }, true, true]);

// ---- roles (T2.0): who is what, and only Operations may change it ----
props = {}; cacheStore = {};
const OPS = { email:'operations@deitemeyerbrothers.com', name:'Operations', userId:'u0', membershipId:'m0', role:'Admin' };
const ALBERTO = { email:'alberto@deitemeyerbrothers.com', name:'Alberto Gonzalez', userId:'u2', membershipId:'22PdPUpWzpHy', role:'Crew' };
const TYLER = { email:'tylermohr94@gmail.com', name:'Tyler Mohr', userId:'u3', membershipId:'m3', role:'Site Manager' };
const CARL = { email:'carl.bledsoe@deitemeyerbrothers.com', name:'Carl Bledsoe', userId:'u4', membershipId:'m4', role:'Admin' };
t('ops is the one list in the code', sandbox.roleFor_(OPS), { role:'ops', source:'code' });
t('Alberto is service off his membership id', sandbox.roleFor_(ALBERTO), { role:'service', source:'default' });
t('a JobTread Site Manager gets the Day log by default', sandbox.roleFor_(TYLER), { role:'siteManager', source:'default' });
t('Carl\'s work account tests the service view', sandbox.roleFor_(CARL), { role:'service', source:'default' });
t('everyone else is crew', sandbox.roleFor_(ME), { role:'crew', source:'default' });
t('a crew member cannot set roles', /^NOT_OPS/.test(refusedBy(() => sandbox.setRole(ME, 'alberto@deitemeyerbrothers.com', 'crew'))), true);
t('nobody can be made ops from the app', /in the code/.test(refusedBy(() => sandbox.setRole(OPS, 'operations@deitemeyerbrothers.com', 'crew'))), true);
t('an unknown role is refused', /Unknown role/.test(refusedBy(() => sandbox.setRole(OPS, 'x@deitemeyerbrothers.com', 'boss'))), true);
r = sandbox.setRole(OPS, 'Alberto@deitemeyerbrothers.com', 'crew');
t('Operations moves Alberto off the seed', [r.role, r.source, sandbox.roleFor_(ALBERTO)], ['crew', 'set', { role:'crew', source:'set' }]);
r = sandbox.setRole(OPS, 'alberto@deitemeyerbrothers.com', '');
t('clearing puts the default back', [r.source, sandbox.roleFor_(ALBERTO).role], ['default', 'service']);
sandbox.seenPerson_(TYLER); sandbox.seenPerson_(ME);
r = sandbox.getPeople(OPS);
t('the People list: seen people, the seeds and ops, by role', r.people.map(p => p.name || p.email),
  ['operations@deitemeyerbrothers.com', 'Alberto Gonzalez', 'carl.bledsoe@deitemeyerbrothers.com', 'Yahir Gonzalez', 'Tyler Mohr', 'Tyler B.']);
t('a seed listed before its first sign-in is marked pending', r.people.filter(p => p.pending).map(p => p.name), ['Alberto Gonzalez', 'Yahir Gonzalez']);
t('getPeople is Operations only', /^NOT_OPS/.test(refusedBy(() => sandbox.getPeople(TYLER))), true);
t('the profile carries the app role beside JobTread\'s', [sandbox.bootProfile_(TYLER).appRole, sandbox.bootProfile_(TYLER).role, sandbox.bootProfile_(OPS).ops], ['siteManager', 'Site Manager', true]);

// ---- close out (T2.0): the door to the CheckOut server ----
props = {}; fetched = [];
t('a crew member is refused before any call', /^NO_CLOSEOUT/.test(refusedBy(() => sandbox.coQueue(ME))), true);
t('unconfigured -> says so, no fetch', [sandbox.coQueue(ALBERTO).reason, fetched.length], ['not-configured', 0]);
props = { CLOSEOUT_API_URL: 'https://closeout.example.com/', CLOSEOUT_SECRET: 'co-secret' };
fetchImpl = () => ({ code: 200, body: '[{"id":"j1"}]' });
r = sandbox.coQueue(ALBERTO);
t('queue -> forwarded with the secret and WHO is asking', [r.status, r.body, fetched[0].url, fetched[0].opts.headers.Authorization,
   fetched[0].opts.headers['X-Acting-Email'], fetched[0].opts.headers['X-Acting-Name'], fetched[0].opts.followRedirects],
  [200, [{ id:'j1' }], 'https://closeout.example.com/queue', 'Bearer co-secret', 'alberto@deitemeyerbrothers.com', 'Alberto Gonzalez', false]);
fetched = [];
r = sandbox.coReport(ALBERTO, 'j1', { location: 'Rear', englishNote: 'Cracked boot' }, 'ob_12.r1');
t('a write carries the client ref and the body', [fetched[0].opts.method, fetched[0].opts.headers['X-Client-Ref'], JSON.parse(fetched[0].opts.payload).englishNote], ['post', 'ob_12.r1', 'Cracked boot']);
fetched = [];
sandbox.coReport(ALBERTO, 'j1', { location: 'Rear', englishNote: 'x' }, 'bad ref!');
t('a malformed ref is dropped, not sent', 'X-Client-Ref' in fetched[0].opts.headers, false);
t('a bad job id never reaches the server', /Missing job id/.test(refusedBy(() => sandbox.coJob(ALBERTO, '../etc'))), true);
fetchImpl = () => ({ code: 409, body: '{"error":"not yet"}' });
t('a 409 comes back as status and body, not a throw', [sandbox.coPhoto(ALBERTO, 'j1', { label:'REPORT', imageBase64:'data:image/jpeg;base64,xx' }, 'ob_1.p0').status, sandbox.coPhoto(ALBERTO, 'j1', { label:'REPORT', imageBase64:'data:image/jpeg;base64,xx' }).body.error], [409, 'not yet']);
fetchImpl = () => { throw new Error('DNS'); };
t('a dead server is a reason, never a throw', sandbox.coQueue(OPS).reason, 'unreachable');
fetchImpl = () => ({ code: 307, body: '' });
t('a sign-in bounce is named', sandbox.coQueue(OPS).reason, 'signin-bounce');
fetchImpl = () => ({ code: 200, body: '{"translations":["Cracked boot"]}' }); fetched = [];
r = sandbox.coTranslate(ALBERTO, ['la bota está rota'], 'en');
t('translate -> direction rides the body', JSON.parse(fetched[0].opts.payload), { texts: ['la bota está rota'], to: 'en' });

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
