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

  // A fixture set handed in from outside — the training video's
  // (docs/training-video/fixtures.js), injected before this file. Anything it
  // names replaces the demo data below; anything it leaves out stays as it is.
  // Unset, this harness behaves exactly as it always has.
  var FX = window.__MOCK_FIX || {};

  // A session token the app will accept: it only parses `exp` out of the payload.
  var payload = btoa(JSON.stringify({ email: 'tyler.b@deitemeyerbrothers.com', iss: 'dbtc-session', exp: 4102444800 }))
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
  if (FX.job) JOB = FX.job;
  if (FX.job2) LUCAS = FX.job2;
  function jobById(id) { return (FX.jobs || [JOB, LUCAS]).concat([FX.shop || { id: 'shop', number: '25-0011', name: '250011 DB INTERNAL', customer: '', address: '224 Bonnewitz Ave, Van Wert, OH 45891, USA' }]).filter(function (j) { return j.id === id; })[0] || null; }
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
    { id: 'ci10', name: 'Sales On-Site Support', number: '99TM-6', codeName: 'Sales On-Site Support' },
    // The job's Travel Related Labor line in CLOCK IN ITEMS (T2.18).
    // __MOCK_NOTRAVEL: a job made before the line existed.
    { id: 'ci11', name: 'Travel Related Labor', number: '01GR-9', codeName: 'Travel Related Costs', travel: true }
  ];
  if (window.__MOCK_NOTRAVEL) CODES = CODES.filter(function (c) { return !c.travel; });
  if (FX.codes) CODES = FX.codes;
  // T2.25: __MOCK_TRADE='Roofing' (or 'Construction') plays an API that read
  // the job's Job Type and marked off that trade's codes, as getJobCodes does.
  var TRADE_CODES = {
    Roofing: ['07TM-1', '07TM', '07TM-2', '01GR-7', '01GR-1', '02ST-2', '02ST-1', '02ST-5'],
    Construction: ['01GR', '01GR-1', '01GR-4', '01GR-7', '02ST-2', '02ST-1', '02ST-5', '03CC', '04MA', '06WP-1', '06WP', '06WP-2', '09FN-1', '09FN-2', '09FN', '16EL', '15MC']
  };
  if (window.__MOCK_TRADE) CODES = CODES.map(function (c) {
    var t = window.__MOCK_TRADE, list = TRADE_CODES[t] || [];
    return Object.assign({}, c, { trade: list.indexOf(c.number) !== -1 ? t : '' });
  });
  // The shop (T2.17): 25-0011 DB INTERNAL and the six lines the crew
  // clocks at the shop, as getJobCodes chooses them. __MOCK_NOSHOP plays an
  // API from before T2.17, which names no shop on boot.
  var SHOP = FX.shop || { id: 'shop', number: '25-0011', name: '250011 DB INTERNAL', customer: '', address: '224 Bonnewitz Ave, Van Wert, OH 45891, USA' };
  var SHOP_CODES = [
    { id: 'sh1', name: 'Morning Clock-In', number: '99TM-1', codeName: 'Morning Clock-In', travel: false, office: false },
    { id: 'sh2', name: 'Training', number: '99TM-2', codeName: 'Training', travel: false, office: false },
    { id: 'sh3', name: 'Crew Labor - Monroe St.', number: '99TM-3', codeName: 'In House- Monroe', travel: false, office: false },
    { id: 'sh5', name: 'Crew Labor - Bonnewitz Ave.', number: '99TM-5', codeName: 'In House- Bonnewitz', travel: false, office: false },
    { id: 'sh4', name: 'Shop Work/Maintenance', number: '99TM-4', codeName: 'Shop Work/Maintenance', travel: false, office: false },
    { id: 'sh6', name: 'Hauling & Disposal (Direct)', number: '02ST-5', codeName: 'Hauling & Disposal (Direct)', travel: false, office: false }
  ];
  // FX.codesPerJob: every job gets its own cost-item ids ('ci5@co-fair'), as
  // in JobTread, where a cost item belongs to one job's budget — so a code
  // running at one job is not "Running" on the next job's list.
  function codesFor(jobId) {
    if (jobId === SHOP.id) return SHOP_CODES;
    if (!FX.codesPerJob || !jobId) return CODES;
    return CODES.map(function (c) { return Object.assign({}, c, { id: c.id + '@' + jobId }); });
  }
  function code(id) {
    var base = String(id).split('@')[0], c = CODES.concat(SHOP_CODES).filter(function (x) { return x.id === base; })[0];
    return c && base !== id ? Object.assign({}, c, { id: id }) : c;
  }

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
  if (FX.checklist) CHECKLIST = FX.checklist;
  // __MOCK_YARD (T2.20): the board's checklist as it is today, starting At the
  // yard, before you roll out — and Lucas, its yard lines open and its shop
  // material not loaded, is booked today.
  var YARD = !!window.__MOCK_YARD;
  if (YARD && !FX.checklist) {
    CHECKLIST.phases.unshift({ key: 'yard', label: 'At the yard, before you roll out', tag: 'AT THE YARD', when: 'while the truck is loaded \u2014 the same moment as marking the material loaded' });
    CHECKLIST.lines.unshift({ key: 'tarps', phase: 'yard', label: 'Tarps checked and loaded \u2014 four sound 20\u00d740s with tie-downs, a torn one swapped out' },
                            { key: 'dryin', phase: 'yard', label: 'Dry-in supplies loaded \u2014 underlayment, flashing, sealants, fasteners for the planned section' });
  }
  // __MOCK_NAMES (T2.25): the two name lines the board's list has carried
  // since 21 Sep — Covered by: on the handover, Watertight confirmed with:
  // before the sign-off — and the crew leader offered for the second.
  if (window.__MOCK_NAMES && !FX.checklist) {
    var ipm = CHECKLIST.lines.map(function (l) { return l.key; }).indexOf('pm');
    CHECKLIST.lines.splice(ipm + 1, 0, { key: 'covered', phase: 'handover', label: 'Covered by:', value: 'coveredBy' });
    var isg = CHECKLIST.lines.map(function (l) { return l.key; }).indexOf('signoff');
    CHECKLIST.lines.splice(isg, 0, { key: 'watertight', phase: 'finished', label: 'Watertight confirmed with:', value: 'watertightWith' });
  }
  var LINE_KEYS = {};
  CHECKLIST.lines.forEach(function (l) { LINE_KEYS[l.key] = true; });
  function blankChecks(ticked) {
    var done = {};
    CHECKLIST.lines.forEach(function (l) { done[l.key] = (ticked || []).indexOf(l.key) !== -1; });
    return { done: done, magnetBy: null, coveredBy: null, watertightWith: null, signedOff: null, notes: {}, na: {} };
  }
  // One list per JOB, on the roofing crew's line — so its id is never the
  // visit's own taskId. 26-1490 ended yesterday and was never signed off.
  var CHECKS = {
    't2roof': blankChecks(),
    't4roof': blankChecks(['address', 'homeowner', 'scope', 'color', 'walk', 'septic', 'safety', 'access', 'weather', 'material', 'sign',
                           'tearoff', 'shingles', 'tarped', 'special', 'matcheck', 'photos1', 'pm', 'cleanup', 'nails', 'bundle'])
  };
  if (FX.checks) CHECKS = FX.checks(blankChecks);
  function checksProgress(c) {
    return CHECKLIST.phases.map(function (p) {
      var ls = CHECKLIST.lines.filter(function (l) { return l.phase === p.key; });
      return { phase: p.key, label: p.label, done: ls.filter(function (l) { return !!c.done[l.key] || !!(c.na && c.na[l.key]); }).length, total: ls.length,
               na: ls.filter(function (l) { return !c.done[l.key] && !!(c.na && c.na[l.key]); }).length };
    });
  }
  function checksWords(c) {
    if (FX.checksWords) return FX.checksWords(c, checksProgress(c));
    if (c.signedOff) return 'Signed off \u2014 ' + c.signedOff;
    var pr = checksProgress(c), by = {}; pr.forEach(function (p) { by[p.phase] = p; });
    var before = by.before, handover = by.handover, finished = by.finished;
    if (finished.done > 0) return 'Finishing up \u2014 ' + finished.done + ' of ' + finished.total + ' done, not signed off';
    if (handover.done > 0) return 'Handing over \u2014 ' + handover.done + ' of ' + handover.total + ' done';
    if (before.done === 0) return 'Site checks not started';
    if (before.done === before.total) return 'Before-tear-off checks done';
    return 'Before tear-off \u2014 ' + before.done + ' of ' + before.total + ' done';
  }
  function checksFor(tid) {
    var c = CHECKS[tid];
    if (!c) return null;
    return { taskId: tid, state: JSON.parse(JSON.stringify(c)), progress: checksProgress(c), words: checksWords(c), crewLead: FX.crewLead || (window.__MOCK_NAMES ? 'Jeremiah Zehr' : null) };
  }
  // The bench's pre-start list (T2.25): seven boxes on a construction job's
  // Start Date line, the board's own words (prestart-checks.ts). Webster
  // carries one when __MOCK_PRESTART is set; a fixture can name its own.
  var PRESTART_LINES = [
    { key: 'precon', label: 'Pre-con meeting held \u2014 scope, selections and access agreed with the customer' },
    { key: 'permit', label: 'Permit posted on site, or confirmed not needed' },
    { key: 'utilities', label: 'Utilities located and marked \u2014 gas, electric, water, septic' },
    { key: 'material', label: 'Material for the first days is in \u2014 the rest dated on the budget lines' },
    { key: 'debris', label: 'Dumpster or trailer booked for the start' },
    { key: 'photos', label: 'Before photos in DB Cam \u2014 property, access, anything already damaged' },
    { key: 'customer', label: 'Customer told the start day and who is coming' }
  ];
  var PRESTART = { 'tpre': (function () { var d = {}; PRESTART_LINES.forEach(function (l) { d[l.key] = l.key === 'precon' || l.key === 'permit'; }); return { done: d }; })() };
  function prestartWords(c) {
    var n = PRESTART_LINES.filter(function (l) { return c.done[l.key]; }).length;
    return n === 0 ? 'Pre-start not started' : n === PRESTART_LINES.length ? 'Pre-start all done' : 'Pre-start \u2014 ' + n + ' of ' + PRESTART_LINES.length + ' done';
  }
  function prestartFor(tid) {
    var c = PRESTART[tid]; if (!c) return null;
    var n = PRESTART_LINES.filter(function (l) { return c.done[l.key]; }).length;
    return { taskId: tid, state: JSON.parse(JSON.stringify(c)), progress: { done: n, total: PRESTART_LINES.length }, words: prestartWords(c), lines: JSON.parse(JSON.stringify(PRESTART_LINES)) };
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
    var out = FX.visits ? FX.visits({ isoAdd: isoAdd, checksFor: checksFor, prestartFor: prestartFor, two: TWO }) : [
      { taskId: 't1', jobId: 'j_2841', jobNum: '26-0890', jobName: '260890 Webster_Foundation',
        start: isoAdd(-1), end: isoAdd(1), days: 3, dayOf: 2, today: true,
        crewNote: 'Dumpster on the north side. Gate code 1412 — do not block the neighbour\u2019s drive.',
        cust: 'Noah Webster', city: 'Van Wert', address: '408 Euclid Ave, Van Wert, OH 45891, USA',
        status: 'Production', jtype: 'Foundation',
        material: { text: 'Ordered \u2014 drop booked, not on site yet', cls: 'warn' },
        warehouse: null,
        checks: null, prestart: window.__MOCK_PRESTART ? prestartFor('tpre') : null, alongside: null, pm: 'Neal Deitemeyer', reps: ['Justin Phillips'] },
      { taskId: 't4', jobId: 'j4', jobNum: '26-1490', jobName: '261490 Courtney_Roof',
        start: isoAdd(-1), end: isoAdd(-1), days: 1, dayOf: null, today: false,
        crewNote: '', cust: 'Courtney', city: 'Ohio City', address: '1140 Bittersweet Ln, Ohio City, OH 45874, USA',
        status: 'Production', jtype: 'Roofing',
        material: { text: 'Loaded for the crew \u2713', cls: 'good' },
        warehouse: { delivered: false, pulled: true, staged: true, where: 'Bay 3', loaded: true, toWarehouse: false, words: 'Pulled, staged and loaded for the crew' },
        checks: checksFor('t4roof'), alongside: 'Platinum (Shingle)', pm: 'Dave Elick', reps: ['Shawn Deitemeyer', 'Jenn Grubb'] },
      { taskId: 't2', jobId: 'j2', jobNum: '26-1045', jobName: '261045 Lucas_Roof',
        start: isoAdd(TWO || YARD ? 0 : 2), end: isoAdd(TWO || YARD ? 0 : 2), days: 1, dayOf: TWO || YARD ? 1 : null, today: TWO || YARD,
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
    // T2.25: __MOCK_LONG — Webster is the bench's four-week Rough-in, day 8
    // of 15 on site (the board names the task; the phone says the stage).
    if (window.__MOCK_LONG) out.forEach(function (v) {
      if (v.taskId === 't1') Object.assign(v, { taskName: 'Rough-in', days: 15, dayOf: 8, end: isoAdd(9) });
      if (v.taskId === 't3') Object.assign(v, { taskName: 'Finishes' });
    });
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
  // Two closed blocks already banked, so the hours have something in them:
  // the morning at the shop and the drive to Webster (T2.23). Neither is work
  // at Webster, so its first clock-in owes the start photo whatever the hour
  // the suites run — the photo rule asks whether the site was worked today.
  var t0 = Date.now() - 3 * 3600 * 1000;
  ST.entries = [
    { id: 'e1', startedAt: new Date(t0).toISOString(), endedAt: new Date(t0 + 42 * 60000).toISOString(), minutes: 42, notes: '', job: SHOP, code: code('sh1') },
    { id: 'e2', startedAt: new Date(t0 + 42 * 60000).toISOString(), endedAt: new Date(t0 + 180 * 60000).toISOString(), minutes: 138, notes: 'Drive to 26-0890 Noah Webster · from the shop', job: JOB, code: code('ci11') }
  ];
  if (FX.entries) ST.entries = FX.entries({ job: JOB, code: code, t0: t0 });
  // __MOCK_OPEN_AGO (minutes): on 04MA at Webster since then. __MOCK_OPEN_YESTERDAY:
  // since 7:02a yesterday — a block nobody clocked out of (T2.19).
  // __MOCK_DRIVE_YESTERDAY: the drive back, never ended, since 4:40p yesterday.
  if (window.__MOCK_OPEN_AGO || window.__MOCK_OPEN_YESTERDAY || window.__MOCK_DRIVE_YESTERDAY) {
    var ob = new Date(Date.now() - (window.__MOCK_OPEN_AGO || 0) * 60000);
    if (window.__MOCK_OPEN_YESTERDAY || window.__MOCK_DRIVE_YESTERDAY) { ob = new Date(); ob.setDate(ob.getDate() - 1); ob.setHours(window.__MOCK_DRIVE_YESTERDAY ? 16 : 7, window.__MOCK_DRIVE_YESTERDAY ? 40 : 2, 0, 0); }
    ST.open = { id: 'oy', startedAt: ob.toISOString(), endedAt: null, minutes: 0, notes: window.__MOCK_DRIVE_YESTERDAY ? 'Drive back · end of the day · from 26-0890 Noah Webster' : '', job: JOB, code: code(window.__MOCK_DRIVE_YESTERDAY ? 'ci11' : 'ci9') };
    ST.entries = [ST.open].concat(ST.entries);
  }
  // __MOCK_KEEP_CLOCK: the clock lives in JobTread, so a reload finds it
  // where it was — since T2.13 a break is an open entry there, not
  // something only the phone remembers.
  if (window.__MOCK_KEEP_CLOCK) {
    try {
      var kept = JSON.parse(sessionStorage.getItem('mock_clock') || 'null');
      if (kept) { ST.open = kept.open; ST.entries = kept.entries; ST.n = kept.n; }
    } catch (e) {}
    window.addEventListener('pagehide', function () {
      try { sessionStorage.setItem('mock_clock', JSON.stringify({ open: ST.open, entries: ST.entries, n: ST.n })); } catch (e) {}
    });
  }

  // ---- Close Out fixtures: DB CheckOut's demo jobs, in its own shapes ----
  var CO_LANDED = {}, CO_DONE = {};
  var CO_JOBS = FX.coJobs ? FX.coJobs({ isoAdd: isoAdd }) : [
    { id: 'co-hartman', number: '26-0418', name: '260418 Hartman_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Neal Deitemeyer', salesRep: 'Austin Leeth', address: '1427 Prairie View Dr, Lima, OH 45801, USA', openPunchCount: 0, mine: true, openPunchTotal: 0,
      punchTasks: [], soldScope: [{ id: 'd1', name: 'Estimate', number: 4, issueDate: '2026-07-02', price: 18450, jtUrl: 'https://app.jobtread.com', lines: [
        { name: 'OC Duration Shingles — Onyx Black', quantity: 32, unit: 'Square', description: null }, { name: 'High Temp Pipe Boot', quantity: 3, unit: 'Each', description: null }] }] },
    { id: 'co-okafor', number: '26-0415', name: '260415 Okafor_Roof', status: 'Punch List', jobType: 'Roofing', projectTypes: ['R-Repairs/Service'], isService: true,
      projectManager: 'Dave Elick', salesRep: 'Sam Black', address: '88 Cedar Falls Ct, Van Wert, OH 45891, USA', openPunchCount: 2, mine: true, openPunchTotal: 2,
      punchTasks: [
        { id: 'pt1', name: 'REPORT: Reseal the pipe boot', description: 'Rear slope pipe boot is cracked, water getting in. Replace the boot, seal and check the shingles around it.', progress: 0, endDate: '2026-10-07', createdAt: '2026-10-01T12:00:00.000Z', assignees: [{ membershipId: 'm1', name: 'Alberto Gonzalez', email: 'alberto@deitemeyerbrothers.com' }], assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true },
        { id: 'pt2', name: 'REPORT: Reconnect the downspout', description: 'NE corner downspout came loose from the elbow.', progress: 0, endDate: null, createdAt: '2026-10-01T12:00:00.000Z', assignees: [], assigneeNames: ['Alberto Gonzalez'], mine: true },
        { id: 'pt3', name: 'REPORT: Exposed nails sealed', description: 'Four exposed nails on the ridge, sealed.', progress: 1, endDate: null, assignees: [], assigneeNames: ['Yahir Gonzalez'], mine: false }
      ], soldScope: [] },
    { id: 'co-reyes', number: '26-0421', name: '260421 Reyes_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '301 Walnut St, Delphos, OH 45833, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [], soldScope: [] },
    { id: 'co-bell', number: '26-0388', name: '260388 Bell_Roof', status: 'PM Review', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: null, address: '9 Sycamore Ln, Ohio City, OH 45874, USA', openPunchCount: 0, mine: false, openPunchTotal: 0, punchTasks: [], soldScope: [] }
  ];
  // __MOCK_CO_AREAS: a server new enough to list each job's work areas
  // (Carl, 23 Oct 2026). Hartman's one roof gets its area, and Mason has
  // two: the roof inspected with one repair open, and the gutters booked
  // for today, for Alberto — notes and photos, not the roof checklist.
  var CO_REVIEWER = FX.reviewers || { shingle: 'Dave Elick', gutters: 'Neal Deitemeyer' };
  if (window.__MOCK_CO_AREAS) {
    CO_JOBS[0].areas = [{ key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-hartman', inspectionDate: isoAdd(0), assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true, inspected: false, openRepairs: 0 }];
    CO_JOBS.push({ id: 'co-mason', number: '26-0502', name: '260502 Mason_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles', 'R-Gutters'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '212 Elm St, Van Wert, OH 45891, USA', openPunchCount: 1, mine: true, openPunchTotal: 1,
      punchTasks: [{ id: 'pt9', name: 'REPORT: Reseal the chimney flashing', description: 'Counter-flashing lifted on the left side of the chimney.', progress: 0, endDate: null, createdAt: '2026-10-20T12:00:00.000Z', assignees: [], assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true, area: 'shingle' }],
      areas: [
        { key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-mason', inspectionDate: isoAdd(-3), assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true, inspected: true, openRepairs: 1 },
        { key: 'gutters', label: 'Gutters', line: false, form: 'notes', inspectionTaskId: 'fig-mason', inspectionDate: isoAdd(0), assigneeNames: ['Alberto Gonzalez'], mine: true, inspected: false, openRepairs: 0 }
      ], soldScope: [] });
  }
  // __MOCK_CO_DAYS: a CheckOut server new enough to say which days each of
  // your jobs is booked for (`booked`, T2.11). Hartman's inspection is today,
  // Okafor's repair slipped from two days ago, a new job is booked in four
  // days (a two-day stay), and one more is yours with no day yet.
  if (window.__MOCK_CO_DAYS) {
    CO_JOBS[0].booked = [{ start: isoAdd(0), end: isoAdd(0), kind: 'inspection' }];
    CO_JOBS[1].booked = [{ start: isoAdd(-2), end: isoAdd(-2), kind: 'repair' }];
    CO_JOBS.push({ id: 'co-diaz', number: '26-0533', name: '260533 Diaz_Roof', status: 'Final Inspection', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: 'Sam Black', address: '40 Fox Run, Celina, OH 45822, USA', openPunchCount: 0, mine: true, openPunchTotal: 0,
      booked: [{ start: isoAdd(4), end: isoAdd(5), kind: 'inspection' }], punchTasks: [], soldScope: [] });
    CO_JOBS.push({ id: 'co-lane', number: '26-0540', name: '260540 Lane_Roof', status: 'Punch List', jobType: 'Roofing', projectTypes: ['R-Shingles'], isService: false,
      projectManager: 'Kyle Akerman', salesRep: 'Austin Leeth', address: '7 Mill St, Rockford, OH 45882, USA', openPunchCount: 1, mine: true, openPunchTotal: 1,
      booked: [], punchTasks: [{ id: 'pt20', name: 'REPORT: Ridge vent nails', description: 'Two nails backing out on the ridge vent.', progress: 0, endDate: null, createdAt: '2026-10-21T12:00:00.000Z', assignees: [], assigneeNames: ['Alberto Gonzalez'], mine: true }], soldScope: [] });
  }
  // The Production Board's rule, as far as the phone can tell it from here:
  // the area furthest behind decides, forward only.
  function coBoardMove(j) {
    if (!j || !j.areas || !j.areas.length) return null;
    var order = ['Final Inspection', 'Punch List', 'PM Review'], to;
    if (j.areas.some(function (a) { return !a.inspected; })) to = 'Final Inspection';
    else if (j.areas.some(function (a) { return a.openRepairs > 0; })) to = 'Punch List';
    else to = 'PM Review';
    if (order.indexOf(to) > order.indexOf(j.status)) { j.status = to; return to; }
    return null;
  }
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
      var who = FX.who && FX.who[appRole] ? FX.who[appRole]
              : appRole === 'service' ? { email: 'alberto@deitemeyerbrothers.com', name: 'Alberto Gonzalez' }
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
      return { me: b, open: t.open, job: t.job, entries: t.entries, writeEnabled: t.writeEnabled, shop: window.__MOCK_NOSHOP ? undefined : { id: SHOP.id, number: SHOP.number, name: SHOP.name } };
    },
    // Set __MOCK_SLOWEXTRAS to watch the sheets while the extras are still in
    // flight — the state a real phone is in for the first few seconds of boot.
    getExtras: function (jobId) {
      var b = HANDLERS.getBoot();
      return { codes: jobId ? codesFor(jobId) : [], jobOptions: HANDLERS.getJobOptions(),
               crew: b.isForeman ? HANDLERS.getCrewOnClock() : [], logFields: LOG_FIELDS,
               // __MOCK_PARTNER: Yahir's phone — the API names Alberto (T2.21).
               partner: window.__MOCK_PARTNER ? { name: 'Alberto Gonzalez' } : (FX.partner || null),
               // T2.23: your codes — __MOCK_RECENT, or the fixtures'; null is "could not ask".
               recentCodes: window.__MOCK_RECENT || FX.recentCodes || null };
    },
    getToday: function (jobId) {
      // __MOCK_NOJOB: nothing remembered on the phone — the seed-from-the-schedule case.
      var job = (ST.open && ST.open.job) || jobById(jobId) || ((TWO || window.__MOCK_NOJOB) ? null : JOB);
      return { me: { userId: 'u1', name: HANDLERS.getBoot().name }, open: ST.open, job: job, codes: codesFor(job && job.id),
               entries: ST.entries, writeEnabled: !window.__MOCK_READONLY };
    },
    getMyDay: function () { return ST.entries; },
    getJobCodes: function (jobId) { return codesFor(jobId); },
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
        crew: FX.crew ? FX.crew(window.__MOCK_ROLE || 'siteManager') : { id: 'c1', name: 'Alberto', leadMembershipId: 'm1', leadUserName: 'Alberto Gonzalez' },
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
      var signedOff = checks.signOff ? (cur.signedOff || ((FX.signer || 'Tyler') + ' \u00b7 ' + shortDate(today))) : null;
      done.signoff = !!signedOff;
      var notes = Object.assign({}, cur.notes || {});
      for (var nk in (checks.notes || {})) if (LINE_KEYS[nk]) { var nt = String(checks.notes[nk] || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (nt) notes[nk] = nt; else delete notes[nk]; }
      // N/A as the board takes it: a reason sets it, "" clears it, and a tick
      // this save does not also send as n/a clears an old one.
      var na = Object.assign({}, cur.na || {});
      for (var ak in (checks.na || {})) if (LINE_KEYS[ak]) { var ar = String(checks.na[ak] || '').replace(/\s+/g, ' ').trim().slice(0, 80); if (ar) { na[ak] = ar; done[ak] = false; } else delete na[ak]; }
      for (var tk in done) if (done[tk] && !(checks.na && checks.na[tk])) delete na[tk];
      var nameOf = function (f) { return Object.prototype.hasOwnProperty.call(checks, f) ? (String(checks[f] || '').trim().slice(0, 60) || null) : (cur[f] || null); };
      cur = CHECKS[taskId] = { done: done, magnetBy: String(checks.magnetBy || '').trim().slice(0, 40) || null, coveredBy: nameOf('coveredBy'), watertightWith: nameOf('watertightWith'),
                               signedOff: signedOff, notes: notes, na: na };
      return { status: 200, reason: '', body: {
        human: jobLabel + ' \u2014 ' + checksWords(cur), api: [],
        checks: JSON.parse(JSON.stringify(cur)), previous: previous } };
    },
    // The board's PUT /api/crew/prestart: the whole state, every time (T2.25).
    //   __MOCK_PRE_FORBID  the board's 403: not on the bench, not a site manager
    savePrestart: function (taskId, jobId, jobLabel, done) {
      window.__PREPUTS = window.__PREPUTS || [];
      window.__PREPUTS.push(JSON.parse(JSON.stringify({ taskId: taskId, jobId: jobId, jobLabel: jobLabel, done: done })));
      if (window.__MOCK_PRE_FORBID) return { status: 403, reason: 'board-http-403', body: { error: 'Only the construction bench or a site manager can tick the pre-start \u2014 ask the office.' } };
      if (window.__MOCK_PUTFAIL) return { status: 502, reason: 'board-http-502', body: { error: 'JobTread write failed' } };
      var cur = PRESTART[taskId];
      if (!cur) return { status: 400, reason: 'board-http-400', body: { error: 'membershipId, taskId, jobId and done are required' } };
      var previous = JSON.parse(JSON.stringify(cur)), next = { done: {} };
      PRESTART_LINES.forEach(function (l) { next.done[l.key] = done[l.key] === true; });
      PRESTART[taskId] = next;
      return { status: 200, reason: '', body: { taskId: taskId, human: jobLabel + ' \u2014 ' + prestartWords(next), api: [], prestart: JSON.parse(JSON.stringify(next)), previous: previous } };
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
    getJobOptions: function () { return FX.jobs || [JOB, LUCAS]; },
    searchJobs: function (term) { return FX.search ? FX.search(term) : [JOB]; },
    getCrewOnClock: function () {
      if (FX.crewOnClock) return FX.crewOnClock;
      return [
        { name: 'Tyler B.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Marcus D.', minutes: 138, job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' },
        { name: 'Jesse P.', minutes: 60, job: '26-0890 Webster_Foundation', code: '02ST-1 Final Clean' }
      ].concat(window.__MOCK_CREW_BREAK ? [
        // On a break (T2.13): the open entry starts when the break ends.
        { name: 'Luis R.', minutes: 0, startedAt: new Date(Date.now() + 20 * 60000).toISOString(), job: '26-0890 Webster_Foundation', code: '04MA Masonry Labor' }
      ] : []);
    },
    // The clock, with the photo gates Code.gs enforces: no start photo, no
    // clock-in; no end photo, no clock-out; a switch carries both. A break
    // is the one photo-less write. Every call is recorded in window.__CLOCK.
    // T2.23: the photo rule, as Code.gs asks it — a start photo when work
    // starts at a site not started today, never at the shop; an end photo
    // when a site is left for the day.
    __work: function (e) { return !!(e && e.job && Date.parse(e.startedAt) <= Date.now() && !(e.code && /travel/i.test(e.code.name || '')) && !/^(drive (to|back)|supply run)\b/i.test(e.notes || '')); },
    __startOwed: function (jobId) {
      if (jobId === SHOP.id) return false;
      if (HANDLERS.__work(ST.open) && ST.open.job && ST.open.job.id === jobId) return false;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      return !ST.entries.some(function (e) { return e.job && e.job.id === jobId && HANDLERS.__work(e) && Date.parse(e.startedAt) >= today.getTime(); });
    },
    __endOwed: function () { return HANDLERS.__work(ST.open) && !(ST.open.job && ST.open.job.id === SHOP.id); },
    clockIn: function (jobId, costItemId, coords, startPhotoId, opts) {
      (window.__CLOCK = window.__CLOCK || []).push(['clockIn', jobId, costItemId, startPhotoId || null, (opts && opts.todayJobId) || null]);
      if (!startPhotoId && HANDLERS.__startOwed(jobId)) throw new Error('PHOTO_REQUIRED: A start photo is required to clock in.');
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var first = jobId === SHOP.id && !ST.entries.some(function (e) { return Date.parse(e.startedAt) >= today.getTime() && Date.parse(e.startedAt) <= Date.now(); });
      var e = HANDLERS.__open(jobId, costItemId);
      // __MOCK_AWAY: the morning clock-in somewhere else (T2.23).
      if (first) {
        e.morning = window.__MOCK_AWAY ? { ok: false, where: window.__MOCK_AWAY === 'noloc' ? 'with no location from the phone' : 'about 3.2 miles from the shop on Monroe St' } : { ok: true, at: 'the shop on Monroe St' };
        if (window.__MOCK_AWAY) (window.__NOTES = window.__NOTES || []).push({ kind: 'morning', jobId: (opts && opts.todayJobId) || SHOP.id, where: e.morning.where });
      }
      return e;
    },
    __open: function (jobId, costItemId, notes) {
      HANDLERS.__dropPlanned();
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = { id: 'open' + (++ST.n), startedAt: new Date().toISOString(), endedAt: null, minutes: 0, notes: notes || '', job: jobById(jobId) || JOB, code: code(costItemId) };
      ST.entries = [ST.open].concat(ST.entries);
      return ST.open;
    },
    switchCode: function (jobId, costItemId, coords, endPhotoId, startPhotoId, opts) {
      (window.__CLOCK = window.__CLOCK || []).push(['switchCode', jobId, costItemId, endPhotoId || null, startPhotoId || null, (opts && opts.notes) || null]);
      if (!startPhotoId && HANDLERS.__startOwed(jobId)) throw new Error('PHOTO_REQUIRED: A start photo is required to start work at this job.');
      return HANDLERS.__open(jobId, costItemId, opts && opts.notes);
    },
    // Rolled out without the shop checks done (T2.20): the PM and the Ops
    // Director are told.
    rollForgot: function (jobId, jobLabel, missing) {
      (window.__ROLL = window.__ROLL || []).push({ jobId: jobId, jobLabel: jobLabel, missing: missing });
      return { ok: true, assigned: ['Dave Elick', 'Carl Bledsoe'] };
    },
    // The morning's shop checks on a multi-day roof (T2.24), written on the
    // checklist's own task.
    rollChecked: function (jobId, taskId, jobLabel, day, lines, bring) {
      (window.__ROLLDAY = window.__ROLLDAY || []).push({ jobId: jobId, taskId: taskId, jobLabel: jobLabel, day: day, lines: lines, bring: bring });
      return { ok: true, id: 'c' + window.__ROLLDAY.length };
    },
    // Left the site without clocking out (T2.19): the block ends at the time
    // given, no photo; then out, the drive from then, or the work from now
    // (with the drive from then to now on the travel line named).
    leftSite: function (leftAt, coords, plan) {
      plan = plan || {};
      (window.__CLOCK = window.__CLOCK || []).push(['leftSite', leftAt, plan.kind || 'out', plan.jobId || null, plan.costItemId || null, plan.travelItemId || null, plan.startPhotoId || null, plan.notes || '']);
      if (!ST.open || Date.parse(ST.open.startedAt) > Date.now()) throw new Error('You are not on the clock at a job.');
      if (HANDLERS.__driving() && (plan.kind || 'out') !== 'out') throw new Error('A drive needs no end photo — use the buttons on the drive.');
      var at = Date.parse(leftAt);
      if (!(at > Date.parse(ST.open.startedAt))) throw new Error('That is before this block began.');
      if (at > Date.now() + 60000) throw new Error('That time has not happened yet.');
      if (plan.kind === 'work' && !plan.startPhotoId && HANDLERS.__startOwed(plan.jobId)) throw new Error('PHOTO_REQUIRED: A start photo is required to start the next code.');
      ST.open.endedAt = new Date(at).toISOString();
      ST.open.notes = 'No end photo — left the site.';
      ST.open = null;
      var add = function (jobId, costItemId, from, to, notes) {
        var e = { id: 'open' + (++ST.n), startedAt: from, endedAt: to, minutes: 0, notes: notes || '', job: jobById(jobId) || JOB, code: code(costItemId) };
        ST.entries = [e].concat(ST.entries);
        return e;
      };
      if (plan.kind === 'drive') ST.open = add(plan.jobId, plan.costItemId, new Date(at).toISOString(), null, plan.notes);
      if (plan.kind === 'work') {
        var now = new Date().toISOString();
        if (plan.travelItemId) add(plan.jobId, plan.travelItemId, new Date(at).toISOString(), now, plan.notes);
        ST.open = add(plan.jobId, plan.costItemId, now, null);
      }
      return { ok: true, open: ST.open, entries: ST.entries };
    },
    // Started earlier (T2.24): the block just opened moves back, its notes
    // say so; the API's bounds, as the API words them.
    startedEarlier: function (startedAt) {
      (window.__CLOCK = window.__CLOCK || []).push(['startedEarlier', startedAt]);
      if (!ST.open || Date.parse(ST.open.startedAt) > Date.now()) throw new Error('You are not on the clock.');
      var at = Date.parse(startedAt), began = Date.parse(ST.open.startedAt);
      if (!(at < began)) throw new Error('That is not before you clocked in.');
      if (began - at > 4 * 3600e3) throw new Error('That is more than 4 hours before you clocked in — ask the office to fix the day.');
      ST.open.startedAt = new Date(at).toISOString();
      ST.open.notes = ((ST.open.notes || '') + ' Started earlier — said they started earlier.').trim();
      (window.__NOTES = window.__NOTES || []).push({ kind: 'earlier', jobId: ST.open.job && ST.open.job.id, at: startedAt });
      return { ok: true, id: ST.open.id, startedAt: ST.open.startedAt, notice: { ok: true } };
    },
    // The drive (T2.18): from work it carries the end photo of what is left;
    // from a drive nothing. Opens on the line named, saying where to.
    __driving: function () { return !!(ST.open && Date.parse(ST.open.startedAt) <= Date.now() && ((ST.open.code && /travel/i.test(ST.open.code.name || '')) || /^(drive (to|back)|supply run)\b/i.test(ST.open.notes || ''))); },
    startTravel: function (jobId, costItemId, coords, endPhotoId, notes, opts) {
      (window.__CLOCK = window.__CLOCK || []).push(['startTravel', jobId, costItemId, endPhotoId || null, notes || '', !!(opts && opts.doneHere)]);
      if (!ST.open) throw new Error('You are not on the clock. Clock in first — the drive starts from where you are.');
      if (!endPhotoId && opts && opts.doneHere && HANDLERS.__endOwed()) throw new Error('PHOTO_REQUIRED: An end photo of the site is required when you leave it for the day.');
      return HANDLERS.__open(jobId, costItemId, notes);
    },
    clockOut: function (coords, endPhotoId) {
      (window.__CLOCK = window.__CLOCK || []).push(['clockOut', endPhotoId || null]);
      // Out from a break: the planned block goes, no photo (T2.13).
      if (HANDLERS.__dropPlanned()) return { ok: true, closed: null, entries: ST.entries };
      if (!endPhotoId && HANDLERS.__endOwed()) throw new Error('PHOTO_REQUIRED: An end photo is required to clock out.');
      if (ST.open) ST.open.endedAt = new Date().toISOString();
      ST.open = null;
      return { ok: true, entries: ST.entries };
    },
    // A break the way JobTread takes one (T2.13): the running block ends and
    // the next is waiting, starting when the break ends (floored to the
    // minute). __MOCK_OLD_BREAK plays an Apps Script from before T2.13,
    // which only closed the block.
    startBreak: function (coords, minutes, lang) {
      (window.__CLOCK = window.__CLOCK || []).push(['startBreak', minutes == null ? null : minutes, lang || null]);
      if (window.__MOCK_OLD_BREAK || minutes == null) {
        if (ST.open) ST.open.endedAt = new Date().toISOString();
        ST.open = null;
        return { ok: true, entries: ST.entries };
      }
      if ([15, 30, 45, 60].indexOf(Number(minutes)) === -1) throw new Error('Pick a break of 15, 30, 45 or 60 minutes.');
      var was = ST.open;
      if (!was) throw new Error('You are not on the clock, so there is no break to start.');
      was.endedAt = new Date().toISOString();
      var at = new Date(Date.now() + minutes * 60000); at.setSeconds(0, 0);
      ST.open = { id: 'open' + (++ST.n), startedAt: at.toISOString(), endedAt: null, minutes: 0, job: was.job, code: was.code };
      ST.entries = [ST.open].concat(ST.entries);
      return { ok: true, closed: was.id, open: ST.open, breakEnd: ST.open.startedAt, minutes: minutes, entries: ST.entries };
    },
    endBreak: function (jobId, costItemId) {
      (window.__CLOCK = window.__CLOCK || []).push(['endBreak', jobId, costItemId]);
      if (ST.open && Date.parse(ST.open.startedAt) <= Date.now()) return ST.open;   // the break already ran out
      return HANDLERS.__open(jobId, costItemId);
    },
    // The waiting block after a break goes (End break early, a clock-out,
    // or work starting somewhere else). True when there was one.
    __dropPlanned: function () {
      if (!ST.open || Date.parse(ST.open.startedAt) <= Date.now()) return false;
      var gone = ST.open.id;
      ST.entries = ST.entries.filter(function (e) { return e.id !== gone; });
      ST.open = null;
      return true;
    },
    // A read-only build refuses the upload request the way Code.gs does.
    createCaptureUploadRequest: function () {
      if (window.__MOCK_READONLY) throw new Error('READ_ONLY: this deployment cannot post to JobTread yet.');
      return { uploadRequestId: 'ur1', url: 'https://mock.local/put', method: 'PUT', headers: {} };
    },
    // The base64 path the app falls back to when the direct PUT is refused.
    uploadCapture: function (jobId, b64, mime, name, desc) {
      window.__VIAAPI = window.__VIAAPI || [];
      window.__VIAAPI.push({ jobId: jobId, bytes: b64.length, mime: mime, name: name });
      (window.__FILES = window.__FILES || []).push({ name: name, desc: desc });
      return { ok: true, fileId: 'f' + (++ST.files) };
    },
    // Every file that reaches JobTread, by either path, with its name and description.
    finalizeCaptureUpload: function (jobId, reqId, name, desc) {
      (window.__FILES = window.__FILES || []).push({ name: name, desc: desc });
      return { ok: true, fileId: 'f' + (++ST.files) };
    },
    // A note to the office; with the fourth argument it is assigned to the PM.
    postJobNote: function (jobId, message, author, assignPm) {
      window.__NOTES = window.__NOTES || [];
      window.__NOTES.push({ jobId: jobId, message: message, author: author, assignPm: !!assignPm });
      return { ok: true, id: 'c' + window.__NOTES.length, assigned: assignPm ? [FX.pm || 'Neal Deitemeyer'] : [] };
    },
    // "Tell the PM now": a comment on the job, assigned to the PM.
    tellPm: function (jobId, text) { return HANDLERS.postJobNote(jobId, text, HANDLERS.getBoot().name, true); },
    // The safety alert: a comment assigned to the PM and a text to the
    // office's list, recorded in window.__ALERTS. __MOCK_ALERTFAIL makes it throw.
    sendSafetyAlert: function (jobId, alert) {
      if (window.__MOCK_ALERTFAIL) throw new Error('Pave error (HTTP 500): boom');
      window.__ALERTS = window.__ALERTS || [];
      window.__ALERTS.push(JSON.parse(JSON.stringify({ jobId: jobId, alert: alert })));
      return { ok: true, at: Date.now(), commented: true, assigned: [FX.pm || 'Neal Deitemeyer'],
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
        return { ok: true, dailyLogId: 'dl' + window.__LOGS.length, date: log.date, assigned: FX.logAssigned || ['Neal Deitemeyer', 'Justin Phillips'], unresolved: [],
                 flag: sflag, commented: !!sflag, photos: (log.photos || []).length };
      }
      var signed = log.checks && log.checks.signedOff;
      var pings = Object.keys(log.fields || {}).filter(function (id) {
        var f = LOG_FIELDS.filter(function (x) { return x.id === id; })[0], v = log.fields[id];
        return f && /safety|incident|delay/i.test(f.name) && (v === true || (typeof v === 'string' && v.trim()) || (Array.isArray(v) && v.length));
      });
      var flag = String(log.problems || '').trim() ? 'problems' : pings.length ? 'fields' : (log.crewOnSite === true && !signed ? 'crew-on-site' : '');
      return { ok: true, dailyLogId: 'dl' + window.__LOGS.length, date: log.date, assigned: FX.logAssigned || ['Neal Deitemeyer', 'Justin Phillips'], unresolved: [],
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
      return { status: 200, body: CO_JOBS.map(function (j) { var c = JSON.parse(JSON.stringify(j)); delete c.punchTasks; delete c.soldScope; delete c.openPunchTotal; delete c.areas; return c; }) };
    },
    coJob: function (jobId) {
      var j = CO_JOBS.filter(function (x) { return x.id === jobId; })[0];
      if (!j) return { status: 404, reason: 'http-404', body: { error: 'Job not found' } };
      var out = JSON.parse(JSON.stringify(j));
      out.punchTasks.forEach(function (t) { if (CO_DONE[t.id]) t.progress = 1; });
      // __MOCK_CO_FORM (T2.25): the server's form, as data — the phone draws
      // this one, not its own copy. A form object here replaces the roof's.
      if (window.__MOCK_CO_FORM) { out.forms = { roof: window.__MOCK_CO_FORM }; out.jobForm = 'roof'; }
      return { status: 200, body: out };
    },
    coScope: function () { if (FX.scope) return { status: 200, body: FX.scope }; return { status: 200, body: { en: 'A 32-square Duration roof in Onyx Black with three pipe boots and new gutters on the back.', es: 'Un techo Duration de 32 cuadros en Onyx Black con tres botas y canales nuevos atrás.' } }; },
    coTranslate: function (texts, to) {
      window.__CO.push({ fn: 'coTranslate', to: to, n: texts.length });
      return { status: 200, body: { translations: texts.map(function (t) { return FX.translate ? FX.translate(t, to) : to === 'en' ? 'EN: ' + t : 'ES: ' + t; }) } };
    },
    coReport: function (jobId, report, ref) {
      window.__CO.push({ fn: 'coReport', jobId: jobId, ref: ref, report: report });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      if (window.__MOCK_CO_REJECT) return { status: 400, reason: 'http-400', body: { error: 'location and englishNote are required' } };
      CO_LANDED[ref] = 't_' + ref;
      // A fixture set may turn a report into the repair the server would make.
      if (FX.onReport) FX.onReport(CO_JOBS.filter(function (x) { return x.id === jobId; })[0], report, 't_' + ref);
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
      var line = j && j.areas && j.areas.filter(function (a) { return a.line; })[0];
      if (line) {
        // With work areas the board moves the job, and the line roof's PM is told.
        line.inspected = true; line.openRepairs += visit.problemsReported || 0;
        return { status: 200, body: { completedTaskId: line.inspectionTaskId, flipped: coBoardMove(j), sentTo: CO_REVIEWER[line.key] || null } };
      }
      var flipped = visit.problemsReported > 0 ? 'Punch List' : 'PM Review';
      if (j) j.status = flipped;
      return { status: 200, body: { completedTaskId: 'fi_' + jobId, flipped: flipped } };
    },
    coCloseArea: function (jobId, body, ref) {
      window.__CO.push({ fn: 'coCloseArea', jobId: jobId, ref: ref, body: body });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      var j = CO_JOBS.filter(function (x) { return x.id === jobId; })[0];
      var a = j && (j.areas || []).filter(function (x) { return x.key === body.area; })[0];
      if (!a) return { status: 400, reason: 'http-400', body: { error: 'area must be one of this job\'s work areas' } };
      a.inspected = true; a.openRepairs += body.problemsReported || 0;
      return { status: 200, body: { completedTaskId: a.inspectionTaskId, flipped: coBoardMove(j), sentTo: CO_REVIEWER[a.key] || null } };
    },
    coComplete: function (taskId, jobId, note, ref) {
      window.__CO.push({ fn: 'coComplete', taskId: taskId, jobId: jobId, note: note, ref: ref });
      if (window.__MOCK_CO_DOWN) return { status: 0, reason: 'unreachable', body: null };
      CO_DONE[taskId] = true;
      // The server's own rule (shouldFlipToPmReview): the last punch task
      // closing moves a Punch List job to PM Review.
      var j = CO_JOBS.filter(function (x) { return x.id === jobId; })[0], flipped = null;
      var t = j && j.punchTasks.filter(function (x) { return x.id === taskId; })[0], a = t && t.area && j.areas && j.areas.filter(function (x) { return x.key === t.area; })[0];
      if (a) {
        // The last repair on an area tells that area's PM; the board moves the job.
        a.openRepairs = j.punchTasks.filter(function (x) { return x.area === a.key && x.progress < 1 && !CO_DONE[x.id]; }).length;
        return { status: 200, body: { ok: true, flipped: coBoardMove(j), sentTo: a.openRepairs ? null : CO_REVIEWER[a.key] || null } };
      }
      if (j && j.status === 'Punch List' && j.punchTasks.length && j.punchTasks.every(function (t) { return t.progress >= 1 || CO_DONE[t.id]; })) { j.status = 'PM Review'; flipped = 'PM Review'; }
      return { status: 200, body: { ok: true, flipped: flipped } };
    },
    // ---- People (T2.0): Operations only, as Code.gs enforces ----
    getPeople: function () {
      if ((window.__MOCK_ROLE || 'siteManager') !== 'ops') throw new Error('NOT_OPS: Only the Operations account can do this.');
      return { people: PEOPLE.map(function (p) { return JSON.parse(JSON.stringify(p)); }), roles: ['crew', 'siteManager', 'service'],
               choices: ['crew', 'siteManager', 'service', 'manager', 'off'], ops: ['operations@deitemeyerbrothers.com'], hub: true, build: 'mock' };
    },
    // T2.3: a choice is written through to DB Hub, which then owns it — the
    // answer comes back source 'hub' with the hub level; the mock hub never
    // refuses unless the test asks it to.
    setRole: function (email, role) {
      if ((window.__MOCK_ROLE || 'siteManager') !== 'ops') throw new Error('NOT_OPS: Only the Operations account can do this.');
      if (window.__MOCK_HUB_DOWN) throw new Error('DB Hub could not be reached (mock). Nothing was changed.');
      window.__ROLES = window.__ROLES || [];
      window.__ROLES.push({ email: email, role: role });
      var LEVEL = { crew: 'Crew', siteManager: 'Site Manager', service: 'Service', manager: 'Manager', off: 'Off' };
      var p = PEOPLE.filter(function (x) { return x.email === email; })[0];
      if (p) { p.role = role === 'manager' || role === 'off' ? 'crew' : role; p.source = 'hub'; p.hubLevel = LEVEL[role]; p.choice = role; }
      return { email: email, name: p ? p.name : '', role: p ? p.role : role, source: 'hub', hubLevel: LEVEL[role], choice: role, level: LEVEL[role], onRoster: true };
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
  var __TOKENS = window.__TOKENS = [];
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('mock.local/exec') !== -1) {
      var body = JSON.parse((opts && opts.body) || '{}');
      __TOKENS.push({ fn: body.fn, t: body.t });
      // Sign-in (T2.8):
      //   a token with BAD in it      refused as a personal account (authWhy not-allowed)
      //   __MOCK_EXCHANGE_FAIL = N    the first N trades of a token answer like an overloaded /exec
      //   a token with GOOGLE in it   Google's hour-long token: exchangeSession trades it
      var authNo = function (extra) {
        var t = JSON.stringify(Object.assign({ ok: false, error: 'AUTH', auth: true }, extra || {}));
        return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(t); } });
      };
      if (!body.t) return authNo();
      if (/BAD/.test(body.t)) return authNo({ authWhy: 'not-allowed', email: 'yahir.personal@gmail.com' });
      if (body.fn === 'exchangeSession' && Number(window.__MOCK_EXCHANGE_FAIL) > 0) {
        window.__MOCK_EXCHANGE_FAIL--;
        return Promise.resolve({ ok: false, status: 500, text: function () { return Promise.resolve('<html>busy</html>'); } });
      }
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
        // T2.21: a write marked for the partner. __MOCK_PARTNER_AWAY plays a
        // partner on the clock somewhere else, left alone.
        if (body.partner && out.ok) {
          (window.__PARTNER = window.__PARTNER || []).push(body.fn);
          if (out.data && typeof out.data === 'object') out.data.partner = window.__MOCK_PARTNER_AWAY
            ? { name: 'Alberto Gonzalez', followed: false, why: 'on the clock at 26-0890 · 04MA' } : { name: 'Alberto Gonzalez', followed: true };
        }
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
