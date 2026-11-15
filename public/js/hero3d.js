import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp01, crownPoint, damp, easeOutBack, smoothstep } from './hero-math.js';

const TEAL = 0x0e7490;
const TAU = Math.PI * 2;
/** One scene per dental treatment, in the order the page lists them. */
export const TREATMENTS = ['checkup', 'whitening', 'braces', 'implant'];

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(64, 0); ctx.quadraticCurveTo(64, 64, 128, 64); ctx.quadraticCurveTo(64, 64, 64, 128);
  ctx.quadraticCurveTo(64, 64, 0, 64); ctx.quadraticCurveTo(64, 64, 64, 0);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

/** The crown geometry: a displaced sphere (see crownPoint). */
function crownGeometry() {
  const sphere = new THREE.SphereGeometry(1, 72, 54);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const merged = mergeVertices(sphere, 1e-4);
  const p = merged.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...crownPoint(p.getX(i), p.getY(i), p.getZ(i)));
  merged.computeVertexNormals();
  return merged;
}

/** A molar: crown plus two tapered roots, centred on its own middle. */
function buildTooth(crown, material) {
  const body = new THREE.Group();
  body.position.y = 0.62;
  body.add(new THREE.Mesh(crown, material));
  const profile = [[0.0, 0.25], [0.36, 0.2], [0.34, -0.3], [0.26, -0.8], [0.15, -1.3], [0.06, -1.62], [0, -1.7]].map(([r, y]) => new THREE.Vector2(r, y));
  const rootGeometry = new THREE.LatheGeometry(profile, 32);
  for (const side of [-1, 1]) {
    const root = new THREE.Mesh(rootGeometry, material);
    root.position.set(side * 0.44, -0.5, 0);
    root.rotation.z = side * 0.12;
    root.scale.z = 0.85;
    body.add(root);
  }
  return body;
}

const facing = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

/**
 * The hero scene: a 3D model for each treatment (check-up, whitening, braces, implant) that swaps with `show(i)`.
 * Drag to spin the model; a tap on it calls `onTap`. Returns {show, destroy}, or null if WebGL is unavailable.
 */
export function startHero(canvas, { onTap = () => {} } = {}) {
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
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.z = 9;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0x9ff5e6, 2);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));

  const tooth = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xffffff, emissiveIntensity: 0.04 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xe4ecef, metalness: 1, roughness: 0.22 });
  const crown = crownGeometry();
  const star = starTexture();

  const placement = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  placement.add(tilt);
  tilt.add(spin);
  scene.add(placement);

  const makeStar = (parent, x, y, z, size) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, z);
    parent.add(sprite);
    return { sprite, size, seed: x * 3 + y * 5 };
  };

  /* ----- 0. check-up: a tooth, a dental mirror and a few bubbles ----- */
  const checkup = new THREE.Group();
  checkup.add(buildTooth(crown, tooth));
  const mirror = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04 }));
  disc.rotation.x = Math.PI / 2;
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 12, 48), new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.35 }));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 16), steel);
  handle.position.y = -1.15;
  mirror.add(disc, rimRing, handle);
  mirror.position.set(-1.35, 0.55, 0.9);
  mirror.rotation.z = -0.5;
  checkup.add(mirror);
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.5, clearcoat: 1 });
  const bubbles = [[1.2, -0.6, 0.8, 0.13], [1.5, 0.3, 0.4, 0.09], [1.0, 1.0, 0.9, 0.11], [1.65, -1.1, 0.2, 0.07], [-0.9, -1.4, 0.9, 0.08]].map(([x, y, z, r], i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), bubbleMaterial);
    mesh.position.set(x, y, z);
    checkup.add(mesh);
    return { mesh, y, seed: i * 1.3 };
  });

  /* ----- 1. whitening: a bright tooth with a halo and twinkling stars ----- */
  const whitening = new THREE.Group();
  whitening.add(buildTooth(crown, tooth));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.025, 10, 120), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  halo.rotation.x = 1.25;
  whitening.add(halo);
  const sparkles = [[-1.3, 1.1, 0.8, 0.7], [1.35, 0.8, 0.6, 0.55], [1.1, -0.9, 0.9, 0.6], [-1.2, -0.7, 0.7, 0.45], [0.2, 1.65, 0.8, 0.4], [-0.1, -1.6, 0.9, 0.35]].map((s) => makeStar(whitening, ...s));

  /* ----- 2. braces: brackets, coloured bands and a wire on the crown ----- */
  const braces = new THREE.Group();
  const bracesTooth = buildTooth(crown, tooth);
  braces.add(bracesTooth);
  const dirs = [[-0.95, 0.1, 0.3], [-0.62, 0.1, 0.78], [0, 0.1, 1], [0.62, 0.1, 0.78], [0.95, 0.1, 0.3]].map((d) => new THREE.Vector3(...d).normalize());
  const bands = [0xff8a66, 0x2dd4bf, 0xffd166];
  const wirePoints = [];
  dirs.forEach((dir, i) => {
    const [x, y, z] = crownPoint(dir.x, dir.y, dir.z);
    const at = new THREE.Vector3(x, y, z);
    wirePoints.push(at.clone().addScaledVector(dir, 0.13));
    if (i === 0 || i === 4) return;
    const bracket = new THREE.Group();
    bracket.position.copy(at).addScaledVector(dir, 0.04);
    bracket.quaternion.copy(facing(dir));
    bracket.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.1), steel));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 10, 20), new THREE.MeshStandardMaterial({ color: bands[i - 1], roughness: 0.4 }));
    band.position.z = 0.07;
    bracket.add(band);
    bracesTooth.add(bracket);
  });
  bracesTooth.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePoints), 40, 0.022, 8), steel));

  /* ----- 3. implant: crown, abutment and a threaded screw, slightly apart ----- */
  const implant = new THREE.Group();
  const crownMesh = new THREE.Mesh(crown, tooth);
  crownMesh.scale.setScalar(0.82);
  const titanium = new THREE.MeshStandardMaterial({ color: 0xc3ccd2, metalness: 1, roughness: 0.3 });
  const abutment = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.36, 24), new THREE.MeshStandardMaterial({ color: 0xe0b85a, metalness: 1, roughness: 0.3 }));
  const screw = new THREE.Group();
  screw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 24), titanium));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.05, 0.32, 24), titanium);
  tip.position.y = -0.7;
  screw.add(tip);
  for (let i = 0; i < 8; i++) {
    const thread = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.032, 8, 28), titanium);
    thread.rotation.x = Math.PI / 2;
    thread.position.y = 0.45 - i * 0.14;
    screw.add(thread);
  }
  screw.position.y = -0.45;
  abutment.position.y = 0.38;
  implant.add(crownMesh, abutment, screw);
  implant.position.y = -0.15;

  const models = [checkup, whitening, braces, implant].map((group) => {
    spin.add(group);
    return { group, s: 0 };
  });

  /* ----- layout ----- */
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();

  /* ----- input ----- */
  const pointer = { x: 0, y: 0 };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onModel = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(spin, true).length > 0;
  };
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
      canvas.style.cursor = onModel(e) ? 'pointer' : 'grab';
    }
  };
  const onDown = (e) => {
    drag = { x: e.clientX, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onUp = (e) => {
    if (drag && drag.moved < 6 && onModel(e)) {
      bounce = 1;
      onTap();
    }
    drag = null;
    canvas.style.cursor = 'grab';
  };
  addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.cursor = 'grab';

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(canvas);

  /* ----- the loop ----- */
  let current = 0;
  let bounce = 0;
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
    bounce = damp(bounce, 0, 5, dt);

    placement.position.y = Math.sin(t * 0.9) * 0.06 * calm;
    placement.scale.setScalar(0.8 * easeOutBack(intro / 1.2) * (1 + 0.06 * bounce));
    tilt.rotation.x = damp(tilt.rotation.x, pointer.y * 0.2 * calm, 4, dt);
    tilt.rotation.y = damp(tilt.rotation.y, pointer.x * 0.25 * calm, 4, dt);
    if (!drag) {
      spinVelocity = damp(spinVelocity, 0.3 * calm, 2.5, dt);
      spin.rotation.y += spinVelocity * dt;
    }

    models.forEach((m, i) => {
      m.s = reduced ? (i === current ? 1 : 0) : damp(m.s, i === current ? 1 : 0, 6, dt);
      m.group.visible = m.s > 0.01;
      m.group.scale.setScalar(Math.max(0.0001, easeOutBack(m.s)));
    });

    if (checkup.visible) {
      mirror.position.y = 0.55 + Math.sin(t * 1.4) * 0.08 * calm;
      mirror.rotation.z = -0.5 + Math.sin(t * 1.1) * 0.08 * calm;
      for (const b of bubbles) {
        b.mesh.position.y = b.y + Math.sin(t * 1.2 + b.seed) * 0.18 * calm;
      }
    }
    if (whitening.visible) {
      halo.rotation.z += dt * 0.6 * calm;
      tooth.emissiveIntensity = 0.04 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.2)) * calm;
      for (const sp of sparkles) {
        const size = sp.size * (0.75 + 0.25 * Math.sin(t * 3 + sp.seed) * calm);
        sp.sprite.scale.setScalar(size);
        sp.sprite.material.rotation = t * 0.4 * calm + sp.seed;
      }
    } else tooth.emissiveIntensity = 0.04;
    if (implant.visible) crownMesh.position.y = 1.2 + (0.18 + 0.18 * Math.sin(t * 1.6)) * calm;

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    show(i) {
      if (i === current) return;
      current = i;
      bounce = 0.6;
    },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      observer.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
