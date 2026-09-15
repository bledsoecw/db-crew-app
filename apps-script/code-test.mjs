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
let props = {}, cacheStore = {}, fetched = [];
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
    return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
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

// ---- boot: the clock first, everything else after ----
// Collapsing all of boot into one call fixed the queueing and created a worse
// problem — seven-plus sequential Pave round trips in a single execution, which
// overran the client's 25-second ceiling and failed boot outright. getStart
// must stay down to what the first screen cannot be drawn without. The code
// list, the job picker and the crew block are all behind a tap, so they belong
// in getExtras, after the app is already usable.
props = {}; cacheStore = {}; fetched = [];
let calls = [];
sandbox.openEntryFor_ = () => { calls.push('open'); return null; };
sandbox.fetchJobs_ = () => { calls.push('job'); return [{ id: 'j1' }]; };
sandbox.getMyDay = () => { calls.push('day'); return []; };
sandbox.getJobCodes = () => { calls.push('codes'); return [{ id: 'ci1' }]; };
sandbox.getJobOptions = () => { calls.push('options'); return [{ id: 'j1' }, { id: 'j2' }]; };
sandbox.getCrewOnClock = () => { calls.push('crew'); return [{ name: 'Alberto' }]; };

const crewMe = { ...ME, role: 'Crew' };
const s1 = sandbox.getStart(crewMe, 'j1');
t('getStart carries the profile', [s1.me.name, s1.me.userId, s1.me.build], ['Tyler B.', 'u1', sandbox.APP_BUILD]);
t('getStart carries the clock', [s1.job.id, s1.open, s1.entries.length], ['j1', null, 0]);
t('getStart stops at what the screen needs', calls, ['open', 'job', 'day']);

calls = [];
const x1 = sandbox.getExtras(crewMe, 'j1');
t('getExtras carries the codes and the picker', [x1.codes.length, x1.jobOptions.length], [1, 2]);
t('a crew member gets no crew block', [x1.crew.length, calls.indexOf('crew')], [0, -1]);

const bossMe = { ...ME, role: 'Sales Team Manager' };
t('a manager is a foreman', sandbox.getStart(bossMe, null).me.isForeman, true);
t('and gets the crew block', sandbox.getExtras(bossMe, 'j1').crew.length, 1);

// no extra is worth failing for, and none may take the others down with it
sandbox.getJobCodes = () => { throw new Error('pave down'); };
sandbox.getJobOptions = () => { throw new Error('pave down'); };
sandbox.getCrewOnClock = () => { throw new Error('pave down'); };
const x3 = sandbox.getExtras(bossMe, 'j1');
t('a failing extra returns empty, not an error', [x3.codes.length, x3.jobOptions.length, x3.crew.length], [0, 0, 0]);

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
t('never sends a name or a date for the signature', Object.keys(sent.checks).sort(), ['done', 'magnetBy', 'signOff']);
t('bearer header, JSON body, no redirects', [put.opts.headers.Authorization, put.opts.contentType, put.opts.followRedirects], ['Bearer s3cret', 'application/json', false]);
t('200 -> status and body come back verbatim', [r.status, r.reason, r.body.checks], [200, '', written]);

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
const paveOf = (opts) => { try { return JSON.parse(opts.payload).query; } catch { return null; } };
function route(handlers) {
  return (url, opts) => {
    if (url.indexOf('/api/crew/assignments') > -1) return handlers.board(url, opts);
    if (url.indexOf('oauth2.googleapis.com/token') > -1) return { code: 200, body: '{"access_token":"at","expires_in":3600}' };
    if (url.indexOf('fcm.googleapis.com') > -1) { pushes.push(JSON.parse(opts.payload).message); return handlers.fcm ? handlers.fcm() : { code: 200, body: '{}' }; }
    const q = paveOf(opts) || {};
    if (q.organization && q.organization.tasks) return handlers.tasks ? handlers.tasks(q) : { code: 200, body: '{"organization":{"tasks":{"nodes":[]}}}' };
    if (q.organization && q.organization.jobs && q.organization.jobs.nodes && q.organization.jobs.nodes.customFieldValues) return handlers.people ? handlers.people(q) : { code: 200, body: '{"organization":{"jobs":{"nodes":[]}}}' };
    if (q.organization && q.organization.memberships) return handlers.member ? handlers.member(q) : { code: 200, body: '{"organization":{"memberships":{"nodes":[]}}}' };
    if (q.createDailyLog) return handlers.dailyLog ? handlers.dailyLog(q) : { code: 200, body: '{"createDailyLog":{"createdDailyLog":{"id":"dl1"}}}' };
    if (q.createComment) return handlers.comment ? handlers.comment(q) : { code: 200, body: '{"createComment":{"createdComment":{"id":"c1","createdAt":"2026-09-15T20:00:00Z"}}}' };
    return { code: 200, body: '{}' };
  };
}
let pushes = [];
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
fetchImpl = route({ people: PEOPLE, member: MEMBER,
  dailyLog: (q) => { jtCalls.push(['dailyLog', q.createDailyLog.$]); return { code: 200, body: '{"createDailyLog":{"createdDailyLog":{"id":"dl1"}}}' }; },
  comment: (q) => { jtCalls.push(['comment', q.createComment.$]); return { code: 200, body: '{"createComment":{"createdComment":{"id":"c1"}}}' }; } });
r = sandbox.sendDailyLog(ME, LOG);
const dl = jtCalls.find(c => c[0] === 'dailyLog')[1];
t('one daily log on the job, dated, notify on', [dl.jobId, dl.date, dl.notify], ['j9', '2026-09-15', true]);
t('assigned to the PM and the reps JobTread knows', dl.assignees, [{ membership: { membershipId: 'm_dave' } }, { membership: { membershipId: 'm_shawn' } }]);
t('photos ride by reference, only the uploaded ones, names made safe', dl.files, [{ copyFromFileId: 'f1', name: 'a.jpg' }, { copyFromFileId: 'f2', name: 'b-c.jpg' }]);
const N = dl.notes;
t('the notes read in the owner\'s order', [N.indexOf('WHAT GOT DONE') > -1, N.indexOf('WHAT GOT DONE') < N.indexOf('CONDITION WHEN I LEFT'), N.indexOf('CONDITION WHEN I LEFT') < N.indexOf('PROBLEMS, EXTRAS, RETURNS')], [true, true, true]);
t('...with the condition chips, the checks, the hours and the photo count',
  ['Crew still on site · Tarped · Left at 4:30', 'Handing over — 7 of 7 done · Magnet run by Kenton', '04MA Masonry Labor — 2h 18m', 'Total 3h 00m', '2 attached (1 before, 1 after)', 'with Platinum (Shingle)', '(sent to the office at the time)'].map(x => N.indexOf(x) > -1), [true, true, true, true, true, true, true]);
t('the answer says who was assigned and who could not be', [r.dailyLogId, r.assigned, r.unresolved, r.photos], ['dl1', ['Dave Elick', 'Shawn Deitemeyer'], ['Jenn Grubb'], 2]);
const cm = jtCalls.find(c => c[0] === 'comment')[1];
t('a problem pings the same people in the feed, once', [r.flag, r.commented, cm.targetType, cm.targetId, cm.assignees.length, cm.message.indexOf('Short 8 pieces of drip edge') > -1], ['problems', true, 'job', 'j9', 2, true]);

jtCalls.length = 0;
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: false });
t('a routine day is the log alone, no comment', [r.flag, r.commented, jtCalls.map(c => c[0])], ['', false, ['dailyLog']]);
jtCalls.length = 0;
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: true });
t('a crew left on site without a sign-off is flagged', [r.flag, r.commented, jtCalls[1][1].message.indexOf('crew still on site when Tyler left at 4:30') > -1], ['crew-on-site', true, true]);
jtCalls.length = 0;
r = sandbox.sendDailyLog(ME, { ...LOG, problems: '', crewOnSite: true, checks: { words: 'Signed off — Tyler · Sep 15', magnetBy: null, signedOff: 'Tyler · Sep 15' } });
t('...but not once it is signed off', [r.flag, jtCalls.map(c => c[0])], ['', ['dailyLog']]);
t('a bad date falls back to the script\'s today', sandbox.sendDailyLog(ME, { ...LOG, date: 'soon' }).date, today);

jtCalls.length = 0;
r = sandbox.addDailyLogNote(ME, 'j9', 'dl1', 'Kenton dropped the returns at 5.');
t('a later note is a comment on the log itself, signed', [jtCalls[0][1].targetType, jtCalls[0][1].targetId, jtCalls[0][1].message], ['dailyLog', 'dl1', 'Tyler B.: Kenton dropped the returns at 5.']);

jtCalls.length = 0;
r = sandbox.postJobNote('j9', 'Need drip edge now', 'Tyler B.', true);
t('an urgent note is assigned to the PM', [jtCalls[0][1].assignees, r.assigned], [[{ membership: { membershipId: 'm_dave' } }], ['Dave Elick']]);
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

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
