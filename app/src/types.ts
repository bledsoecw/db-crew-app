/** A JobTread cost code the crew clocks into. */
export type CostCode = {
  /** JobTread cost-code number, e.g. "210". Stable id used everywhere. */
  n: string;
  name: string;
};

export type PhotoTag = 'before' | 'during' | 'after';

export type Capture = {
  id: string;
  tag: PhotoTag;
  /** local file uri */
  uri: string | null;
  kind: 'photo' | 'video';
  /** "7:14a" — pre-formatted for display, per the design system's number rule */
  time: string;
  /** epoch ms, the sortable truth behind `time` */
  at: number;
  /** the cost code this capture belongs to; prompts are per-code, not per-day */
  code: string | null;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  qty: number;
};

export type Note = {
  id: string;
  meta: string;
  body: string;
};

export type CrewMember = {
  id: string;
  name: string;
  on: boolean;
  code: string | null;
  /** seconds on the clock today */
  secs: number;
};

export type Job = {
  /** JobTread job id */
  id: string;
  /** display number, e.g. "2841" */
  number: string;
  address: string;
  customer: string;
  location: string;
  scope: string;
  dayLabel: string;
};

export type ScheduleDay = {
  id: string;
  day: string;
  addr: string;
  detail: string;
  today: boolean;
};

export type Role = 'crew' | 'foreman';

export type Tab = 'job' | 'cam' | 'log';

/** Which bottom sheet is up, if any. */
export type SheetKind = 'codes' | 'prompt' | 'schedule' | 'out' | null;

/** Which photo question the prompt sheet is asking. */
export type PromptKind = 'before' | 'after' | null;
