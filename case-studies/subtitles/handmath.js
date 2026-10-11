/* The hand maths, from Subtitles/components/tracking.js. Shared by the live tracker
   and the hand diagram (Fig. 4), so both show the same numbers. */

export const PINCH = 0.06;        // tracking.js:118, thumb tip to index tip
export const DEAD = 0.07;         // tracking.js:20, joystick dead zone round the middle
export const SMOOTH = 0.35;       // tracking.js:104, EMA on the index tip
export const SPAN_MIN = 0.06;     // tracking.js:126, wrist to little-finger base, far
export const SPAN_RANGE = 0.18;   // tracking.js:126, ... to 0.24, close
export const HOLD_MS = 1000;      // freeform.js:470 and globe.js:403, pinch held this long presses
export const HOLD_TRAVEL = 60;    // freeform.js:456, ... if the hand moved less than this, in px
export const Z_STEP = 0.010;      // globe.js:366, depth change ignored below this
export const Z_GAIN = 18;         // globe.js:367

/* This page only: the band round the middle where your hand points without scrolling.
   The site's Feed view scrolled with the 0.07 dead zone above. */
export const PAGE_DEAD = 0.22;

export const TIP_INDEX = 8, TIP_THUMB = 4, WRIST = 0, PINKY_BASE = 17;

/* tracking.js:21-25 */
export function joystick(pos, dead = DEAD) {
  const c = pos - 0.5;
  if (Math.abs(c) < dead) return 0;
  return Math.sign(c) * (Math.abs(c) - dead) / (0.5 - dead);
}

export const pinchDist = (lm) => Math.hypot(lm[TIP_INDEX].x - lm[TIP_THUMB].x, lm[TIP_INDEX].y - lm[TIP_THUMB].y);
export const spanOf = (lm) => Math.hypot(lm[WRIST].x - lm[PINKY_BASE].x, lm[WRIST].y - lm[PINKY_BASE].y);
export const depthOf = (span) => Math.max(0, Math.min(1, (span - SPAN_MIN) / SPAN_RANGE));

/* MediaPipe's 21 points, joined the way its hand model joins them */
export const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
