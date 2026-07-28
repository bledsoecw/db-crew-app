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

  var ST = { open: null, entries: [], pushToken: null, nudged: null };
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
    getToday: function () {
      return { me: { userId: 'u1', name: 'Tyler B.' }, open: ST.open, job: JOB, codes: CODES,
               entries: ST.entries, writeEnabled: !window.__MOCK_READONLY };
    },
    getMyDay: function () { return ST.entries; },
    getJobCodes: function () { return CODES; },
    getJobOptions: function () { return [JOB, { id: 'j2', name: '261045 Lucas_Roof', number: '26-1045', customer: 'Lucas', address: '812 S Washington St, Van Wert, OH' }]; },
    searchJobs: function () { return [JOB]; },
    getCrewOnClock: function () {
      return [
        { name: 'Tyler B.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Marcus D.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Jesse P.', minutes: 60, job: '26-0890 Webster_Foundation', code: '02ST-1 Final Clean' }
      ];
    },
    clockIn: function (jobId, costItemId) {
      ST.open = { id: 'open1', startedAt: new Date().toISOString(), endedAt: null, minutes: 0, job: JOB, code: code(costItemId) };
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
    finalizeCaptureUpload: function () { return { ok: true, fileId: 'f1' }; },
    postJobNote: function () { return { ok: true }; },
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
      var out = fn ? { ok: true, data: fn.apply(null, body.args || []) }
                   : { ok: false, error: 'Unknown function: ' + body.fn };
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(out); } });
    }
    if (u.indexOf('mock.local/put') !== -1) return Promise.resolve({ ok: true, status: 200 });
    return realFetch(url, opts);
  };
})();
