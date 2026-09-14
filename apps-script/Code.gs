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
//   BOARD_API_URL     the Production Board origin, for assigned jobs
//   CREW_APP_SECRET   shared secret the board checks on /api/crew/assignments
//   FCM_PROJECT_ID / FCM_SERVICE_ACCOUNT / PUSH_ENABLED  (push, see below)
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

var APP_BUILD = 'T1.1 (2026-07-28)';

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
  if (!/@deitemeyerbrothers\.com$/.test(email)) throw new Error('AUTH');
  var ttl = Math.max(60, Math.min(3600, (Number(info.exp) || 0) - Math.floor(Date.now() / 1000) - 30));
  cache.put(key, email, ttl);
  return email;
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

function doPost(e) {
  var out;
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (pe) { throw new Error('Bad request body.'); }
    var email = verifyIdToken_(body.t);
    var fn = String(body.fn || '');
    var args = Object.prototype.toString.call(body.args) === '[object Array]' ? body.args : [];

    // Every write is stamped with the caller resolved from the verified token,
    // never with a user id sent by the client.
    var WITH_USER = {
      getToday: getToday,
      clockIn: clockIn,
      switchCode: switchCode,
      clockOut: clockOut,
      getMyDay: getMyDay,
      getMyJobs: getMyJobs,
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
    else if (WITH_USER[fn]) data = WITH_USER[fn].apply(null, [memberFor_(email)].concat(args));
    else if (PLAIN[fn]) data = PLAIN[fn].apply(null, args);
    else throw new Error('Unknown function: ' + fn);
    out = { ok: true, data: (data === undefined ? null : data) };
  } catch (err) {
    var msg = (err && err.message) || String(err);
    out = { ok: false, error: msg, auth: msg === 'AUTH', readOnly: msg.indexOf('READ_ONLY') === 0 };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- PAVE API CALL (same pattern as DB Cam / the dashboard) ----
function pave(queryBody) {
  var q = { '$': { grantKey: GRANT_KEY } };
  for (var k in queryBody) q[k] = queryBody[k];
  var opts = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: q }),
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch('https://api.jobtread.com/pave', opts);
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code >= 400) {
    var looksJson = String(body).charAt(0) === '{';
    if (!looksJson) {
      Utilities.sleep(1500);
      resp = UrlFetchApp.fetch('https://api.jobtread.com/pave', opts);
      code = resp.getResponseCode();
      body = resp.getContentText();
    }
  }
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
    var d = pave({
      organization: {
        '$': { id: ORG },
        memberships: {
          '$': { where: [['user', 'email'], email], size: 1 },
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
  var m = memberFor_(email);
  return {
    email: m.email,
    name: m.name,
    userId: m.userId,
    membershipId: m.membershipId,
    role: m.role,
    // Foreman gets the crew block. Role names are the org's own, so this is a
    // contains-match rather than an exact one.
    isForeman: /foreman|super|manager|owner|admin/i.test(m.role || ''),
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
function getJobOptions(userId) {
  var jobIds = [], seen = {}, lastByJob = {};
  if (userId) {
    try {
      var d = pave({
        organization: {
          '$': { id: ORG },
          timeEntries: {
            '$': { where: [['user', 'id'], userId], sortBy: [{ field: 'startedAt', order: 'desc' }], size: 60 },
            nodes: { startedAt: {}, job: { id: {} } }
          }
        }
      });
      var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
      for (var i = 0; i < ns.length && jobIds.length < 10; i++) {
        var j = ns[i].job;
        if (!j || !j.id || seen[j.id]) continue;
        seen[j.id] = 1;
        lastByJob[j.id] = ns[i].startedAt;
        jobIds.push(j.id);
      }
    } catch (e) { /* fall through to an empty list */ }
  }
  if (!jobIds.length) return [];
  var rich = fetchJobs_({ 'in': [{ field: 'id' }, jobIds.map(function (id) { return { value: id }; })] }, jobIds.length);
  rich.forEach(function (r) { if (lastByJob[r.id]) r.lastWorked = lastByJob[r.id]; });
  rich.sort(function (a, b) { return String(b.lastWorked || '').localeCompare(String(a.lastWorked || '')); });
  return rich;
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

function fetchJobs_(where, size) {
  var data = pave({
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
  });
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
var BOARD_CACHE_SEC = 60;        // a re-opened app shouldn't re-hit the board
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
  from = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? from : today;
  to = /^\d{4}-\d{2}-\d{2}$/.test(String(to || '')) ? to : addDays_(from, BOARD_LOOKAHEAD_DAYS);
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

  var ck = 'mj_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      me.membershipId + '|' + from + '|' + to)).slice(0, 40);
  var cache = CacheService.getScriptCache();
  var hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* fall through and refetch */ } }

  var body;
  try {
    var resp = UrlFetchApp.fetch(
      cfg.url + '/api/crew/assignments' +
        '?membershipId=' + encodeURIComponent(me.membershipId) +
        '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to),
      {
        method: 'get',
        headers: { Authorization: 'Bearer ' + cfg.secret },
        muteHttpExceptions: true,
        followRedirects: false   // a 307 to Google sign-in means the proxy matcher is wrong, not that we should follow it
      });
    var code = resp.getResponseCode();
    var text = resp.getContentText();
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
    out.reason = 'board-unreachable';
    out.jobs = fallbackJobs_(me);
    return out;
  }

  out.source = 'board';
  out.crew = body.crew || null;
  out.visits = (body.visits || []).map(function (v) { return shapeVisit_(v, today); });
  out.visits.sort(function (a, b) {
    return String(a.start).localeCompare(String(b.start)) || String(a.jobNum).localeCompare(String(b.jobNum));
  });
  if (!out.crew) out.reason = 'no-crew';

  // A resolved crew with nothing booked is a real answer, not a failure — but
  // the crew member still needs somewhere to clock in, so the recent-jobs list
  // rides along rather than leaving them with an empty screen.
  if (!out.visits.length) out.jobs = fallbackJobs_(me);

  try { cache.put(ck, JSON.stringify(out), BOARD_CACHE_SEC); } catch (e) {}
  return out;
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
    material: v.material || null
  };
}

// The pre-board answer to "which job am I on", kept as the fallback rather
// than removed: it is what keeps the clock working when the board is down.
function fallbackJobs_(me) {
  try { return getJobOptions(me.userId); } catch (e) { return []; }
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
function getJobCodes(jobId) {
  if (!jobId) throw new Error('Missing job id.');
  var out = [], seen = {}, page = null;
  for (var i = 0; i < 4; i++) {
    var arg = { where: [['costType', 'name'], 'Labor'], size: 100 };
    if (page) arg.page = page;
    var d = pave({
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
    });
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
    page = conn.nextPage;
    if (!page) break;
  }
  out.sort(function (a, b) {
    return String(a.number).localeCompare(String(b.number)) || String(a.name).localeCompare(String(b.name));
  });
  return out;
}

// ===========================================================
// THE CLOCK
// Clocked in == an open time entry (endedAt null). JobTread
// counts the minutes itself; the app only opens and closes.
// ===========================================================
function openEntryFor_(userId) {
  var d = pave({
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
  });
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  return ns.length ? shapeEntry_(ns[0]) : null;
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

// Today's closed + open entries for the caller, for the "today on
// this job" table. Day boundary is the script's own time zone.
// NOTE: Pave wants '>=', not 'gte' — it rejects the latter outright.
function getMyDay(me) {
  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var d = pave({
    organization: {
      '$': { id: ORG },
      timeEntries: {
        '$': {
          where: { and: [[['user', 'id'], me.userId], { '>=': [{ field: 'startedAt' }, { value: start.toISOString() }] }] },
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
  });
  var ns = (((d.organization || {}).timeEntries || {}).nodes) || [];
  return ns.map(shapeEntry_);
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
function getCrewOnClock() {
  var d = pave({
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
  });
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

// A note to the office lands as a comment on the job.
function postJobNote(jobId, message, authorName) {
  if (!jobId) throw new Error('Missing job id.');
  message = String(message || '').trim();
  if (!message) throw new Error('Empty note.');
  assertWrite_(jobId);
  authorName = String(authorName || '').trim();
  if (authorName) message = authorName + ': ' + message;
  var d = pave({
    createComment: {
      '$': { targetType: 'job', targetId: jobId, message: message },
      createdComment: { id: {}, message: {}, createdAt: {} }
    }
  });
  var c = ((d.createComment || {}).createdComment) || {};
  return { ok: true, id: c.id, at: c.createdAt };
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
  PropertiesService.getScriptProperties().setProperty('pt_' + me.userId, JSON.stringify({
    token: token, platform: String(platform || ''), name: me.name, at: Date.now()
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
function sendPush_(token, title, body, data) {
  var projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  if (!projectId) throw new Error('Set the FCM_PROJECT_ID Script Property.');

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
          tag: 'dbtc-before',
          requireInteraction: true
        },
        fcmOptions: { link: (PropertiesService.getScriptProperties().getProperty('APP_URL') || '/') },
        headers: { Urgency: 'high', TTL: '900' }
      },
      data: data || {}
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
