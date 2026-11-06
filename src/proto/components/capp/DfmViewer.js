import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FiChevronRight, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { cappStepUrl } from '../../cappApi';
import { loadStepFaces } from './dfmStepLoader';
import './dfmViewer.css';

// 3D DFM viewer: the job's STEP rendered with its B-rep faces coloured by DFM issue category, next to
// a category -> item -> detail tree. Everything shown comes from GET /jobs/{id}/dfm:
//   face_count, categories[{id,label,severity,color,why,items[{id,label,detail,measured,expected,face_indices,centroid_mm}]}]
// Face indices are TopExp_Explorer(shape, FACE) order, the same order occt-import-js emits brep_faces
// in (see dfmStepLoader.js). If the service's face_count differs from what loaded here, faces are NOT
// coloured — a wrong highlight is worse than none. Z-up, as CAD/CAM uses it (same as CadViewer3D).

const BASE = new THREE.Color(0xcfd5dd);
const DIM = new THREE.Color(0xe6e9ee);
const EDGE = 0x4f5d73;
const SEV_RANK = { block: 0, warn: 1, info: 2 };
const SEV_COLOR = { block: '#e5484d', warn: '#f59e0b', info: '#3b82f6', ok: '#10b981' };
const SEV_NAME = { block: 'Blocker', warn: 'Warning', info: 'Info' };
const VIEWS = [
  ['top', 'Top', [0, -1e-4, 1]],
  ['front', 'Front', [0, -1, 0]],
  ['iso', 'ISO', [1, -1, 0.8]],
];
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const isHex = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
const fmtVal = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k.replace(/_/g, ' ')} ${x}`).join(', ');
  return String(v);
};

// Normalises the response into tree categories (items with faces) and part-level notes (no faces).
function buildModel(d) {
  const raw = Array.isArray(d && d.categories) ? d.categories : null;
  const cats = [];
  const notes = [];
  (raw || []).forEach((c, ci) => {
    const severity = SEV_RANK[c.severity] !== undefined ? c.severity : 'info';
    const cat = {
      ci, id: c.id || `cat${ci}`, label: c.label || c.id || 'Issue', severity,
      color: isHex(c.color) ? c.color.trim() : SEV_COLOR[severity], why: c.why || '', items: [],
    };
    (c.items || []).forEach((it, ii) => {
      const faces = (it.face_indices || []).filter(n => Number.isInteger(n) && n >= 0);
      const measured = fmtVal(it.measured);
      const expected = fmtVal(it.expected);
      const detail = it.detail || [expected && `Expected ${expected}`, measured && `Actual ${measured}`].filter(Boolean).join(', ');
      const item = { key: `${ci}:${ii}`, label: it.label || it.id || cat.label, detail, faces, cat };
      if (faces.length) cat.items.push(item); else notes.push(item);
    });
    if (cat.items.length) cats.push(cat);
  });
  cats.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  if (!raw) {
    // Older service without face-level categories: the findings are still real, show them as notes.
    (d.findings || []).forEach((f, i) => {
      const severity = f.severity === 'block' ? 'block' : f.severity === 'warn' ? 'warn' : 'info';
      if (f.severity === 'ok') return;
      notes.push({ key: `f${i}`, label: f.title, detail: f.detail, faces: [], cat: { label: SEV_NAME[severity], severity, color: SEV_COLOR[severity] } });
    });
  }
  const itemsByKey = new Map();
  const faceItems = new Map();
  let maxFace = -1;
  cats.forEach(c => c.items.forEach((it) => {
    itemsByKey.set(it.key, it);
    it.faces.forEach((f) => {
      maxFace = Math.max(maxFace, f);
      if (!faceItems.has(f)) faceItems.set(f, []);
      faceItems.get(f).push(it);
    });
  }));
  // a face in several categories takes the most severe category's colour (cats are sorted)
  const faceColor = new Map();
  cats.forEach(c => c.items.forEach(it => it.faces.forEach((f) => { if (!faceColor.has(f)) faceColor.set(f, c.color); })));
  const faceTotal = cats.reduce((n, c) => n + c.items.length, 0);
  return { cats, notes, hasCategories: !!raw, itemsByKey, faceItems, faceColor, maxFace, faceTotal };
}

export default function DfmViewer({ jobId, dfm }) {
  const model = useMemo(() => buildModel(dfm), [dfm]);
  const viewRef = useRef(null);
  const canvasRef = useRef(null);
  const tipRef = useRef(null);
  const treeRef = useRef(null);
  const t = useRef({ meshes: [], edges: [], faces: [], triFace: [], sphere: null, tween: null, hover: null });

  const [geo, setGeo] = useState({ loading: true, error: null, faces: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const [sel, setSel] = useState(null); // {kind:'item',key} | {kind:'cat',ci} | {kind:'pick',keys,face}
  const [open, setOpen] = useState(() => new Set());
  const [hoverFace, setHoverFace] = useState(null);

  // ---- parity --------------------------------------------------------------------------------
  const fc = dfm ? dfm.face_count : undefined;
  let parity = 'none';
  if (model.faceTotal > 0 && geo.faces !== null) {
    if (!Number.isInteger(fc)) parity = 'unknown';
    else if (fc !== geo.faces || model.maxFace >= geo.faces) parity = 'mismatch';
    else parity = 'ok';
  }
  const colourOn = parity === 'ok';

  // categories open by default: all of them when the tree is short, else only the first
  useEffect(() => {
    const short = model.faceTotal <= 12;
    setOpen(new Set(model.cats.filter((c, i) => short || i === 0).map(c => c.ci)));
    setSel(null);
  }, [model]);

  // ---- selection -> faces + colours ---------------------------------------------------------
  const selKeys = useMemo(() => {
    if (!sel) return new Set();
    if (sel.kind === 'item') return new Set([sel.key]);
    if (sel.kind === 'pick') return new Set(sel.keys);
    const c = model.cats.find(x => x.ci === sel.ci);
    return new Set(c ? c.items.map(i => i.key) : []);
  }, [sel, model]);

  const selFaces = useMemo(() => {
    const m = new Map();
    selKeys.forEach((k) => {
      const it = model.itemsByKey.get(k);
      if (it) it.faces.forEach((f) => { if (!m.has(f)) m.set(f, it.cat.color); });
    });
    return m;
  }, [selKeys, model]);

  // ---- scene ---------------------------------------------------------------------------------
  useEffect(() => {
    const s = t.current;
    const box = viewRef.current;
    const w = box.clientWidth || 600;
    const h = box.clientHeight || 400;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, -200, 160);
    scene.add(camera);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(w, h);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(0.6, 0.8, 1);
    camera.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-1, -0.4, -0.6);
    camera.add(fill);
    const root = new THREE.Group();
    scene.add(root);
    Object.assign(s, { scene, camera, renderer, controls, root, raycaster: new THREE.Raycaster() });

    let raf = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (s.tween) {
        const k = Math.min(1, (now - s.tween.t0) / s.tween.dur);
        const e = ease(k);
        camera.position.lerpVectors(s.tween.p0, s.tween.p1, e);
        controls.target.lerpVectors(s.tween.c0, s.tween.c1, e);
        camera.lookAt(controls.target);
        if (k >= 1) { s.tween = null; controls.enabled = true; }
      }
      if (!s.tween) controls.update();
      if (s.hover && s.hover.dirty && s.onHover) { s.hover.dirty = false; s.onHover(); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      if (!cw || !ch) return;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
      renderer.dispose();
      s.meshes = [];
      s.edges = [];
    };
  }, []);

  // ---- camera --------------------------------------------------------------------------------
  // `tight` < 1 for the whole part: its bounding sphere is much larger than the part's silhouette
  // (long thin parts especially), so a full-sphere fit leaves the part small in frame.
  const distFor = useCallback((radius, tight = 1) => {
    const { camera } = t.current;
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    return (radius / Math.sin(Math.min(fovV, fovH) / 2)) * 1.08 * tight;
  }, []);

  const flyTo = useCallback((center, radius, dir, animate = true, tight = 1) => {
    const s = t.current;
    const d = dir.clone().normalize();
    const p1 = center.clone().addScaledVector(d, distFor(radius, tight));
    if (!animate) {
      s.tween = null;
      s.camera.position.copy(p1);
      s.controls.target.copy(center);
      s.camera.lookAt(center);
      s.controls.update();
      return;
    }
    s.controls.enabled = false;
    s.tween = { p0: s.camera.position.clone(), p1, c0: s.controls.target.clone(), c1: center.clone(), t0: performance.now(), dur: 450 };
  }, [distFor]);

  const curDir = () => {
    const s = t.current;
    const d = s.camera.position.clone().sub(s.controls.target);
    return d.lengthSq() < 1e-9 ? new THREE.Vector3(1, -1, 0.8) : d.normalize();
  };
  const PART_FIT = 0.72;
  const setView = (dir) => { const s = t.current; if (s.sphere) flyTo(s.sphere.center, s.sphere.radius, new THREE.Vector3(...dir), true, PART_FIT); };
  const fit = () => { const s = t.current; if (s.sphere) flyTo(s.sphere.center, s.sphere.radius, curDir(), true, PART_FIT); };

  // bounding box + area-weighted normal of a set of faces
  const faceBounds = useCallback((faceIdxs) => {
    const s = t.current;
    const bb = new THREE.Box3();
    const n = new THREE.Vector3();
    let nAbs = 0;
    const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
    const u = new THREE.Vector3(); const v = new THREE.Vector3();
    faceIdxs.forEach((fi) => {
      const f = s.faces[fi];
      if (!f || f.t1 < f.t0) return;
      const g = s.meshes[f.m].geometry;
      const P = g.attributes.position.array;
      const I = g.index.array;
      for (let tr = f.t0; tr <= f.t1; tr += 1) {
        a.fromArray(P, 3 * I[3 * tr]); b.fromArray(P, 3 * I[3 * tr + 1]); c.fromArray(P, 3 * I[3 * tr + 2]);
        bb.expandByPoint(a); bb.expandByPoint(b); bb.expandByPoint(c);
        u.subVectors(b, a).cross(v.subVectors(c, a));
        n.add(u);
        nAbs += u.length();
      }
    });
    return { bb, n, nAbs };
  }, []);

  const frameFaces = useCallback((faceIdxs) => {
    const s = t.current;
    if (!s.sphere || !faceIdxs.length) return;
    const { bb, n, nAbs } = faceBounds(faceIdxs);
    if (bb.isEmpty()) return;
    const sph = bb.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sph.radius * 1.5, s.sphere.radius * 0.2);
    const cur = curDir();
    // Look along the faces' mean outward normal when it is consistent (|sum n| / sum |n| high:
    // floors, walls), blended with the current view so the move is not disorienting. Holes and
    // fillets average to ~0, so they keep the current view direction.
    let dir = cur;
    if (nAbs > 1e-12 && n.length() / nAbs > 0.5) dir = n.clone().normalize().add(cur.clone().multiplyScalar(0.7)).normalize();
    flyTo(sph.center, radius, dir);
  }, [faceBounds, flyTo]);

  // ---- geometry --------------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setGeo({ loading: true, error: null, faces: null });
    loadStepFaces(cappStepUrl(jobId)).then((meshes) => {
      if (cancelled) return;
      const s = t.current;
      while (s.root.children.length) {
        const o = s.root.children[0];
        s.root.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      }
      s.meshes = []; s.edges = []; s.faces = []; s.triFace = [];
      meshes.forEach((md, mi) => {
        const g = new THREE.BufferGeometry();
        // copies: the cached arrays are shared with any other viewer instance
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(md.pos), 3));
        if (md.nrm && md.nrm.length === md.pos.length) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(md.nrm), 3));
        g.setIndex(new THREE.BufferAttribute(new Uint32Array(md.idx), 1));
        if (!g.attributes.normal) g.computeVertexNormals();
        const col = new Float32Array(md.pos.length);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeBoundingBox();
        g.computeBoundingSphere();
        const triCount = md.idx.length / 3;
        const triFace = new Int32Array(triCount).fill(-1);
        const I = md.idx;
        for (let k = 0; k < md.faces.length / 2; k += 1) {
          const t0 = md.faces[2 * k];
          const t1 = md.faces[2 * k + 1];
          let v0 = Infinity; let v1 = -1;
          for (let tr = t0; tr <= t1; tr += 1) {
            triFace[tr] = s.faces.length;
            for (let j = 0; j < 3; j += 1) { const vi = I[3 * tr + j]; if (vi < v0) v0 = vi; if (vi > v1) v1 = vi; }
          }
          s.faces.push({ m: mi, t0, t1, v0: v1 >= 0 ? v0 : 0, v1 });
        }
        s.triFace.push(triFace);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, vertexColors: true, metalness: 0.05, roughness: 0.68, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        });
        const mesh = new THREE.Mesh(g, mat);
        mesh.userData.mi = mi;
        s.root.add(mesh);
        s.meshes.push(mesh);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.32 }));
        s.root.add(edge);
        s.edges.push(edge);
      });
      const bb = new THREE.Box3();
      s.meshes.forEach(m => bb.expandByObject(m));
      if (bb.isEmpty()) bb.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
      s.sphere = bb.getBoundingSphere(new THREE.Sphere());
      s.camera.near = Math.max(s.sphere.radius / 500, 0.01);
      s.camera.far = s.sphere.radius * 200;
      s.camera.updateProjectionMatrix();
      s.controls.minDistance = s.sphere.radius * 0.05;
      s.controls.maxDistance = s.sphere.radius * 40;
      flyTo(s.sphere.center, s.sphere.radius, new THREE.Vector3(...VIEWS[2][2]), false, 0.72);
      setGeo({ loading: false, error: null, faces: s.faces.length });
    }).catch((e) => {
      if (cancelled) return;
      console.error('DFM viewer: STEP load failed', e);
      setGeo({ loading: false, error: e.message || String(e), faces: null });
    });
    return () => { cancelled = true; };
  }, [jobId, reloadKey, flyTo]);

  // ---- paint ------------------------------------------------------------------------------------
  useEffect(() => {
    const s = t.current;
    if (geo.faces === null || !s.meshes.length) return;
    const c = new THREE.Color();
    const hasSel = colourOn && selFaces.size > 0;
    s.faces.forEach((f, fi) => {
      if (f.v1 < 0) return;
      if (!colourOn) c.copy(BASE);
      else if (hasSel) { if (selFaces.has(fi)) c.set(selFaces.get(fi)); else c.copy(DIM); }
      else if (showAll && model.faceColor.has(fi)) c.set(model.faceColor.get(fi));
      else c.copy(BASE);
      const arr = s.meshes[f.m].geometry.attributes.color.array;
      for (let v = f.v0; v <= f.v1; v += 1) { arr[3 * v] = c.r; arr[3 * v + 1] = c.g; arr[3 * v + 2] = c.b; }
    });
    s.meshes.forEach((m) => { m.geometry.attributes.color.needsUpdate = true; });
    s.edges.forEach((e) => { e.material.opacity = hasSel ? 0.2 : 0.32; });
  }, [geo.faces, colourOn, selFaces, showAll, model]);

  // frame the camera when an item or a category is chosen in the tree (not on a click on the model)
  useEffect(() => {
    if (!sel || sel.kind === 'pick' || !colourOn) return;
    frameFaces([...selFaces.keys()]);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- picking ------------------------------------------------------------------------------------
  const pickFace = useCallback((clientX, clientY) => {
    const s = t.current;
    if (!s.meshes.length) return null;
    const rect = s.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    s.raycaster.setFromCamera(ndc, s.camera);
    const hits = s.raycaster.intersectObjects(s.meshes, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const fi = s.triFace[hit.object.userData.mi][hit.faceIndex];
    return fi >= 0 ? fi : null;
  }, []);

  const live = useRef({});
  live.current = { model, colourOn };

  useEffect(() => {
    const s = t.current;
    s.onHover = () => {
      const h = s.hover;
      if (!h || h.out) { setHoverFace(null); return; }
      const fi = pickFace(h.x, h.y);
      const { model: m, colourOn: on } = live.current;
      const face = on && fi !== null && m.faceItems.has(fi) ? fi : null;
      setHoverFace(face);
      if (canvasRef.current) canvasRef.current.style.cursor = face !== null ? 'pointer' : '';
    };
  }, [pickFace]);

  const down = useRef(null);
  const onPointerDown = (e) => { down.current = { x: e.clientX, y: e.clientY, b: e.button }; };
  const onPointerMove = (e) => {
    const s = t.current;
    if (e.buttons) { if (s.hover) s.hover.out = true; setHoverFace(null); return; }
    s.hover = { x: e.clientX, y: e.clientY, dirty: true };
    const tip = tipRef.current;
    if (tip && viewRef.current) {
      const r = viewRef.current.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const flip = x > r.width * 0.6;
      tip.style.transform = `translate(${flip ? x - 14 : x + 14}px, ${y + 16}px) translateX(${flip ? '-100%' : '0'})`;
    }
  };
  const onPointerLeave = () => { t.current.hover = { out: true, dirty: true }; setHoverFace(null); };

  const scrollToKey = (key) => {
    requestAnimationFrame(() => {
      const tree = treeRef.current;
      const el = tree && tree.querySelector(`[data-key="${key}"]`);
      if (!el) return;
      const tr = tree.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      if (er.top < tr.top + 8 || er.bottom > tr.bottom - 8) {
        tree.scrollTo({ top: tree.scrollTop + (er.top - tr.top) - tr.height / 3, behavior: 'smooth' });
      }
    });
  };

  const onPointerUp = (e) => {
    const d0 = down.current;
    down.current = null;
    if (!d0 || d0.b !== 0 || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5) return;
    const fi = pickFace(e.clientX, e.clientY);
    const items = colourOn && fi !== null ? model.faceItems.get(fi) : null;
    if (!items || !items.length) { setSel(null); return; }
    setSel({ kind: 'pick', keys: items.map(i => i.key), face: fi });
    setOpen(prev => new Set([...prev, ...items.map(i => i.cat.ci)]));
    scrollToKey(items[0].key);
  };

  // ---- tree actions -------------------------------------------------------------------------------
  const clickCat = (c) => {
    const isSel = sel && sel.kind === 'cat' && sel.ci === c.ci;
    const isOpen = open.has(c.ci);
    if (isSel && isOpen) {
      setOpen((prev) => { const n = new Set(prev); n.delete(c.ci); return n; });
      setSel(null);
      return;
    }
    setOpen(prev => new Set([...prev, c.ci]));
    setSel({ kind: 'cat', ci: c.ci });
  };
  const toggleCat = (c, e) => {
    e.stopPropagation();
    setOpen((prev) => { const n = new Set(prev); if (n.has(c.ci)) n.delete(c.ci); else n.add(c.ci); return n; });
  };
  const clickItem = (it) => {
    if (sel && sel.kind === 'item' && sel.key === it.key) { setSel(null); return; }
    setSel({ kind: 'item', key: it.key });
  };
  const reset = () => { setSel(null); fit(); };

  // ---- test hook ------------------------------------------------------------------------------------
  const hookState = useRef({});
  hookState.current = { geo, parity, sel, selFaces, showAll, fc };
  useEffect(() => {
    const hook = {
      state() {
        const s = t.current;
        const L = hookState.current;
        return {
          ready: !L.geo.loading && !L.geo.error && L.geo.faces !== null,
          error: L.geo.error, loadedFaces: L.geo.faces, faceCount: L.fc, parity: L.parity,
          selection: L.sel, highlightedFaces: L.selFaces.size, showAll: L.showAll,
          camera: s.camera ? s.camera.position.toArray() : null,
          target: s.controls ? s.controls.target.toArray() : null,
          animating: !!s.tween,
        };
      },
      // screen point (client px) of a face's centre, for driving clicks in tests
      faceScreenPoint(fi) {
        const s = t.current;
        const { bb } = faceBounds([fi]);
        if (bb.isEmpty()) return null;
        const p = bb.getCenter(new THREE.Vector3()).project(s.camera);
        const r = s.renderer.domElement.getBoundingClientRect();
        return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
      },
      faceAt(x, y) { return pickFace(x, y); },
    };
    window.__dfmViewer = hook;
    return () => { if (window.__dfmViewer === hook) delete window.__dfmViewer; };
  }, [faceBounds, pickFace]);

  // ---- render --------------------------------------------------------------------------------------
  const ready = !geo.loading && !geo.error;
  const hoverItems = hoverFace !== null ? (model.faceItems.get(hoverFace) || []) : [];

  return (
    <div className="dv" data-dfm-viewer>
      <div className="dv-view" ref={viewRef}>
        <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} />

        <div className="dv-bar">
          <div className="dv-grp" role="group" aria-label="Views">
            {VIEWS.map(([id, name, dir]) => (
              <button type="button" key={id} disabled={!ready} onClick={() => setView(dir)}>{name}</button>
            ))}
            <button type="button" disabled={!ready} onClick={fit} title="Fit the whole part in view">Fit</button>
          </div>
          {model.faceTotal > 0 && (
            <div className="dv-grp" role="group" aria-label="Issues">
              <button type="button" className={showAll ? 'on' : ''} aria-pressed={showAll} disabled={!ready || !colourOn}
                onClick={() => setShowAll(v => !v)} title="Colour every face that has an issue">
                <span className={`dv-check ${showAll ? 'on' : ''}`} /> Show all issues
              </button>
              <button type="button" disabled={!ready || (!sel)} onClick={reset} title="Clear the selection and fit the part">Reset</button>
            </div>
          )}
        </div>

        <div ref={tipRef} className="dv-tip" style={{ display: hoverItems.length ? '' : 'none' }}>
          {hoverItems.slice(0, 4).map(it => (
            <div key={it.key} className="dv-tip-row"><span className="dv-sw" style={{ background: it.cat.color }} />{it.label}</div>
          ))}
          {hoverItems.length > 4 && <div className="dv-tip-more">+{hoverItems.length - 4} more</div>}
        </div>

        {ready && (parity === 'mismatch' || parity === 'unknown') && (
          <div className="dv-warn" role="alert" data-dfm-parity={parity}>
            <FiAlertTriangle size={15} />
            <span>
              {parity === 'mismatch'
                ? `Face numbering mismatch: the analysis counted ${fc} faces, the 3D model loaded ${geo.faces}. Issue colouring is off so nothing is marked in the wrong place.`
                : 'The analysis did not report a face count, so face numbering cannot be checked. Issue colouring is off.'}
            </span>
          </div>
        )}

        {geo.loading && <div className="dv-overlay"><div className="cx-spin" /><div><b>Loading 3D model…</b><div className="dv-sub">Reading the STEP file and building the faces</div></div></div>}
        {geo.error && (
          <div className="dv-overlay err">
            <div>
              <b>Could not show the 3D model</b>
              <div className="dv-sub">{geo.error}</div>
              <button type="button" className="btn-sm ghost" style={{ marginTop: 8 }} onClick={() => setReloadKey(k => k + 1)}>Retry</button>
            </div>
          </div>
        )}
      </div>

      <div className="dv-side">
        <div className="dv-side-h">
          <span>Issues on the part</span>
          {model.faceTotal > 0 && <span className="dv-count">{model.faceTotal}</span>}
        </div>
        <div className="dv-tree" ref={treeRef}>
          {!model.hasCategories && (
            <div className="dv-empty">This analysis has no face-level issue data, so nothing is marked on the model. The planner's findings are listed below.</div>
          )}
          {model.hasCategories && model.cats.length === 0 && (
            <div className="dv-empty">No face-level issues found.</div>
          )}
          {model.cats.map((c) => {
            const isOpen = open.has(c.ci);
            const catSel = sel && sel.kind === 'cat' && sel.ci === c.ci;
            return (
              <div key={c.ci} className={`dv-cat ${catSel ? 'sel' : ''}`}>
                <div className="dv-cat-h" role="button" tabIndex={0} onClick={() => clickCat(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickCat(c); } }}>
                  <button type="button" className={`dv-chev ${isOpen ? 'open' : ''}`} aria-label={isOpen ? 'Collapse' : 'Expand'} onClick={e => toggleCat(c, e)}><FiChevronRight size={15} /></button>
                  <span className="dv-sw lg" style={{ background: c.color }} />
                  <span className="dv-cat-l">{c.label}</span>
                  <span className={`dv-sev ${c.severity}`}>{SEV_NAME[c.severity]}</span>
                  <span className="dv-n">{c.items.length}</span>
                </div>
                {isOpen && c.why && <div className="dv-why">{c.why}</div>}
                {isOpen && c.items.map((it) => {
                  const on = selKeys.has(it.key);
                  return (
                    <div key={it.key} data-key={it.key} className={`dv-item ${on ? 'sel' : ''}`} style={on ? { '--c': c.color } : undefined}
                      role="button" tabIndex={0} onClick={() => clickItem(it)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickItem(it); } }}>
                      <div className="dv-item-l">{it.label}</div>
                      {on && (it.detail || it.faces.length) && (
                        <div className="dv-item-d">
                          {it.detail && <div>{it.detail}</div>}
                          <div className="dv-faces">{it.faces.length} face{it.faces.length === 1 ? '' : 's'}{!colourOn ? ' · not shown (face numbering unchecked)' : ''}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {model.notes.length > 0 && (
            <div className="dv-notes">
              <div className="dv-notes-h"><FiInfo size={13} /> Part-level notes</div>
              {model.notes.map(n => (
                <div key={n.key} className="dv-note">
                  <span className="dv-sw" style={{ background: n.cat.color }} />
                  <div>
                    <div className="dv-note-l">{n.label}</div>
                    {n.detail && <div className="dv-note-d">{n.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
