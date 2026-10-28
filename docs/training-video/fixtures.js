/* The training video's practice data — injected before dev/mock.js, which
 * reads window.__MOCK_FIX and puts it in place of its own demo jobs.
 *
 * Every customer, address and job number here is MADE UP. The surnames were
 * checked against the org's customer accounts (none of them is a customer)
 * and no 26-8xxx job number exists in JobTread, so nothing on screen is a
 * real customer's. The people — Tyler, Zac, Yahir, Alberto, the PMs and the
 * reps — are the company's own, the way the Production Board's training video
 * names them. The labour codes are real code names the org clocks on.
 *
 * The take happens on Thursday 6 August 2026 (record.mjs pins the browser's
 * clock there), so "today" below is that Thursday.
 */
(function () {
  if (window === window.top) return; // the app runs in the stage's iframe, never the stage itself
  var role = window.__MOCK_ROLE || 'siteManager';

  var J = {
    whitcombe: { id: 'v-8127', name: '268127 Whitcombe_Roof', number: '26-8127', customer: 'Ellen Whitcombe', address: '1186 Larkspur Ln, Ohio City, OH 45874, USA' },
    pemberton: { id: 'v-8140', name: '268140 Pemberton_Roof', number: '26-8140', customer: 'Gary Pemberton', address: '740 Kensington Ct, Van Wert, OH 45891, USA' },
    thornbury: { id: 'v-8119', name: '268119 Thornbury_Roof', number: '26-8119', customer: 'Thornbury', address: '305 Marlowe St, Convoy, OH 45832, USA' },
    ashcombe: { id: 'v-8174', name: '268174 Ashcombe_Roof', number: '26-8174', customer: 'Ashcombe', address: '96 Quimby Rd, Delphos, OH 45833, USA' },
    lindqvist: { id: 'v-8155', name: '268155 Lindqvist_Addition', number: '26-8155', customer: 'Nora Lindqvist', address: '312 Juniper Ave, Van Wert, OH 45891, USA' },
    halvorsen: { id: 'v-8162', name: '268162 Halvorsen_Bath', number: '26-8162', customer: 'Dale Halvorsen', address: '58 Fenwick Dr, Delphos, OH 45833, USA' }
  };
  // The service crew's jobs are Close Out's (below); the clock offers the same ones.
  J.castellano = { id: 'co-cast', name: '268072 Castellano_Repair', number: '26-8072', customer: 'Castellano', address: '88 Ivanhoe Ct, Van Wert, OH 45891, USA' };
  J.abernathy = { id: 'co-aber', name: '268090 Abernathy_Roof', number: '26-8090', customer: 'Abernathy', address: '1427 Wexford Dr, Van Wert, OH 45891, USA' };
  J.fairbanks = { id: 'co-fair', name: '268101 Fairbanks_Roof', number: '26-8101', customer: 'Fairbanks', address: '415 Hawthorne Ave, Delphos, OH 45833, USA' };
  J.sinclair = { id: 'co-sinc', name: '268049 Sinclair_Warranty', number: '26-8049', customer: 'Sinclair', address: '2210 Greenleaf Rd, Ohio City, OH 45874, USA' };
  var mine = role === 'crew' ? [J.lindqvist, J.halvorsen]
           : role === 'service' ? [J.castellano, J.abernathy, J.fairbanks, J.sinclair]
           : [J.whitcombe, J.pemberton, J.thornbury, J.ashcombe];

  // The checklist exactly as the board sends it today (src/lib/install-checks.ts
  // via checklistShape(): five phases, forty lines).
  var CHECKLIST = {
    phases: [
      { key: 'yard', label: 'At the yard, before you roll out', tag: 'AT THE YARD', when: 'while the truck is loaded — the same moment as marking the material loaded' },
      { key: 'before', label: 'Before the tear-off', tag: 'BEFORE TEAR-OFF', when: 'the morning the crew starts' },
      { key: 'during', label: 'While the roof is open', tag: 'DURING', when: 'before each stage gets covered — a promise is not an inspection' },
      { key: 'handover', label: 'Before the site manager leaves', tag: 'HANDING OVER', when: 'only if you leave before the crew does — the PM approves the plan first' },
      { key: 'finished', label: 'Before the crew leaves for good', tag: 'FINISHED', when: 'the last day' }
    ],
    lines: [
      ['yard', 'tarps', 'Tarps checked and loaded — four sound 20×40s with tie-downs, a torn one swapped out'],
      ['yard', 'dryin', 'Dry-in supplies loaded — underlayment, flashing, sealants, fasteners for the planned section'],
      ['before', 'address', 'Right address, right roof'],
      ['before', 'homeowner', 'Homeowner talked to, or texted if away — trailer spot, questions, color confirmed'],
      ['before', 'scope', 'Scope on site matches the work order'],
      ['before', 'color', 'Shingle / metal / drip color checked against the order'],
      ['before', 'walk', 'Property walked — damage photographed, items to move moved'],
      ['before', 'septic', 'Well and septic located'],
      ['before', 'safety', 'Safety: power lines, ground, fall protection'],
      ['before', 'access', 'Buggy access and driveway protection agreed'],
      ['before', 'weather', 'Weather call made with the crew leader — proceed, limit or hold, tear-off limit in the group text'],
      ['before', 'material', 'Material on site and counted against the order'],
      ['before', 'sign', 'Yard sign up'],
      ['before', 'prephotos', 'Pre-job photos in DB Cam — property, delivered material, DB stock, sign and trailer spot'],
      ['during', 'decking', 'Decking inspected — whole repair area measured, PM consulted even under 300 sq ft'],
      ['during', 'repairs', 'Repair direction recorded — wood repairs photographed before underlayment covers them'],
      ['during', 'underlay', 'Underlayment and ice & water checked — coverage, laps, fastening, edges'],
      ['during', 'flashing', 'Flashing and penetrations checked before covering — valleys, walls, chimneys, skylights, vents, boots, drip edge'],
      ['during', 'nailing', 'Shingle install checked early — nail placement and depth photographed close up'],
      ['handover', 'tearoff', 'Tear-off done, decking verified nailable'],
      ['handover', 'shingles', 'Shingles on the roof, material on site'],
      ['handover', 'tarped', 'Site under control — tarps catching debris, material out of the heat'],
      ['handover', 'special', 'Special tasks done — anything needing supervision or timing is scheduled'],
      ['handover', 'matcheck', 'Enough material to finish — shortages called in, extras noted'],
      ['handover', 'photos1', 'Photos taken'],
      ['handover', 'pm', 'PM approved the coverage plan'],
      ['handover', 'covered', 'Covered by:', 'coveredBy'],
      ['finished', 'cleanup', 'Clean up — ground, gutters, around the trailers, siding'],
      ['finished', 'nails', 'Exposed nails caulked'],
      ['finished', 'bundle', 'One open bundle left for the homeowner'],
      ['finished', 'movedback', 'Items moved back to where they were'],
      ['finished', 'blown', 'Roof blown off'],
      ['finished', 'tabs', 'Plastic tabs pulled'],
      ['finished', 'magnet', 'Magnet run, lawn and beds — by:', 'magnetBy'],
      ['finished', 'photos', '20–30 photos in DB Cam (8 from the ground, each side)'],
      ['finished', 'extras', 'Returns and extras logged'],
      ['finished', 'pickup', 'Trailer or buggy ready for pickup — yard told'],
      ['finished', 'corrections', 'Roof corrections verified — anything left goes to the PM’s punch list with an owner'],
      ['finished', 'watertight', 'Watertight confirmed with:', 'watertightWith'],
      ['finished', 'signoff', 'Signed off:', 'signedOff']
    ].map(function (l) { var o = { phase: l[0], key: l[1], label: l[2] }; if (l[3]) o.value = l[3]; return o; })
  };
  var keysOf = function (phase) { return CHECKLIST.lines.filter(function (l) { return l.phase === phase; }).map(function (l) { return l.key; }); };

  // A start-of-day code list for a roofing job, as the org names them.
  var CODES = [
    { id: 'ci1', name: 'Project Management (R)', number: '01GR-1', codeName: 'Project Management' },
    { id: 'ci2', name: 'Crew Labor', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci3', name: 'Site Prep/Clean Up', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci4', name: 'Final Clean', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci5', name: 'Hauling & Disposal (R)', number: '02ST-5', codeName: 'Hauling & Disposal (Direct)' },
    { id: 'ci6', name: 'Service Repair Labor', number: '01GR-4', codeName: 'Service Repair Labor' }
  ];
  // Every job's CLOCK IN ITEMS carries the travel line (T2.18): the drive goes
  // on the job you are driving to. The code sheets never show it.
  var TRAVEL = { id: 'ci9', name: 'Travel Related Labor', number: '01GR-9', codeName: 'Travel Related Costs', travel: true };
  if (role === 'service') CODES = [
    { id: 'ci1', name: 'Final Clean', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci2', name: 'Crew Labor', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci3', name: 'Service Repair Labor', number: '01GR-4', codeName: 'Service Repair Labor' },
    { id: 'ci4', name: 'Warranty Work', number: '01GR-5', codeName: 'Warranty Work' }
  ];
  if (role === 'crew') CODES = [
    { id: 'ci1', name: 'General Requirements', number: '01GR', codeName: 'General Requirements' },
    { id: 'ci2', name: 'Framing/Sheeting', number: '06WP-1', codeName: 'Framing/Sheeting' },
    { id: 'ci3', name: 'Site Prep/Clean Up', number: '02ST-1', codeName: 'Site Prep/Clean Up' },
    { id: 'ci4', name: 'Hauling & Disposal (Direct)', number: '02ST-5', codeName: 'Hauling & Disposal (Direct)' }
  ];
  CODES = CODES.concat([TRAVEL]);

  var who = {
    crew: { email: 'zac@deitemeyerbrothers.com', name: 'Zac Deitemeyer' },
    siteManager: { email: 'tyler@deitemeyerbrothers.com', name: 'Tyler Mohr' },
    service: { email: 'yahir@deitemeyerbrothers.com', name: 'Yahir Gonzalez' }
  };

  window.__MOCK_FIX = {
    who: who,
    signer: who[role] ? who[role].name.split(' ')[0] : 'Tyler',
    job: mine[0],
    jobs: mine,
    search: function (term) {
      var t = String(term || '').toLowerCase();
      return mine.filter(function (j) { return (j.number + ' ' + j.name + ' ' + j.customer + ' ' + j.address).toLowerCase().indexOf(t) !== -1; });
    },
    codes: CODES,
    codesPerJob: true,
    // Yahir and Alberto work as a pair (T2.21): the API names Alberto on Yahir's phone only.
    partner: role === 'service' ? { name: 'Alberto Gonzalez' } : null,
    entries: function () { return []; },
    pm: role === 'crew' ? 'Neal Deitemeyer' : 'Kyle Akerman',
    logAssigned: role === 'crew' ? ['Neal Deitemeyer', 'Justin Phillips'] : ['Kyle Akerman', 'Sam Black'],
    crew: function (r) {
      return r === 'crew' ? { id: 'bench', name: 'Bench', leadMembershipId: 'm6', leadUserName: 'Zac Deitemeyer' }
                          : { id: 'tyler', name: 'Tyler', leadMembershipId: 'm3', leadUserName: 'Tyler Mohr' };
    },
    checklist: CHECKLIST,
    checks: function (blank) {
      var yesterday = blank([].concat(keysOf('yard'), keysOf('before'), keysOf('during'), keysOf('handover'),
                                      ['cleanup', 'nails', 'bundle', 'movedback', 'blown', 'tabs', 'photos', 'extras', 'watertight']));
      return { tWhit: blank(), tPemb: blank(), tThorn: yesterday, tAsh: blank() };
    },
    // The board's checksWords (src/lib/install-checks.ts), five phases.
    checksWords: function (c, pr) {
      if (c.signedOff) return 'Signed off — ' + c.signedOff;
      var by = {}; pr.forEach(function (p) { by[p.phase] = p; });
      if (by.finished.done > 0) return 'Finishing up — ' + by.finished.done + ' of ' + by.finished.total + ' done, not signed off';
      if (by.handover.done > 0) return 'Handing over — ' + by.handover.done + ' of ' + by.handover.total + ' done';
      if (by.during.done > 0) return 'Roof open — ' + by.during.done + ' of ' + by.during.total + ' checked';
      if (by.before.done === by.before.total) return 'Before-tear-off checks done';
      if (by.before.done > 0) return 'Before tear-off — ' + by.before.done + ' of ' + by.before.total + ' done';
      if (by.yard.done > 0) return 'At the yard — ' + by.yard.done + ' of ' + by.yard.total + ' done';
      return 'Site checks not started';
    },
    visits: function (h) {
      var v = function (j, o) {
        return Object.assign({ jobId: j.id, jobNum: j.number, jobName: j.name, cust: j.customer, address: j.address,
          city: j.address.split(', ')[1], status: 'Production', warehouse: null, checks: null, alongside: null, reps: [], crewNote: '' }, o);
      };
      // Yahir's day is Close Out's; the board books no roofs on him.
      if (role === 'service') return [];
      if (role === 'crew') return [
        v(J.lindqvist, { taskId: 'z1', start: h.isoAdd(-1), end: h.isoAdd(1), days: 3, dayOf: 2, today: true, jtype: 'Construction',
          material: { text: '7 of 9 lines in — Window (MBS) due Aug 12', cls: 'warn' }, pm: 'Neal Deitemeyer', reps: ['Justin Phillips'],
          crewNote: 'Dumpster goes on the north side of the drive. Homeowner works from home — knock before the saws start.' }),
        v(J.halvorsen, { taskId: 'z2', start: h.isoAdd(4), end: h.isoAdd(5), days: 2, dayOf: null, today: false, jtype: 'Construction',
          material: { text: 'All 6 lines received — per the office, not counted on site', cls: 'good' }, pm: 'Neal Deitemeyer', reps: ['Robert Switzer'] })
      ];
      return [
        v(J.thornbury, { taskId: 'tThornV', start: h.isoAdd(-1), end: h.isoAdd(-1), days: 1, dayOf: null, today: false, jtype: 'Roofing',
          material: { text: 'Material on site ✓', cls: 'good' }, checks: h.checksFor('tThorn'), alongside: 'Platinum', pm: 'Kyle Akerman', reps: ['Sam Black'] }),
        v(J.whitcombe, { taskId: 'tWhitV', start: h.isoAdd(0), end: h.isoAdd(1), days: 2, dayOf: 1, today: true, jtype: 'Roofing',
          material: { text: 'Material due today — not confirmed', cls: 'warn' }, checks: h.checksFor('tWhit'), alongside: 'Platinum', pm: 'Kyle Akerman', reps: ['Sam Black'],
          crewNote: '28 squares — ABC booms it onto the back slope this morning. Dog in the yard, keep the gate shut.' }),
        v(J.pemberton, { taskId: 'tPembV', start: h.isoAdd(1), end: h.isoAdd(1), days: 1, dayOf: null, today: false, jtype: 'Roofing',
          material: { text: 'Ordered — drop booked, not on site yet', cls: 'warn' }, checks: h.checksFor('tPemb'), alongside: 'Jeremiah', pm: 'Kyle Akerman', reps: ['Shawn Deitemeyer'] }),
        v(J.ashcombe, { taskId: 'tAshV', start: h.isoAdd(4), end: h.isoAdd(4), days: 1, dayOf: null, today: false, jtype: 'Roofing',
          material: { text: 'Ordered — no drop date yet', cls: 'warn' }, checks: h.checksFor('tAsh'), alongside: 'Platinum', pm: 'Kyle Akerman', reps: ['Sam Black'] })
      ];
    },

    // ---- Close Out: the service crew's jobs ----
    reviewers: { shingle: 'Dave Elick', gutters: 'Neal Deitemeyer' },
    scope: { en: 'A 26-square Duration roof in Driftwood with two pipe boots, a ridge vent and new drip edge.',
             es: 'Un techo Duration de 26 cuadros en Driftwood con dos botas, ventilación de cumbrera y goteros nuevos.' },
    translate: function (t, to) { return t; },
    // A problem not fixed on site becomes a REPORT repair on the job, as the
    // CheckOut server writes it, so the job reads "Repairs · 0 of 1 done".
    onReport: function (job, report, taskId) {
      if (!job || report.fixedOnSite) return;
      job.punchTasks.push({ id: taskId, name: 'REPORT: ' + (report.location || 'Problem'), description: report.englishNote || '', progress: 0,
        endDate: null, createdAt: new Date().toISOString(), assignees: [], assigneeNames: ['Alberto Gonzalez', 'Yahir Gonzalez'], mine: true,
        area: report.area || 'shingle' });
      job.openPunchCount = (job.openPunchCount || 0) + 1; job.openPunchTotal = (job.openPunchTotal || 0) + 1;
    },
    coJobs: function (h) {
      var AY = ['Alberto Gonzalez', 'Yahir Gonzalez'];
      var base = function (o) {
        return Object.assign({ jobType: 'Roofing', isService: false, openPunchCount: 0, openPunchTotal: 0, mine: true, punchTasks: [], soldScope: [], projectManager: 'Kyle Akerman' }, o);
      };
      var task = function (id, name, description, o) {
        return Object.assign({ id: id, name: name, description: description, progress: 0, endDate: null, createdAt: h.isoAdd(-2) + 'T14:00:00.000Z',
          assignees: [], assigneeNames: AY, mine: true }, o || {});
      };
      return [
        base({ id: 'co-aber', number: '26-8090', name: '268090 Abernathy_Roof', status: 'Final Inspection', projectTypes: ['R-Shingles'],
          salesRep: 'Sam Black', address: '1427 Wexford Dr, Van Wert, OH 45891, USA',
          booked: [{ start: h.isoAdd(0), end: h.isoAdd(0), kind: 'inspection' }],
          areas: [{ key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-aber', inspectionDate: h.isoAdd(0), assigneeNames: AY, mine: true, inspected: false, openRepairs: 0 }],
          soldScope: [{ id: 'd1', name: 'Estimate', number: 3, issueDate: '2026-06-18', price: 16890, jtUrl: 'https://app.jobtread.com', lines: [
            { name: 'OC Duration Shingles — Driftwood', quantity: 26, unit: 'Square', description: null },
            { name: 'High Temp Pipe Boot', quantity: 2, unit: 'Each', description: null },
            { name: 'Shingle-Over Ridge Vent', quantity: 34, unit: 'Linear Foot', description: null }] }] }),
        base({ id: 'co-cast', number: '26-8072', name: '268072 Castellano_Repair', status: 'Punch List', projectTypes: ['R-Repairs/Service'], isService: true,
          salesRep: 'Shawn Deitemeyer', projectManager: 'Dave Elick', address: '88 Ivanhoe Ct, Van Wert, OH 45891, USA', openPunchCount: 2, openPunchTotal: 2,
          booked: [{ start: h.isoAdd(0), end: h.isoAdd(0), kind: 'repair' }],
          punchTasks: [
            task('cs1', 'Alberto and Yahir — Replace the cracked pipe boot', 'Replace the cracked pipe boot on the back slope and check the shingles around it.\n\nService · asked by Dave', { endDate: h.isoAdd(0) }),
            task('cs2', 'Alberto and Yahir — Reseal the kitchen vent', 'Reseal the flashing around the kitchen exhaust vent.\n\nService · asked by Dave', { endDate: h.isoAdd(0) })
          ] }),
        base({ id: 'co-sinc', number: '26-8049', name: '268049 Sinclair_Warranty', status: 'Punch List', projectTypes: ['R-Warranty'], isService: true,
          salesRep: 'Sam Black', projectManager: 'Dave Elick', address: '2210 Greenleaf Rd, Ohio City, OH 45874, USA', openPunchCount: 1, openPunchTotal: 1,
          booked: [{ start: h.isoAdd(1), end: h.isoAdd(1), kind: 'repair' }],
          punchTasks: [task('sn1', 'Alberto and Yahir — Re-nail the lifted shingles', 'Re-nail and seal the shingles lifted by the wind over the garage.\n\nWarranty · asked by Dave', { endDate: h.isoAdd(1) })] }),
        base({ id: 'co-fair', number: '26-8101', name: '268101 Fairbanks_Roof', status: 'Punch List', projectTypes: ['R-Shingles', 'R-Gutters'],
          salesRep: 'Austin Leeth', address: '415 Hawthorne Ave, Delphos, OH 45833, USA', openPunchCount: 1, openPunchTotal: 1,
          booked: [{ start: h.isoAdd(0), end: h.isoAdd(0), kind: 'inspection' }, { start: h.isoAdd(4), end: h.isoAdd(4), kind: 'repair' }],
          punchTasks: [task('fb1', 'REPORT: Reseal the chimney flashing', 'Counter-flashing lifted on the left side of the chimney.', { area: 'shingle', endDate: h.isoAdd(4) })],
          areas: [
            { key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-fair', inspectionDate: h.isoAdd(-2), assigneeNames: AY, mine: true, inspected: true, openRepairs: 1 },
            { key: 'gutters', label: 'Gutters', line: false, form: 'notes', inspectionTaskId: 'fig-fair', inspectionDate: h.isoAdd(0), assigneeNames: ['Yahir Gonzalez'], mine: true, inspected: false, openRepairs: 0 }
          ] }),
        base({ id: 'co-king', number: '26-8088', name: '268088 Kingsley_Roof', status: 'Final Inspection', projectTypes: ['R-Shingles'],
          salesRep: 'Sam Black', address: '67 Drummond Ln, Convoy, OH 45832, USA',
          booked: [{ start: h.isoAdd(4), end: h.isoAdd(5), kind: 'inspection' }],
          areas: [{ key: 'shingle', label: 'Shingle roof', line: true, form: 'roof', inspectionTaskId: 'fi-king', inspectionDate: h.isoAdd(4), assigneeNames: AY, mine: true, inspected: false, openRepairs: 0 }] }),
        base({ id: 'co-temp', number: '26-8058', name: '268058 Templeton_Roof', status: 'Final Inspection', projectTypes: ['R-Shingles'], mine: false,
          salesRep: 'Jenn Grubb', address: '19 Carrington Pl, Van Wert, OH 45891, USA' }),
        base({ id: 'co-pres', number: '26-8064', name: '268064 Prescott_Roof', status: 'PM Review', projectTypes: ['R-Shingles'], mine: false,
          salesRep: 'Austin Leeth', address: '9 Blackwood Ct, Ohio City, OH 45874, USA' })
      ];
    }
  };
})();
