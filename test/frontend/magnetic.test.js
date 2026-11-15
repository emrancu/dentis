import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MAGNETIC, REST, SQUASH, cardTransform, clamp, clampVector, contentTransform, isInside, isNear, lightSize, magneticPose } from '../../public/js/magnetic.js';

const card = { left: 100, top: 100, right: 420, bottom: 300, width: 320, height: 200 }; // centre (260, 200)
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

describe('the values from the style note, for a card', () => {
  it('range 50px, pull 0.12, rotation 0.01, depth 0.05, light 1.5 times the shorter side', () => {
    assert.deepEqual([MAGNETIC.range, MAGNETIC.pull, MAGNETIC.rot, MAGNETIC.depth, MAGNETIC.light], [50, 0.12, 0.01, 0.05, 1.5]);
    assert.equal(MAGNETIC.capPull, 12);
  });
  it('the constants cannot be changed by accident', () => {
    assert.throws(() => { 'use strict'; MAGNETIC.pull = 1; });
  });
});

describe('range', () => {
  it('inside the card and up to 50px beyond its resting edge is active', () => {
    assert.equal(isInside({ x: 200, y: 200 }, card), true);
    assert.equal(isNear({ x: 200, y: 200 }, card), true);
    assert.equal(isNear({ x: 470, y: 200 }, card), true); // 50px right of the edge
    assert.equal(isNear({ x: 50, y: 100 }, card), true); // 50px left
    assert.equal(isNear({ x: 260, y: 350 }, card), true); // 50px below
    assert.equal(isNear({ x: 260, y: 50 }, card), true); // 50px above
  });

  it('one pixel past the range is not', () => {
    assert.equal(isNear({ x: 471, y: 200 }, card), false);
    assert.equal(isNear({ x: 49, y: 200 }, card), false);
    assert.equal(isNear({ x: 260, y: 351 }, card), false);
    assert.equal(isNear({ x: 260, y: 49 }, card), false);
  });

  it('near is wider than inside, and the corner zone is a square, not a circle', () => {
    assert.equal(isInside({ x: 430, y: 200 }, card), false);
    assert.equal(isNear({ x: 430, y: 200 }, card), true);
    assert.equal(isNear({ x: 470, y: 350 }, card), true);
  });

  it('out of range means spring back to rest', () => {
    assert.equal(magneticPose({ x: 900, y: 900 }, card), null);
  });
});

describe('pull', () => {
  it('the card moves toward the cursor by 0.12 of its offset from the resting centre', () => {
    const pose = magneticPose({ x: 300, y: 220 }, card); // offset (40, 20)
    close(pose.x, 4.8);
    close(pose.y, 2.4);
  });

  it('pulls toward the cursor on every side', () => {
    assert.ok(magneticPose({ x: 460, y: 200 }, card).x > 0);
    assert.ok(magneticPose({ x: 60, y: 200 }, card).x < 0);
    assert.ok(magneticPose({ x: 260, y: 340 }, card).y > 0);
    assert.ok(magneticPose({ x: 260, y: 60 }, card).y < 0);
  });

  it('is zero with the cursor exactly on the centre', () => {
    const pose = magneticPose({ x: 260, y: 200 }, card);
    assert.deepEqual([pose.x, pose.y, pose.rotate], [0, 0, 0]);
  });

  it('never moves a card more than 12px, so text stays readable', () => {
    for (const p of [{ x: 470, y: 350 }, { x: 50, y: 50 }, { x: 470, y: 200 }]) {
      const pose = magneticPose(p, card);
      assert.ok(Math.hypot(pose.x, pose.y) <= 12 + 1e-9, JSON.stringify(p));
    }
    const far = magneticPose({ x: 470, y: 350 }, card);
    close(Math.hypot(far.x, far.y), 12); // clamped, direction kept
    assert.ok(far.x > 0 && far.y > 0);
  });

  it('rotates by 0.01 degree per pixel of horizontal offset, up to 2 degrees', () => {
    close(magneticPose({ x: 360, y: 200 }, card).rotate, 1);
    close(magneticPose({ x: 160, y: 200 }, card).rotate, -1);
    assert.equal(clamp(5, -2, 2), 2);
    for (const x of [50, 470]) assert.ok(Math.abs(magneticPose({ x, y: 200 }, card).rotate) <= 2);
  });
});

describe('depth', () => {
  it('the content moves by 0.05 of the offset, on top of the card, so it travels further than the card', () => {
    const pose = magneticPose({ x: 360, y: 260 }, card); // offset (100, 60)
    close(pose.contentX, 5);
    close(pose.contentY, 3);
    assert.ok(Math.hypot(pose.x + pose.contentX, pose.y + pose.contentY) > Math.hypot(pose.x, pose.y));
  });

  it('is capped at 8px', () => {
    const wide = { left: 0, top: 0, right: 2000, bottom: 200, width: 2000, height: 200 };
    const pose = magneticPose({ x: 2050, y: 100 }, wide);
    assert.ok(Math.hypot(pose.contentX, pose.contentY) <= 8 + 1e-9);
  });
});

describe('light and shadow state', () => {
  it('the light is about 1.5 times the shorter side', () => {
    assert.equal(lightSize(card), 300);
    assert.equal(lightSize({ width: 200, height: 400 }), 300);
  });

  it('hover (the light) means inside the resting rect, near (the shadow) means in range', () => {
    const outsideNear = magneticPose({ x: 440, y: 200 }, card);
    assert.equal(outsideNear.inside, false);
    assert.notEqual(outsideNear, null);
    assert.equal(magneticPose({ x: 200, y: 150 }, card).inside, true);
  });

  it('the pose depends on the resting rect only, so the moving card can never change it', () => {
    const p = { x: 330, y: 230 };
    assert.deepEqual(magneticPose(p, card), magneticPose(p, { ...card }));
  });
});

describe('the transforms and the squash', () => {
  it('uses transform only: translate and rotate for the card, translate for the content', () => {
    assert.equal(cardTransform({ x: 4.8, y: 2.4, rotate: 0.4 }), 'translate3d(4.80px, 2.40px, 0) rotate(0.400deg)');
    assert.equal(contentTransform({ contentX: 2, contentY: -1 }), 'translate3d(2.00px, -1.00px, 0)');
    assert.equal(cardTransform(REST), 'translate3d(0.00px, 0.00px, 0) rotate(0.000deg)');
  });

  it('the click squash goes 1 to 0.9 to 1.05 to 1 in 400ms ease-out, on the separate scale property', () => {
    assert.deepEqual(SQUASH.keyframes.map((k) => k.scale), ['1', '0.9', '1.05', '1']);
    assert.deepEqual(SQUASH.options, { duration: 400, easing: 'ease-out' });
    assert.ok(SQUASH.keyframes.every((k) => Object.keys(k).join() === 'scale'));
  });

  it('clampVector keeps the direction and leaves short vectors alone', () => {
    assert.deepEqual(clampVector(3, 4, 10), { x: 3, y: 4 });
    const v = clampVector(30, 40, 10);
    close(v.x, 6);
    close(v.y, 8);
    assert.deepEqual(clampVector(0, 0, 5), { x: 0, y: 0 });
  });
});

describe('the controller', () => {
  const source = readFileSync(new URL('../../public/js/magnetic.js', import.meta.url), 'utf8');

  it('is off for reduced motion, and ignores touch', () => {
    assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return null/);
    assert.match(source, /event\.pointerType === 'touch'\) return/);
  });

  it('measures the wrapper (the resting rect), not the moving card', () => {
    assert.match(source, /magneticPose\(pointer, area\.getBoundingClientRect\(\)\)/);
    assert.doesNotMatch(source, /magneticPose\(pointer, card\.getBoundingClientRect/);
  });

  it('throttles to one update per frame and handles scrolling under a still cursor', () => {
    assert.match(source, /requestAnimationFrame\(update\)/);
    assert.match(source, /addEventListener\('scroll', schedule/);
  });

  it('is started by the page', () => {
    const main = readFileSync(new URL('../../public/js/main.js', import.meta.url), 'utf8');
    assert.match(main, /import \{ initMagnetic \} from '\.\/magnetic\.js'/);
    assert.match(main, /initMagnetic\(\)/);
  });
});
