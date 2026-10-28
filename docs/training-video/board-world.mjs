// The war-room TV, for the chapter on reading the Production Board: a dev
// board (the board repo's own start-dev.sh — fixtures, today pinned to Thu 6
// Aug 2026) shown full frame on the stage, with every job swapped for the
// video's made-up ones on the way to the screen.
//
// The swap is not tidiness. The board's dev fixtures are shapes copied from
// the real org — real job numbers and real customers' names — so they are
// never drawn here: /api/jobs and /api/schedule answer ONLY the jobs below,
// and a guard refuses to film if any customer name the dev board served
// survives into what the TV is handed.
import { BOARD, sleep } from "./studio.mjs";

const city = { "Ohio City": [40.7714, -84.6105], "Van Wert": [40.8673, -84.6022], Convoy: [40.8875, -84.7175], Delphos: [40.8513, -84.3695], Bluffton: [40.8962, -83.9190], Ney: [41.3568, -84.4698] };

// The same jobs the phones carry (fixtures.js), plus a few more so the lanes
// look like a real week. Every customer name is made up; no 26-8xxx job exists.
const J = (num, cust, town, extra = {}) => ({
  id: `vid-${num}`, num, cust, city: town, lat: city[town]?.[0] ?? null, lon: city[town]?.[1] ?? null,
  status: "Production", rep: "Sam Black", repAll: ["Sam Black"], pm: "Kyle Akerman", jtype: "Roofing", ptype: ["R-Shingles"],
  createdAt: "2026-05-04T14:00:00Z", mo: true, wo: true, withinCityLimits: null,
  docs: { poTotal: 1, poSent: 1, woTotal: 1, woSent: 1, poIssuedOn: "2026-07-20", byLeg: {} }, sched: null, ...extra,
});
const JOBS = [
  J("26-8127", "Ellen Whitcombe", "Ohio City", { drop: "2026-08-06", dropAt: "site" }),
  J("26-8140", "Gary Pemberton", "Van Wert", { drop: "2026-08-07", dropAt: "site", rep: "Shawn Deitemeyer", repAll: ["Shawn Deitemeyer"] }),
  J("26-8119", "Thornbury", "Convoy"),
  J("26-8174", "Ashcombe", "Delphos"),
  J("26-8133", "Underhill", "Bluffton", { ptype: ["R-Metal"] }),
  J("26-8146", "Yardley", "Van Wert", { mo: null, wo: false, docs: { poTotal: 0, poSent: 0, woTotal: 0, woSent: 0, poIssuedOn: null, byLeg: {} } }),
  J("26-8159", "Northcott", "Ney", { docs: { poTotal: 2, poSent: 1, woTotal: 1, woSent: 1, poIssuedOn: "2026-07-28", byLeg: {} } }),
  J("26-8170", "Brightwater", "Convoy", { ptype: ["R-Repairs/Service"], pm: "Dave Elick" }),
  J("26-8090", "Abernathy", "Van Wert", { status: "Final Inspection" }),
  J("26-8072", "Castellano", "Van Wert", { status: "Punch List", ptype: ["R-Repairs/Service"], pm: "Dave Elick" }),
  J("26-8049", "Sinclair", "Ohio City", { status: "Punch List", ptype: ["R-Warranty"], pm: "Dave Elick", jtype: "Warranty" }),
  J("26-8101", "Fairbanks", "Delphos", { status: "Punch List", ptype: ["R-Shingles", "R-Gutters"] }),
  J("26-8088", "Kingsley", "Convoy", { status: "Final Inspection" }),
  J("26-8064", "Prescott", "Ohio City", { status: "PM Review" }),
  J("26-8155", "Nora Lindqvist", "Van Wert", { jtype: "Construction", ptype: ["C-Additions"], pm: "Neal Deitemeyer", rep: "Justin Phillips", repAll: ["Justin Phillips"] }),
  J("26-8162", "Dale Halvorsen", "Delphos", { jtype: "Construction", ptype: ["C-Bathrooms"], pm: "Neal Deitemeyer" }),
];
const SQUARES = { "vid-26-8127": 28, "vid-26-8140": 31, "vid-26-8119": 24, "vid-26-8174": 36, "vid-26-8133": 22, "vid-26-8146": 19, "vid-26-8159": 41, "vid-26-8170": 2 };

let n = 0;
const V = (num, crewId, start, end, extra = {}) => {
  const job = JOBS.find((j) => j.num === num);
  return { taskId: `vid-t${++n}`, jobId: job.id, jobNum: num, jobName: job.cust, start, end, days: 1, crewId, crewNote: null, ...extra };
};
// Wed 5 Aug (yesterday) to Wed 12 Aug — the TV's window on Thu 6 Aug.
const VISITS = [
  V("26-8119", "platinum", "2026-08-05", "2026-08-05", { matOnSite: true }),
  V("26-8119", "tyler", "2026-08-05", "2026-08-05", { matOnSite: true }),
  V("26-8127", "platinum", "2026-08-06", "2026-08-07", { days: 2 }),
  V("26-8127", "tyler", "2026-08-06", "2026-08-07", { days: 2 }),
  V("26-8140", "c3", "2026-08-07", "2026-08-07"),
  V("26-8174", "platinum", "2026-08-10", "2026-08-10"),
  V("26-8174", "tyler", "2026-08-10", "2026-08-10"),
  V("26-8133", "c2", "2026-08-10", "2026-08-11", { days: 2 }),
  V("26-8146", "c1", "2026-08-11", "2026-08-11"),
  V("26-8159", "marcos", "2026-08-12", "2026-08-12"),
  V("26-8170", "nicks", "2026-08-07", "2026-08-07"),
  V("26-8155", "bench", "2026-08-05", "2026-08-07", { days: 3 }),
  V("26-8162", "bench", "2026-08-10", "2026-08-11", { days: 2 }),
];
let k = 0;
const CO = (kind, num, crewId, start, end, extra = {}) => {
  const job = JOBS.find((j) => j.num === num);
  const id = `vid-co${++k}`;
  return { key: `${id}:${crewId}`, kind, taskId: id, taskIds: [id], jobId: job.id, jobNum: num, jobName: job.cust, start, end, crewId,
    trade: null, onLine: true, done: false, count: 1, ...extra };
};
const CLOSEOUTS = [
  CO("inspection", "26-8090", "c1", "2026-08-06", "2026-08-06"),
  CO("inspection", "26-8090", "yahir", "2026-08-06", "2026-08-06"),
  CO("punch", "26-8072", "yahir", "2026-08-06", "2026-08-06", { count: 2 }),
  CO("inspection", "26-8101", "yahir", "2026-08-06", "2026-08-06", { trade: "gutters", onLine: false }),
  CO("punch", "26-8049", "yahir", "2026-08-07", "2026-08-07"),
  CO("punch", "26-8049", "c1", "2026-08-07", "2026-08-07"),
  CO("inspection", "26-8088", "c1", "2026-08-10", "2026-08-11"),
  CO("inspection", "26-8088", "yahir", "2026-08-10", "2026-08-11"),
  CO("punch", "26-8101", "yahir", "2026-08-10", "2026-08-10"),
  CO("inspection", "26-8119", "c1", "2026-08-05", "2026-08-05", { done: true }),
];
const PM_REVIEWS = [{ jobId: "vid-26-8064", jobNum: "26-8064", jobName: "Prescott", date: "2026-08-05", at: "2026-08-05T15:00:00.000Z" }];

const lastName = (s) => String(s || "").trim().split(/\s+/).pop();

/** Sign the context in to the dev board (read-only) and hand the TV the video's jobs. */
export async function installBoardWorld(ctx) {
  const origin = new URL(BOARD).origin;
  const real = new Set(); // every customer surname the dev board itself served
  const swap = async (route, fn) => {
    const res = await route.fetch();
    const data = await res.json();
    const out = fn(data);
    const text = JSON.stringify(out);
    for (const name of real) {
      if (name.length > 2 && new RegExp(`\\b${name}\\b`).test(text)) throw new Error(`a dev-board customer (${name}) reached the TV — refusing to film it`);
    }
    return route.fulfill({ response: res, json: out });
  };
  await ctx.route(`${origin}/api/jobs`, (route) =>
    swap(route, (d) => {
      for (const j of d.jobs ?? []) real.add(lastName(j.cust));
      return { ...d, jobs: JOBS };
    }),
  );
  await ctx.route(`${origin}/api/schedule?*`, (route) =>
    swap(route, (d) => {
      for (const v of d.visits ?? []) real.add(lastName(v.jobName));
      return { ...d, visits: VISITS, closeouts: CLOSEOUTS, pmReviews: PM_REVIEWS };
    }),
  );
  await ctx.route(`${origin}/api/jobs/squares?*`, (route) =>
    swap(route, (d) => ({ ...d, squares: SQUARES })),
  );
  // The roster as the live board has it in the ways the TV shows: the site
  // managers flagged (their name rides the crew's card) and the warehouse
  // track off, as Carl has it (so the legend has no DB warehouse group).
  await ctx.route(`${origin}/api/roster`, (route) =>
    swap(route, (d) => {
      const doc = structuredClone(d.roster ?? d);
      for (const c of doc.crews ?? []) if (c.id === "tyler" || c.id === "kenton") c.siteManager = true;
      doc.warehouseTrack = false;
      return d.roster ? { ...d, roster: doc } : doc;
    }),
  );
  // The dev board's own overlay is not part of the board.
  await ctx.addInitScript(`if (location.origin === ${JSON.stringify(origin)}) addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); });`);
  // Read-only sign-in through the dev provider (the board's src/auth.ts).
  const csrf = await (await ctx.request.get(`${origin}/api/auth/csrf`)).json();
  const r = await ctx.request.post(`${origin}/api/auth/callback/dev`, {
    maxRedirects: 0,
    form: { csrfToken: csrf.csrfToken, role: "rep", callbackUrl: `${origin}/tv/roofing` },
  });
  const host = new URL(origin).hostname;
  for (const h of r.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie")) {
    const [pair] = h.value.split(";");
    const i = pair.indexOf("=");
    if (i > 0 && pair.slice(i + 1)) await ctx.addCookies([{ name: pair.slice(0, i), value: pair.slice(i + 1), domain: host, path: "/", expires: -1 }]);
  }
}

/** Put a TV screen on the stage and wait for its lanes. */
export async function showTv(page, screen = "roofing") {
  await page.evaluate((u) => window.__stage.tv(u), `${new URL(BOARD).origin}/tv/${screen}`);
  const tv = page.frameLocator("#tv");
  await tv.locator(".tv-body").waitFor({ timeout: 120_000 });
  await sleep(4000);
  return tv;
}
