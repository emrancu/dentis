import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clamp01, crownPoint, damp, easeOutBack, smoothstep } from '../../public/js/hero-math.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

describe('easing', () => {
  it('clamps to 0..1', () => {
    assert.equal(clamp01(-3), 0);
    assert.equal(clamp01(7), 1);
    assert.equal(clamp01(0.4), 0.4);
  });

  it('smoothstep is 0 and 1 at the ends, 0.5 in the middle, and flat at the ends', () => {
    assert.equal(smoothstep(0), 0);
    assert.equal(smoothstep(1), 1);
    close(smoothstep(0.5), 0.5);
    assert.ok(smoothstep(0.1) < 0.1);
    assert.ok(smoothstep(0.9) > 0.9);
    assert.equal(smoothstep(2), 1);
  });

  it('easeOutBack lands on 0 and 1 and overshoots in between', () => {
    close(easeOutBack(0), 0);
    close(easeOutBack(1), 1);
    assert.ok(Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49))) > 1);
  });

  it('damp moves toward the target, never past it, and does not depend on frame rate', () => {
    const slow = damp(0, 1, 5, 0.1);
    assert.ok(slow > 0 && slow < 1);
    let a = 0;
    for (let i = 0; i < 10; i++) a = damp(a, 1, 5, 0.01);
    let b = 0;
    for (let i = 0; i < 2; i++) b = damp(b, 1, 5, 0.05);
    close(a, b, 1e-9);
    assert.equal(damp(0.3, 0.3, 5, 0.1), 0.3);
  });
});

describe('crownPoint', () => {
  const sphere = (n = 40) => {
    const points = [];
    for (let i = 0; i <= n; i++) {
      const polar = (i / n) * Math.PI;
      for (let j = 0; j < n; j++) {
        const azimuth = (j / n) * Math.PI * 2;
        points.push([Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth)]);
      }
    }
    return points;
  };

  it('keeps the crown inside its box and finite', () => {
    for (const p of sphere()) {
      const [x, y, z] = crownPoint(...p);
      assert.ok([x, y, z].every(Number.isFinite));
      assert.ok(Math.abs(x) <= 1.051 && Math.abs(z) <= 0.901);
      assert.ok(y >= -0.751 && y <= 0.95);
    }
  });

  it('puts the poles on the axis, with a dimple lower than the cusps', () => {
    const top = crownPoint(0, 1, 0);
    const bottom = crownPoint(0, -1, 0);
    close(top[0], 0);
    close(top[2], 0);
    close(bottom[0], 0);
    close(bottom[1], -0.75);
    const highest = Math.max(...sphere().map((p) => crownPoint(...p)[1]));
    assert.ok(highest > top[1] + 0.05);
  });

  it('is continuous across the equator', () => {
    const above = crownPoint(1, 1e-9, 0);
    const below = crownPoint(1, -1e-9, 0);
    close(above[0], below[0], 1e-6);
    close(above[1], below[1], 1e-6);
  });
});
