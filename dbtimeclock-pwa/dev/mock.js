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
  // A phone that just signed out (T2.1) stays signed out across the reload the
  // sign-out ends on, so the gate can be seen; everything else boots signed in.
  if (localStorage.getItem('dbtc_pick_account') !== '1')
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
  // The org's daily-log custom fields, as JobTread returned them on 2026-09-15.
  var LOG_FIELDS = [
    { id: '22PC7jNSGzEb', name: 'Material Pickups / Deliveries', type: 'boolean', options: null, multi: false, required: false },
    { id: '22PC7jNshbiK', name: 'Trades Onsite', type: 'option', options: ['Carpentry', 'Concrete', 'Electrical', 'Engineering', 'Excavation', 'Foundation', 'Framing', 'HVAC', 'Masonry', 'Mechanical', 'Painting', 'Plumbing', 'Roofing', 'Tile', 'Other', 'Production Manager', 'Site Manager', 'Sales Rep'], multi: true, required: false },
    { id: '22PC7jPsepri', name: 'Unplanned Tasks', type: 'text', options: null, multi: false, required: false },
    { id: '22PC7jQ6BkBC', name: 'Anticipated Delays', type: 'boolean', options: null, multi: false, required: false },
    { id: '22PLhdEgfHXF', name: 'Delay Reason', type: 'option', options: ['Weather', 'Short Labor', 'Short Material', 'Other'], multi: true, required: false },
    { id: '22PLhcfDaJ7r', name: 'Safety Incidents', type: 'text', options: null, multi: false, required: false },
    { id: '22PLbmgVwteK', name: 'Internal Notes', type: 'text', options: null, multi: false, required: false }
  ];
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
      { key: 'tarped', phase: 'handover', label: 'Site under control \u2014 tarps catching debris, material out of the heat' },
      { key: 'special', phase: 'handover', label: 'Special tasks done \u2014 anything needing supervision or timing is scheduled' },
      { key: 'matcheck', phase: 'handover', label: 'Enough material to finish \u2014 shortages called in, extras noted' },
      { key: 'photos1', phase: 'handover', label: 'Photos taken' },
      { key: 'pm', phase: 'handover', label: 'PM notified' },
      { key: 'cleanup', phase: 'finished', label: 'Clean up \u2014 ground, gutters, around the trailers, siding' },
      { key: 'nails', phase: 'finished', label: 'Exposed nails caulked' },
      { key: 'bundle', phase: 'finished', label: 'One open bundle left for the homeowner' },
      { key: 'movedback', phase: 'finished', label: 'Items moved back to where they were' },
      { key: 'blown', phase: 'finished', label: 'Roof blown off' },
      { key: 'tabs', phase: 'finished', label: 'Plastic tabs pulled' },
      { key: 'magnet', phase: 'finished', label: 'Magnet run, lawn and beds \u2014 by:', value: 'magnetBy' },
      { key: 'photos', phase: 'finished', label: '20\u201330 photos in DB Cam (8 from the ground, each side)' },
      { key: 'extras', phase: 'finished', label: 'Returns and extras logged' },
      { key: 'signoff', phase: 'finished', label: 'Signed off:', value: 'signedOff' }
    ]
  };
  var LINE_KEYS = {};
  CHECKLIST.lines.forEach(function (l) { LINE_KEYS[l.key] = true; });
  function blankChecks(ticked) {
    var done = {};
    CHECKLIST.lines.forEach(function (l) { done[l.key] = (ticked || []).indexOf(l.key) !== -1; });
    return { done: done, magnetBy: null, signedOff: null, notes: {} };
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

  // What the phone has recorded about a warehouse half, by job. Applied to
  // every answer, the way the board's own list reflects a save once its cache
  // is dropped — which is what T1.18's re-ask after a save relies on.
  var WAREHOUSE = {};
  function visits() {
    var out = [
      { taskId: 't1', jobId: 'j_2841', jobNum: '26-0890', jobName: '260890 Webster_Foundation',
        start: isoAdd(-1), end: isoAdd(1), days: 3, dayOf: 2, today: true,
        crewNote: 'Dumpster on the north side. Gate code 1412 — do not block the neighbour\u2019s drive.',
        cust: 'Noah Webster', city: 'Van Wert', address: '408 Euclid Ave, Van Wert, OH 45891, USA',
        status: 'Production', jtype: 'Foundation',
        material: { text: 'Ordered \u2014 drop booked, not on site yet', cls: 'warn' },
        warehouse: null,
        checks: null, alongside: null, pm: 'Neal Deitemeyer', reps: ['Justin Phillips'] },
      { taskId: 't4', jobId: 'j4', jobNum: '26-1490', jobName: '261490 Courtney_Roof',
        start: isoAdd(-1), end: isoAdd(-1), days: 1, dayOf: null, today: false,
        crewNote: '', cust: 'Courtney', city: 'Ohio City', address: '1140 Bittersweet Ln, Ohio City, OH 45874, USA',
        status: 'Production', jtype: 'Roofing',
        material: { text: 'Loaded for the crew \u2713', cls: 'good' },
        warehouse: { delivered: false, pulled: true, staged: true, where: 'Bay 3', loaded: true, toWarehouse: false, words: 'Pulled, staged and loaded for the crew' },
        checks: checksFor('t4roof'), alongside: 'Platinum (Shingle)', pm: 'Dave Elick', reps: ['Shawn Deitemeyer', 'Jenn Grubb'] },
      { taskId: 't2', jobId: 'j2', jobNum: '26-1045', jobName: '261045 Lucas_Roof',
        start: isoAdd(TWO ? 0 : 2), end: isoAdd(TWO ? 0 : 2), days: 1, dayOf: TWO ? 1 : null, today: TWO,
        crewNote: '', cust: 'Lucas', city: 'Van Wert', address: '812 S Washington St, Van Wert, OH 45891, USA',
        status: 'Production', jtype: 'Roofing',
        material: { text: 'Pull from shop', cls: 'warn' },
        warehouse: { delivered: false, pulled: false, staged: false, where: null, loaded: false, toWarehouse: false, words: 'Still on the shelf' },
        checks: checksFor('t2roof'), alongside: 'Platinum', pm: 'Dave Elick', reps: ['Shawn Deitemeyer'] },
      { taskId: 't3', jobId: 'j3', jobNum: '26-1102', jobName: '261102 Harmon_Siding',
        start: isoAdd(7), end: isoAdd(8), days: 2, dayOf: null, today: false,
        crewNote: 'Homeowner works nights — no compressor before 9am.',
        cust: 'Dale Harmon', city: 'Delphos', address: '221 N Main St, Delphos, OH 45833, USA',
        status: 'Production', jtype: 'Siding',
        material: { text: 'PART ORDER \u2014 check first', cls: 'bad' },
        warehouse: null,
        checks: null, alongside: null, pm: '', reps: [] }
    ];
    out.forEach(function (v) {
      var w = v.warehouse, o = WAREHOUSE[v.jobId];
      if (!w || !o) return;
      w.pulled = o.pulled; w.staged = o.staged; w.loaded = o.loaded;
      w.words = o.loaded ? 'Pulled, staged and loaded for the crew' : o.staged ? 'Pulled and staged' : 'Still on the shelf';
      // The board's materialWords(), in miniature.
      v.material = o.loaded ? { text: 'Loaded for the crew \u2713', cls: 'good' }
        : o.staged ? { text: w.where ? 'Staged at ' + w.where + ' \u2014 not loaded' : 'Staged \u2014 not loaded yet', cls: 'warn' }
        : { text: 'Pull from shop', cls: 'warn' };
    });
    return out;
  }

  var ST = { open: null, entries: [], pushToken: null, nudged: null, n: 0, files: 0 };
  // Two closed blocks already banked today, so the table has something in it.
  var t0 = Date.now() - 3 * 3600 * 1000;
  ST.entries = [
    { id: 'e1', startedAt: new Date(t0).toISOString(), endedAt: new Date(t0 + 42 * 60000).toISOString(), minutes: 42, job: JOB, code: code('ci4') },
    { id: 'e2', startedAt: new Date(t0 + 42 * 60000).toISOString(), endedAt: new Date(t0 + 180 * 60000).toISOString(), minutes: 138, job: JOB, code: code('ci9') }
  ];

  // ---- Close Out fixtures: DB CheckOut's demo jobs, in its own shapes ----
  var CO_LANDED = {}, CO_DONE = {};
  var CO_JOBS = [
    { id: 'co-hartman', number: '26-0418', name: '260418 Hartman_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Neal Deitemeyer', salesRep: 'Austin Leeth', address: '1427 Prairie View Dr, Lima, OH 45801, USA', openPunchCount: 0, mine: true, openPunchTotal: 0,
      punchTasks: [], soldScope: [{ id: 'd1', name: 'Estimate', number: 4, issueDate: '2026-07-02', price: 18450, jtUrl: 'https://app.jobtread.com', lines: [
        { name: 'OC Duration Shingles — Onyx Black', quantity: 32, unit: 'Square', description: null }, { name: 'High Temp Pipe Boot', quantity: 3, unit: 'Each', description: null }] }] },
    { id: 'co-okafor', number: '26-0415', name: '260415 Okafor_Roof', status: 'Punch List', jobType: 'Roofing', projectTypes: ['R-Repairs/Service'], isService: true,
      projectManager: 'Dave Elick', salesRep: 'Sam Black', address: '88 Cedar Falls Ct, Van Wert, OH 45891, USA', openPunchCount: 2, mine: true, openPunchTotal: 2,
      punchTasks: [
        { id: 'pt1', name: 'REPORT: Reseal the pipe boot', description: 'Rear slope pipe boot is cracked, water getting in. Replace the boot, seal and check the shingles around it.', progress: 0, endDate: '2026-10-07', assignees: [{ membershipId: 'm1', name: 'Alberto Gonzalez', email: 'alberto@deitemeyerbrothers.com' }], assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true },
        { id: 'pt2', name: 'REPORT: Reconnect the downspout', description: 'NE corner downspout came loose from the elbow.', progress: 0, endDate: null, assignees: [], assigneeNames: ['Alberto Gonzalez'], mine: true },
        { id: 'pt3', name: 'REPORT: Exposed nails sealed', description: 'Four exposed nails on the ridge, sealed.', progress: 1, endDate: null, assignees: [], assigneeNames: ['Yahir Gonzalez'], mine: false }
      ], soldScope: [] },
    { id: 'co-reyes', number: '26-0421', name: '260421 Reyes_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '301 Walnut St, Delphos, OH 45833, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [], soldScope: [] },
    { id: 'co-bell', number: '26-0388', name: '260388 Bell_Roof', status: 'PM Review', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: null, address: '9 Sycamore Ln, Ohio City, OH 45874, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [], soldScope: [] }
  ];
  var PEOPLE = [
    { email: 'operations@deitemeyerbrothers.com', name: 'Operations', membershipId: 'm0', jtRole: 'Admin', role: 'ops', source: 'code', seen: isoAdd(0), ops: true },
    { email: 'alberto@deitemeyerbrothers.com', name: 'Alberto Gonzalez', membershipId: '22PdPUpWzpHy', jtRole: 'Crew', role: 'service', source: 'default', seen: isoAdd(0), ops: false },
    { email: '', name: 'Yahir Gonzalez', membershipId: '22PdPTwMdkzj', jtRole: '', role: 'service', source: 'default', seen: '', ops: false, pending: true },
    { email: 'carl.bledsoe@deitemeyerbrothers.com', name: 'Carl Bledsoe', membershipId: 'm4', jtRole: 'Admin', role: 'service', source: 'default', seen: isoAdd(-1), ops: false },
    { email: 'tylermohr94@gmail.com', name: 'Tyler Mohr', membershipId: 'm3', jtRole: 'Site Manager', role: 'siteManager', source: 'default', seen: isoAdd(0), ops: false },
    { email: 'kentonmccomas@gmail.com', name: 'Kenton McComas', membershipId: 'm5', jtRole: 'Site Manager', role: 'siteManager', source: 'default', seen: isoAdd(-2), ops: false },
    { email: 'zac@deitemeyerbrothers.com', name: 'Zac Deitemeyer', membershipId: 'm6', jtRole: 'Crew', role: 'crew', source: 'default', seen: isoAdd(0), ops: false },
    { email: 'brian@deitemeyerbrothers.com', name: 'Brian Bowers', membershipId: 'm7', jtRole: 'Crew', role: 'crew', source: 'default', seen: isoAdd(-3), ops: false }
  ];

  var HANDLERS = {
    getBoot: function () {
      // __MOCK_ROLE: the app role the API would answer — crew · siteManager ·
      // service · ops. The default is a site manager, which is what every
      // test and screenshot before T2.0 assumed (Tyler has the Day log).
      var appRole = window.__MOCK_ROLE || 'siteManager';
      var who = appRole === 'service' ? { email: 'alberto@deitemeyerbrothers.com', name: 'Alberto Gonzalez' }
              : appRole === 'ops' ? { email: 'operations@deitemeyerbrothers.com', name: 'Operations' }
              : { email: 'tyler.b@deitemeyerbrothers.com', name: 'Tyler B.' };
      return { email: who.email, name: who.name, userId: 'u1', membershipId: 'm1',
               // The JobTread role: a site manager's, unless the test says the
               // board will answer 403 (ckOnProfile clears a remembered refusal
               // for a JT Site Manager, so that case has to read Crew).
               role: window.__MOCK_FOREMAN ? 'Foreman' : (appRole === 'siteManager' && !window.__MOCK_NOTMANAGER ? 'Site Manager' : 'Crew'), isForeman: !!window.__MOCK_FOREMAN,
               appRole: appRole, appRoleSource: appRole === 'ops' ? 'code' : 'default', ops: appRole === 'ops', closeOut: !window.__MOCK_CO_UNSET,
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
               crew: b.isForeman ? HANDLERS.getCrewOnClock() : [], logFields: LOG_FIELDS };
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
      window.__MYJOBS = (window.__MYJOBS || 0) + 1;   // how many times the list was asked for
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
      var notes = Object.assign({}, cur.notes || {});
      for (var nk in (checks.notes || {})) if (LINE_KEYS[nk]) { var nt = String(checks.notes[nk] || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (nt) notes[nk] = nt; else delete notes[nk]; }
      cur = CHECKS[taskId] = { done: done, magnetBy: String(checks.magnetBy || '').trim().slice(0, 40) || null, signedOff: signedOff, notes: notes };
      return { status: 200, reason: '', body: {
        human: jobLabel + ' \u2014 ' + checksWords(cur), api: [],
        checks: JSON.parse(JSON.stringify(cur)), previous: previous } };
    },
    // The one material fact the phone records. Same door as the checks, so
    // __MOCK_NOTMANAGER covers it too.
    saveMaterialLoaded: function (jobId, jobLabel, loaded) {
      window.__LOADS = window.__LOADS || [];
      window.__LOADS.push({ jobId: jobId, jobLabel: jobLabel, loaded: loaded });
      if (window.__MOCK_NOTMANAGER) return { status: 403, reason: 'board-http-403', body: { error: 'Only a site manager can record the material loaded \u2014 ask the office.' } };
      if (window.__MOCK_PUTFAIL) return { status: 502, reason: 'board-http-502', body: { error: 'JobTread write failed' } };
      // Loading implies pulling and staging, as the board's setMaterialLoaded
      // does; an undo only clears the load.
      var vis = visits().filter(function (v) { return v.jobId === jobId; })[0];
      var cur = (vis && vis.warehouse) || { pulled: false, staged: false, loaded: false };
      WAREHOUSE[jobId] = loaded ? { pulled: true, staged: true, loaded: true } : { pulled: cur.pulled, staged: cur.staged, loaded: false };
      return { status: 200, reason: '', body: { human: jobLabel + ' \u2014 ' + (loaded ? 'pulled, staged and loaded for the crew' : 'no longer loaded'), api: [] } };
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
    // The clock, with the photo gates Code.gs enforces: no start photo, no
    // clock-in; no end photo, no clock-out; a switch carries both. A break
    // is the one photo-less write. Every call is recorded in window.__CLOCK.
    clockIn: function (jobId, costItemId, coords, startPhotoId) {
      (window.__CLOCK = window.__CLOCK || []).push(['clockIn', jobId, costItemId, startPhotoId || null]);
      if (!startPhotoId) throw new Error('PHOTO_REQUIRED: A start photo is required to clock in.');
      return HANDLERS.__open(jobId, costItemId);
    },
    __open: function (jobId, costItemId) {
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = { id: 'open' + (++ST.n), startedAt: new Date().toISOString(), endedAt: null, minutes: 0, job: jobById(jobId) || JOB, code: code(costItemId) };
      ST.entries = [ST.open].concat(ST.entries);
      return ST.open;
    },
    switchCode: function (jobId, costItemId, coords, endPhotoId, startPhotoId) {
      (window.__CLOCK = window.__CLOCK || []).push(['switchCode', jobId, costItemId, endPhotoId || null, startPhotoId || null]);
      if (!endPhotoId) throw new Error('PHOTO_REQUIRED: An end photo of the code you are leaving is required to switch.');
      if (!startPhotoId) throw new Error('PHOTO_REQUIRED: A start photo is required to start the next code.');
      return HANDLERS.__open(jobId, costItemId);
    },
    clockOut: function (coords, endPhotoId) {
      (window.__CLOCK = window.__CLOCK || []).push(['clockOut', endPhotoId || null]);
      if (!endPhotoId) throw new Error('PHOTO_REQUIRED: An end photo is required to clock out.');
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = null;
      return { ok: true, entries: ST.entries };
    },
    startBreak: function () {
      (window.__CLOCK = window.__CLOCK || []).push(['startBreak']);
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = null;
      return { ok: true, entries: ST.entries };
    },
    endBreak: function (jobId, costItemId) {
      (window.__CLOCK = window.__CLOCK || []).push(['endBreak', jobId, costItemId]);
      return HANDLERS.__open(jobId, costItemId);
    },
    // A read-only build refuses the upload request the way Code.gs does.
    createCaptureUploadRequest: function () {
      if (window.__MOCK_READONLY) throw new Error('READ_ONLY: this deployment cannot post to JobTread yet.');
      return { uploadRequestId: 'ur1', url: 'https://mock.local/put', method: 'PUT', headers: {} };
    },
    // The base64 path the app falls back to when the direct PUT is refused.
    uploadCapture: function (jobId, b64, mime, name) {
      window.__VIAAPI = window.__VIAAPI || [];
      window.__VIAAPI.push({ jobId: jobId, bytes: b64.length, mime: mime, name: name });
      return { ok: true, fileId: 'f' + (++ST.files) };
    },
    finalizeCaptureUpload: function () { return { ok: true, fileId: 'f' + (++ST.files) }; },
    // A note to the office; with the fourth argument it is assigned to the PM.
    postJobNote: function (jobId, message, author, assignPm) {
      window.__NOTES = window.__NOTES || [];
      window.__NOTES.push({ jobId: jobId, message: message, author: author, assignPm: !!assignPm });
      return { ok: true, id: 'c' + window.__NOTES.length, assigned: assignPm ? ['Neal Deitemeyer'] : [] };
    },
    // "Tell the PM now": a comment on the job, assigned to the PM.
    tellPm: function (jobId, text) { return HANDLERS.postJobNote(jobId, text, 'Tyler B.', true); },
    // The safety alert: a comment assigned to the PM and a text to the
    // office's list, recorded in window.__ALERTS. __MOCK_ALERTFAIL makes it throw.
    sendSafetyAlert: function (jobId, alert) {
      if (window.__MOCK_ALERTFAIL) throw new Error('Pave error (HTTP 500): boom');
      window.__ALERTS = window.__ALERTS || [];
      window.__ALERTS.push(JSON.parse(JSON.stringify({ jobId: jobId, alert: alert })));
      return { ok: true, at: Date.now(), commented: true, assigned: ['Neal Deitemeyer'],
               to: ['pm@deitemeyerbrothers.com', 'shawn@deitemeyerbrothers.com', 'neal@deitemeyerbrothers.com', 'carl@deitemeyerbrothers.com'], failed: [] };
    },
    // The daily log, as Code.gs answers: the id, who it was assigned to, and
    // whether the feed was pinged. __MOCK_LOGFAIL makes it throw. A story
    // log (T1.14) pings on a delay or an incident; the older shape on its
    // problems and fields.
    sendDailyLog: function (log) {
      if (window.__MOCK_LOGFAIL) throw new Error('Pave error (HTTP 500): boom');
      window.__LOGS = window.__LOGS || [];
      window.__LOGS.push(JSON.parse(JSON.stringify(log)));
      if ('story' in log || 'safety' in log) {
        var spings = Object.keys(log.fields || {}).filter(function (id) {
          var f = LOG_FIELDS.filter(function (x) { return x.id === id; })[0], v = log.fields[id];
          return f && /safety|incident|delay/i.test(f.name) && (v === true || (typeof v === 'string' && v.trim()) || (Array.isArray(v) && v.length));
        });
        var sflag = (spings.length || log.safety === true) ? 'fields' : '';
        return { ok: true, dailyLogId: 'dl' + window.__LOGS.length, date: log.date, assigned: ['Neal Deitemeyer', 'Justin Phillips'], unresolved: [],
                 flag: sflag, commented: !!sflag, photos: (log.photos || []).length };
      }
      var signed = log.checks && log.checks.signedOff;
      var pings = Object.keys(log.fields || {}).filter(function (id) {
        var f = LOG_FIELDS.filter(function (x) { return x.id === id; })[0], v = log.fields[id];
        return f && /safety|incident|delay/i.test(f.name) && (v === true || (typeof v === 'string' && v.trim()) || (Array.isArray(v) && v.length));
      });
      var flag = String(log.problems || '').trim() ? 'problems' : pings.length ? 'fields' : (log.crewOnSite === true && !signed ? 'crew-on-site' : '');
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
    exchangeSession: function () { return { token: 'h.' + payload + '.s', exp: 4102444800 }; },

    // ---- Close Out (T2.0): Code.gs forwards to the DB CheckOut server and
    // hands its answer back as { status, body, reason }. The fixtures are
    // CheckOut's own demo shapes. Every call is recorded in window.__CO.
    //   __MOCK_CO_UNSET     CLOSEOUT_API_URL not set
    //   __MOCK_CO_DOWN      the server unreachable
    //   __MOCK_CO_PHOTO409  the first REPORT photo answers 409 once (its report not landed yet)
    //   __MOCK_CO_REJECT    a report answers 400
    coQueue: function () {
      window.__CO = window.__CO || [];
      if (window.__MOCK_CO_UNSET) return { status: 0, reason: 'not-configured', body: null };
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: { error: 'DNS' } };
      return { status: 200, body: CO_JOBS.map(function (j) { var c = JSON.parse(JSON.stringify(j)); delete c.punchTasks; delete c.soldScope; delete c.openPunchTotal; return c; }) };
    },
    coJob: function (jobId) {
      var j = CO_JOBS.filter(function (x) { return x.id === jobId; })[0];
      if (!j) return { status: 404, reason: 'http-404', body: { error: 'Job not found' } };
      var out = JSON.parse(JSON.stringify(j));
      out.punchTasks.forEach(function (t) { if (CO_DONE[t.id]) t.progress = 1; });
      return { status: 200, body: out };
    },
    coScope: function () { return { status: 200, body: { en: 'A 32-square Duration roof in Onyx Black with three pipe boots and new gutters on the back.', es: 'Un techo Duration de 32 cuadros en Onyx Black con tres botas y canales nuevos atrás.' } }; },
    coTranslate: function (texts, to) {
      window.__CO.push({ fn: 'coTranslate', to: to, n: texts.length });
      return { status: 200, body: { translations: texts.map(function (t) { return to === 'en' ? 'EN: ' + t : 'ES: ' + t; }) } };
    },
    coReport: function (jobId, report, ref) {
      window.__CO.push({ fn: 'coReport', jobId: jobId, ref: ref, report: report });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      if (window.__MOCK_CO_REJECT) return { status: 400, reason: 'http-400', body: { error: 'location and englishNote are required' } };
      CO_LANDED[ref] = 't_' + ref;
      return { status: 200, body: { taskId: 't_' + ref, photosUploaded: 0 } };
    },
    coPhoto: function (jobId, photo, ref) {
      var p = {}; for (var k in photo) p[k] = k === 'imageBase64' ? photo[k].slice(0, 30) + '…(' + photo[k].length + ')' : photo[k];
      window.__CO.push({ fn: 'coPhoto', jobId: jobId, ref: ref, photo: p });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      if (photo.reportRef && !CO_LANDED[photo.reportRef]) return { status: 409, reason: 'http-409', body: { error: 'The report this photo belongs to has not reached JobTread yet' } };
      if (window.__MOCK_CO_PHOTO409 && photo.label === 'REPORT') { window.__MOCK_CO_PHOTO409 = false; return { status: 409, reason: 'http-409', body: { error: 'not yet' } }; }
      return { status: 200, body: { fileId: 'f_' + ref } };
    },
    coClose: function (jobId, visit, ref) {
      window.__CO.push({ fn: 'coClose', jobId: jobId, ref: ref, visit: visit });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      var j = CO_JOBS.filter(function (x) { return x.id === jobId; })[0];
      var flipped = visit.problemsReported > 0 ? 'Punch List' : 'PM Review';
      if (j) j.status = flipped;
      return { status: 200, body: { completedTaskId: 'fi_' + jobId, flipped: flipped } };
    },
    coComplete: function (taskId, jobId, note, ref) {
      window.__CO.push({ fn: 'coComplete', taskId: taskId, jobId: jobId, note: note, ref: ref });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      CO_DONE[taskId] = true;
      return { status: 200, body: { ok: true, flipped: null } };
    },
    // ---- People (T2.0): Operations only, as Code.gs enforces ----
    getPeople: function () {
      if ((window.__MOCK_ROLE || 'siteManager') !== 'ops') throw new Error('NOT_OPS: Only the Operations account can do this.');
      return { people: PEOPLE.map(function (p) { return JSON.parse(JSON.stringify(p)); }), roles: ['crew', 'siteManager', 'service'], ops: ['operations@deitemeyerbrothers.com'], build: 'mock' };
    },
    setRole: function (email, role) {
      if ((window.__MOCK_ROLE || 'siteManager') !== 'ops') throw new Error('NOT_OPS: Only the Operations account can do this.');
      window.__ROLES = window.__ROLES || [];
      window.__ROLES.push({ email: email, role: role });
      var p = PEOPLE.filter(function (x) { return x.email === email; })[0];
      if (p) { p.role = role || (p.email === 'tylermohr94@gmail.com' ? 'siteManager' : 'crew'); p.source = role ? 'set' : 'default'; }
      return { email: email, name: p ? p.name : '', role: p ? p.role : role, source: p ? p.source : 'set' };
    }
  };

  var __CALLS = window.__CALLS = [];
  var gs = HANDLERS.getStart;
  HANDLERS.getStart = function () {
    var r = gs.apply(null, arguments);
    // What the API remembers of its last calls — here, one slow extras call
    // a phone gave up on, and the boot before it.
    r.recent = [
      { fn: 'getStart', who: 'tyler', at: Date.now() - 95000, ms: 2100, pave: 3, paveMs: 1600, ok: 1, err: '' },
      { fn: 'getExtras', who: 'tyler', at: Date.now() - 60000, ms: 31400, pave: 4, paveMs: 29800, ok: 1, err: '' }
    ];
    return r;
  };
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('mock.local/exec') !== -1) {
      var body = JSON.parse((opts && opts.body) || '{}');
      // __MOCK_STARTFAIL: the first N boot calls come back as a web page with a
      // 500, the way an overloaded /exec answers — transient, retried, then
      // failed, so the app's own boot retry has to carry it.
      if (body.fn === 'getStart' && Number(window.__MOCK_STARTFAIL) > 0) {
        window.__MOCK_STARTFAIL--;
        return Promise.resolve({ ok: false, status: 500, text: function () { return Promise.resolve('<html>busy</html>'); }, json: function () { return Promise.reject(new Error('html')); } });
      }
      var fn = HANDLERS[body.fn];
      var out;
      try {
        out = fn ? { ok: true, data: fn.apply(null, body.args || []) }
                 : { ok: false, error: 'Unknown function: ' + body.fn };
      } catch (err) {
        out = { ok: false, error: String(err && err.message || err), readOnly: /^READ_ONLY/.test(String(err && err.message || '')) };
      }
      // Every real reply says where its time went; the Build panel shows it.
      out.ms = { total: 1840, auth: 60, member: 380, fn: 1400, pave: body.fn === 'getStart' ? 3 : 1, paveMs: 1250 };
      __CALLS.push(body.fn);
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
                 ((body.fn === 'saveSiteChecks' || body.fn === 'saveMaterialLoaded') && Number(window.__MOCK_SLOWPUT)) ||
                 (body.fn === 'sendDailyLog' && Number(window.__MOCK_SLOWLOG)) || 0;
      if (!hold) return Promise.resolve(res);
      return new Promise(function (ok) { setTimeout(function () { ok(res); }, hold); });
    }
    // __MOCK_PUTREFUSED: the signed URL refuses the browser's PUT (a CORS answer).
    if (u.indexOf('mock.local/put') !== -1) return window.__MOCK_PUTREFUSED ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ ok: true, status: 200 });
    return realFetch(url, opts);
  };
})();
