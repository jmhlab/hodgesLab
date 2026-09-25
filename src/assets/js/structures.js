/* ==========================================================================
   Live crystal structures.
   Any element with class "structure" and data-structure="<file>.json" becomes
   a slowly rotating 3D model, built from the group's own CIF data
   (see tools/build_structures.py). Models load only when scrolled into view
   and pause when off-screen, so the page stays light.

   data- attributes: view (c|a|b|oblique|c-tilt|a-tilt|b-tilt), ortho (true/false),
   spin (rad/s-ish), alpha (polyhedra opacity), scale ("Cs:0.5,K:0.8"),
   cell (0/1 draw unit cell), fit (zoom factor, 1 = fit whole model).
   ========================================================================== */
import * as THREE from 'three';

const COLORS = {
  Hf: 0x8fa3b8, Ti: 0x9ec1c9, Si: 0x8899a8, Cu: 0xd98b3f, Fe: 0xb8552f, Zr: 0x8fa3b8, Nb: 0x9aa9b8, Mo: 0x8f9bb0, V: 0x9db3c4,
  S: 0xf2d16b, Se: 0xf0a63a, Te: 0xc9a77a, O: 0xe8e4dc, Cl: 0xb6e0a8, Br: 0xc8927a, I: 0xb08bc9,
  K: 0x8e7cc3, Cs: 0x7d6fb0, Na: 0xa89ed6, Ba: 0x6b8f71, Rb: 0x8e7cc3, Sr: 0x7f9c86, Ca: 0x7f9c86, Li: 0xa89ed6,
};
const RADII = { Hf: 0.62, Ti: 0.55, Si: 0.45, Cu: 0.55, Fe: 0.55, S: 0.50, Se: 0.55, Te: 0.62, O: 0.36, K: 0.8, Cs: 0.95, Na: 0.7, Ba: 0.9, Rb: 0.85, Sr: 0.85 };
const ANIONS = new Set(['O', 'S', 'Se', 'Te', 'Cl', 'Br', 'I']);
const BASE = new URL('../structures/', import.meta.url).href;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
const cylGeo = new THREE.CylinderGeometry(0.085, 0.085, 1, 10, 1, false);
cylGeo.translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);
const cache = new Map();

async function loadData(file) {
  if (!cache.has(file)) cache.set(file, fetch(BASE + file).then(r => r.json()));
  return cache.get(file);
}

function buildGroup(data, opts) {
  const group = new THREE.Group();
  const scale = {};
  for (const pair of (opts.scale || '').split(',').filter(Boolean)) { const [el, f] = pair.split(':'); scale[el] = parseFloat(f); }
  const polys = data.polyhedra || [];
  const centres = new Set(polys.map(p => p.center));
  const verts = new Set(polys.flatMap(p => p.verts));
  const dummy = new THREE.Object3D();

  // atoms (a partially occupied site, occupancy < 0.9, is drawn as a translucent ghost)
  const occ = data.occupancy || [];
  const ghost = i => (occ[i] ?? 1) < 0.9;
  const byEl = {};
  data.elements.forEach((el, i) => { if (!centres.has(i)) (byEl[el + (ghost(i) ? '~' : '')] ??= []).push(i); });
  for (const [key, idx] of Object.entries(byEl)) {
    const el = key.replace('~', ''); const isGhost = key.endsWith('~');
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[el] ?? 0xaaaaaa, roughness: 0.45, metalness: 0.15, transparent: isGhost, opacity: isGhost ? 0.38 : 1, depthWrite: !isGhost });
    mat.userData.baseOpacity = isGhost ? 0.38 : 1;
    const mesh = new THREE.InstancedMesh(sphereGeo, mat, idx.length);
    const r = (RADII[el] ?? 0.5) * (scale[el] ?? 1);
    idx.forEach((i, k) => {
      const p = data.positions[i];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.setScalar((verts.has(i) || (polys.length && ANIONS.has(el))) ? Math.min(r, 0.24) : r);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    group.add(mesh);
  }

  // bonds, half per atom so each half takes its atom's colour
  const halves = {};
  for (const [a, b] of data.bonds) for (const [f, t] of [[a, b], [b, a]]) (halves[data.elements[f]] ??= []).push([f, t]);
  for (const [el, list] of Object.entries(halves)) {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS[el] ?? 0xaaaaaa).multiplyScalar(0.85), roughness: 0.6, metalness: 0.1 });
    mat.userData.baseOpacity = 1;
    const mesh = new THREE.InstancedMesh(cylGeo, mat, list.length);
    list.forEach(([f, t], k) => {
      const p = new THREE.Vector3(...data.positions[f]);
      const dir = new THREE.Vector3(...data.positions[t]).sub(p);
      const len = dir.length() / 2;
      dummy.position.copy(p);
      dummy.quaternion.setFromUnitVectors(UP, dir.normalize());
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    group.add(mesh);
  }

  // coordination polyhedra
  const alpha = opts.alpha ?? 0.85;
  for (const poly of polys) {
    const vs = poly.verts.map(v => new THREE.Vector3(...data.positions[v]));
    const c = new THREE.Vector3(...data.positions[poly.center]);
    const pos = [];
    for (const f of poly.faces) {
      const [a, b, d] = f.map(k => vs[k]);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
      const tri = new THREE.Vector3().subVectors(a, c).dot(n) > 0 ? [a, b, d] : [a, d, b];
      for (const p of tri) pos.push(p.x, p.y, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const col = new THREE.Color(COLORS[poly.el] ?? 0xaaaaaa);
    const pm = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, metalness: 0.05, transparent: alpha < 1, opacity: alpha, flatShading: true, side: THREE.DoubleSide, clearcoat: 0.3 });
    pm.userData.baseOpacity = alpha;
    group.add(new THREE.Mesh(geo, pm));
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(0.45) })));
  }

  // unit cell
  if (opts.cell) {
    const [a, b, c] = data.cell.map(v => new THREE.Vector3(...v));
    const o = new THREE.Vector3(...data.cellOrigin);
    const corners = [];
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) corners.push(o.clone().addScaledVector(a, i).addScaledVector(b, j).addScaledVector(c, k));
    const edges = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
    const pts = []; for (const [i, j] of edges) pts.push(corners[i], corners[j]);
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf0a63a, transparent: true, opacity: 0.45 })));
  }
  return group;
}

const VIEWS = {
  c: [0, 0, 0], a: [0, Math.PI / 2, 0], b: [Math.PI / 2, 0, 0],
  'a-tilt': [-0.25, Math.PI / 2 + 0.35, 0], 'b-tilt': [Math.PI / 2 - 0.3, 0.35, 0], 'c-tilt': [-0.3, 0.3, 0],
  oblique: [-0.35, 0.55, 0.05],
};

async function mount(el) {
  const opts = {
    file: el.dataset.structure, view: el.dataset.view || 'oblique',
    ortho: el.dataset.ortho === 'true', spin: parseFloat(el.dataset.spin ?? '0.08'),
    alpha: parseFloat(el.dataset.alpha ?? '0.85'), scale: el.dataset.scale || '',
    cell: el.dataset.cell === '1', fit: parseFloat(el.dataset.fit ?? '1'),
  };
  const data = await loadData(opts.file);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const group = buildGroup(data, opts);
  scene.add(group);

  // Optional second phase: data-structure-alt="<file>.json" crossfades between the two.
  // data-labels="293 K|90 K" names them; data-hold / data-fade are seconds.
  let alt = null, label = null;
  if (el.dataset.structureAlt) {  // empty string = no alternate
    const altData = await loadData(el.dataset.structureAlt);
    alt = buildGroup(altData, opts);
    alt.visible = false;
    group.add(alt);            // shares the parent's rotation
    const names = (el.dataset.labels || `${data.label || 'A'}|${altData.label || 'B'}`).split('|');
    label = el.dataset.labelTarget ? document.querySelector(el.dataset.labelTarget) : null;
    if (!label) { label = document.createElement('div'); label.className = 'structure-label'; el.appendChild(label); }
    label.textContent = names[0];
    alt.userData.names = names;
  }
  function setFade(g, f) {   // f: 0 hidden .. 1 shown
    g.visible = f > 0.001;
    g.traverse(o => { if (o.material) { const m = o.material; m.transparent = true; m.opacity = (m.userData.baseOpacity ?? 1) * f; } });
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1d21, 0.55));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6); key.position.set(20, 30, 25); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb4d8, 0.5); fill.position.set(-30, -10, 10); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf0a63a, 0.5); rim.position.set(0, -20, -30); scene.add(rim);

  const box = new THREE.Box3();
  for (const p of data.positions) box.expandByPoint(new THREE.Vector3(...p));
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62 / opts.fit;

  const camera = opts.ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000) : new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
  const dist = opts.ortho ? radius * 6 : radius / Math.tan((32 * Math.PI) / 360) * 1.05;
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
  if (!opts.ortho) scene.fog = new THREE.Fog(0x1a1d21, dist + radius * 0.2, dist + radius * 2.4);

  // base orientation, then a slow turn about the vertical screen axis
  const base = new THREE.Euler(...(VIEWS[opts.view] || VIEWS.oblique));
  const baseQ = new THREE.Quaternion().setFromEuler(base);
  const spinAxis = new THREE.Vector3(0, 1, 0);
  // for axis views spin about the viewing axis instead so the projection stays true
  const axisView = ['a', 'b', 'c'].includes(opts.view);
  group.quaternion.copy(baseQ);

  function resize() {
    const w = el.clientWidth || 300, h = el.clientHeight || 200;
    renderer.setSize(w, h, false);
    const asp = w / h;
    if (opts.ortho) { const hh = radius * 1.08; camera.left = -hh * asp; camera.right = hh * asp; camera.top = hh; camera.bottom = -hh; }
    else camera.aspect = asp;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(el);

  let running = false, last = performance.now(), angle = 0;
  const tmpQ = new THREE.Quaternion();
  const hold = parseFloat(el.dataset.hold ?? '4'), fadeT = parseFloat(el.dataset.fade ?? '1.2');
  let phaseT = 0;
  function frame(now) {
    if (!running) return;
    const raw = (now - last) / 1000; last = now;
    const dt = Math.min(raw, 0.1);
    if (!reduceMotion) angle += opts.spin * dt;
    if (alt) {
      phaseT = (phaseT + Math.min(raw, 0.5)) % (2 * (hold + fadeT));
      // 0..hold: A; hold..hold+fade: A->B; ..2hold+fade: B; then B->A
      let f;
      if (phaseT < hold) f = 0;
      else if (phaseT < hold + fadeT) f = (phaseT - hold) / fadeT;
      else if (phaseT < 2 * hold + fadeT) f = 1;
      else f = 1 - (phaseT - 2 * hold - fadeT) / fadeT;
      const s = f * f * (3 - 2 * f);   // ease
      // fade the primary's children (not the alt group nested inside it)
      group.children.forEach(o => { if (o !== alt) { if (o.material) { const m = o.material; m.transparent = true; m.opacity = (m.userData.baseOpacity ?? 1) * (1 - s); } } });
      setFade(alt, s);
      if (label) label.textContent = alt.userData.names[s < 0.5 ? 0 : 1];
    }
    if (axisView) { tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle); group.quaternion.copy(tmpQ).multiply(baseQ); }
    else { tmpQ.setFromAxisAngle(spinAxis, angle); group.quaternion.copy(tmpQ).multiply(baseQ); }
    renderer.render(scene, camera);
    if (reduceMotion) { running = false; return; }
    requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!e.isIntersecting) running = false;
    }
  }, { rootMargin: '100px' });
  io.observe(el);
  renderer.render(scene, camera);   // first frame even if off-screen
  el.classList.add('is-ready');
}

// Load lazily as each container approaches the viewport.
const pending = new IntersectionObserver((entries, obs) => {
  for (const e of entries) if (e.isIntersecting) { obs.unobserve(e.target); mount(e.target).catch(err => console.warn('structure failed', e.target.dataset.structure, err)); }
}, { rootMargin: '600px' });
document.querySelectorAll('.structure[data-structure]').forEach(el => pending.observe(el));
