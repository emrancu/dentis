/**
 * Magnetic cards: a card is pulled toward a nearby cursor, its content drifts a little further, a soft light
 * follows the pointer inside it, and a click squashes it. The card sits in a static wrapper, and every distance
 * is measured from that wrapper (the card's resting rect), never from the moving card.
 * Motion is transform only. Off for reduced motion and for touch.
 */

/** Values for a card (the owner's style note). Pull and depth are fractions of the cursor's offset from the centre. */
export const MAGNETIC = Object.freeze({ range: 50, pull: 0.12, rot: 0.01, depth: 0.05, capPull: 12, capDepth: 8, capRot: 2, light: 1.5 });

export const REST = Object.freeze({ x: 0, y: 0, rotate: 0, contentX: 0, contentY: 0, inside: false });

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Shortens a vector to at most `max` long, keeping its direction. */
export function clampVector(x, y, max) {
  const length = Math.hypot(x, y);
  return length <= max || length === 0 ? { x, y } : { x: (x * max) / length, y: (y * max) / length };
}

export const isInside = (p, r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/** Within `range` px of the resting edge (or inside it). */
export const isNear = (p, r, range = MAGNETIC.range) => isInside(p, { left: r.left - range, right: r.right + range, top: r.top - range, bottom: r.bottom + range });

/** About 1.5 times the card's shorter side. */
export const lightSize = (r, factor = MAGNETIC.light) => Math.min(r.width, r.height) * factor;

/**
 * Where the card and its content should be for a cursor `p`, given the card's resting rect `r`.
 * Returns null when the cursor is out of range, which means "spring back to rest".
 */
export function magneticPose(p, r, config = MAGNETIC) {
  if (!isNear(p, r, config.range)) return null;
  const offset = { x: p.x - (r.left + r.width / 2), y: p.y - (r.top + r.height / 2) };
  const pull = clampVector(offset.x * config.pull, offset.y * config.pull, config.capPull);
  const content = clampVector(offset.x * config.depth, offset.y * config.depth, config.capDepth);
  return { x: pull.x, y: pull.y, rotate: clamp(offset.x * config.rot, -config.capRot, config.capRot), contentX: content.x, contentY: content.y, inside: isInside(p, r) };
}

export const cardTransform = (pose) => `translate3d(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px, 0) rotate(${pose.rotate.toFixed(3)}deg)`;
export const contentTransform = (pose) => `translate3d(${pose.contentX.toFixed(2)}px, ${pose.contentY.toFixed(2)}px, 0)`;

/** The click squash: scale 1 -> 0.9 -> 1.05 -> 1 over 400ms. Uses the separate `scale` property so it never fights the pull. */
export const SQUASH = Object.freeze({ keyframes: [{ scale: '1' }, { scale: '0.9' }, { scale: '1.05' }, { scale: '1' }], options: { duration: 400, easing: 'ease-out' } });

function place(card, pose, pointer, resting) {
  const content = card.querySelector('.mag__content');
  const light = card.querySelector('.mag__light');
  card.style.transform = cardTransform(pose);
  if (content) content.style.transform = contentTransform(pose);
  card.classList.add('is-near');
  card.classList.toggle('is-hover', pose.inside);
  if (light) {
    const size = lightSize(resting);
    const box = card.getBoundingClientRect(); // the light follows the card as it moves, so it stays under the cursor
    light.style.setProperty('--light', `${size}px`);
    light.style.transform = `translate3d(${pointer.x - box.left - size / 2}px, ${pointer.y - box.top - size / 2}px, 0)`;
  }
}

function release(card) {
  if (!card.classList.contains('is-near') && !card.style.transform) return;
  card.style.transform = '';
  card.querySelector('.mag__content')?.style.setProperty('transform', '');
  card.classList.remove('is-near', 'is-hover');
}

/** Wires every `.mag-area` under `root`. Returns null when the effect is off. */
export function initMagnetic(root = document, { areaSelector = '.mag-area' } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  let pointer = null;
  let frame = 0;

  const update = () => {
    frame = 0;
    for (const area of root.querySelectorAll(areaSelector)) {
      const card = area.firstElementChild;
      const pose = pointer && magneticPose(pointer, area.getBoundingClientRect()); // the wrapper never moves, so this is the resting rect
      if (pose) place(card, pose, pointer, area.getBoundingClientRect());
      else release(card);
    }
  };
  const schedule = () => (frame ||= requestAnimationFrame(update));

  const onMove = (event) => {
    if (event.pointerType === 'touch') return; // no hover on touch
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  };
  const onLeave = () => {
    pointer = null;
    schedule();
  };
  const onClick = (event) => event.target.closest('.mag')?.animate(SQUASH.keyframes, SQUASH.options);

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', schedule, { passive: true }); // the resting rect moves under a still cursor
  document.documentElement.addEventListener('mouseleave', onLeave);
  root.addEventListener('click', onClick);

  return {
    destroy() {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', schedule);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('click', onClick);
      cancelAnimationFrame(frame);
    },
  };
}
