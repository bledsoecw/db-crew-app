import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobtread } from '../jobtread';
import type { DaySubmission, PhotoUpload, TimeEntry } from '../jobtread/types';

/**
 * Offline queue.
 *
 * Signal on a roof is "usually fine", so this is deliberately simple: every
 * mutation is appended to a persisted list and drained in order whenever we
 * are online. Nothing in the UI blocks on the network — the crew member is
 * told what is queued, and that is the whole contract.
 */

export type QueuedItem =
  | { id: string; kind: 'time'; payload: TimeEntry }
  | { id: string; kind: 'photo'; payload: PhotoUpload }
  | { id: string; kind: 'day'; payload: DaySubmission };

const KEY = 'dbtc.queue.v1';

type Listener = (count: number) => void;

let queue: QueuedItem[] = [];
let loaded = false;
let draining = false;
let online = true;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(queue.length);
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function loadQueue(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) queue = JSON.parse(raw) as QueuedItem[];
  } catch {
    queue = [];
  }
  emit();
}

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  l(queue.length);
  return () => listeners.delete(l);
}

export function pendingCount(): number {
  return queue.length;
}

/** Tell the queue whether the device currently has a usable connection. */
export function setOnline(next: boolean): void {
  online = next;
  if (online) void drain();
}

export async function enqueue(item: QueuedItem): Promise<void> {
  queue = [...queue, item];
  emit();
  await persist();
  void drain();
}

async function send(item: QueuedItem): Promise<void> {
  switch (item.kind) {
    case 'time':
      await jobtread.postTimeEntry(item.payload);
      return;
    case 'photo':
      await jobtread.uploadPhoto(item.payload);
      return;
    case 'day':
      await jobtread.submitDay(item.payload);
      return;
  }
}

/** Drain in order; stop at the first failure and keep the rest for later. */
export async function drain(): Promise<void> {
  if (draining || !online || queue.length === 0) return;
  draining = true;
  try {
    while (online && queue.length > 0) {
      const [head] = queue;
      try {
        await send(head);
      } catch {
        break; // leave it at the head; we'll try again on the next signal
      }
      queue = queue.slice(1);
      emit();
      await persist();
    }
  } finally {
    draining = false;
  }
}
