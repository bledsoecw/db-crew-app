import type { JobTreadClient, TodayBundle } from './types';

/**
 * Stand-in for the live JobTread account.
 *
 * The cost codes below are PLACEHOLDERS that mirror a roofing job's shape —
 * they are not Deitemeyer Brothers' real JobTread codes. Replace `CODES` (and
 * the job/schedule fixtures) with the real list, or delete this file once
 * `paveClient` is wired to the account.
 */

export const CODES = [
  { n: '100', name: 'Drive time' },
  { n: '210', name: 'Tear-off' },
  { n: '220', name: 'Deck repair' },
  { n: '230', name: 'Dry-in' },
  { n: '240', name: 'Shingle install' },
  { n: '250', name: 'Metal & flashing' },
  { n: '260', name: 'Gutter' },
  { n: '900', name: 'Cleanup & haul' },
  { n: '950', name: 'Punch list' },
];

const BUNDLE: TodayBundle = {
  session: { userId: 'u_tyler', name: 'Tyler B.', role: 'crew' },
  job: {
    id: 'j_2841',
    number: '2841',
    address: '4127 Lincoln Hwy',
    customer: 'Hoverman Residence',
    location: 'Van Wert',
    scope: 'Tear-off & re-roof',
    dayLabel: 'Day 2 of 3',
  },
  codes: CODES,
  schedule: [
    {
      id: 's1',
      day: 'Today · Mon Jul 27',
      addr: '4127 Lincoln Hwy',
      detail: 'Hoverman Residence · Tear-off & re-roof · Day 2 of 3',
      today: true,
    },
    {
      id: 's2',
      day: 'Tomorrow · Tue Jul 28',
      addr: '4127 Lincoln Hwy',
      detail: 'Hoverman Residence · Shingle install & cleanup · Day 3 of 3',
      today: false,
    },
    {
      id: 's3',
      day: 'Wed Jul 29',
      addr: '812 S Washington St',
      detail: 'Bidlack · Standing-seam metal · Day 1 of 4',
      today: false,
    },
  ],
  materials: [
    { id: 'm1', name: '30yr arch shingle', unit: 'Bundles', qty: 42 },
    { id: 'm2', name: 'Synthetic underlayment', unit: 'Rolls', qty: 6 },
    { id: 'm3', name: 'Ice & water shield', unit: 'Rolls', qty: 3 },
    { id: 'm4', name: 'Ridge vent', unit: 'Feet', qty: 40 },
  ],
  crew: [
    { id: 'c1', name: 'Tyler B.', on: true, code: '210', secs: 8280 },
    { id: 'c2', name: 'Marcus D.', on: true, code: '210', secs: 8280 },
    { id: 'c3', name: 'Wade K.', on: false, code: null, secs: 0 },
    { id: 'c4', name: 'Jesse P.', on: true, code: '900', secs: 3600 },
  ],
  banked: { '100': 2520, '210': 8280 },
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const mockClient: JobTreadClient = {
  async getToday() {
    await delay(120);
    return JSON.parse(JSON.stringify(BUNDLE)) as TodayBundle;
  },
  async postTimeEntry(entry) {
    await delay(200);
    return { remoteId: `jt_time_${entry.id}` };
  },
  async uploadPhoto(photo) {
    await delay(260);
    return { remoteId: `jt_doc_${photo.id}` };
  },
  async submitDay() {
    await delay(240);
  },
};
