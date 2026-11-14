import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp01, crownPoint, damp, easeOutBack, smoothstep } from './hero-math.js';

const TEAL = 0x2dd4bf;
const CORAL = 0xff8a66;
const TAU = Math.PI * 2;
/** Where plaque sits on the crown, as directions from its centre. */
const PLAQUE = [
  [0.1, 0.35, 0.93], [-0.7, 0.45, 0.55], [0.75, 0.3, 0.6], [0, 0.85, 0.5],
  [0.3, -0.3, 0.9], [-0.6, -0.2, -0.77], [0.8, 0.2, -0.57], [-0.2, 0.5, -0.84],
].map((d) => new THREE.Vector3(...d).normalize());

function softTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  draw(ctx);
  return new THREE.CanvasTexture(c);
}
const glowTexture = () => softTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});
const starTexture = () => softTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(64, 0); ctx.quadraticCurveTo(64, 64, 128, 64); ctx.quadraticCurveTo(64, 64, 64, 128);
  ctx.quadraticCurveTo(64, 64, 0, 64); ctx.quadraticCurveTo(64, 64, 64, 0);
  ctx.fill();
});

/** A molar: a displaced sphere for the crown plus two tapered roots. Centred on its own middle. */
function buildTooth(material) {
  const crownGeometry = new THREE.SphereGeometry(1, 72, 54);
  crownGeometry.deleteAttribute('uv');
  crownGeometry.deleteAttribute('normal');
  const merged = mergeVertices(crownGeometry, 1e-4);
  const p = merged.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...crownPoint(p.getX(i), p.getY(i), p.getZ(i)));
  merged.computeVertexNormals();

  const body = new THREE.Group();
  body.position.y = 0.62;
  const crown = new THREE.Mesh(merged, material);
  body.add(crown);

  const profile = [[0.0, 0.25], [0.36, 0.2], [0.34, -0.3], [0.26, -0.8], [0.15, -1.3], [0.06, -1.62], [0, -1.7]].map(([r, y]) => new THREE.Vector2(r, y));
  const rootGeometry = new THREE.LatheGeometry(profile, 32);
  for (const side of [-1, 1]) {
    const root = new THREE.Mesh(rootGeometry, material);
    root.position.set(side * 0.44, -0.5, 0);
    root.rotation.z = side * 0.12;
    root.scale.z = 0.85;
    body.add(root);
  }

  const plaqueMaterial = new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.55, emissive: 0x7a2a12, emissiveIntensity: 0.6 });
  const spots = PLAQUE.map((dir, i) => {
    const spot = new THREE.Group();
    const [x, y, z] = crownPoint(dir.x, dir.y, dir.z);
    spot.position.set(x, y, z).addScaledVector(dir, 0.02);
    spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.15 + (i % 3) * 0.035, 20, 14), plaqueMaterial);
    blob.scale.set(1, 1, 0.5);
    spot.add(blob);
    for (const [ox, oy, r] of [[0.15, 0.06, 0.06], [-0.1, -0.12, 0.05]]) {
      const bit = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), plaqueMaterial);
      bit.position.set(ox, oy, 0.02);
      bit.scale.z = 0.6;
      spot.add(bit);
    }
    body.add(spot);
    return spot;
  });
  return { body, spots };
}

function buildBrush() {
  const brush = new THREE.Group();
  const handle = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.35, metalness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2fffc, roughness: 0.5 });
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.4, 6, 12), handle);
  stem.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.56, 0.1), handle);
  head.position.y = 0.28;
  brush.add(stem, head);
  const bristle = new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8);
  for (let x = -1; x <= 1; x++) {
    for (let row = 0; row < 6; row++) {
      const b = new THREE.Mesh(bristle, white);
      b.rotation.x = Math.PI / 2;
      b.position.set(x * 0.08, 0.06 + row * 0.09, -0.15);
      brush.add(b);
    }
  }
  return brush;
}

/**
 * The hero scene: a glossy 3D molar with plaque. Hover or tap it and a toothbrush scrubs the plaque away
 * and the tooth sparkles; drag to spin it. `active()` returns true while a call is in progress, which keeps the tooth clean.
 * Returns {destroy}, or null if WebGL is unavailable.
 */
export function startHero(canvas, active) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const calm = reduced ? 0 : 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.z = 9;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(TEAL, 3);
  rim.position.set(-4, 2, -3);
  const warm = new THREE.PointLight(CORAL, 18, 9);
  warm.position.set(2.2, -1.8, 3);
  scene.add(key, rim, warm, new THREE.AmbientLight(0x88ffee, 0.25));

  /* ----- the tooth ----- */
  const placement = new THREE.Group(); // where it sits in the hero and how big it is
  const tilt = new THREE.Group(); // leans toward the pointer
  const spin = new THREE.Group(); // turns when dragged
  const toothMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: TEAL, emissiveIntensity: 0, envMapIntensity: 0.9 });
  const { body, spots } = buildTooth(toothMaterial);
  spin.add(body);
  tilt.add(spin);
  placement.add(tilt);
  scene.add(placement);
  const stained = new THREE.Color(0xf1e4c6);
  const white = new THREE.Color(0xffffff);
  const coralColor = new THREE.Color(CORAL);
  const tealColor = new THREE.Color(TEAL);

  /* ----- toothbrush ----- */
  const brush = buildBrush();
  placement.add(brush);

  /* ----- glow, orbit rings and sparkles ----- */
  const glowMap = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, opacity: 0.3 }));
  glow.scale.set(7, 7, 1);
  glow.position.z = -1.6;
  placement.add(glow);

  const rings = [
    { radius: 2.15, tilt: [1.15, 0.2], speed: 0.45, color: TEAL, size: 0.1 },
    { radius: 2.5, tilt: [-0.55, 1.0], speed: -0.3, color: 0xd9f7f0, size: 0.075 },
  ].map((r, i) => {
    const group = new THREE.Group();
    group.rotation.set(r.tilt[0], r.tilt[1], 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r.radius, 0.007, 8, 200), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.4 }));
    const pivot = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(r.size), new THREE.MeshBasicMaterial({ color: r.color }));
    gem.position.x = r.radius;
    pivot.add(gem);
    pivot.rotation.z = i * 2;
    group.add(ring, pivot);
    placement.add(group);
    return { group, pivot, gem, ...r };
  });

  const starMap = starTexture();
  const stars = Array.from({ length: 7 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: starMap, color: i % 2 ? 0xffffff : 0x9ff5e6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = (i / 7) * TAU + 0.4;
    sprite.position.set(Math.cos(a) * (1.45 + (i % 3) * 0.2), Math.sin(a) * 1.5, 0.9 + (i % 2) * 0.4);
    sprite.visible = false;
    placement.add(sprite);
    return { sprite, size: 0.5 + (i % 3) * 0.22, seed: i * 1.9 };
  });

  /* ----- drifting motes across the whole hero ----- */
  const MOTES = 120;
  const motePositions = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) motePositions.set([(Math.random() - 0.5) * 13, (Math.random() - 0.5) * 6.6, -3 + Math.random() * 5], i * 3);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = new THREE.PointsMaterial({ map: glowMap, color: TEAL, size: 0.16, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(moteGeometry, moteMaterial));

  /* ----- layout: tooth on the right on wide screens, on top on phones ----- */
  const place = { x: 0, y: 0, scale: 1 };
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (w > 700) {
      place.x = halfW * 0.5;
      place.y = 0;
      place.scale = Math.min((halfH * 2 * 0.6) / 3.1, (halfW * 0.92) / 5);
    } else {
      place.x = 0;
      place.y = halfH * 0.5;
      place.scale = Math.min((halfH * 2 * 0.3) / 3.1, (halfW * 2 * 0.86) / 5);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();

  /* ----- input ----- */
  const pointer = { x: 0, y: 0 };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onTooth = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(body, true).length > 0;
  };
  let hover = false;
  let pinned = false;
  let drag = null;
  let spinVelocity = 0;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    if (drag) {
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      drag.moved += Math.abs(dx);
      spin.rotation.y += dx * 0.012;
      spinVelocity = THREE.MathUtils.clamp(dx * 0.012 * 60, -8, 8);
    } else if (e.pointerType === 'mouse' && e.target === canvas) {
      hover = onTooth(e);
      canvas.style.cursor = hover ? 'pointer' : 'grab';
    }
  };
  const onDown = (e) => {
    drag = { x: e.clientX, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onUp = (e) => {
    if (drag && drag.moved < 6 && onTooth(e)) pinned = !pinned; // a tap, not a drag
    drag = null;
    canvas.style.cursor = hover ? 'pointer' : 'grab';
  };
  const onLeave = () => (hover = false);
  addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.style.cursor = 'grab';

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(canvas);

  /* ----- the loop ----- */
  const restPose = { p: new THREE.Vector3(1.75, -1.35, 0.6), r: -0.3 };
  let mood = 0; // 0 plaque, 1 clean (what the visitor asked for)
  let clean = 0; // how much plaque has actually gone (lags behind so the brush has time to scrub)
  let brushIn = 0;
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

    const want = hover || pinned || active() ? 1 : 0;
    mood = reduced ? want : damp(mood, want, 5, dt);
    clean = reduced ? want : damp(clean, want, want ? 1.4 : 6, dt);
    const s = smoothstep(mood);

    // layout and entrance
    const grow = easeOutBack(intro / 1.3);
    placement.position.set(place.x, place.y + Math.sin(t * 0.9) * 0.07 * calm, 0);
    placement.scale.setScalar(place.scale * grow);

    // tooth: leans toward the pointer, idles with a slow turn, and faces front while being cleaned
    tilt.rotation.x = damp(tilt.rotation.x, pointer.y * 0.25 * calm, 4, dt);
    tilt.rotation.y = damp(tilt.rotation.y, pointer.x * 0.3 * calm, 4, dt);
    if (!drag) {
      const idle = (s < 0.5 ? 0.35 : 0) * calm;
      spinVelocity = damp(spinVelocity, idle, 2.5, dt);
      spin.rotation.y += spinVelocity * dt;
      if (s > 0.01) spin.rotation.y = damp(spin.rotation.y, Math.round(spin.rotation.y / TAU) * TAU, 1.6 * s, dt);
    }
    toothMaterial.color.copy(stained).lerp(white, smoothstep(clean));
    toothMaterial.emissiveIntensity = 0.1 * Math.sin(Math.PI * clamp01(clean)) + 0.05 * s;

    // plaque shrinks away one spot after another, and wobbles while it is there
    spots.forEach((spot, i) => {
      const local = clamp01((clean - (i / spots.length) * 0.5) / 0.5);
      const size = 1 - smoothstep(local);
      spot.visible = size > 0.01;
      spot.scale.setScalar(Math.max(0.0001, size * (1 + 0.06 * Math.sin(t * 3 + i) * calm)));
    });

    // toothbrush slides in, scrubs the front of the tooth, then leaves when the plaque is gone
    brushIn = damp(brushIn, want && clean < 0.96 ? 1 : 0, 3.2, dt);
    const b = smoothstep(brushIn);
    const scrub = Math.sin(t * 9) * 0.5 * calm;
    brush.visible = true;
    brush.position.set(
      THREE.MathUtils.lerp(restPose.p.x, scrub, b),
      THREE.MathUtils.lerp(restPose.p.y + Math.sin(t * 1.1) * 0.06 * calm, 0.3 + Math.sin(t * 2.3) * 0.4 * calm, b),
      THREE.MathUtils.lerp(restPose.p.z, 1.2, b),
    );
    brush.rotation.set(0, THREE.MathUtils.lerp(0.4, 0, b), THREE.MathUtils.lerp(restPose.r, -0.65, b));
    brush.scale.setScalar(THREE.MathUtils.lerp(0.75, 1, b));

    // rings turn, gems orbit, stars pop in once the tooth is clean
    for (const r of rings) {
      r.group.rotation.z += dt * 0.08 * calm;
      r.pivot.rotation.z += dt * r.speed * calm;
      r.gem.rotation.y += dt * 2 * calm;
    }
    const pop = clamp01((clean - 0.55) / 0.45);
    for (const st of stars) {
      const sz = easeOutBack(pop - ((st.seed % 3) * 0.08)) * st.size * (0.85 + 0.15 * Math.sin(t * 3 + st.seed) * calm);
      st.sprite.visible = sz > 0.01;
      st.sprite.scale.setScalar(Math.max(0.0001, sz));
      st.sprite.material.rotation = t * 0.4 * calm + st.seed;
    }

    // mood colours the room
    glow.material.color.copy(coralColor).lerp(tealColor, s);
    glow.material.opacity = 0.28 + 0.2 * s;
    warm.intensity = 18 * (1 - s);
    moteMaterial.opacity = 0.3 + 0.35 * s;
    if (calm) {
      const p = moteGeometry.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        let y = p.getY(i) + dt * (0.1 + 0.25 * s);
        if (y > 3.3) y = -3.3;
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
      removeEventListener('pointermove', onMove);
      observer.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
