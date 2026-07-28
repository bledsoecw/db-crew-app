import type { CostCode, CrewMember, Job, Material, ScheduleDay } from '../types';

/**
 * The shape of everything this app needs from JobTread.
 *
 * Nothing in the UI imports a concrete implementation — screens talk to
 * `JobTreadClient` only. Today it is backed by `mockClient`; swapping in the
 * live Pave API is a one-line change in `src/jobtread/index.ts`.
 */

/** One block of time against one cost code. This is what posts to JobTread. */
export type TimeEntry = {
  /** local id; the server id lands in `remoteId` once accepted */
  id: string;
  remoteId?: string;
  jobId: string;
  costCode: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  seconds: number;
  /** set when a foreman waived the after-photo requirement */
  photoGateOverriddenBy?: string;
};

export type PhotoUpload = {
  id: string;
  jobId: string;
  costCode: string | null;
  tag: 'before' | 'during' | 'after';
  kind: 'photo' | 'video';
  uri: string;
  takenAt: number;
  userId: string;
};

export type DaySubmission = {
  jobId: string;
  userId: string;
  date: string;
  materials: { name: string; unit: string; qty: number }[];
  notes: { meta: string; body: string }[];
};

export type Session = {
  userId: string;
  name: string;
  role: 'crew' | 'foreman';
};

export type TodayBundle = {
  session: Session;
  job: Job;
  codes: CostCode[];
  schedule: ScheduleDay[];
  materials: Material[];
  crew: CrewMember[];
  /** seconds already banked today per cost code, e.g. { "210": 8280 } */
  banked: Record<string, number>;
};

export interface JobTreadClient {
  /** Everything the app needs to render a shift, in one round trip. */
  getToday(): Promise<TodayBundle>;
  /** Post one closed block of time. Called on switch-code and clock-out. */
  postTimeEntry(entry: TimeEntry): Promise<{ remoteId: string }>;
  /** Push a capture; these feed the DB Cam photo report. */
  uploadPhoto(photo: PhotoUpload): Promise<{ remoteId: string }>;
  /** Materials + notes, sent once at the end of the day. */
  submitDay(day: DaySubmission): Promise<void>;
}
