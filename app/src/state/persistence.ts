import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Capture, Material, Note, PhotoTag } from '../types';

/**
 * What survives an app restart.
 *
 * A crew member force-quitting the app, or iOS reclaiming it while the phone
 * is in a pocket, must not lose the clock. The running code and its start time
 * are the important part — elapsed is always recomputed from `startedAt`, not
 * counted, so time is right even if the app was killed for an hour.
 */

export type PersistedShift = {
  v: 1;
  day: string;
  sun: boolean;
  clockedIn: boolean;
  activeCode: string | null;
  startedAt: number | null;
  banked: Record<string, number>;
  photos: Capture[];
  materials: Material[];
  notes: Note[];
  sent: boolean;
  nudged: boolean;
  escalated: boolean;
  afterRequired: boolean;
  pendingSwitch: string | null;
  capture: PhotoTag;
  nudgeId: string | null;
};

const KEY = 'dbtc.shift.v1';

/** Local calendar day, so a stale shift from yesterday is discarded. */
export function today(at: number = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadShift(): Promise<PersistedShift | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedShift;
    if (parsed.v !== 1 || parsed.day !== today()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveShift(shift: Omit<PersistedShift, 'v' | 'day'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ v: 1, day: today(), ...shift }));
  } catch {
    // Persistence is best-effort; never break the clock over it.
  }
}

export async function clearShift(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
