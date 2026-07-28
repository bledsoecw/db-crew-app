import { mockClient } from './mockClient';
import type { JobTreadClient } from './types';

/**
 * The single place the app decides which JobTread backend it is talking to.
 *
 * Swap to the live account by importing `createPaveClient` and exporting it
 * here — no screen or store changes.
 */
export const jobtread: JobTreadClient = mockClient;

export * from './types';
export { CODES } from './mockClient';
