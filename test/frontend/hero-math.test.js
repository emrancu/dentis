import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, clamp01, damp, easeOutBack, lerpFlat, revealCount, smoothstep, toSegments } from '../../public/js/hero-math.js';

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

describe('line geometry helpers', () => {
  it('lerpFlat blends two coordinate arrays into out', () => {
    const out = new Float32Array(3);
    lerpFlat([0, 0, 0], [10, 20, 30], 0.5, out);
    assert.deepEqual([...out], [5, 10, 15]);
    assert.deepEqual([...lerpFlat([1, 1, 1], [2, 2, 2], 0, new Float32Array(3))], [1, 1, 1]);
    assert.deepEqual([...lerpFlat([1, 1, 1], [2, 2, 2], 1, new Float32Array(3))], [2, 2, 2]);
  });

  it('toSegments turns a polyline into consecutive point pairs', () => {
    const out = new Float32Array(12);
    toSegments([0, 0, 0, 1, 1, 1, 2, 2, 2], out);
    assert.deepEqual([...out], [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('toSegments handles a single segment', () => {
    assert.deepEqual([...toSegments([0, 0, 0, 5, 5, 5], new Float32Array(6))], [0, 0, 0, 5, 5, 5]);
  });

  it('revealCount draws segments in proportion to progress and stays in range', () => {
    assert.equal(revealCount(0, 10), 0);
    assert.equal(revealCount(0.5, 10), 5);
    assert.equal(revealCount(0.01, 10), 1);
    assert.equal(revealCount(1, 10), 10);
    assert.equal(revealCount(5, 10), 10);
    assert.equal(revealCount(-1, 10), 0);
  });
});

describe('classify', () => {
  it('puts tagged expression paths in the morph layer whatever their group', () => {
    assert.equal(classify(['pain'], { morph: 'brows' }), 'morph');
    assert.equal(classify(['happy'], { morph: 'mouth' }), 'morph');
  });

  it('maps drawing groups to layers', () => {
    assert.equal(classify(['body']), 'body');
    assert.equal(classify(['head']), 'head');
    assert.equal(classify(['pain']), 'pain');
    assert.equal(classify(['happy']), 'happy');
    assert.equal(classify(['hand']), 'hand');
    assert.equal(classify(['fx', 'zap']), 'fx');
    assert.equal(classify(['happy', 'spark']), 'spark');
  });

  it('puts the sweat drop (own class fx inside pain) in the fx layer, and unknown paths in the head', () => {
    assert.equal(classify(['fx', 'pain']), 'fx');
    assert.equal(classify([]), 'head');
  });
});
