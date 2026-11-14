import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { classify, clamp01, damp, easeOutBack, lerpFlat, revealCount, smoothstep, toSegments } from './hero-math.js';

const MORPH_SAMPLES = 48;
const COLORS = { mint: 0xd9f7f0, coral: 0xff8a66, teal: 0x2dd4bf };
/** Depth of each layer. The rig turns toward the pointer, so these gaps become real parallax. */
const DEPTH = { body: -0.5, head: 0, morph: 0.12, pain: 0.12, happy: 0.12, blush: 0.1, hand: 0.55, fx: 0.7, spark: 0 };
/** [colour, draw-on delay in seconds] per layer. */
const STYLE = {
  body: [COLORS.mint, 0],
  head: [COLORS.mint, 0.25],
  morph: [COLORS.mint, 0.7],
  pain: [COLORS.mint, 0.9],
  hand: [COLORS.mint, 1.1],
  fx: [COLORS.coral, 1.3],
  happy: [COLORS.mint, 0],
  blush: [COLORS.coral, 0],
  spark: [COLORS.teal, 0],
};

const world = (p, z = 0) => [(p.x - 240) / 100, (260 - p.y) / 100, z];

function ancestry(node) {
  const names = [];
  for (let el = node; el && el.nodeType === 1 && el.nodeName.toLowerCase() !== 'svg'; el = el.parentNode) {
    names.push(...(el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
  }
  return names;
}

/** Reads every sub-path of the inline SVG, so the page has one drawing and this scene only animates it. */
function readDrawing(svg) {
  const { paths } = new SVGLoader().parse(svg.outerHTML);
  const items = [];
  for (const path of paths) {
    const node = path.userData.node;
    const morph = node.getAttribute('data-morph');
    const dashed = node.hasAttribute('stroke-dasharray');
    const classes = ancestry(node);
    const base = classify(classes, { morph });
    const layer = base === 'happy' && dashed ? 'blush' : base;
    const mood = classes.includes('happy') ? 'happy' : 'pain';
    path.subPaths.forEach((sub, index) => {
      const points = morph ? sub.getSpacedPoints(MORPH_SAMPLES) : sub.getPoints(12);
      items.push({ layer, morph, mood, dashed, index, points });
    });
  }
  return items;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * The hero scene: the line-drawn person as 3D lines. `target()` returns 1 when the person should be happy
 * (hover, tap, or a call in progress) and 0 when they have toothache. Returns {destroy}, or null if WebGL is unavailable.
 */
export function startHero(canvas, svg, target) {
  let renderer;
  let drawing;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    drawing = readDrawing(svg);
  } catch {
    return null;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const rig = new THREE.Group();
  const headPivot = new THREE.Group();
  const head = new THREE.Group();
  const handGroup = new THREE.Group();
  headPivot.position.set(0, -1.15, 0);
  head.position.set(0, 1.15, 0);
  headPivot.add(head);
  head.add(handGroup);
  rig.add(headPivot);
  scene.add(rig);

  /* ----- materials, one per layer (and dashed variant), so a layer fades as one ----- */
  const materials = new Map();
  const material = (layer, dashed) => {
    const key = dashed ? `${layer}-dashed` : layer;
    if (!materials.has(key)) {
      materials.set(key, new LineMaterial({ color: STYLE[layer][0], linewidth: 3, transparent: true, depthWrite: false, dashed, dashSize: 0.03, gapSize: 0.07 }));
    }
    return materials.get(key);
  };

  /* ----- build the lines ----- */
  const reveals = []; // lines that draw on at the start
  const morphs = new Map(); // "brows" -> { pain: [flat…], happy: [flat…] } per sub-path index
  const sparkles = [];

  const flat = (points, z) => points.flatMap((p) => world(p, z));
  const makeLine = (positions, layer, dashed) => {
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const line = new Line2(geometry, material(layer, dashed));
    line.frustumCulled = false;
    if (dashed) line.computeLineDistances();
    return line;
  };

  let order = 0;
  for (const item of drawing) {
    const { layer, morph, mood: drawnMood, dashed, index, points } = item;
    if (morph) {
      const entry = morphs.get(`${morph}:${index}`) ?? {};
      entry[drawnMood] = flat(points, DEPTH.morph);
      morphs.set(`${morph}:${index}`, entry);
      continue;
    }
    if (layer === 'spark') {
      const c = points.reduce((a, p) => ({ x: a.x + p.x / points.length, y: a.y + p.y / points.length }), { x: 0, y: 0 });
      const group = new THREE.Group();
      const [cx, cy] = world(c);
      group.position.set(cx, cy, 0.9 + sparkles.length * 0.25);
      group.add(makeLine(points.flatMap((p) => [(p.x - c.x) / 100, (c.y - p.y) / 100, 0]), 'spark', false));
      rig.add(group);
      sparkles.push({ group, seed: sparkles.length * 1.7 });
      continue;
    }
    const line = makeLine(flat(points, DEPTH[layer]), layer, dashed);
    const parent = layer === 'body' ? rig : layer === 'hand' ? handGroup : head;
    parent.add(line);
    const segments = points.length - 1;
    line.geometry.instanceCount = 0;
    reveals.push({ line, segments, delay: STYLE[layer][1] + order++ * 0.035 });
  }
  const morphLines = [];
  for (const entry of morphs.values()) {
    if (!entry.pain || !entry.happy) continue;
    const line = makeLine(entry.pain, 'morph', false);
    const segments = entry.pain.length / 3 - 1;
    line.geometry.instanceCount = 0;
    head.add(line);
    reveals.push({ line, segments, delay: STYLE.morph[1] + order++ * 0.05 });
    morphLines.push({ line, pain: new Float32Array(entry.pain), happy: new Float32Array(entry.happy), tmp: new Float32Array(entry.pain.length) });
  }

  /* ----- background glow and drifting motes ----- */
  const painGlow = new THREE.Color(0xff8a66);
  const happyGlow = new THREE.Color(COLORS.teal);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.3 }));
  glow.scale.set(6.2, 6.2, 1);
  glow.position.z = -2;
  scene.add(glow);
  const MOTES = 70;
  const motePositions = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) motePositions.set([(Math.random() - 0.5) * 5.6, (Math.random() - 0.5) * 6, -1 + Math.random() * 2.5], i * 3);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = new THREE.PointsMaterial({ color: COLORS.teal, size: 0.05, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(moteGeometry, moteMaterial));

  /* ----- size ----- */
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max(2.9 / half, 2.55 / (half * camera.aspect)));
    camera.updateProjectionMatrix();
    for (const m of materials.values()) {
      m.linewidth = w < 320 ? 2.2 : 3;
      m.resolution.set(w, h);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();

  /* ----- input ----- */
  const pointer = { x: 0, y: 0 };
  const onPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  };
  addEventListener('pointermove', onPointer, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(canvas);

  /* ----- the loop ----- */
  const tmpSegments = (line) => line.geometry.attributes.instanceStart.data;
  let mood = 0;
  let intro = reduced ? 10 : 0;
  let last = performance.now();
  let raf;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const t = now / 1000;
    intro += dt;

    mood = reduced ? target() : damp(mood, target(), target() ? 5 : 4, dt);
    const s = smoothstep(mood);
    const calm = reduced ? 0 : 1;

    // draw-on at the start
    for (const r of reveals) r.line.geometry.instanceCount = revealCount(smoothstep((intro - r.delay) / 1.1), r.segments);

    // expression morph: brows, eyes and mouth glide between the two drawings
    for (const m of morphLines) {
      const data = tmpSegments(m.line);
      toSegments(lerpFlat(m.pain, m.happy, s, m.tmp), data.array);
      data.needsUpdate = true;
    }

    // layers cross-fade with the mood
    const fade = (key, value) => materials.has(key) && (materials.get(key).opacity = value);
    fade('pain', 1 - s);
    fade('pain-dashed', 1 - s);
    fade('happy', s);
    fade('happy-dashed', s);
    fade('blush', s);
    fade('blush-dashed', s);
    fade('hand', clamp01(1 - s * 1.4));
    fade('fx', (1 - s) * (calm ? 0.6 + 0.4 * Math.sin(t * 14) ** 2 : 1));
    fade('spark', s);
    handGroup.position.set(-0.7 * s, -1.5 * s, 0);
    handGroup.rotation.z = -0.35 * s;

    // sparkles pop in with a little overshoot, then float and turn
    for (const sp of sparkles) {
      const grow = easeOutBack((s - 0.25) / 0.75);
      sp.group.visible = s > 0.02;
      sp.group.scale.setScalar(Math.max(0.0001, grow));
      sp.group.rotation.z = t * 0.5 * calm + sp.seed;
      sp.group.position.y += Math.sin(t * 1.4 + sp.seed) * 0.0012 * calm;
    }

    // body language: parallax toward the pointer, a nod, a tremble while it hurts, a gentle float
    rig.rotation.y = damp(rig.rotation.y, pointer.x * 0.3 * calm, 4, dt);
    rig.rotation.x = damp(rig.rotation.x, pointer.y * 0.1 * calm, 4, dt);
    rig.position.y = Math.sin(t * 0.9) * 0.05 * calm;
    headPivot.rotation.y = damp(headPivot.rotation.y, pointer.x * 0.12 * calm, 5, dt);
    headPivot.rotation.z = (1 - s) * 0.06 + Math.sin(t * 38) * 0.004 * (1 - s) * calm;

    // mood colours the room
    glow.material.color.copy(painGlow).lerp(happyGlow, s);
    glow.material.opacity = 0.26 + 0.16 * s;
    moteMaterial.opacity = 0.25 + 0.4 * s;
    if (calm) {
      const p = moteGeometry.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        let y = p.getY(i) + dt * (0.08 + 0.18 * s);
        if (y > 3) y = -3;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onPointer);
      observer.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
