/**
 * Every open question from the design review lives here as a single constant,
 * so changing a policy is a one-line edit rather than a hunt through screens.
 *
 * Defaults are the answers the prototype shipped with. Where the client had
 * not decided yet, the safest option is used and flagged with TODO.
 */

/** How long a code can run without a before photo before we escalate. */
export const BEFORE_PHOTO_GRACE_SECONDS = 5 * 60;

/**
 * TODO(client): should the 5-minute notification repeat, or fire once and
 * leave the amber strip? Shipped as fire-once-per-code — set a number of
 * seconds to re-fire on an interval instead.
 */
export const BEFORE_PHOTO_RENOTIFY_SECONDS: number | null = null;

/** How long into a code we ask for a progress ("during") photo. */
export const DURING_PHOTO_AFTER_SECONDS = 45 * 60;

/**
 * TODO(client): who gets copied on the 5-minute notification besides the crew
 * member — foreman only, or the office too? Shipped as foreman only. The name
 * appears verbatim in the notification body.
 */
export const ESCALATION_CONTACT = 'Randy';

/**
 * TODO(client): can a foreman override a missing after photo, or is the block
 * absolute? Shipped absolute. Flipping this to `true` reveals an override
 * control on the clock-out sheet for foremen, and records the override on the
 * time entry so the office can see it was used.
 */
export const FOREMAN_CAN_OVERRIDE_PHOTO_GATE = false;

/** One before photo clears the gate. The client confirmed one, not two. */
export const BEFORE_PHOTOS_REQUIRED = 1;

/** Gloved-thumb budget. Nothing important is smaller than this. */
export const TAP_TARGET = 76;

/** Max seconds of video per clip. */
export const MAX_VIDEO_SECONDS = 60;
