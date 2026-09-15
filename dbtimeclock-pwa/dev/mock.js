/* Local preview harness — NOT shipped. `public/` is what deploys.
 *
 * Injected before the app boots (see dev/preview.mjs). It fakes the Google
 * sign-in and the Apps Script API so every screen can be opened and
 * screenshotted without touching the live JobTread org.
 *
 * The fixtures use real shapes read from the production org: cost items with
 * CSI-style cost codes, an open time entry with endedAt null, minutes counted
 * by the server. */
(function () {
  // Pin the config so the real config.js (loaded after this) can't blank it out.
  Object.defineProperty(window, 'DBTC_CONFIG', {
    value: { apiUrl: 'https://mock.local/exec', clientId: 'mock.apps.googleusercontent.com' },
    writable: false, configurable: false
  });

  // A session token the app will accept: it only parses `exp` out of the payload.
  var payload = btoa(JSON.stringify({ email: 'tyler.b@deitemeyerbrothers.com', exp: 4102444800 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  localStorage.setItem('dbtc_auth', JSON.stringify({ token: 'h.' + payload + '.s', exp: 4102444800 }));

  var JOB = {
    id: 'j_2841', name: '260890 Webster_Foundation', number: '26-0890',
    customer: 'Noah Webster', address: '408 Euclid Ave, Van Wert, OH 45891, USA'
  };
  var LUCAS = { id: 'j2', name: '261045 Lucas_Roof', number: '26-1045', customer: 'Lucas', address: '812 S Washington St, Van Wert, OH 45891, USA' };
  function jobById(id) { return [JOB, LUCAS].filter(function (j) { return j.id === id; })[0] || null; }
  // __MOCK_TWO_TODAY: Lucas is booked today as well, and the clock opens with
  // no job remembered — the two-roof morning.
  var TWO = !!window.__MOCK_TWO_TODAY;
  var CODES = [
    { id: 'ci1', name: 'Equipment Operation', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci2', name: 'Crew Labor', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci3', name: 'Project Management (C)', number: '01GR-1', codeName: 'Project Management' },
    { id: 'ci4', name: 'Site Prep Labor', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci5', name: 'Final Clean', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci6', name: 'Demolition', number: '02ST-2', codeName: 'Demolition' },
    { id: 'ci7', name: 'Hand Excavation', number: '02ST-3', codeName: 'Excavation' },
    { id: 'ci8', name: 'Hauling & Disposal', number: '02ST-5', codeName: 'Hauling & Disposal (Direct)' },
    { id: 'ci9', name: 'Masonry Labor', number: '04MA', codeName: 'Masonry' },
    { id: 'ci10', name: 'Sales On-Site Support', number: '99TM-6', codeName: 'Sales On-Site Support' }
  ];
  function code(id) { return CODES.filter(function (c) { return c.id === id; })[0]; }

  // ---- assigned jobs, as the Production Board returns them ----
  // Shapes match CREW-ASSIGNMENTS-API.md: Visit joined to BoardJob, plus the
  // material line, with day n of m already resolved by Code.gs.
  function isoAdd(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  // ---- site checks, as the board sends them ----
  // The shape is the board's `checklistShape()` (src/lib/install-checks.ts):
  // three phases, 28 lines, two carrying a value. The app draws from THIS and
  // hardcodes nothing; the words below are the board's `checksWords`, ported
  // here only so the fixture can answer the way the board does after a save.
  var CHECKLIST = {
    phases: [
      { key: 'before', label: 'Before the tear-off', tag: null, when: 'the morning the crew starts' },
      { key: 'handover', label: 'Before the site manager leaves', tag: 'HANDING OVER', when: 'only if you leave before the crew does' },
      { key: 'finished', label: 'Before the crew leaves for good', tag: 'FINISHED', when: 'the last day' }
    ],
    lines: [
      { key: 'address', phase: 'before', label: 'Right address, right roof' },
      { key: 'homeowner', phase: 'before', label: 'Homeowner talked to \u2014 trailer spot, questions, color confirmed' },
      { key: 'scope', phase: 'before', label: 'Scope on site matches the work order' },
      { key: 'color', phase: 'before', label: 'Shingle / metal / drip color checked against the order' },
      { key: 'walk', phase: 'before', label: 'Property walked \u2014 damage photographed, items to move moved' },
      { key: 'septic', phase: 'before', label: 'Well and septic located' },
      { key: 'safety', phase: 'before', label: 'Safety: power lines, ground, fall protection' },
      { key: 'access', phase: 'before', label: 'Buggy access and driveway protection agreed' },
      { key: 'weather', phase: 'before', label: 'Weather plan \u2014 tarps on hand' },
      { key: 'material', phase: 'before', label: 'Material on site and counted against the order' },
      { key: 'sign', phase: 'before', label: 'Yard sign up' },
      { key: 'tearoff', phase: 'handover', label: 'Tear-off done, decking verified nailable' },
      { key: 'shingles', phase: 'handover', label: 'Shingles on the roof, material on site' },
      { key: 'tarped', phase: 'handover', label: 'Cleaned up and tarped \u2014 heat accounted for' },
      { key: 'special', phase: 'handover', label: 'Special tasks done, or oversight timed' },
      { key: 'matcheck', phase: 'handover', label: 'Material checked off' },
      { key: 'photos1', phase: 'handover', label: 'Photos taken' },
      { key: 'pm', phase: 'handover', label: 'PM notified' },
      { key: 'cleanup', phase: 'finished', label: 'Clean up \u2014 ground, gutters, around the trailers, siding' },
      { key: 'nails', phase: 'finished', label: 'Exposed nails caulked' },
      { key: 'bundle', phase: 'finished', label: 'One open bundle left for the homeowner' },
      { key: 'movedback', phase: 'finished', label: 'Items moved back to where they were' },
      { key: 'blown', phase: 'finished', label: 'Roof blown off' },
      { key: 'tabs', phase: 'finished', label: 'Plastic tabs pulled' },
      { key: 'magnet', phase: 'finished', label: 'Magnet run, lawn and beds \u2014 by:', value: 'magnetBy' },
      { key: 'photos', phase: 'finished', label: '20\u201330 photos in CompanyCam (8 from the ground, each side)' },
      { key: 'extras', phase: 'finished', label: 'Returns and extras logged' },
      { key: 'signoff', phase: 'finished', label: 'Signed off:', value: 'signedOff' }
    ]
  };
  var LINE_KEYS = {};
  CHECKLIST.lines.forEach(function (l) { LINE_KEYS[l.key] = true; });
  function blankChecks(ticked) {
    var done = {};
    CHECKLIST.lines.forEach(function (l) { done[l.key] = (ticked || []).indexOf(l.key) !== -1; });
    return { done: done, magnetBy: null, signedOff: null };
  }
  // One list per JOB, on the roofing crew's line — so its id is never the
  // visit's own taskId. 26-1490 ended yesterday and was never signed off.
  var CHECKS = {
    't2roof': blankChecks(),
    't4roof': blankChecks(['address', 'homeowner', 'scope', 'color', 'walk', 'septic', 'safety', 'access', 'weather', 'material', 'sign',
                           'tearoff', 'shingles', 'tarped', 'special', 'matcheck', 'photos1', 'pm', 'cleanup', 'nails', 'bundle'])
  };
  function checksProgress(c) {
    return CHECKLIST.phases.map(function (p) {
      var ls = CHECKLIST.lines.filter(function (l) { return l.phase === p.key; });
      return { phase: p.key, label: p.label, done: ls.filter(function (l) { return !!c.done[l.key]; }).length, total: ls.length };
    });
  }
  function checksWords(c) {
    if (c.signedOff) return 'Signed off \u2014 ' + c.signedOff;
    var pr = checksProgress(c), before = pr[0], handover = pr[1], finished = pr[2];
    if (finished.done > 0) return 'Finishing up \u2014 ' + finished.done + ' of ' + finished.total + ' done, not signed off';
    if (handover.done > 0) return 'Handing over \u2014 ' + handover.done + ' of ' + handover.total + ' done';
    if (before.done === 0) return 'Site checks not started';
    if (before.done === before.total) return 'Before-tear-off checks done';
    return 'Before tear-off \u2014 ' + before.done + ' of ' + before.total + ' done';
  }
  function checksFor(tid) {
    var c = CHECKS[tid];
    if (!c) return null;
    return { taskId: tid, state: JSON.parse(JSON.stringify(c)), progress: checksProgress(c), words: checksWords(c) };
  }
  function shortDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate();
  }

  function visits() {
    return [
      { taskId: 't1', jobId: 'j_2841', jobNum: '26-0890', jobName: '260890 Webster_Foundation',
        start: isoAdd(-1), end: isoAdd(1), days: 3, dayOf: 2, today: true,
        crewNote: 'Dumpster on the north side. Gate code 1412 — do not block the neighbour\u2019s drive.',
        cust: 'Noah Webster', city: 'Van Wert', address: '408 Euclid Ave, Van Wert, OH 45891, USA',
        status: 'Production', jtype: 'Foundation',
        material: { text: 'Material ordered \u2713', cls: 'good' },
        checks: null, alongside: null, pm: 'Neal Deitemeyer', reps: ['Justin Phillips'] },
      { taskId: 't4', jobId: 'j4', jobNum: '26-1490', jobName: '261490 Courtney_Roof',
        start: isoAdd(-1), end: isoAdd(-1), days: 1, dayOf: null, today: false,
        crewNote: '', cust: 'Courtney', city: 'Ohio City', address: '1140 Bittersweet Ln, Ohio City, OH 45874, USA',
        status: 'Production', jtype: 'Roofing',
        material: { text: 'Material ordered \u2713', cls: 'good' },
        checks: checksFor('t4roof'), alongside: 'Platinum (Shingle)', pm: 'Dave Elick', reps: ['Shawn Deitemeyer', 'Jenn Grubb'] },
      { taskId: 't2', jobId: 'j2', jobNum: '26-1045', jobName: '261045 Lucas_Roof',
        start: isoAdd(TWO ? 0 : 2), end: isoAdd(TWO ? 0 : 2), days: 1, dayOf: TWO ? 1 : null, today: TWO,
        crewNote: '', cust: 'Lucas', city: 'Van Wert', address: '812 S Washington St, Van Wert, OH 45891, USA',
        status: 'Production', jtype: 'Roofing',
        material: { text: 'Pull from shop', cls: 'warn' },
        checks: checksFor('t2roof'), alongside: 'Platinum', pm: 'Dave Elick', reps: ['Shawn Deitemeyer'] },
      { taskId: 't3', jobId: 'j3', jobNum: '26-1102', jobName: '261102 Harmon_Siding',
        start: isoAdd(7), end: isoAdd(8), days: 2, dayOf: null, today: false,
        crewNote: 'Homeowner works nights — no compressor before 9am.',
        cust: 'Dale Harmon', city: 'Delphos', address: '221 N Main St, Delphos, OH 45833, USA',
        status: 'Production', jtype: 'Siding',
        material: { text: 'PART ORDER \u2014 check first', cls: 'bad' },
        checks: null, alongside: null, pm: '', reps: [] }
    ];
  }

  var ST = { open: null, entries: [], pushToken: null, nudged: null, n: 0, files: 0 };
  // Two closed blocks already banked today, so the table has something in it.
  var t0 = Date.now() - 3 * 3600 * 1000;
  ST.entries = [
    { id: 'e1', startedAt: new Date(t0).toISOString(), endedAt: new Date(t0 + 42 * 60000).toISOString(), minutes: 42, job: JOB, code: code('ci4') },
    { id: 'e2', startedAt: new Date(t0 + 42 * 60000).toISOString(), endedAt: new Date(t0 + 180 * 60000).toISOString(), minutes: 138, job: JOB, code: code('ci9') }
  ];

  var HANDLERS = {
    getBoot: function () {
      return { email: 'tyler.b@deitemeyerbrothers.com', name: 'Tyler B.', userId: 'u1', membershipId: 'm1',
               role: window.__MOCK_FOREMAN ? 'Foreman' : 'Crew', isForeman: !!window.__MOCK_FOREMAN,
               writeEnabled: !window.__MOCK_READONLY, build: 'mock' };
    },
    getStart: function (jobId) {
      var b = HANDLERS.getBoot();
      var t = HANDLERS.getToday(jobId);
      return { me: b, open: t.open, job: t.job, entries: t.entries, writeEnabled: t.writeEnabled };
    },
    // Set __MOCK_SLOWEXTRAS to watch the sheets while the extras are still in
    // flight — the state a real phone is in for the first few seconds of boot.
    getExtras: function (jobId) {
      var b = HANDLERS.getBoot();
      return { codes: jobId ? CODES : [], jobOptions: HANDLERS.getJobOptions(),
               crew: b.isForeman ? HANDLERS.getCrewOnClock() : [] };
    },
    getToday: function (jobId) {
      // __MOCK_NOJOB: nothing remembered on the phone — the seed-from-the-schedule case.
      var job = (ST.open && ST.open.job) || jobById(jobId) || ((TWO || window.__MOCK_NOJOB) ? null : JOB);
      return { me: { userId: 'u1', name: 'Tyler B.' }, open: ST.open, job: job, codes: CODES,
               entries: ST.entries, writeEnabled: !window.__MOCK_READONLY };
    },
    getMyDay: function () { return ST.entries; },
    getJobCodes: function () { return CODES; },
    getMyJobs: function () {
      // __MOCK_NOBOARD exercises the fallback path — the board down, or not
      // deployed yet. The clock must stay usable either way.
      if (window.__MOCK_NOBOARD) {
        return { source: 'fallback', reason: 'board-unreachable', crew: null,
                 range: { from: isoAdd(0), to: isoAdd(13) }, visits: [],
                 jobs: HANDLERS.getJobOptions() };
      }
      if (window.__MOCK_NOCREW) {
        return { source: 'board', reason: 'no-crew', crew: null,
                 range: { from: isoAdd(0), to: isoAdd(13) }, visits: [],
                 jobs: HANDLERS.getJobOptions() };
      }
      return {
        source: 'board', reason: '',
        crew: { id: 'c1', name: 'Alberto', leadMembershipId: 'm1', leadUserName: 'Alberto Gonzalez' },
        range: { from: isoAdd(-1), to: isoAdd(13) },
        visits: visits(), jobs: [],
        checklist: JSON.parse(JSON.stringify(CHECKLIST))
      };
    },
    // The board's PUT /api/crew/checks, as Code.gs hands it back: status and
    // body verbatim. The client's args carry no membershipId — Code.gs adds
    // it from the verified token — so none is expected here either.
    //   __MOCK_NOTMANAGER  the board's 403: not a site manager
    //   __MOCK_PUTFAIL     the board's 502: JobTread write failed
    //   __MOCK_SLOWPUT     hold the answer this many ms
    saveSiteChecks: function (taskId, jobId, jobLabel, today, checks) {
      window.__PUTS = window.__PUTS || [];
      window.__PUTS.push(JSON.parse(JSON.stringify({ taskId: taskId, jobId: jobId, jobLabel: jobLabel, today: today, checks: checks })));
      if (window.__MOCK_NOTMANAGER) return { status: 403, reason: 'board-http-403', body: { error: 'Only a site manager can tick the site checks \u2014 ask the office.' } };
      if (window.__MOCK_PUTFAIL) return { status: 502, reason: 'board-http-502', body: { error: 'JobTread write failed' } };
      var cur = CHECKS[taskId];
      if (!cur) return { status: 400, reason: 'board-http-400', body: { error: 'membershipId, taskId, jobId and checks are required' } };
      var previous = JSON.parse(JSON.stringify(cur));
      var done = Object.assign({}, cur.done);
      for (var k in (checks.done || {})) if (LINE_KEYS[k]) done[k] = !!checks.done[k];
      var signedOff = checks.signOff ? (cur.signedOff || ('Tyler \u00b7 ' + shortDate(today))) : null;
      done.signoff = !!signedOff;
      cur = CHECKS[taskId] = { done: done, magnetBy: String(checks.magnetBy || '').trim().slice(0, 40) || null, signedOff: signedOff };
      return { status: 200, reason: '', body: {
        human: jobLabel + ' \u2014 ' + checksWords(cur), api: [],
        checks: JSON.parse(JSON.stringify(cur)), previous: previous } };
    },
    getJobOptions: function () { return [JOB, LUCAS]; },
    searchJobs: function () { return [JOB]; },
    getCrewOnClock: function () {
      return [
        { name: 'Tyler B.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Marcus D.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Jesse P.', minutes: 60, job: '26-0890 Webster_Foundation', code: '02ST-1 Final Clean' }
      ];
    },
    clockIn: function (jobId, costItemId) {
      ST.open = { id: 'open' + (++ST.n), startedAt: new Date().toISOString(), endedAt: null, minutes: 0, job: jobById(jobId) || JOB, code: code(costItemId) };
      ST.entries = [ST.open].concat(ST.entries);
      return ST.open;
    },
    switchCode: function (jobId, costItemId) {
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      return HANDLERS.clockIn(jobId, costItemId);
    },
    clockOut: function () {
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = null;
      return { ok: true, entries: ST.entries };
    },
    createCaptureUploadRequest: function () { return { uploadRequestId: 'ur1', url: 'https://mock.local/put', method: 'PUT', headers: {} }; },
    finalizeCaptureUpload: function () { return { ok: true, fileId: 'f' + (++ST.files) }; },
    // A note to the office; with the fourth argument it is assigned to the PM.
    postJobNote: function (jobId, message, author, assignPm) {
      window.__NOTES = window.__NOTES || [];
      window.__NOTES.push({ jobId: jobId, message: message, author: author, assignPm: !!assignPm });
      return { ok: true, id: 'c' + window.__NOTES.length, assigned: assignPm ? ['Neal Deitemeyer'] : [] };
    },
    // The daily log, as Code.gs answers: the id, who it was assigned to, and
    // whether the feed was pinged. __MOCK_LOGFAIL makes it throw.
    sendDailyLog: function (log) {
      if (window.__MOCK_LOGFAIL) throw new Error('Pave error (HTTP 500): boom');
      window.__LOGS = window.__LOGS || [];
      window.__LOGS.push(JSON.parse(JSON.stringify(log)));
      var signed = log.checks && log.checks.signedOff;
      var flag = String(log.problems || '').trim() ? 'problems' : (log.crewOnSite === true && !signed ? 'crew-on-site' : '');
      return { ok: true, dailyLogId: 'dl' + window.__LOGS.length, date: log.date, assigned: ['Neal Deitemeyer', 'Justin Phillips'], unresolved: [],
               flag: flag, commented: !!flag, photos: (log.photos || []).length };
    },
    addDailyLogNote: function (jobId, dailyLogId, message) {
      window.__LOGNOTES = window.__LOGNOTES || [];
      window.__LOGNOTES.push({ jobId: jobId, dailyLogId: dailyLogId, message: message });
      return { ok: true, id: 'cn' + window.__LOGNOTES.length };
    },
    registerPushToken: function (token, platform) { ST.pushToken = { token: token, platform: platform }; return { ok: true }; },
    unregisterPushToken: function () { ST.pushToken = null; return { ok: true }; },
    markNudged: function (entryId) { ST.nudged = entryId; return { ok: true }; },
    exchangeSession: function () { return { token: 'h.' + payload + '.s', exp: 4102444800 }; }
  };

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('mock.local/exec') !== -1) {
      var body = JSON.parse((opts && opts.body) || '{}');
      var fn = HANDLERS[body.fn];
      var out;
      try {
        out = fn ? { ok: true, data: fn.apply(null, body.args || []) }
                 : { ok: false, error: 'Unknown function: ' + body.fn };
      } catch (err) {
        out = { ok: false, error: String(err && err.message || err), readOnly: /^READ_ONLY/.test(String(err && err.message || '')) };
      }
      // A real Response, near enough: apiCall reads the body as text and parses
      // it itself, so that it can tell a page from JSON. A stub with only
      // json() silently breaks every screen in the harness.
      var text = JSON.stringify(out);
      var res = {
        ok: true, status: 200,
        text: function () { return Promise.resolve(text); },
        json: function () { return Promise.resolve(JSON.parse(text)); }
      };
      // The first seconds of a real boot: the clock is drawn, the code list
      // and job picker are not here yet. Hard to catch by hand, easy to break.
      var hold = (body.fn === 'getExtras' && Number(window.__MOCK_SLOWEXTRAS)) ||
                 (body.fn === 'saveSiteChecks' && Number(window.__MOCK_SLOWPUT)) ||
                 (body.fn === 'sendDailyLog' && Number(window.__MOCK_SLOWLOG)) || 0;
      if (!hold) return Promise.resolve(res);
      return new Promise(function (ok) { setTimeout(function () { ok(res); }, hold); });
    }
    if (u.indexOf('mock.local/put') !== -1) return Promise.resolve({ ok: true, status: 200 });
    return realFetch(url, opts);
  };
})();
