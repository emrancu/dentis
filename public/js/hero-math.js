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

/** out[i] = a[i] + (b[i] - a[i]) * t, for two flat coordinate arrays of the same length. */
export function lerpFlat(a, b, t, out) {
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

/**
 * Writes a polyline (flat x,y,z,x,y,z…) as the segment pairs a fat line geometry stores:
 * segment i = [point i, point i+1]. Returns `out`.
 */
export function toSegments(flat, out) {
  const points = flat.length / 3;
  for (let i = 0; i < points - 1; i++) {
    for (let k = 0; k < 3; k++) {
      out[i * 6 + k] = flat[i * 3 + k];
      out[i * 6 + 3 + k] = flat[(i + 1) * 3 + k];
    }
  }
  return out;
}

/** How many of `total` segments are drawn at `progress` 0..1 (the draw-on effect). */
export const revealCount = (progress, total) => Math.max(0, Math.min(total, Math.ceil(clamp01(progress) * total)));

/**
 * Which layer of the drawing a path belongs to, from the class names of the element and its ancestors.
 * Layers decide the colour, depth and how the path reacts to the mood.
 */
export function classify(classes, { morph = null } = {}) {
  const has = (name) => classes.includes(name);
  if (morph) return 'morph';
  if (has('spark')) return 'spark';
  if (has('fx')) return 'fx';
  if (has('hand')) return 'hand';
  if (has('happy')) return 'happy';
  if (has('pain')) return 'pain';
  if (has('body')) return 'body';
  return 'head';
}
