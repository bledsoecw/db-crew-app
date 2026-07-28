import type { JobTreadClient, TodayBundle } from './types';

/**
 * Live JobTread client — TRANSPORT ONLY, NOT YET WIRED.
 *
 * JobTread exposes a single JSON endpoint (Pave) that takes a query object and
 * a grant key. The transport below is real; the query bodies are marked TODO
 * because the field names depend on the account's own schema and custom
 * fields, which we do not have yet.
 *
 * To go live:
 *   1. Fill in `PAVE_ENDPOINT`, the organization id and the grant key
 *      (from a server or a secure store — never commit them).
 *   2. Replace each `notWired()` with the query for that operation, checked
 *      against JobTread's Pave documentation for this account.
 *   3. Point `src/jobtread/index.ts` at `paveClient` instead of `mockClient`.
 *
 * Prefer brokering these calls through your own backend so the grant key never
 * ships inside the app bundle.
 */

const PAVE_ENDPOINT = 'https://api.jobtread.com/pave';

type PaveConfig = {
  grantKey: string;
  organizationId: string;
  /** the job the crew is scheduled on today */
  jobId: string;
  userId: string;
};

function notWired(op: string): never {
  throw new Error(
    `JobTread ${op} is not wired yet. Fill in the query in src/jobtread/paveClient.ts, ` +
      `or keep using mockClient (see src/jobtread/index.ts).`,
  );
}

export async function pave<T = unknown>(config: PaveConfig, query: Record<string, unknown>): Promise<T> {
  const res = await fetch(PAVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { $: { grantKey: config.grantKey }, ...query } }),
  });
  if (!res.ok) {
    throw new Error(`JobTread ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export function createPaveClient(config: PaveConfig): JobTreadClient {
  return {
    async getToday(): Promise<TodayBundle> {
      // TODO: read the job, its cost codes, the crew's schedule and today's
      // existing time entries, then map them onto TodayBundle.
      return notWired('getToday');
    },
    async postTimeEntry() {
      // TODO: create a time entry against { jobId, costCode, startedAt, endedAt }.
      return notWired('postTimeEntry');
    },
    async uploadPhoto() {
      // TODO: request an upload target, PUT the file, then attach the document
      // to the job so it lands in the DB Cam photo report.
      return notWired('uploadPhoto');
    },
    async submitDay() {
      // TODO: post materials used and the day's notes as job comments / custom
      // field values.
      return notWired('submitDay');
    },
  };
}
