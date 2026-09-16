// ===========================================================
// DB TIME CLOCK — crew clock-in for JobTread
// Build T1.1 (2026-07-28) — standalone Apps Script web app
// ===========================================================
// Companion to DB Cam Mobile. Same Pave patterns, same grant
// key, same auth model, same deployment story. This app is the
// TIME side: clock in against a job's Labor cost item, switch
// codes through the day, clock out — with before/during/after
// photos required at the moments they are actually owed.
//
// SETUP: see ../dbtimeclock-pwa/SETUP.md. Script Properties:
//   GRANT_KEY         the JobTread Pave grant key (shared with DB Cam)
//   OAUTH_CLIENT_ID   the Google web client id the PWA signs in with
//   SESSION_SECRET    long random string, signs the 30-day app session
//   SESSION_TTL_DAYS  optional, defaults to 30
//   APP_URL           optional, makes the bare /exec link redirect
//   WRITE_ENABLED     'true' to let the app post to JobTread
//   BOARD_API_URL     the Production Board origin, for assigned jobs and site checks
//   CREW_APP_SECRET   shared secret the board checks on /api/crew/*
//   EXTRA_ALLOWED_EMAILS  optional, comma-separated Google addresses let in beside the
//                     company domain (the two site managers on Gmail are already in
//                     SITE_MANAGER_EMAILS below; this is for the next one, without a deploy)
//   ACCESS_FEED_URL   optional, DB Hub's App access feed (see below). With it set,
//                     run installAccessFeedRefresh once: the feed is read from a
//                     copy a trigger keeps warm, never fetched while a phone waits
//   ACCESS_FEED_KEY   the feed key, if it isn't already baked into the URL
//   FCM_PROJECT_ID / FCM_SERVICE_ACCOUNT / PUSH_ENABLED  (push, see below)
//                     With push on, run installSchedulePushTrigger once as well:
//                     the evening "Tomorrow: …" line and "Schedule changed".
//
// ---- READ THIS BEFORE FLIPPING WRITE_ENABLED ----
// This org's time clock is LIVE. There were 5,831 real time
// entries and 18 people on the clock when this was written, and
// these records are payroll. WRITE_ENABLED defaults to FALSE:
// every read works, and every write throws a clear error instead
// of touching production. Turn it on once you have watched the
// app read correctly. WRITE_JOB_ALLOWLIST narrows writes further
// to specific job ids while you are testing.
// ===========================================================

var GRANT_KEY = PropertiesService.getScriptProperties().getProperty('GRANT_KEY') || 'PASTE_GRANT_KEY_INTO_SCRIPT_PROPERTIES';
var ORG = '22PBAjem8SSC';

var APP_BUILD = 'T1.10 (2026-09-15)';

var CAPTURE_FOLDER = 'DB Cam';     // photos land beside DB Cam's, so one report covers the job
var ENTRY_TYPE = 'Standard';       // 'Standard' is worked time; 'PTO' is the other value in use
var MAX_UPLOAD_BYTES = 45 * 1024 * 1024;

function doGet() {
  var appUrl = '';
  try { appUrl = PropertiesService.getScriptProperties().getProperty('APP_URL') || ''; } catch (e) {}
  var body = appUrl
    ? '<meta http-equiv="refresh" content="0;url=' + appUrl + '"><p style="font-family:sans-serif">Opening DB Time Clock… <a href="' + appUrl + '">tap here</a> if nothing happens.</p>'
    : '<p style="font-family:sans-serif">DB Time Clock runs as an installed app. Set the APP_URL Script Property to enable this redirect.</p>';
  return HtmlService.createHtmlOutput(body).setTitle('DB Time Clock');
}

// ===========================================================
// WRITE GUARD
// ===========================================================
function writeEnabled_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('WRITE_ENABLED') || '').toLowerCase() === 'true';
  } catch (e) { return false; }
}

function assertWrite_(jobId) {
  if (!writeEnabled_()) {
    throw new Error('READ_ONLY: this deployment cannot post to JobTread yet. Set the WRITE_ENABLED Script Property to "true" when you are ready.');
  }
  var allow = '';
  try { allow = PropertiesService.getScriptProperties().getProperty('WRITE_JOB_ALLOWLIST') || ''; } catch (e) {}
  if (allow && jobId && allow.indexOf(jobId) === -1) {
    throw new Error('READ_ONLY: job ' + jobId + ' is not in WRITE_JOB_ALLOWLIST.');
  }
}

// ===========================================================
// AUTH — identical model to DB Cam Mobile. Every request carries
// either a Google ID token or an app session token we minted
// after a real Google sign-in. The grant key never leaves here.
// ===========================================================
// Who may get past the sign-in. The company domain, plus an EXPLICIT list —
// never "any Google account". Two of the three site managers sign in with
// Gmail addresses, and those ARE their JobTread user emails (verified live,
// 2026-09-15), so memberFor_ resolves them like anyone else once they are
// through the door. Chris Blue is on the company domain and needs no line.
// The board keeps the same two in src/auth.ts (siteManagerEmailsInCode).
//
// NOTE the OAuth consent screen must be "External" for a Gmail account to
// sign in at all — an "Internal" app refuses them before this code runs.
// See SETUP.md §3.
var SITE_MANAGER_EMAILS = [
  'tylermohr94@gmail.com',    // Tyler Mohr — site manager (Sep 2026)
  'kentonmccomas@gmail.com'   // Kenton McComas — site manager (Sep 2026)
];

function emailAllowed_(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return false;
  if (/@deitemeyerbrothers\.com$/.test(email)) return true;
  if (SITE_MANAGER_EMAILS.indexOf(email) !== -1) return true;
  var extra = '';
  try { extra = PropertiesService.getScriptProperties().getProperty('EXTRA_ALLOWED_EMAILS') || ''; } catch (e) {}
  var list = extra.split(/[,\s;]+/).map(function (x) { return x.toLowerCase().trim(); }).filter(Boolean);
  return list.indexOf(email) !== -1;
}

function verifyIdToken_(idToken) {
  if (!idToken) throw new Error('AUTH');
  var sessionEmail = verifySessionToken_(idToken);
  if (sessionEmail) return sessionEmail;
  var clientId = '';
  try { clientId = PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_ID') || ''; } catch (e) {}
  if (!clientId) throw new Error('Server not configured: set the OAUTH_CLIENT_ID Script Property.');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) return hit;
  var resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('AUTH');
  var info = {};
  try { info = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('AUTH'); }
  if (info.aud !== clientId) throw new Error('AUTH');
  if (String(info.email_verified) !== 'true') throw new Error('AUTH');
  var email = String(info.email || '').toLowerCase();
  if (!emailAllowed_(email)) throw new Error('AUTH');
  var ttl = Math.max(60, Math.min(3600, (Number(info.exp) || 0) - Math.floor(Date.now() / 1000) - 30));
  cache.put(key, email, ttl);
  return email;
}

// ---- Hub-managed access (DB Hub's "App access" panel) ----
// The hub publishes a token-gated JSON feed of who may use which company
// app. Blank / no row = the default here (a JobTread membership is the
// gate), 'Manager' also unlocks the crew block, 'Off' blocks the app.
// The feed being unreachable never locks the crew out of the clock.
// ---- DB Hub's App access feed ------------------------------------------
// The feed is read on EVERY request — doPost calls assertAccess_ before it
// dispatches anything — so it must never be fetched on the request path.
//
// It used to be: a five-minute cache and, on a miss, an inline UrlFetchApp
// call with the phone waiting. UrlFetchApp has no timeout, and the hub is
// itself an Apps Script web app behind the /exec redirect, so every cold
// reopen more than five minutes after the last stacked a second cold start in
// front of the clock. Past the client's 25-second ceiling that was the
// "api not reached / The API did not answer in 25 seconds" boot fault, and it
// came back on every reopen because the breaker here only ever tripped on a
// hub that was DOWN — a hub that answered correctly but slowly tripped
// nothing, so the next cache expiry paid in full again (Carl, Sep 2026).
//
// Measured once the trigger was installed (15 Sep 2026): 7209ms, then 5095ms
// per refresh at a five-minute cadence — i.e. with the hub kept WARM. That is
// five to seven seconds that used to sit in front of every boot, before the
// clock's own Pave calls, under a 25-second ceiling; cold, with hours between
// launches, it was worse, and the trigger keeping the hub warm now means its
// true cold latency is no longer observable from here. Either way it does not
// belong on the request path.
//
// Now a time-driven trigger (installAccessFeedRefresh, every 5 minutes) keeps
// a copy warm and the request path only ever reads it: the cache first, then
// a durable copy in Script Properties that survives a cache eviction, and past
// ACCESS_FEED_MAX_AGE_SEC with no refresh, no opinion at all — so a trigger
// that quietly died cannot leave a months-old roster in charge of the door.
//
// No copy at all reads as "no opinion", exactly as an unreachable hub always
// has: the clock is payroll and the hub must never lock the crew out by
// accident. That window is the minutes between a fresh deploy and the first
// trigger run, and installAccessFeedRefresh runs one refresh immediately so
// in practice there is none.
var ACCESS_FEED_CACHE_SEC = 21600;        // CacheService's own ceiling (6h)
var ACCESS_FEED_MAX_AGE_SEC = 24 * 3600;  // older than this = the trigger is dead, not the truth
var ACCESS_FEED_PROP = 'dbaccess_copy_v1';
var ACCESS_FEED_PROP_MAX = 9000;          // a Script Property holds 9KB

function accessFeedUrl_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('ACCESS_FEED_URL') || '';
  if (!url) return '';
  if (url.indexOf('feed=') === -1) {
    var k = props.getProperty('ACCESS_FEED_KEY') || '';
    if (!k) return '';
    url += (url.indexOf('?') > -1 ? '&' : '?') + 'feed=' + encodeURIComponent(k);
  }
  return url;
}

/** The warm copy, or null. Never fetches. */
function accessFeedCopy_() {
  var hit = cacheGet_('dbaccess_v1');
  if (hit && hit.people) return hit;
  var raw = '';
  try { raw = PropertiesService.getScriptProperties().getProperty(ACCESS_FEED_PROP) || ''; } catch (e) {}
  if (!raw) return null;
  var copy = null;
  try { copy = JSON.parse(raw); } catch (e2) { return null; }
  if (!copy || !copy.feed || !copy.feed.people) return null;
  if ((Date.now() - (Number(copy.at) || 0)) / 1000 > ACCESS_FEED_MAX_AGE_SEC) return null;
  // Back into the cache so the next request doesn't read Properties again.
  cachePut_('dbaccess_v1', copy.feed, ACCESS_FEED_CACHE_SEC);
  return copy.feed;
}

/**
 * Fetch the feed and store it. Runs from the trigger, never from doPost.
 * Never throws: a bad answer leaves the last good copy in place, which is a
 * better door than none — and the failure is logged where the executions
 * list will show it, rather than surfacing on a phone.
 */
function refreshAccessFeed() {
  var url = accessFeedUrl_();
  if (!url) return 'ACCESS_FEED_URL is not set — nothing to refresh.';
  var t0 = Date.now();
  var feed = null, why = '';
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) why = 'HTTP ' + resp.getResponseCode();
    else {
      try { feed = JSON.parse(resp.getContentText()); } catch (pe) { why = 'not JSON'; }
      if (feed && !feed.people) { feed = null; why = 'no people map'; }
    }
  } catch (e) { why = (e && e.message) || String(e); }
  var ms = Date.now() - t0;
  if (!feed) {
    console.warn('access feed: refresh failed after ' + ms + 'ms (' + why + '); keeping the last good copy');
    return 'Refresh failed: ' + why;
  }
  cachePut_('dbaccess_v1', feed, ACCESS_FEED_CACHE_SEC);
  var copy = JSON.stringify({ at: Date.now(), feed: feed });
  if (copy.length <= ACCESS_FEED_PROP_MAX) {
    try { PropertiesService.getScriptProperties().setProperty(ACCESS_FEED_PROP, copy); } catch (e3) {}
  } else {
    console.warn('access feed: ' + copy.length + ' bytes is too big for a Script Property; cache only');
  }
  var n = 0; for (var k in feed.people) n++;
  console.log('access feed: ' + n + ' people in ' + ms + 'ms');
  return 'Refreshed: ' + n + ' people in ' + ms + 'ms.';
}

function dbAccessRec_(email) {
  var feed = accessFeedCopy_();
  if (!feed) return null;
  return feed.people[String(email || '').toLowerCase()] || null;
}

function assertAccess_(email) {
  var rec = dbAccessRec_(email);
  if (!rec) return null;
  var gone = /^(left|inactive|terminated)/i.test(String(rec.status || ''));
  if (gone || String(rec.timeClock || '') === 'Off') {
    throw new Error('NO_ACCESS: DB Time Clock access for ' + email +
      ' is turned off in DB Hub. Ask the office if that seems wrong.');
  }
  return rec;
}

function b64url_(obj) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
}

function mintSessionToken_(email) {
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret) throw new Error('Server not configured: set the SESSION_SECRET Script Property.');
  var ttlDays = Number(PropertiesService.getScriptProperties().getProperty('SESSION_TTL_DAYS')) || 30;
  var now = Math.floor(Date.now() / 1000);
  var payload = { email: email, iss: 'dbtc-session', iat: now, exp: now + ttlDays * 86400 };
  var signingInput = b64url_({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url_(payload);
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(signingInput, secret)).replace(/=+$/, '');
  return { token: signingInput + '.' + sig, exp: payload.exp };
}

function verifySessionToken_(token) {
  var parts = String(token).split('.');
  if (parts.length !== 3) return null;
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret) return null;
  var expectedSig;
  try {
    expectedSig = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(parts[0] + '.' + parts[1], secret)).replace(/=+$/, '');
  } catch (e) { return null; }
  if (expectedSig !== parts[2]) return null;
  var payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString()); } catch (e) { return null; }
  if (payload.iss !== 'dbtc-session') return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return String(payload.email || '').toLowerCase();
}

// The last calls the API answered, for the Build panel. A phone that timed
// out never saw its own reply; the next getStart carries this list, so the
// server's side of the story is a tap away. CacheService, not a property:
// this is diagnostics, and two executions finishing together may drop each
// other's line — fine here, never for anything that matters.
var RECENT_CALLS_KEY = 'recent_calls_v1', RECENT_CALLS_MAX = 30;
function recordCall_(fn, email, out) {
  try {
    var cache = CacheService.getScriptCache(), list = [];
    try { list = JSON.parse(cache.get(RECENT_CALLS_KEY) || '[]') || []; } catch (e0) { list = []; }
    list.push({ fn: fn || '?', who: String(email || '').split('@')[0].slice(0, 16), at: Date.now(),
                ms: out.ms.total, pave: out.ms.pave, paveMs: out.ms.paveMs, ok: out.ok ? 1 : 0,
                err: out.ok ? '' : String(out.error || '').slice(0, 80) });
    if (list.length > RECENT_CALLS_MAX) list = list.slice(list.length - RECENT_CALLS_MAX);
    cache.put(RECENT_CALLS_KEY, JSON.stringify(list), 21600);
  } catch (e) { /* diagnostics only */ }
}
function recentCalls_() {
  try { return JSON.parse(CacheService.getScriptCache().get(RECENT_CALLS_KEY) || '[]') || []; } catch (e) { return []; }
}

function doPost(e) {
  var t0 = Date.now(), tAuth = 0, tMember = 0, fn = '', email = '', out;
  PAVE_T.n = 0; PAVE_T.ms = 0;
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (pe) { throw new Error('Bad request body.'); }
    email = verifyIdToken_(body.t);
    assertAccess_(email);
    tAuth = Date.now();
    fn = String(body.fn || '');
    var args = Object.prototype.toString.call(body.args) === '[object Array]' ? body.args : [];

    // Every write is stamped with the caller resolved from the verified token,
    // never with a user id sent by the client.
    var WITH_USER = {
      getStart: getStart,
      getExtras: getExtras,
      getToday: getToday,
      clockIn: clockIn,
      switchCode: switchCode,
      clockOut: clockOut,
      getMyDay: getMyDay,
      getMyJobs: getMyJobs,
      saveSiteChecks: saveSiteChecks,
      sendDailyLog: sendDailyLog,
      addDailyLogNote: addDailyLogNote,
      registerPushToken: registerPushToken,
      unregisterPushToken: unregisterPushToken
    };
    var PLAIN = {
      getJobOptions: getJobOptions,
      getNearbyCandidates: getNearbyCandidates,
      searchJobs: searchJobs,
      getJobCodes: getJobCodes,
      createCaptureUploadRequest: createCaptureUploadRequest,
      finalizeCaptureUpload: finalizeCaptureUpload,
      uploadCapture: uploadCapture,
      postJobNote: postJobNote,
      getCrewOnClock: getCrewOnClock,
      markNudged: markNudged
    };

    var data;
    if (fn === 'getBoot') data = getBootFor_(email);
    else if (fn === 'exchangeSession') data = mintSessionToken_(email);
    else if (WITH_USER[fn]) {
      var me = memberFor_(email);
      tMember = Date.now();
      data = WITH_USER[fn].apply(null, [me].concat(args));
    }
    else if (PLAIN[fn]) data = PLAIN[fn].apply(null, args);
    else throw new Error('Unknown function: ' + fn);
    out = { ok: true, data: (data === undefined ? null : data) };
  } catch (err) {
    var msg = (err && err.message) || String(err);
    out = { ok: false, error: msg, auth: msg === 'AUTH', readOnly: msg.indexOf('READ_ONLY') === 0,
      noAccess: msg.indexOf('NO_ACCESS') === 0 };
  }
  // Where the time went, on every reply — the sign-in check, the membership
  // lookup, the work itself and JobTread inside it — so a phone that waited
  // can say which. And a line in the recent-calls log for the phones that
  // gave up before this answer reached them (getStart hands the log back).
  var now = Date.now(), tWork = tMember || tAuth;
  out.ms = { total: now - t0, auth: (tAuth || now) - t0, member: tMember ? tMember - tAuth : 0,
             fn: tWork ? now - tWork : 0, pave: PAVE_T.n, paveMs: PAVE_T.ms };
  recordCall_(fn, email, out);
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- PAVE API CALL (same pattern as DB Cam / the dashboard) ----
var PAVE_URL = 'https://api.jobtread.com/pave';
// A per-execution tally, so every reply can say how much of its time was
// JobTread's (`ms.pave`, `ms.paveMs`). A round trip from here costs seconds,
// not the tens of milliseconds a laptop sees — which is why questions that
// don't depend on each other go out together (paveAll_).
var PAVE_T = { n: 0, ms: 0 };

function paveParams_(queryBody) {
  var q = { '$': { grantKey: GRANT_KEY } };
  for (var k in queryBody) q[k] = queryBody[k];
  return { method: 'post', contentType: 'application/json', payload: JSON.stringify({ query: q }), muteHttpExceptions: true };
}
function paveParse_(code, body) {
  var data;
  try {
    data = JSON.parse(body);
  } catch (e2) {
    throw new Error('Pave HTTP ' + code + ' — ' + String(body).slice(0, 300));
  }
  if (code >= 400 || data.errors || data.error) {
    throw new Error('Pave error (HTTP ' + code + '): ' + JSON.stringify(data.errors || data.error || data).slice(0, 300));
  }
  return data;
}
function pave(queryBody) {
  var t0 = Date.now(), opts = paveParams_(queryBody);
  try {
    var resp = UrlFetchApp.fetch(PAVE_URL, opts);
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code >= 400 && String(body).charAt(0) !== '{') {
      // Not JobTread's own answer (a gateway page): once more, after a pause.
      Utilities.sleep(1500);
      resp = UrlFetchApp.fetch(PAVE_URL, opts);
      code = resp.getResponseCode();
      body = resp.getContentText();
    }
    return paveParse_(code, body);
  } finally { PAVE_T.n++; PAVE_T.ms += Date.now() - t0; }
}
/** Several queries that don't depend on each other, in one round trip.
 *  Returns [{ data } | { error }] in the same order: one failing never hides
 *  the others' answers, and the caller says which ones it cannot do without. */
function paveAll_(queries) {
  if (!queries || !queries.length) return [];
  var t0 = Date.now();
  var reqs = queries.map(function (qb) { var p = paveParams_(qb); p.url = PAVE_URL; return p; });
  var resps;
  try { resps = UrlFetchApp.fetchAll(reqs); }
  catch (e) {
    PAVE_T.n += queries.length; PAVE_T.ms += Date.now() - t0;
    return queries.map(function () { return { error: e }; });
  }
  PAVE_T.n += queries.length; PAVE_T.ms += Date.now() - t0;
  return resps.map(function (resp, i) {
    var code = resp.getResponseCode(), body = resp.getContentText();
    if (code >= 400 && String(body).charAt(0) !== '{') {
      // A gateway page for this one: pave()'s own pause-and-retry.
      try { return { data: pave(queries[i]) }; } catch (e1) { return { error: e1 }; }
    }
    try { return { data: paveParse_(code, body) }; } catch (e2) { return { error: e2 }; }
  });
}

// ===========================================================
// WHO IS CALLING
// ===========================================================
function memberFor_(email) {
  email = String(email || '').toLowerCase();
  if (!email) throw new Error('AUTH');
  var cache = CacheService.getScriptCache();
  var ck = 'mem_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)).slice(0, 40);
  var hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  var name = '', userId = '', membershipId = '', role = '';
  try {
    // `=` first, then `like`. JobTread keeps the address as it was typed, so a
    // capital letter in there misses an exact match against the lowercased
    // token email; `like` is case-insensitive. Same two tries as the board's
    // membershipForEmail, so the two sides can't resolve a person differently.
    var wheres = [
      [['user', 'emailAddress'], email],
      [['user', 'emailAddress'], 'like', email]
    ];
    for (var wi = 0; wi < wheres.length && !userId; wi++) {
      var d = pave({
        organization: {
          '$': { id: ORG },
          memberships: {
            // The field is emailAddress. `email` does not exist on membership.user
            // and Pave rejects the whole query with "The field \"email\" does not
            // exist" — which this function's catch swallows, so every sign-in used
            // to fail as "No JobTread user is linked to ...". Verified 2026-09-14.
            '$': { where: wheres[wi], size: 1 },
            nodes: { id: {}, role: { name: {} }, user: { id: {}, name: {} } }
          }
        }
      });
      var ns = (((d.organization || {}).memberships || {}).nodes) || [];
      if (ns.length) {
        membershipId = ns[0].id || '';
        role = ((ns[0].role || {}).name) || '';
        userId = ((ns[0].user || {}).id) || '';
        name = ((ns[0].user || {}).name) || '';
      }
    }
  } catch (e) { /* fall through */ }

  if (!userId) {
    throw new Error('No JobTread user is linked to ' + email + '. Ask the office to add you to the organization.');
  }
  if (!name) {
    name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  var m = { email: email, name: name, userId: userId, membershipId: membershipId, role: role };
  cache.put(ck, JSON.stringify(m), 21600); // 6h
  return m;
}
function getBootFor_(email) {
  return bootProfile_(memberFor_(email));
}

// One place builds the signed-in profile, so getBoot and getStart can never
// disagree about who is a foreman.
function bootProfile_(m) {
  var ax = null;
  try { ax = dbAccessRec_(m.email); } catch (eAx) {}
  return {
    email: m.email,
    name: m.name,
    userId: m.userId,
    membershipId: m.membershipId,
    role: m.role,
    // Foreman gets the crew block. Role names are the org's own, so this is a
    // contains-match rather than an exact one; a 'Manager' grant in DB Hub's
    // App access panel unlocks it too.
    isForeman: (ax && String(ax.timeClock || '') === 'Manager') ||
      /foreman|super|manager|owner|admin/i.test(m.role || ''),
    captureFolder: CAPTURE_FOLDER,
    writeEnabled: writeEnabled_(),
    build: APP_BUILD
  };
}

// ===========================================================
// JOBS — which job am I standing on?
// There is no reliable dated schedule in this org (tasks mostly
// have null dates), so the job is resolved the way DB Cam does:
// the jobs you have recently clocked into, plus GPS proximity,
// plus whatever the app remembered last. You can always pick.
// ===========================================================
function recentJobsQuery_(userId) {
  return {
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': { where: [['user', 'id'], userId], sortBy: [{ field: 'startedAt', order: 'desc' }], size: 60 },
        nodes: { startedAt: {}, job: { id: {} } }
      }
    }
  };
}
/** The picker's list from the caller's recent entries (already fetched):
 *  the last ten distinct jobs, richest first worked; cached. */
function jobOptionsFrom_(userId, d) {
  var jobIds = [], seen = {}, lastByJob = {};
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  for (var i = 0; i < ns.length && jobIds.length < 10; i++) {
    var j = ns[i].job;
    if (!j || !j.id || seen[j.id]) continue;
    seen[j.id] = 1;
    lastByJob[j.id] = ns[i].startedAt;
    jobIds.push(j.id);
  }
  if (!jobIds.length) return [];
  var rich = fetchJobs_({ 'in': [{ field: 'id' }, jobIds.map(function (id) { return { value: id }; })] }, jobIds.length);
  rich.forEach(function (r) { if (lastByJob[r.id]) r.lastWorked = lastByJob[r.id]; });
  rich.sort(function (a, b) { return String(b.lastWorked || '').localeCompare(String(a.lastWorked || '')); });
  if (userId) cachePut_('jo_' + userId, rich, JOBS_CACHE_SEC);
  return rich;
}
function getJobOptions(userId) {
  if (userId) {
    var cached = cacheGet_('jo_' + userId);
    if (cached) return cached;
  }
  if (!userId) return [];
  var d = null;
  try { d = pave(recentJobsQuery_(userId)); } catch (e) { return []; }
  return jobOptionsFrom_(userId, d);
}

function searchJobs(term) {
  term = String(term || '').trim();
  if (!term) return [];
  var pat = '%' + term.replace(/[%_\\]/g, '') + '%';
  return fetchJobs_({
    or: [
      { like: [{ field: 'name' }, { value: pat }] },
      { like: [{ field: 'number' }, { value: pat }] },
      { like: [{ field: ['location', 'account', 'name'] }, { value: pat }] }
    ]
  }, 25);
}

function jobsQuery_(where, size) {
  return {
    organization: {
      '$': { id: ORG },
      jobs: {
        '$': { where: where, size: size || 25, sortBy: [{ field: 'createdAt', order: 'desc' }] },
        nodes: {
          id: {}, name: {}, number: {}, createdAt: {},
          location: { formattedAddress: {}, latitude: {}, longitude: {}, account: { name: {} } }
        }
      }
    }
  };
}
function jobsFrom_(data) {
  var nodes = (((data.organization || {}).jobs || {}).nodes) || [];
  return nodes.map(function (j) {
    var loc = j.location || {};
    return {
      id: j.id,
      name: j.name || '',
      number: j.number || '',
      customer: (loc.account && loc.account.name) || '',
      address: loc.formattedAddress || '',
      lat: (loc.latitude == null ? null : loc.latitude),
      lng: (loc.longitude == null ? null : loc.longitude)
    };
  });
}
function fetchJobs_(where, size) {
  return jobsFrom_(pave(jobsQuery_(where, size)));
}

// Flat job list with coordinates, for the client's haversine "nearest job".
function getNearbyCandidates() {
  var out = [], page = null;
  for (var i = 0; i < 2; i++) {
    var arg = { sortBy: [{ field: 'createdAt', order: 'desc' }], size: 100 };
    if (page) arg.page = page;
    var d = pave({
      organization: {
        '$': { id: ORG },
        jobs: {
          '$': arg,
          nextPage: {},
          nodes: { id: {}, name: {}, number: {}, location: { formattedAddress: {}, latitude: {}, longitude: {}, account: { name: {} } } }
        }
      }
    });
    var conn = ((d.organization || {}).jobs) || {};
    var nodes = conn.nodes || [];
    for (var n = 0; n < nodes.length; n++) {
      var j = nodes[n], loc = j.location || {};
      out.push({
        id: j.id, name: j.name || '', number: j.number || '',
        customer: (loc.account && loc.account.name) || '',
        address: loc.formattedAddress || '',
        lat: (loc.latitude == null ? null : loc.latitude),
        lng: (loc.longitude == null ? null : loc.longitude)
      });
    }
    page = conn.nextPage;
    if (!page || out.length >= 150) break;
  }
  return out;
}

// ===========================================================
// ASSIGNED JOBS — what the Production Board says this crew is on.
//
// The join is a JobTread membership id that already exists on
// both sides: memberFor_(email).membershipId here, and
// Crew.leadMembershipId in the board's roster. Google Workspace
// account -> membership id -> crew, an exact match.
//
// The board resolves the crew, this app only asks. Crew names on
// tasks are matched against the saved roster AND its aliases —
// renaming a crew in the board's Operations tab auto-keeps the
// old name so existing tasks don't come loose — and that roster
// lives in a private Vercel Blob this script cannot read. A
// first-name match against task names would look right and then
// silently stop finding jobs after a rename.
//
// See CREW-ASSIGNMENTS-API.md for the contract both repos build to.
//
// Script Properties:
//   BOARD_API_URL     https://ops.deitemeyerbrothers.com
//   CREW_APP_SECRET   shared secret, same value as the board's env
// ===========================================================

var BOARD_LOOKAHEAD_DAYS = 13;   // today plus a fortnight: this week and next
// Yesterday too. A roof that ended yesterday and was never signed off is the
// morning-after nudge's whole reason to exist, and it needs the data to say so.
// The board already reaches back further for a multi-day install still running.
var BOARD_LOOKBACK_DAYS = 1;
var BOARD_CACHE_SEC = 120;       // a re-opened app shouldn't re-hit the board
// UrlFetchApp has no timeout, and Apps Script runs one execution at a time per
// user — so a board that answers slowly does not just delay this call, it
// queues getBoot and getToday behind it and the whole app looks frozen. "Never
// blocked by the board" has to cover slow as well as down, so a call that
// overruns trips a breaker and the next few requests skip the board entirely.
var BOARD_SLOW_MS = 8000;
var BOARD_COOLDOWN_SEC = 300;
var BOARD_MAX_SPAN_DAYS = 60;    // ceiling on a client-supplied range
var BOARD_MAX_BACKDATE_DAYS = 30;

function boardConfig_() {
  var url = '', secret = '';
  try {
    var p = PropertiesService.getScriptProperties();
    url = String(p.getProperty('BOARD_API_URL') || '').replace(/\/+$/, '');
    secret = String(p.getProperty('CREW_APP_SECRET') || '');
  } catch (e) { /* unconfigured reads as empty */ }
  return { url: url, secret: secret };
}

// The script's own time zone, matching getMyDay's day boundary.
function isoDay_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function addDays_(iso, n) {
  var d = new Date(iso + 'T12:00:00Z');   // midday, so a DST shift can't roll the date
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The window the app asks for when it sends none: yesterday through a fortnight.
function boardWindow_(today) {
  return { from: addDays_(today, -BOARD_LOOKBACK_DAYS), to: addDays_(today, BOARD_LOOKAHEAD_DAYS) };
}

// One key for the cached answer, so a site-checks save can drop exactly the
// copy the next getMyJobs would otherwise serve.
function myJobsCacheKey_(membershipId, from, to) {
  return 'mj_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      membershipId + '|' + from + '|' + to)).slice(0, 40);
}

/**
 * The crew member's assigned jobs, from the Production Board.
 *
 * Registered in WITH_USER, so `me` is resolved from the verified Google token
 * and the membership id is never one the phone sent. A crew member must not be
 * able to read another crew's schedule by editing a request.
 *
 * NEVER THROWS for a board problem. The clock is payroll and cannot be blocked
 * by the board being down, unreachable or not yet deployed — every failure
 * comes back as source:'fallback' with the recent-jobs list getJobOptions has
 * always produced, and a reason the UI can show honestly.
 */
function getMyJobs(me, from, to) {
  var today = isoDay_(new Date());
  var win = boardWindow_(today);
  from = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? from : win.from;
  to = /^\d{4}-\d{2}-\d{2}$/.test(String(to || '')) ? to : win.to;
  // The app never sends a range, but a signed-in crew member could. The board
  // is shared production and fetchVisits pages over the whole window, so the
  // span is clamped here rather than trusted: this is the only caller that can
  // choose how much work the board does.
  var floor = addDays_(today, -BOARD_MAX_BACKDATE_DAYS);
  if (from < floor) from = floor;
  if (to < from) to = from;
  var ceiling = addDays_(from, BOARD_MAX_SPAN_DAYS);
  if (to > ceiling) to = ceiling;

  var out = { source: 'fallback', reason: '', crew: null, range: { from: from, to: to }, visits: [], jobs: [] };

  if (!me.membershipId) {
    // Signed in, in the organization, but no membership the board can key on.
    out.reason = 'no-membership';
    out.jobs = fallbackJobs_(me);
    return out;
  }

  var cfg = boardConfig_();
  if (!cfg.url || !cfg.secret) {
    out.reason = 'not-configured';
    out.jobs = fallbackJobs_(me);
    return out;
  }

  // Breaker open: the board overran recently, so don't queue behind it again.
  var cache0 = CacheService.getScriptCache();
  if (cache0.get('board_slow')) {
    out.reason = 'board-slow';
    out.jobs = fallbackJobs_(me);
    return out;
  }

  var ck = myJobsCacheKey_(me.membershipId, from, to);
  var cache = CacheService.getScriptCache();
  var hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* fall through and refetch */ } }

  var body, startedMs = Date.now(), elapsedMs = 0;
  try {
    var resp = fetchAssignmentsRaw_(cfg, me.membershipId, from, to);
    elapsedMs = Date.now() - startedMs;
    if (elapsedMs > BOARD_SLOW_MS) tripBoardBreaker_(elapsedMs);
    var code = resp.code;
    var text = resp.text;
    if (code === 307 || code === 302) {
      out.reason = 'board-signin-bounce';   // add api/crew to the matcher in src/proxy.ts
      out.jobs = fallbackJobs_(me);
      return out;
    }
    if (code !== 200) {
      out.reason = 'board-http-' + code;
      out.jobs = fallbackJobs_(me);
      return out;
    }
    body = JSON.parse(text);
  } catch (e) {
    elapsedMs = Date.now() - startedMs;
    if (elapsedMs > BOARD_SLOW_MS) tripBoardBreaker_(elapsedMs);
    out.reason = 'board-unreachable';
    out.boardMs = elapsedMs;
    out.jobs = fallbackJobs_(me);
    return out;
  }

  out.source = 'board';
  out.boardMs = elapsedMs;
  out.crew = body.crew || null;
  // How to draw any visit's site checks — the three phases and the 28 lines,
  // the board's own wording. Passed through untouched: the app renders from
  // this and never hardcodes a line, so the board can reword one without an
  // app release. Absent from an older board, and the app says so.
  out.checklist = body.checklist || null;
  out.visits = (body.visits || []).map(function (v) { return shapeVisit_(v, today); });
  out.visits.sort(function (a, b) {
    return String(a.start).localeCompare(String(b.start)) || String(a.jobNum).localeCompare(String(b.jobNum));
  });
  if (!out.crew) out.reason = 'no-crew';
  // Two labels the cards and the daily log want. Never allowed to fail the list.
  try { enrichVisits_(out.visits); } catch (eEnrich) { /* labels only */ }

  // A resolved crew with nothing booked is a real answer, not a failure — but
  // the crew member still needs somewhere to clock in, so the recent-jobs list
  // rides along rather than leaving them with an empty screen. Yesterday's
  // visit is in the window now, and it is not somewhere to clock in today.
  var anyCurrent = out.visits.some(function (v) { return !v.end || v.end >= today; });
  if (!anyCurrent) out.jobs = fallbackJobs_(me);

  try { cache.put(ck, JSON.stringify(out), BOARD_CACHE_SEC); } catch (e) {}
  return out;
}

// The one HTTP call to the board's assignments route, shared with the schedule
// sweep. Throws on a network failure; the callers decide what that means.
function fetchAssignmentsRaw_(cfg, membershipId, from, to) {
  var resp = UrlFetchApp.fetch(
    cfg.url + '/api/crew/assignments' +
      '?membershipId=' + encodeURIComponent(membershipId) +
      '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to),
    {
      method: 'get',
      headers: { Authorization: 'Bearer ' + cfg.secret },
      muteHttpExceptions: true,
      followRedirects: false   // a 307 to Google sign-in means the proxy matcher is wrong, not that we should follow it
    });
  return { code: resp.getResponseCode(), text: resp.getContentText() };
}

// Day n of m, and the job shape the clock screen already knows how to render.
function shapeVisit_(v, today) {
  var days = Number(v.days) || 1;
  var dayOf = null;
  if (v.start && today >= v.start && (!v.end || today <= v.end)) {
    var ms = new Date(today + 'T12:00:00Z') - new Date(v.start + 'T12:00:00Z');
    dayOf = Math.min(days, Math.max(1, Math.round(ms / 86400000) + 1));
  }
  return {
    taskId: v.taskId || '',
    jobId: v.jobId || '',
    jobNum: v.jobNum || '',
    jobName: v.jobName || '',
    start: v.start || '',
    end: v.end || v.start || '',
    days: days,
    dayOf: dayOf,
    today: !!(v.start && today >= v.start && (!v.end || today <= v.end)),
    crewNote: v.crewNote || '',
    cust: v.cust || '',
    city: v.city || '',
    address: v.address || '',
    status: v.status || '',
    jtype: v.jtype || '',
    material: v.material || null,
    // The JOB's site checks, or null when the job has none. `checks.taskId` is
    // the task the list sits on — usually the roofing crew's line, not this
    // visit's own task — and is what saveSiteChecks must be given. Untouched.
    checks: v.checks || null
  };
}

/* One slow answer is enough to stop asking for a while. The cost of a stale
   job list is a crew member tapping refresh; the cost of not tripping is the
   clock screen hanging behind a queued execution. */
function tripBoardBreaker_(ms) {
  try {
    CacheService.getScriptCache().put('board_slow', String(ms), BOARD_COOLDOWN_SEC);
  } catch (e) {}
}

// The pre-board answer to "which job am I on", kept as the fallback rather
// than removed: it is what keeps the clock working when the board is down.
function fallbackJobs_(me) {
  try { return getJobOptions(me.userId); } catch (e) { return []; }
}

// ---- the job's people, and who is on the roof with you --------------------
// The Project Manager and Sales Rep fields on the job — the same custom fields
// the board reads (its src/lib/jobtread/ids.ts; verified live 2026-09-15).
// Option fields holding user names; Sales Rep can hold several.
var CF_SALES_REP = '22PBzhswJYd8';
var CF_PROJECT_MANAGER = '22PC4DSTx7tg';

/**
 * Two labels, read in two Pave calls and never allowed to fail the list:
 *
 *   alongside  the crew whose line the site checks sit on — "with Platinum"
 *              for a site manager overseeing them. It is that task's own name
 *              minus its "Install —" prefix: a LABEL, not crew resolution (the
 *              board resolves crews against its roster and aliases; this app
 *              still asks it). Suppressed when the list is on this visit's own
 *              task — that is your own crew.
 *   pm / reps  the job's Project Manager and Sales Reps, as names. The daily
 *              log is assigned to them and the confirm sheet names them.
 */
function enrichVisits_(visits) {
  visits.forEach(function (v) { v.alongside = null; v.pm = ''; v.reps = []; });
  if (!visits.length) return;
  var taskIds = [], jobIds = [], seenT = {}, seenJ = {};
  visits.forEach(function (v) {
    var tid = v.checks && v.checks.taskId;
    if (tid && tid !== v.taskId && !seenT[tid]) { seenT[tid] = 1; taskIds.push(tid); }
    if (v.jobId && !seenJ[v.jobId]) { seenJ[v.jobId] = 1; jobIds.push(v.jobId); }
  });
  // Both labels, one round trip; each is best effort on its own.
  var qs = [], tags = [];
  if (taskIds.length) {
    qs.push({ organization: { '$': { id: ORG },
      tasks: { '$': { where: { and: [['id', 'in', taskIds]] }, size: 50 }, nodes: { id: {}, name: {} } } } });
    tags.push('tasks');
  }
  if (jobIds.length) { qs.push(jobPeopleQuery_(jobIds)); tags.push('people'); }
  var got = {};
  paveAll_(qs).forEach(function (r, i) { got[tags[i]] = r; });
  if (got.tasks && !got.tasks.error) {
    try {
      var byTask = {};
      ((((got.tasks.data.organization || {}).tasks || {}).nodes) || []).forEach(function (t) { byTask[t.id] = crewLabelFromTaskName_(t.name); });
      visits.forEach(function (v) {
        var tid = v.checks && v.checks.taskId;
        if (tid && tid !== v.taskId && byTask[tid]) v.alongside = byTask[tid];
      });
    } catch (e1) { /* a label */ }
  }
  if (got.people && !got.people.error) {
    try {
      var people = jobPeopleFrom_(got.people.data);
      visits.forEach(function (v) { var p = people[v.jobId]; if (p) { v.pm = p.pm; v.reps = p.reps; } });
    } catch (e2) { /* a label */ }
  }
}

/** "Roof install — Platinum (Shingle)" -> "Platinum (Shingle)"; anything else -> null. */
function crewLabelFromTaskName_(name) {
  var m = /install\s*[—–-]\s*(.+)$/i.exec(String(name || ''));
  var label = m ? m[1].trim() : '';
  return label || null;
}

/** { jobId: { pm, reps[] } } for the given jobs, one Pave call. */
function jobPeopleQuery_(jobIds) {
  return {
    organization: {
      '$': { id: ORG },
      jobs: {
        '$': { where: { and: [['id', 'in', jobIds]] }, size: 50 },
        nodes: {
          id: {},
          customFieldValues: {
            '$': { size: 10, where: [['customField', 'id'], 'in', [CF_PROJECT_MANAGER, CF_SALES_REP]] },
            nodes: { customField: { id: {} }, value: {} }
          }
        }
      }
    }
  };
}
function jobPeopleFrom_(d) {
  var out = {};
  ((((d.organization || {}).jobs || {}).nodes) || []).forEach(function (j) {
    var pm = '', reps = [];
    (((j.customFieldValues || {}).nodes) || []).forEach(function (c) {
      var id = (c.customField || {}).id, val = String(c.value == null ? '' : c.value).trim();
      if (!val) return;
      if (id === CF_PROJECT_MANAGER) { if (!pm) pm = val; }
      else if (id === CF_SALES_REP && reps.indexOf(val) === -1) reps.push(val);
    });
    out[j.id] = { pm: pm, reps: reps };
  });
  return out;
}
function jobPeopleByIds_(jobIds) {
  return jobPeopleFrom_(pave(jobPeopleQuery_(jobIds)));
}

/** A membership id for a user name, as the PM and Sales Rep fields carry it.
 *  null when nobody in the org has that name; cached either way. */
function membershipNameKey_(name) {
  return 'mbn_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(name).toLowerCase())).slice(0, 40);
}
function membershipByNameQuery_(name) {
  return {
    organization: {
      '$': { id: ORG },
      memberships: { '$': { where: [['user', 'name'], name], size: 1 }, nodes: { id: {} } }
    }
  };
}
function membershipIdFrom_(d) {
  var ns = (((d.organization || {}).memberships || {}).nodes) || [];
  return ns.length ? (ns[0].id || null) : null;
}
function membershipByName_(name) {
  name = String(name || '').trim();
  if (!name) return null;
  var ck = membershipNameKey_(name);
  var hit = cacheGet_(ck);
  if (hit) return hit.id || null;
  var id = null;
  try {
    id = membershipIdFrom_(pave(membershipByNameQuery_(name)));
    // Cached either way — nobody by that name is an answer too. A failed
    // lookup is not, and is asked again next time.
    cachePut_(ck, { id: id }, 21600);
  } catch (e) { id = null; }
  return id;
}

/** [{membershipId}] for a list of names, plus who resolved and who didn't.
 *  An `assignee` is a one-of (role / membership / user) written FLAT: Pave
 *  picks the variant from the fields present — roleId, membershipId, or
 *  emailAddress+name. The nested { membership: { membershipId } } matches
 *  none, falls through to `user`, and every send died with "A non-null value
 *  is required at assignees.0.emailAddress". Verified live 2026-09-15. */
function assigneesFor_(names) {
  var want = [];
  (names || []).forEach(function (n) { n = String(n || '').trim(); if (n && want.indexOf(n) === -1) want.push(n); });
  // The names the cache doesn't know are looked up together, one round trip.
  var ids = {}, miss = [];
  want.forEach(function (n) {
    var hit = cacheGet_(membershipNameKey_(n));
    if (hit) ids[n] = hit.id || null; else miss.push(n);
  });
  if (miss.length) {
    paveAll_(miss.map(membershipByNameQuery_)).forEach(function (r, i) {
      var id = r.error ? null : membershipIdFrom_(r.data);
      ids[miss[i]] = id;
      if (!r.error) cachePut_(membershipNameKey_(miss[i]), { id: id }, 21600);
    });
  }
  var assignees = [], assigned = [], unresolved = [];
  want.forEach(function (n) {
    var mid = ids[n];
    if (mid) { assignees.push({ membershipId: mid }); assigned.push(n); }
    else unresolved.push(n);
  });
  return { assignees: assignees, assigned: assigned, unresolved: unresolved };
}

// ===========================================================
// THE DAILY LOG — the site manager's own record of the day, on the job.
//
// The org's daily logs are the owner's second-hand dictation ("Report via
// Tyler we were short eight pieces of drip edge … Tyler left about 430 and
// so I don't know the condition of the job"). This is the person who was on
// the roof writing it, from what the phone already knows — the hours, the
// site checks, the photos — plus three short answers.
//
// One JobTread daily log per site manager per job per day, sent ONCE: there
// is no update call for daily logs (verified against the schema), only
// create and delete, so anything after the send is a comment on the log.
//
// It is assigned to the job's Project Manager and Sales Reps with notify on —
// JobTread's own way of pointing a record at people. A one-line comment on
// the job, assigned to the same people, goes out only when the log carries
// something that needs a decision: problems, extras or returns, or a crew
// left on site without a sign-off. A comment on every routine log is the
// noise that buries daily-log notifications today.
//
// Photos are attached by reference (copyFromFileId): they stay in DB Cam on
// the job, and the log carries them too, so the PM opens one thing.
// ===========================================================
var DAILY_LOG_NOTES_MAX = 10000;   // JobTread's ceiling, verified
// A sent log is remembered for this long, keyed by who, which job, which
// day. A phone that timed out waiting for the answer sends again; the
// second send must find the first, never create a twin.
var DAILY_LOG_KEY_DAYS = 3;

function dailyLogKey_(me, jobId, date) {
  return 'dl_' + (me.membershipId || me.userId || me.email) + '|' + jobId + '|' + date;
}

function pruneDailyLogKeys_(props) {
  var all = props.getProperties(), cutoff = Date.now() - DAILY_LOG_KEY_DAYS * 86400000;
  for (var k in all) {
    if (k.indexOf('dl_') !== 0) continue;
    var at = 0;
    try { at = Number(JSON.parse(all[k]).at) || 0; } catch (e) {}
    if (at < cutoff) props.deleteProperty(k);
  }
}

function sendDailyLog(me, log) {
  log = log || {};
  var jobId = String(log.jobId || '').trim();
  if (!jobId) throw new Error('Missing job id.');
  assertWrite_(jobId);
  var date = /^\d{4}-\d{2}-\d{2}$/.test(String(log.date || '')) ? log.date : isoDay_(new Date());

  // Already sent today: hand the first one back rather than write a twin.
  var props = PropertiesService.getScriptProperties();
  var key = dailyLogKey_(me, jobId, date), prior = null;
  try { prior = JSON.parse(props.getProperty(key) || 'null'); } catch (e) { prior = null; }
  if (prior && prior.id) {
    return { ok: true, dailyLogId: prior.id, date: date, assigned: prior.assigned || [], unresolved: prior.unresolved || [],
             flag: prior.flag || '', commented: !!prior.commented, photos: prior.photos || 0, duplicate: true };
  }

  var people = { pm: '', reps: [] };
  try { people = jobPeopleByIds_([jobId])[jobId] || people; } catch (e0) { /* assign nobody rather than fail */ }
  var who = assigneesFor_([people.pm].concat(people.reps || []));

  var text = dailyLogText_(me, log).slice(0, DAILY_LOG_NOTES_MAX);
  var files = [];
  (log.photos || []).forEach(function (p) {
    if (!p || !p.fileId || files.length >= 100) return;
    files.push({ copyFromFileId: String(p.fileId), name: String(p.name || 'Photo').replace(/[\/\\]+/g, '-') });
  });
  var args = { jobId: jobId, date: date, notes: text, assignees: who.assignees, notify: true };
  if (files.length) args.files = files;
  var d = pave({ createDailyLog: { '$': args, createdDailyLog: { id: {} } } });
  var id = (((d.createDailyLog || {}).createdDailyLog) || {}).id;
  if (!id) throw new Error('createDailyLog failed: ' + JSON.stringify(d).slice(0, 200));

  var flag = dailyLogFlag_(log);
  var commented = false;
  if (flag) {
    try {
      pave({
        createComment: {
          '$': { targetType: 'job', targetId: jobId, message: dailyLogPointer_(me, log, flag), assignees: who.assignees },
          createdComment: { id: {} }
        }
      });
      commented = true;
    } catch (e3) { /* the log is in; the pointer is best effort, and the app says so */ }
  }
  try {
    props.setProperty(key, JSON.stringify({ id: id, at: Date.now(), assigned: who.assigned, unresolved: who.unresolved,
                                            flag: flag, commented: commented, photos: files.length }));
    pruneDailyLogKeys_(props);
  } catch (e4) { /* the log is in; the memory of it is best effort */ }
  return { ok: true, dailyLogId: id, date: date, assigned: who.assigned, unresolved: who.unresolved,
           flag: flag, commented: commented, photos: files.length };
}

/** What needs a decision: '' when nothing does. */
function dailyLogFlag_(log) {
  if (String(log.problems || '').trim()) return 'problems';
  if (log.crewOnSite === true && !(log.checks && log.checks.signedOff)) return 'crew-on-site';
  return '';
}

function dailyLogPointer_(me, log, flag) {
  var label = String(log.jobLabel || log.jobId || '').trim();
  var day = fmtDayShort_(log.date);
  var what = flag === 'problems'
    ? String(log.problems || '').trim().split(/\r?\n/)[0].slice(0, 160)
    : 'crew still on site' + (log.leftAt ? ' when ' + firstName_(me.name) + ' left at ' + log.leftAt : '') + ', not signed off';
  return '📋 Site log ' + day + ' — ' + label + ': ' + what + ' — full log under Daily Logs. (' + me.name + ')';
}

/** Plain text, in the order the owner's own log reads. */
function dailyLogText_(me, log) {
  var L = [];
  L.push('Site manager\'s log — ' + me.name + ' · ' + fmtDayLong_(log.date));
  var head = [String(log.jobLabel || '').trim(), log.alongside ? 'with ' + log.alongside : ''].filter(Boolean).join(' · ');
  if (head) L.push(head);
  L.push('');
  L.push('WHAT GOT DONE');
  L.push(String(log.done || '').trim() || '—');
  L.push('');
  L.push('CONDITION WHEN I LEFT');
  var cond = [];
  if (log.crewOnSite === true) cond.push('Crew still on site'); else if (log.crewOnSite === false) cond.push('Crew gone');
  if (log.tarped === true) cond.push('Tarped'); else if (log.tarped === false) cond.push('Not tarped');
  if (log.leftAt) cond.push('Left at ' + String(log.leftAt).trim());
  if (cond.length) L.push(cond.join(' · '));
  var condText = String(log.condition || '').trim();
  if (condText) L.push(condText); else if (!cond.length) L.push('—');
  L.push('');
  L.push('PROBLEMS, EXTRAS, RETURNS');
  L.push(String(log.problems || '').trim() || 'None');
  L.push('');
  var ck = log.checks || {};
  if (ck.words || ck.magnetBy) {
    L.push('SITE CHECKS');
    L.push([ck.words, ck.magnetBy ? 'Magnet run by ' + ck.magnetBy : ''].filter(Boolean).join(' · '));
    L.push('');
  }
  var hrs = (log.hours || []).filter(function (h) { return h && (Number(h.minutes) || 0) > 0; });
  if (hrs.length) {
    L.push('HOURS (' + firstName_(me.name) + ')');
    var tot = 0;
    hrs.forEach(function (h) {
      tot += Number(h.minutes) || 0;
      L.push(((h.number ? h.number + ' ' : '') + (h.name || '')).trim() + ' — ' + hm_(h.minutes));
    });
    L.push('Total ' + hm_(tot));
    L.push('');
  }
  var notes = (log.notes || []).filter(function (n) { return n && String(n.body || '').trim(); });
  if (notes.length) {
    L.push('NOTES DURING THE DAY');
    notes.forEach(function (n) {
      L.push((n.time ? n.time + '  ' : '') + String(n.body).trim() + (n.urgent ? '  (sent to the office at the time)' : ''));
    });
    L.push('');
  }
  var photos = (log.photos || []).filter(function (p) { return p && p.fileId; });
  var left = Number(log.photosPending) || 0;
  if (photos.length || left) {
    var byTag = {};
    photos.forEach(function (p) { var t = String(p.tag || 'photo').toLowerCase(); byTag[t] = (byTag[t] || 0) + 1; });
    var parts = ['before', 'during', 'after'].filter(function (t) { return byTag[t]; }).map(function (t) { return byTag[t] + ' ' + t; });
    L.push('PHOTOS');
    if (photos.length) L.push(photos.length + ' attached' + (parts.length ? ' (' + parts.join(', ') + ')' : '') + ' · also in DB Cam on the job');
    if (left) L.push(left + ' more still uploading from the phone when this was sent — see DB Cam on the job');
    L.push('');
  }
  L.push('— sent from DB Time Clock');
  return L.join('\n');
}

function firstName_(name) { return String(name || '').trim().split(/\s+/)[0] || 'me'; }
function hm_(minutes) {
  var m = Math.max(0, Math.round(Number(minutes) || 0)), h = Math.floor(m / 60);
  return h ? h + 'h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm' : m + 'm';
}
function fmtDayLong_(iso) {
  try { return Utilities.formatDate(new Date(iso + 'T12:00:00Z'), 'UTC', 'EEE MMM d'); } catch (e) { return String(iso || ''); }
}
function fmtDayShort_(iso) {
  var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? String(Number(m[1])) + '/' + String(Number(m[2])) : String(iso || '');
}

/** Something added after the log was sent: a comment on the log itself. */
function addDailyLogNote(me, jobId, dailyLogId, message) {
  if (!jobId) throw new Error('Missing job id.');
  if (!dailyLogId) throw new Error('Missing daily log id.');
  message = String(message || '').trim();
  if (!message) throw new Error('Empty note.');
  assertWrite_(jobId);
  var d = pave({
    createComment: {
      '$': { targetType: 'dailyLog', targetId: dailyLogId, message: me.name + ': ' + message },
      createdComment: { id: {}, createdAt: {} }
    }
  });
  var c = ((d.createComment || {}).createdComment) || {};
  return { ok: true, id: c.id, at: c.createdAt };
}

// ===========================================================
// SITE CHECKS — the site manager's checklist, ticked from the phone.
//
// It replaces a sheet of paper ("Roofing Checklist") the site managers
// carried in the packet and never filled in. The board OWNS it: the 28
// lines, where they live in JobTread (a checklist on the job's roofing
// install task), the sign-off and the write. This script never touches
// JobTread for any of it — it forwards what the phone holds to the board
// and hands the board's answer straight back.
//
// Registered in WITH_USER: `me` comes from the verified Google token, so
// membershipId is stamped here and never taken from the phone. Who may
// tick is JobTread's call, not ours — the membership must carry the
// "Site Manager" role there — and the board answers 403 for anyone else.
// That 403 is returned as data, not thrown, because the app has to say
// "the site manager ticks these" rather than show a red error.
//
// NEVER THROWS for a board problem, for the same reason getMyJobs doesn't:
// a save that fails comes back with a status the app keeps the state for
// and retries later. It is not gated on WRITE_ENABLED either — that flag
// keeps THIS script's grant key off payroll; the checklist is written by
// the board under its own gate, and a tick that silently vanished into a
// read-only build would be the paper sheet all over again.
//
// The breaker getMyJobs honours is deliberately NOT checked here: the
// site manager tapped, on their own execution slot, and the cold board
// that tripped it at 6:45am is exactly when the before-tear-off ticks
// happen. A slow save still trips it, so the next automatic job-list
// fetch skips the board rather than queueing the clock behind it.
// ===========================================================
function saveSiteChecks(me, taskId, jobId, jobLabel, today, checks) {
  taskId = String(taskId || '').trim();
  jobId = String(jobId || '').trim();
  // These are the app's bugs, not the board's: a missing id can never save.
  if (!taskId) throw new Error('Missing the checklist id.');
  if (!jobId) throw new Error('Missing job id.');
  if (!checks || typeof checks !== 'object') throw new Error('Missing checks.');

  var out = { status: 0, reason: '', body: null };
  if (!me.membershipId) { out.reason = 'no-membership'; return out; }
  var cfg = boardConfig_();
  if (!cfg.url || !cfg.secret) { out.reason = 'not-configured'; return out; }

  // The whole state the phone holds, coerced to the contract's shape. The
  // sign-off VALUE (name, date) is never sent — the board stamps it from the
  // membership; `signOff` is only whether it should be signed.
  var done = {};
  var src = (checks.done && typeof checks.done === 'object') ? checks.done : {};
  for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) done[String(k)] = !!src[k];
  var payload = {
    membershipId: me.membershipId,
    taskId: taskId,
    jobId: jobId,
    jobLabel: String(jobLabel || '').slice(0, 80),
    // The PHONE's date: a UTC server is a day out every evening.
    today: /^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) ? today : isoDay_(new Date()),
    checks: {
      done: done,
      magnetBy: (checks.magnetBy == null || String(checks.magnetBy).trim() === '') ? null : String(checks.magnetBy).trim().slice(0, 40),
      signOff: !!checks.signOff
    }
  };

  var startedMs = Date.now(), elapsedMs = 0;
  try {
    var resp = UrlFetchApp.fetch(cfg.url + '/api/crew/checks', {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: { Authorization: 'Bearer ' + cfg.secret },
      muteHttpExceptions: true,
      followRedirects: false
    });
    elapsedMs = Date.now() - startedMs;
    if (elapsedMs > BOARD_SLOW_MS) tripBoardBreaker_(elapsedMs);
    out.status = resp.getResponseCode();
    out.boardMs = elapsedMs;
    var text = resp.getContentText();
    try { out.body = JSON.parse(text); } catch (pe) { out.body = null; out.text = String(text || '').slice(0, 300); }
    if (out.status === 307 || out.status === 302) out.reason = 'board-signin-bounce';
    else if (out.status !== 200) out.reason = 'board-http-' + out.status;
  } catch (e) {
    elapsedMs = Date.now() - startedMs;
    if (elapsedMs > BOARD_SLOW_MS) tripBoardBreaker_(elapsedMs);
    out.reason = 'board-unreachable';
    out.boardMs = elapsedMs;
    out.error = (e && e.message) || String(e);
    return out;
  }

  // Written. The cached job list now carries stale words ("not started" under
  // a card that was just ticked), so drop the copy the next getMyJobs would
  // serve. Only the default window is cached by the app; a custom range is
  // never sent by it.
  if (out.status === 200) {
    try {
      var win = boardWindow_(isoDay_(new Date()));
      CacheService.getScriptCache().remove(myJobsCacheKey_(me.membershipId, win.from, win.to));
    } catch (e2) { /* a stale cache is a cosmetic problem, not a failure */ }
  }
  return out;
}

// ===========================================================
// COST CODES — what a crew member can clock into.
//
// A real job carries ~220 cost items. Two filters get that down
// to the ten or so a crew member actually picks from:
//   1. costType Labor — you can't clock into Materials.
//   2. job-level items only. The rest are per-document copies of
//      the same lines (one set per estimate / change order).
//      `document` isn't queryable in a where clause, so it is
//      selected and filtered here.
// ===========================================================
// A job's budget lines change on the office's timescale, not the crew's, and
// finding the ten that matter costs three full pages of Pave. Fifteen minutes
// is long enough that re-opening the app during a shift is free, short enough
// that a labor line added this morning is pickable before lunch.
var CODES_CACHE_SEC = 900;
var JOBS_CACHE_SEC = 300;

/* A cache miss must never be an error: CacheService throws on a value over
   100KB, and a code list that won't fit is still a perfectly good answer. */
function cachePut_(key, value, sec) {
  try { CacheService.getScriptCache().put(key, JSON.stringify(value), sec); } catch (e) {}
}

function cacheGet_(key) {
  try {
    var hit = CacheService.getScriptCache().get(key);
    return hit ? JSON.parse(hit) : null;
  } catch (e) { return null; }
}

function jobCodesQuery_(jobId, page) {
  var arg = { where: [['costType', 'name'], 'Labor'], size: 100 };
  if (page) arg.page = page;
  return {
    job: {
      '$': { id: jobId },
      costItems: {
        '$': arg,
        nextPage: {},
        nodes: {
          id: {}, name: {},
          document: { id: {} },
          jobCostItem: { id: {} },
          costCode: { number: {}, name: {} }
        }
      }
    }
  };
}
/** The code list from its first page (already fetched), the rest paged in
 *  as needed; sorted and cached. */
function jobCodesFrom_(jobId, first) {
  var out = [], seen = {}, d = first;
  for (var i = 0; i < 4; i++) {
    var conn = (((d.job || {}).costItems) || {});
    var nodes = conn.nodes || [];
    for (var n = 0; n < nodes.length; n++) {
      var ci = nodes[n];
      if (ci.document || ci.jobCostItem) continue;   // document line item, not the budget line
      if (seen[ci.id]) continue;
      seen[ci.id] = 1;
      var cc = ci.costCode || {};
      out.push({
        id: ci.id,
        name: ci.name || (cc.name || 'Labor'),
        number: cc.number || '',
        codeName: cc.name || ''
      });
    }
    if (!conn.nextPage) break;
    d = pave(jobCodesQuery_(jobId, conn.nextPage));
  }
  out.sort(function (a, b) {
    return String(a.number).localeCompare(String(b.number)) || String(a.name).localeCompare(String(b.name));
  });
  cachePut_('jc_' + jobId, out, CODES_CACHE_SEC);
  return out;
}
function getJobCodes(jobId) {
  if (!jobId) throw new Error('Missing job id.');
  var cached = cacheGet_('jc_' + jobId);
  if (cached) return cached;
  return jobCodesFrom_(jobId, pave(jobCodesQuery_(jobId, null)));
}

// ===========================================================
// THE CLOCK
// Clocked in == an open time entry (endedAt null). JobTread
// counts the minutes itself; the app only opens and closes.
// ===========================================================
function openEntryQuery_(userId) {
  return {
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': {
          where: { and: [[['user', 'id'], userId], ['endedAt', null]] },
          sortBy: [{ field: 'startedAt', order: 'desc' }],
          size: 1
        },
        nodes: {
          id: {}, startedAt: {}, minutes: {}, type: {}, notes: {},
          job: { id: {}, name: {}, number: {}, location: { formattedAddress: {}, account: { name: {} } } },
          costItem: { id: {}, name: {}, costCode: { number: {}, name: {} } }
        }
      }
    }
  };
}
function openEntryFrom_(d) {
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  return ns.length ? shapeEntry_(ns[0]) : null;
}
function openEntryFor_(userId) {
  return openEntryFrom_(pave(openEntryQuery_(userId)));
}

function shapeEntry_(t) {
  var j = t.job || {}, loc = j.location || {}, ci = t.costItem || {}, cc = ci.costCode || {};
  return {
    id: t.id,
    startedAt: t.startedAt,
    endedAt: t.endedAt || null,
    minutes: t.minutes || 0,
    notes: t.notes || '',
    job: j.id ? {
      id: j.id, name: j.name || '', number: j.number || '',
      address: loc.formattedAddress || '',
      customer: (loc.account && loc.account.name) || ''
    } : null,
    code: ci.id ? { id: ci.id, name: ci.name || '', number: cc.number || '', codeName: cc.name || '' } : null
  };
}

// Everything the clock screen needs, in one round trip.
function getToday(me, jobId) {
  var open = openEntryFor_(me.userId);
  var job = null;
  if (open && open.job) job = open.job;
  else if (jobId) {
    var jl = fetchJobs_(['id', jobId], 1);
    job = jl.length ? jl[0] : null;
  }
  return {
    me: { userId: me.userId, name: me.name, role: me.role },
    open: open,
    job: job,
    codes: job ? getJobCodes(job.id) : [],
    entries: getMyDay(me),
    writeEnabled: writeEnabled_()
  };
}

// Boot, in two calls: what the screen cannot draw without, then the rest.
//
// It used to be four round trips — getBoot, getToday, getJobOptions and, for a
// foreman, getCrewOnClock. Apps Script runs one execution at a time per user,
// so those queued; each paid its own cold start, and each was another chance
// for the /macros/echo redirect to come back 404. Collapsing all four into one
// execution fixed the queueing and created a worse problem: one call carrying
// seven to eight sequential Pave round trips, which on a real job (294 Labor
// cost items, so getJobCodes pages three times) overran the client's 25-second
// ceiling and boot failed outright.
//
// So the split is by what the first screen actually needs. getStart is the
// clock: am I on it, on what job, what have I logged today — three Pave calls
// at most. Everything else is behind a tap, so getExtras fetches it after the
// app is already drawn and usable.
function getStart(me, jobId) {
  // Same profile getBoot returns, built the same way — so a DB Hub 'Manager'
  // grant still unlocks the crew block on the path the app actually boots by.
  var boot = bootProfile_(me);
  // Boot's JobTread questions go out together: the open entry (the clock —
  // boot is wrong without it), today's entries, and the last job, which only
  // matters when nothing is open but costs less asked alongside than after.
  var qs = [openEntryQuery_(me.userId), myDayQuery_(me.userId)];
  if (jobId) qs.push(jobsQuery_(['id', jobId], 1));
  var rs = paveAll_(qs);
  if (rs[0].error) throw rs[0].error;
  if (rs[1].error) throw rs[1].error;
  var open = openEntryFrom_(rs[0].data);
  var job = null;
  if (open && open.job) job = open.job;
  else if (jobId && rs[2] && !rs[2].error) {
    var jl = jobsFrom_(rs[2].data);
    job = jl.length ? jl[0] : null;
  }
  return {
    me: boot,
    open: open,
    job: job,
    entries: myDayFrom_(rs[1].data),
    writeEnabled: writeEnabled_(),
    recent: recentCalls_()
  };
}

// The rest of the start: the code list for the job we landed on, the recent
// jobs the picker opens with, and the foreman's crew block. None of it is on
// screen until someone taps something, and none of it is worth failing for —
// without the job list you can still search, without the codes the sheet says
// so and reloads.
function getExtras(me, jobId) {
  var out = { codes: [], jobOptions: [], crew: [] };
  var codesHit = jobId ? cacheGet_('jc_' + jobId) : null;
  var optsHit = me.userId ? cacheGet_('jo_' + me.userId) : null;
  var foreman = bootProfile_(me).isForeman;
  // Whatever the cache doesn't hold goes out in one round trip. Each part is
  // best effort, as before: an empty code list is a tap from another ask.
  var qs = [], tags = [];
  if (jobId && !codesHit) { qs.push(jobCodesQuery_(jobId, null)); tags.push('codes'); }
  if (me.userId && !optsHit) { qs.push(recentJobsQuery_(me.userId)); tags.push('recent'); }
  if (foreman) { qs.push(crewOnClockQuery_()); tags.push('crew'); }
  var got = {};
  paveAll_(qs).forEach(function (r, i) { got[tags[i]] = r; });
  if (codesHit) out.codes = codesHit;
  else if (got.codes && !got.codes.error) { try { out.codes = jobCodesFrom_(jobId, got.codes.data); } catch (e1) {} }
  if (optsHit) out.jobOptions = optsHit;
  else if (got.recent && !got.recent.error) { try { out.jobOptions = jobOptionsFrom_(me.userId, got.recent.data); } catch (e2) {} }
  if (got.crew && !got.crew.error) { try { out.crew = crewFrom_(got.crew.data); } catch (e3) {} }
  return out;
}

// Today's closed + open entries for the caller, for the "today on
// this job" table. Day boundary is the script's own time zone.
// NOTE: Pave wants '>=', not 'gte' — it rejects the latter outright.
function myDayQuery_(userId) {
  var start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': {
          where: { and: [[['user', 'id'], userId], { '>=': [{ field: 'startedAt' }, { value: start.toISOString() }] }] },
          sortBy: [{ field: 'startedAt', order: 'desc' }],
          size: 50
        },
        nodes: {
          id: {}, startedAt: {}, endedAt: {}, minutes: {}, notes: {},
          job: { id: {}, name: {}, number: {}, location: { formattedAddress: {}, account: { name: {} } } },
          costItem: { id: {}, name: {}, costCode: { number: {}, name: {} } }
        }
      }
    }
  };
}
function myDayFrom_(d) {
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  return ns.map(shapeEntry_);
}
function getMyDay(me) {
  return myDayFrom_(pave(myDayQuery_(me.userId)));
}

function coordArg_(c) {
  if (!c || c.lat == null || c.lng == null) return null;
  return { latitude: Number(c.lat), longitude: Number(c.lng) };
}

function clockIn(me, jobId, costItemId, coords) {
  if (!jobId) throw new Error('Missing job id.');
  if (!costItemId) throw new Error('Pick a code before clocking in.');
  assertWrite_(jobId);

  // One open entry per person. If something is already running, close it —
  // a crew member on two clocks at once is a payroll problem.
  var open = openEntryFor_(me.userId);
  if (open) closeEntry_(open.id, coords);

  var args = {
    organizationId: ORG,
    jobId: jobId,
    userId: me.userId,
    costItemId: costItemId,
    startedAt: new Date().toISOString(),
    type: ENTRY_TYPE
  };
  var sc = coordArg_(coords);
  if (sc) args.startCoordinates = sc;

  var d = pave({ createTimeEntry: { '$': args, createdTimeEntry: { id: {} } } });
  var id = (((d.createTimeEntry || {}).createdTimeEntry) || {}).id;
  if (!id) throw new Error('createTimeEntry failed: ' + JSON.stringify(d).slice(0, 200));
  return openEntryFor_(me.userId);
}

function closeEntry_(entryId, coords) {
  var args = { id: entryId, endedAt: new Date().toISOString() };
  var ec = coordArg_(coords);
  if (ec) args.endCoordinates = ec;
  pave({ updateTimeEntry: { '$': args } });
}

function clockOut(me, coords) {
  var open = openEntryFor_(me.userId);
  if (!open) return { ok: true, closed: null };
  assertWrite_(open.job && open.job.id);
  closeEntry_(open.id, coords);
  return { ok: true, closed: open.id, entries: getMyDay(me) };
}

// Close the running entry and open the next one in a single call, so a
// dropped connection can't leave someone clocked out mid-switch.
function switchCode(me, jobId, costItemId, coords) {
  if (!costItemId) throw new Error('Pick a code to switch to.');
  assertWrite_(jobId);
  var open = openEntryFor_(me.userId);
  if (open) closeEntry_(open.id, coords);
  return clockIn(me, jobId, costItemId, coords);
}

// Foreman view: who is on the clock right now.
function crewOnClockQuery_() {
  return {
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': { where: ['endedAt', null], sortBy: [{ field: 'startedAt', order: 'desc' }], size: 60 },
        nodes: {
          id: {}, startedAt: {}, minutes: {},
          user: { id: {}, name: {} },
          job: { id: {}, name: {}, number: {} },
          costItem: { id: {}, name: {}, costCode: { number: {} } }
        }
      }
    }
  };
}
function crewFrom_(d) {
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  return ns.map(function (t) {
    var u = t.user || {}, j = t.job || {}, ci = t.costItem || {}, cc = ci.costCode || {};
    return {
      entryId: t.id,
      userId: u.id || '',
      name: u.name || '',
      minutes: t.minutes || 0,
      startedAt: t.startedAt,
      jobId: j.id || '',
      job: (j.number ? j.number + ' · ' : '') + (j.name || ''),
      code: (cc.number ? cc.number + ' ' : '') + (ci.name || '')
    };
  });
}
function getCrewOnClock() {
  return crewFrom_(pave(crewOnClockQuery_()));
}

// ===========================================================
// PHOTOS — the same signed-URL flow DB Cam Mobile already proved
// in production. Photos land in the same 'DB Cam' folder so one
// photo report covers the job regardless of which app shot it.
// ===========================================================
function createCaptureUploadRequest(jobId, mime, size, fileName) {
  if (!jobId) throw new Error('Missing job id.');
  assertWrite_(jobId);
  mime = String(mime || 'application/octet-stream');
  size = Number(size) || 0;
  if (!size) throw new Error('Missing file size.');
  var cur = pave({
    createUploadRequest: {
      '$': { organizationId: ORG, type: mime, size: size },
      createdUploadRequest: { id: {}, url: {}, method: {}, headers: {} }
    }
  });
  var req = ((cur.createUploadRequest || {}).createdUploadRequest) || {};
  if (!req.id || !req.url) throw new Error('Upload request failed: ' + JSON.stringify(cur).slice(0, 200));
  return { uploadRequestId: req.id, url: req.url, method: req.method || 'PUT', headers: req.headers || {} };
}

function finalizeCaptureUpload(jobId, uploadRequestId, fileName, description) {
  if (!jobId) throw new Error('Missing job id.');
  if (!uploadRequestId) throw new Error('Missing upload request id.');
  assertWrite_(jobId);
  return finalizeFileRecord_(jobId, uploadRequestId, fileName, description);
}

// Fallback for browsers that can't PUT to the signed URL directly.
function uploadCapture(jobId, base64Data, mime, fileName, description) {
  if (!jobId) throw new Error('Missing job id.');
  if (!base64Data) throw new Error('Missing file data.');
  assertWrite_(jobId);
  mime = String(mime || 'image/jpeg');
  var bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large to upload from the app (' + Math.round(bytes.length / 1048576) + ' MB, max 45 MB).');
  }
  var cur = pave({
    createUploadRequest: {
      '$': { organizationId: ORG, type: mime, size: bytes.length },
      createdUploadRequest: { id: {}, url: {}, method: {}, headers: {} }
    }
  });
  var req = ((cur.createUploadRequest || {}).createdUploadRequest) || {};
  if (!req.id || !req.url) throw new Error('Upload request failed.');
  var srcHeaders = req.headers || {}, ct = mime, passHeaders = {};
  for (var h in srcHeaders) {
    if (String(h).toLowerCase() === 'content-type') ct = srcHeaders[h];
    else passHeaders[h] = srcHeaders[h];
  }
  var up = UrlFetchApp.fetch(req.url, {
    method: (req.method || 'PUT').toLowerCase(),
    payload: bytes, contentType: ct, headers: passHeaders, muteHttpExceptions: true
  });
  if (up.getResponseCode() >= 300) {
    throw new Error('Upload PUT failed (HTTP ' + up.getResponseCode() + '): ' + String(up.getContentText()).slice(0, 200));
  }
  return finalizeFileRecord_(jobId, req.id, fileName, description);
}

function finalizeFileRecord_(jobId, uploadRequestId, fileName, description) {
  fileName = String(fileName || 'Capture').replace(/[\/\\]+/g, '-');
  var args = { uploadRequestId: uploadRequestId, targetType: 'job', targetId: jobId, name: fileName };
  if (CAPTURE_FOLDER) args.folder = CAPTURE_FOLDER;
  if (description) args.description = String(description).slice(0, 4000);
  var cf = pave({ createFile: { '$': args, createdFile: { id: {}, name: {} } } });
  var file = ((cf.createFile || {}).createdFile) || {};
  if (!file.id) throw new Error('createFile failed: ' + JSON.stringify(cf).slice(0, 200));

  var thumbUrl = '';
  try {
    var d = pave({ file: { '$': { id: file.id }, thumbUrl: { _: 'url', '$': { size: 400 } } } });
    thumbUrl = (d.file || {}).thumbUrl || '';
  } catch (e) { /* non-fatal */ }
  return { ok: true, fileId: file.id, name: file.name || fileName, thumbUrl: thumbUrl };
}

// A note to the office lands as a comment on the job. With `assignPm` it is
// also assigned to the job's Project Manager (or, with none, the first Sales
// Rep), which is what makes it reach somebody rather than sit in the feed —
// the "office needs this now" note from the Day log.
function postJobNote(jobId, message, authorName, assignPm) {
  if (!jobId) throw new Error('Missing job id.');
  message = String(message || '').trim();
  if (!message) throw new Error('Empty note.');
  assertWrite_(jobId);
  authorName = String(authorName || '').trim();
  if (authorName) message = authorName + ': ' + message;
  var args = { targetType: 'job', targetId: jobId, message: message };
  var assigned = [];
  if (assignPm) {
    try {
      var people = jobPeopleByIds_([jobId])[jobId] || { pm: '', reps: [] };
      var who = assigneesFor_(people.pm ? [people.pm] : (people.reps || []).slice(0, 1));
      if (who.assignees.length) { args.assignees = who.assignees; assigned = who.assigned; }
    } catch (e) { /* unassigned beats unsent */ }
  }
  var d = pave({
    createComment: {
      '$': args,
      createdComment: { id: {}, message: {}, createdAt: {} }
    }
  });
  var c = ((d.createComment || {}).createdComment) || {};
  return { ok: true, id: c.id, at: c.createdAt, assigned: assigned };
}

// ===========================================================
// WEB PUSH — the nudge that reaches a pocketed phone.
//
// The in-app escalation only fires while the app is running. This
// is the part that works when the phone is asleep in someone's
// pocket: a time-driven trigger sweeps for open time entries with
// no before photo and pushes to that crew member's device.
//
// Delivery, honestly:
//   Android — reliable, installed or in the browser.
//   iPhone  — iOS 16.4+ AND the PWA must be installed to the Home
//             Screen. A Safari tab gets nothing. This is why the
//             install step in SETUP.md matters.
//
// Why FCM and not raw Web Push: VAPID requires ES256 (ECDSA), and
// Apps Script has no ECDSA. It does have computeRsaSha256Signature,
// so it can mint a service-account token and call FCM HTTP v1.
// That keeps the whole stack in Apps Script — no Cloud Functions,
// no Blaze plan.
//
// Extra Script Properties:
//   FCM_PROJECT_ID        the Firebase project id
//   FCM_SERVICE_ACCOUNT   the service account JSON key, pasted whole
//   PUSH_ENABLED          'true' to actually send
// ===========================================================

var PUSH_GRACE_MINUTES = 5;      // keep in step with BEFORE_GRACE_SEC in index.html
var PUSH_SWEEP_LOOKBACK_H = 16;  // ignore entries older than a plausible shift

function pushEnabled_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('PUSH_ENABLED') || '').toLowerCase() === 'true';
  } catch (e) { return false; }
}

// ---- device registration -------------------------------------------------
// One token per user. Re-registering replaces the old one, which is what we
// want: a crew member who reinstalls shouldn't accumulate dead endpoints.
function registerPushToken(me, token, platform) {
  token = String(token || '').trim();
  if (!token) throw new Error('Missing push token.');
  // membershipId rides along so the schedule sweep can ask the board for this
  // person without a lookup per device.
  PropertiesService.getScriptProperties().setProperty('pt_' + me.userId, JSON.stringify({
    token: token, platform: String(platform || ''), name: me.name, membershipId: me.membershipId || '', at: Date.now()
  }));
  return { ok: true };
}

function unregisterPushToken(me) {
  PropertiesService.getScriptProperties().deleteProperty('pt_' + me.userId);
  return { ok: true };
}

function pushTokenFor_(userId) {
  var raw = PropertiesService.getScriptProperties().getProperty('pt_' + userId);
  if (!raw) return null;
  try { return JSON.parse(raw).token || null; } catch (e) { return null; }
}

// ---- FCM transport -------------------------------------------------------
function fcmAccessToken_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('fcm_at');
  if (hit) return hit;

  var raw = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Set the FCM_SERVICE_ACCOUNT Script Property (the service account JSON key).');
  var sa;
  try { sa = JSON.parse(raw); } catch (e) { throw new Error('FCM_SERVICE_ACCOUNT is not valid JSON.'); }
  if (!sa.client_email || !sa.private_key) throw new Error('FCM_SERVICE_ACCOUNT is missing client_email or private_key.');

  var now = Math.floor(Date.now() / 1000);
  var claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  var signingInput = b64url_({ alg: 'RS256', typ: 'JWT' }) + '.' + b64url_(claim);
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(signingInput, sa.private_key)).replace(/=+$/, '');

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signingInput + '.' + sig
    },
    muteHttpExceptions: true
  });
  var body = {};
  try { body = JSON.parse(resp.getContentText()); } catch (e) {}
  if (resp.getResponseCode() >= 300 || !body.access_token) {
    throw new Error('FCM auth failed (HTTP ' + resp.getResponseCode() + '): ' + String(resp.getContentText()).slice(0, 200));
  }
  cache.put('fcm_at', body.access_token, Math.max(60, (Number(body.expires_in) || 3600) - 120));
  return body.access_token;
}

/**
 * Send one push. Returns { ok } or { ok:false, stale:true } when FCM says the
 * token is dead, so the sweep can clean it up.
 */
function sendPush_(token, title, body, data, opts) {
  opts = opts || {};
  var projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  if (!projectId) throw new Error('Set the FCM_PROJECT_ID Script Property.');

  // The tag and the kind ride in `data` too: sw.js shows the notification
  // itself and reads them from there.
  var tag = opts.tag || 'dbtc-before';
  var payload = {};
  for (var k in (data || {})) payload[k] = String(data[k]);
  payload.tag = tag;
  var msg = {
    message: {
      token: token,
      notification: { title: title, body: body },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/app-icon-192.png',
          badge: '/app-icon-192.png',
          tag: tag,
          requireInteraction: opts.requireInteraction !== false
        },
        fcmOptions: { link: opts.link || (PropertiesService.getScriptProperties().getProperty('APP_URL') || '/') },
        headers: { Urgency: 'high', TTL: opts.ttl || '900' }
      },
      data: payload
    }
  };

  var resp = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + fcmAccessToken_() },
    payload: JSON.stringify(msg),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code < 300) return { ok: true };
  var text = String(resp.getContentText());
  // UNREGISTERED / NOT_FOUND on the token means the device is gone.
  var stale = code === 404 || /UNREGISTERED|NOT_FOUND|InvalidRegistration/i.test(text);
  return { ok: false, stale: stale, error: 'FCM ' + code + ': ' + text.slice(0, 200) };
}

// ---- the sweep -----------------------------------------------------------
// Runs on a time-driven trigger. One Pave call for the open entries, one for
// the tagged before photos, so the cost doesn't grow with the size of the crew.

/** Before photos carry `#TE:<timeEntryId>` in their description; that is how
 *  the server knows, without trusting the client, whether the photo owed for a
 *  particular block of time actually exists. See fileDescription() in index.html. */
function entryIdsWithBeforePhoto_(sinceIso) {
  var out = {};
  var page = null;
  for (var i = 0; i < 4; i++) {
    var arg = {
      where: {
        and: [
          { like: [{ field: 'description' }, { value: '%#BEFORE%' }] },
          { '>=': [{ field: 'createdAt' }, { value: sinceIso }] }
        ]
      },
      sortBy: [{ field: 'createdAt', order: 'desc' }],
      size: 100
    };
    if (page) arg.page = page;
    var d = pave({
      organization: {
        '$': { id: ORG },
        files: { '$': arg, nextPage: {}, nodes: { description: {} } }
      }
    });
    var conn = ((d.organization || {}).files) || {};
    var nodes = conn.nodes || [];
    for (var n = 0; n < nodes.length; n++) {
      var m = /#TE:([A-Za-z0-9]+)/.exec(String(nodes[n].description || ''));
      if (m) out[m[1]] = true;
    }
    page = conn.nextPage;
    if (!page) break;
  }
  return out;
}

function openEntriesForSweep_(sinceIso) {
  var d = pave({
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': {
          where: { and: [['endedAt', null], { '>=': [{ field: 'startedAt' }, { value: sinceIso }] }] },
          sortBy: [{ field: 'startedAt', order: 'desc' }],
          size: 100
        },
        nodes: {
          id: {}, startedAt: {}, minutes: {},
          user: { id: {}, name: {} },
          job: { id: {}, name: {} },
          costItem: { id: {}, name: {}, costCode: { number: {} } }
        }
      }
    }
  });
  return (((d.organization || {}).timeEntries || {}).nodes) || [];
}

/**
 * TRIGGER ENTRY POINT. Install with installNudgeTrigger().
 *
 * Sends at most one push per time entry, ever — the marker is keyed by entry
 * id, so a crew member who ignores it isn't pestered every five minutes. If
 * you'd rather it repeat, delete the marker check.
 */
function sweepBeforePhotoNudges() {
  if (!pushEnabled_()) return { skipped: 'PUSH_ENABLED is not true' };

  var props = PropertiesService.getScriptProperties();
  var sinceIso = new Date(Date.now() - PUSH_SWEEP_LOOKBACK_H * 3600 * 1000).toISOString();

  var open = openEntriesForSweep_(sinceIso);
  if (!open.length) { cleanupNudgeMarkers_(props, {}); return { open: 0, sent: 0 }; }

  var haveBefore = entryIdsWithBeforePhoto_(sinceIso);
  var stillOpen = {};
  var sent = 0, skipped = 0, failed = 0;

  for (var i = 0; i < open.length; i++) {
    var t = open[i];
    stillOpen[t.id] = true;

    var ageMin = (Date.now() - new Date(t.startedAt).getTime()) / 60000;
    if (ageMin < PUSH_GRACE_MINUTES) { skipped++; continue; }
    if (haveBefore[t.id]) { skipped++; continue; }
    if (props.getProperty('nudged_' + t.id)) { skipped++; continue; }

    var userId = (t.user || {}).id;
    var token = userId ? pushTokenFor_(userId) : null;
    // Mark regardless of whether we can reach the device — otherwise a crew
    // member with no token makes the sweep retry them forever.
    props.setProperty('nudged_' + t.id, String(Date.now()));
    if (!token) { skipped++; continue; }

    var ci = t.costItem || {};
    var label = (((ci.costCode || {}).number || '') + ' ' + (ci.name || '')).trim();
    var mins = Math.max(1, Math.round(ageMin));
    var res;
    try {
      res = sendPush_(token, 'Before photo not taken',
        label + ' started ' + mins + ' minutes ago. The office has been copied.',
        { kind: 'before-photo', timeEntryId: t.id, jobId: (t.job || {}).id || '' });
    } catch (e) {
      res = { ok: false, error: String(e && e.message || e) };
    }
    if (res.ok) sent++;
    else {
      failed++;
      if (res.stale && userId) props.deleteProperty('pt_' + userId);
      console.warn('push failed for ' + ((t.user || {}).name || userId) + ': ' + res.error);
    }
  }

  cleanupNudgeMarkers_(props, stillOpen);
  return { open: open.length, sent: sent, skipped: skipped, failed: failed };
}

/** Drop markers for entries that have since closed, so Script Properties
 *  don't grow without bound. */
function cleanupNudgeMarkers_(props, stillOpen) {
  var all = props.getProperties();
  for (var k in all) {
    if (k.indexOf('nudged_') !== 0) continue;
    if (!stillOpen[k.slice(7)]) props.deleteProperty(k);
  }
}

/** The client calls this when its own in-app nudge fires, so the sweep does
 *  not send a duplicate to a phone whose owner is already looking at it. */
function markNudged(timeEntryId) {
  if (!timeEntryId) return { ok: false };
  PropertiesService.getScriptProperties().setProperty('nudged_' + timeEntryId, String(Date.now()));
  return { ok: true };
}

// ---- the schedule pushes -------------------------------------------------
// "Where am I in the morning" should not need the app opened. Hourly, for
// every registered phone:
//   - after PLAN_PUSH_HOUR local, once per day: "Tomorrow: 812 S Washington
//     St · Lucas · with Platinum · Material ordered". Nothing booked, nothing
//     sent — and if the office books something later in the evening, the next
//     hour sends it.
//   - "Schedule changed" when the next few days differ from the last snapshot
//     for that person: added, moved, removed. The first run only takes the
//     snapshot. Not sent in the same run as the tomorrow line — that line
//     already carries the change.
// One board call per phone per hour; the board's window for three days is
// light, and it is the same route the tab reads.
var PLAN_PUSH_HOUR = 16;
var SCHED_LOOKAHEAD_DAYS = 2;

function sweepSchedulePushes() {
  if (!pushEnabled_()) return { skipped: 'PUSH_ENABLED is not true' };
  var cfg = boardConfig_();
  if (!cfg.url || !cfg.secret) return { skipped: 'board not configured' };
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = new Date(), today = isoDay_(now), tomorrow = addDays_(today, 1);
  var hour = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), 'H'));
  var appUrl = String(all.APP_URL || '').replace(/\/+$/, '');
  var out = { devices: 0, plans: 0, changes: 0, failed: 0 };
  var pushOpts = { tag: 'dbtc-schedule', link: (appUrl || '') + '/?tab=jobs', requireInteraction: false, ttl: '43200' };

  for (var k in all) {
    if (k.indexOf('pt_') !== 0) continue;
    var rec = null;
    try { rec = JSON.parse(all[k]); } catch (e) {}
    if (!rec || !rec.token || !rec.membershipId) continue;   // re-registers with a membership on the next launch
    var userId = k.slice(3);
    out.devices++;

    var visits;
    try {
      var r = fetchAssignmentsRaw_(cfg, rec.membershipId, today, addDays_(today, SCHED_LOOKAHEAD_DAYS));
      if (r.code !== 200) { out.failed++; continue; }
      visits = (JSON.parse(r.text).visits || []).map(function (v) { return shapeVisit_(v, today); });
      try { enrichVisits_(visits); } catch (e2) { /* labels */ }
    } catch (e3) { out.failed++; continue; }

    var sentPlan = false;
    var planKey = 'plan_' + userId + '_' + tomorrow;
    if (hour >= PLAN_PUSH_HOUR && !all[planKey]) {
      var tv = visits.filter(function (v) { return v.start && v.start <= tomorrow && (v.end || v.start) >= tomorrow; });
      if (tv.length) {
        var res = sendPush_(rec.token, 'Tomorrow', planLine_(tv), { kind: 'schedule', date: tomorrow }, pushOpts);
        if (res.ok) { props.setProperty(planKey, '1'); out.plans++; sentPlan = true; }
        else { out.failed++; if (res.stale) props.deleteProperty(k); }
      }
    }

    var snap = scheduleSnapshot_(visits);
    var prevKey = 'sched_' + userId, prev = all[prevKey];
    if (prev != null && prev !== snap && !sentPlan) {
      var res2 = sendPush_(rec.token, 'Schedule changed', changeLine_(prev, snap), { kind: 'schedule' }, pushOpts);
      if (res2.ok) out.changes++; else out.failed++;
    }
    if (prev !== snap) props.setProperty(prevKey, snap);
  }

  // Yesterday's markers.
  for (var k2 in all) {
    if (k2.indexOf('plan_') === 0 && k2.slice(k2.lastIndexOf('_') + 1) < today) props.deleteProperty(k2);
  }
  return out;
}

/** "812 S Washington St · Lucas · with Platinum · Material ordered", or "2 jobs: Courtney, then Lucas". */
function planLine_(tv) {
  if (tv.length > 1) {
    return tv.length + ' jobs: ' + tv.map(function (v) { return v.cust || v.jobNum; }).join(', then ');
  }
  var v = tv[0];
  var street = String(v.address || '').split(',')[0].trim();
  var mat = v.material && v.material.text ? String(v.material.text).replace(/[\u2713\u2714]\s*$/, '').trim() : '';
  return [street || v.cust || v.jobNum, street ? v.cust : '', v.alongside ? 'with ' + v.alongside : '', mat]
    .filter(Boolean).join(' · ');
}

/** One line per visit, sorted, so two answers compare as strings. */
function scheduleSnapshot_(visits) {
  return visits.map(function (v) {
    return [v.taskId, v.jobNum, v.cust || '', v.start, v.end || v.start].join('|');
  }).sort().join('\n');
}

function changeLine_(prev, snap) {
  var parse = function (s) {
    var m = {};
    String(s || '').split('\n').forEach(function (line) {
      if (!line) return;
      var p = line.split('|');
      m[p[0]] = { jobNum: p[1], cust: p[2], start: p[3], end: p[4] };
    });
    return m;
  };
  var a = parse(prev), b = parse(snap), parts = [];
  var name = function (x) { return x.cust || x.jobNum; };
  for (var id in b) {
    if (!a[id]) parts.push('Added: ' + name(b[id]) + ' ' + fmtDayShortDow_(b[id].start));
    else if (a[id].start !== b[id].start || a[id].end !== b[id].end) parts.push('Moved: ' + name(b[id]) + ' to ' + fmtDayShortDow_(b[id].start));
  }
  for (var id2 in a) if (!b[id2]) parts.push('Removed: ' + name(a[id2]));
  if (!parts.length) return 'Your next few days changed — open My jobs.';
  var line = parts.slice(0, 3).join('. ') + (parts.length > 3 ? ' +' + (parts.length - 3) + ' more' : '');
  return line.length > 180 ? line.slice(0, 177) + '…' : line;
}

function fmtDayShortDow_(iso) {
  var d = new Date(String(iso) + 'T12:00:00Z');
  if (isNaN(d)) return String(iso || '');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
}

/** Run once from the Apps Script editor. Idempotent. Runs a sweep on the spot. */
function installSchedulePushTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'sweepSchedulePushes') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('sweepSchedulePushes').timeBased().everyHours(1).create();
  return 'Schedule pushes installed — hourly. First run: ' + JSON.stringify(sweepSchedulePushes());
}

function removeSchedulePushTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'sweepSchedulePushes') ScriptApp.deleteTrigger(existing[i]);
  }
  return 'Schedule pushes removed.';
}

// ---- one-time setup ------------------------------------------------------
/** Run once from the Apps Script editor. Idempotent. */
function installNudgeTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'sweepBeforePhotoNudges') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('sweepBeforePhotoNudges').timeBased().everyMinutes(5).create();
  return 'Sweep installed — runs every 5 minutes.';
}

/** Run once from the Apps Script editor. Idempotent. Refreshes the feed on
 *  the spot too, so there is no fail-open gap before the first tick. */
function installAccessFeedRefresh() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'refreshAccessFeed') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('refreshAccessFeed').timeBased().everyMinutes(5).create();
  return 'Access feed refresh installed — runs every 5 minutes. First run: ' + refreshAccessFeed();
}

function removeAccessFeedRefresh() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'refreshAccessFeed') ScriptApp.deleteTrigger(existing[i]);
  }
  return 'Access feed refresh removed.';
}

function removeNudgeTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'sweepBeforePhotoNudges') ScriptApp.deleteTrigger(existing[i]);
  }
  return 'Sweep removed.';
}

/** Run from the editor to prove the whole chain works end to end: it pushes
 *  to your own registered device, ignoring grace periods and markers. */
function testPushToMe() {
  var email = Session.getActiveUser().getEmail();
  var me = memberFor_(email);
  var token = pushTokenFor_(me.userId);
  if (!token) return 'No device registered for ' + email + ' — open the app on your phone, clock in, and allow notifications.';
  var res = sendPush_(token, 'DB Time Clock test',
    'If you can read this on your lock screen, push is working.', { kind: 'test' });
  return res.ok ? 'Sent.' : res.error;
}
