/** Duration and clock formatting. Ported from the prototype so the screens
 *  read identically. */

/** 8078 -> "2:14:38" — the running clock. */
export function hms(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

/** 8078 -> "2h 14m", 900 -> "15m" — banked totals. */
export function hm(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** 82 -> "01:22" — the record timer. */
export function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** A wall-clock stamp in the crew's shorthand: "7:14a". */
export function clockLabel(at: number = Date.now()): string {
  const d = new Date(at);
  let h = d.getHours();
  const ap = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}${ap}`;
}

/** "Mon, Jul 27" — the day-log title. */
export function dayTitle(at: number = Date.now()): string {
  return new Date(at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Zero-padded count for the mono counters: 6 -> "06". */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
