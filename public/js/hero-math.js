/** Pure helpers for the hero animation. No browser or Three.js APIs, so they are unit-tested in Node. */

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Ease in and out: 0 -> 0, 1 -> 1, flat at both ends. */
export const smoothstep = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Overshoots slightly before settling at 1. Used for sparkles popping in. */
export const easeOutBack = (t, s = 1.70158) => {
  const x = clamp01(t) - 1;
  return 1 + x * x * ((s + 1) * x + s);
};

/** Frame-rate independent smoothing toward a target (same feel at 30 and 120 fps). */
export const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * Turns a point on the unit sphere into a point on a molar crown: a wide body, four cusps on the
 * shoulders with a dimple between them, and a slight waist towards the roots.
 * The crown spans about x ±1.05, y -0.75..0.9, z ±0.9.
 */
export function crownPoint(x, y, z) {
  const ring = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const cusps = 0.5 + 0.5 * Math.cos(4 * angle + Math.PI);
  let height;
  let squeeze = 1;
  if (y >= 0) {
    height = y * 0.5 + 0.7 * cusps * ring * ring * smoothstep(y / 0.45) * (1 - y * 0.5);
  } else {
    height = y * 0.75;
    squeeze = 1 - 0.2 * -y;
  }
  return [x * 1.05 * squeeze, height, z * 0.9 * squeeze];
}
