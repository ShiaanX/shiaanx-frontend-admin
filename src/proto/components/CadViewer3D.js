import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// STEP/IGES viewer for the admin flow. Started from the legacy src/components/enquiry/CadViewer.js
// (occt-import-js + three.js; that file is left as it is for the old pages) and extended with:
// standard views + fit, display modes (shaded / shaded + edges / wireframe / transparent with an
// opacity slider), a bounding box with its X × Y × Z size in mm, and a two-point measure tool.
// The model is shown Z-up, as CAD/CAM uses it: Front looks along +Y, Top looks down -Z, Right
// looks along -X. A small test hook is exposed on window.__protoViewer.

const VIEWS = [
  ['iso', 'Iso', [1, -1, 0.8]],
  ['front', 'Front', [0, -1, 0]],
  ['top', 'Top', [0, -1e-4, 1]], // not exactly along the up axis, so orbiting stays well defined
  ['right', 'Right', [1, 0, 0]],
];
const MODES = [
  ['shaded', 'Shaded'],
  ['edges', 'Shaded + edges'],
  ['wire', 'Wireframe'],
  ['transparent', 'Transparent'],
];
const PART_COLOR = 0xb3bfcd;
const EDGE_COLOR = 0x243042;
const ACCENT = 0x2160b7;
const MEASURE_COLOR = 0xe0451f;

let occtPromise = null;
function loadOcct() {
  if (occtPromise) return occtPromise;
  const publicUrl = process.env.PUBLIC_URL || '';
  occtPromise = new Promise((resolve, reject) => {
    if (window.occtimportjs) { resolve(window.occtimportjs); return; }
    const script = document.createElement('script');
    script.src = `${publicUrl}/lib/occt/occt-import-js.js`;
    script.onload = () => resolve(window.occtimportjs);
    script.onerror = () => reject(new Error('Failed to load the CAD library'));
    document.head.appendChild(script);
  }).then(init => init({ locateFile: (p) => `${publicUrl}/lib/occt/${p}` }));
  occtPromise.catch(() => { occtPromise = null; });
  return occtPromise;
}

const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function CadViewer3D({ fileUrl, fileName, label }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const t = useRef({ meshes: [], edges: [], measureObjs: new Map(), labelEls: new Map(), pending: null, sphere: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('edges');
  const [opacity, setOpacity] = useState(0.35);
  const [showBox, setShowBox] = useState(false);
  const [boxSize, setBoxSize] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const [measures, setMeasures] = useState([]);
  const [pending, setPending] = useState(false);

  // ---- scene, render loop, resize ---------------------------------------------------------
  useEffect(() => {
    const s = t.current;
    const container = containerRef.current;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f7);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, -200, 160);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, 0.8, 1);
    camera.add(key); // the light follows the view, so every side reads well
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-1, -0.4, -0.6);
    camera.add(fill);

    const root = new THREE.Group();
    scene.add(root);
    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    Object.assign(s, { scene, camera, renderer, controls, root, measureGroup, tween: null });

    const tmp = new THREE.Vector3();
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
      renderer.render(scene, camera);
      // keep the measurement labels on their midpoints
      const cw = renderer.domElement.clientWidth;
      const ch = renderer.domElement.clientHeight;
      s.labelEls.forEach((el, id) => {
        const m = s.measureObjs.get(id);
        if (!el || !m) return;
        tmp.copy(m.mid).project(camera);
        const visible = tmp.z < 1 && tmp.z > -1;
        el.style.display = visible ? '' : 'none';
        el.style.left = `${(tmp.x * 0.5 + 0.5) * cw}px`;
        el.style.top = `${(-tmp.y * 0.5 + 0.5) * ch}px`;
      });
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const chh = container.clientHeight;
      if (!cw || !chh) return;
      camera.aspect = cw / chh;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, chh);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
      renderer.dispose();
    };
  }, []);

  // ---- camera ------------------------------------------------------------------------------
  const fitDistance = useCallback(() => {
    const { camera, sphere } = t.current;
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    return (sphere.radius / Math.sin(Math.min(fovV, fovH) / 2)) * 1.08;
  }, []);

  const moveCamera = useCallback((dir, animate = true) => {
    const s = t.current;
    if (!s.sphere) return;
    const d = new THREE.Vector3(...dir).normalize();
    const p1 = s.sphere.center.clone().addScaledVector(d, fitDistance());
    const c1 = s.sphere.center.clone();
    if (!animate) {
      s.tween = null;
      s.camera.position.copy(p1);
      s.controls.target.copy(c1);
      s.camera.lookAt(c1);
      s.controls.update();
      return;
    }
    s.controls.enabled = false;
    s.tween = { p0: s.camera.position.clone(), p1, c0: s.controls.target.clone(), c1, t0: performance.now(), dur: 380 };
  }, [fitDistance]);

  const setView = (dir) => moveCamera(dir);
  const fit = () => {
    const s = t.current;
    if (!s.sphere) return;
    const dir = s.camera.position.clone().sub(s.controls.target);
    if (dir.lengthSq() < 1e-9) dir.set(1, -1, 0.8);
    moveCamera(dir.toArray());
  };

  // ---- measurements ------------------------------------------------------------------------
  const clearPendingMarker = () => {
    const s = t.current;
    if (s.pending) {
      s.measureGroup.remove(s.pending.marker);
      s.pending.marker.geometry.dispose();
      s.pending.marker.material.dispose();
      s.pending = null;
    }
    setPending(false);
  };

  const makeMarker = (p) => {
    const r = (t.current.sphere ? t.current.sphere.radius : 50) * 0.014;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 12),
      new THREE.MeshBasicMaterial({ color: MEASURE_COLOR, depthTest: false }),
    );
    m.renderOrder = 999;
    m.position.copy(p);
    return m;
  };

  const clearMeasures = useCallback(() => {
    const s = t.current;
    s.measureObjs.forEach((m) => {
      s.measureGroup.remove(m.group);
      m.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    });
    s.measureObjs.clear();
    if (s.pending) {
      s.measureGroup.remove(s.pending.marker);
      s.pending.marker.geometry.dispose();
      s.pending.marker.material.dispose();
      s.pending = null;
    }
    setPending(false);
    setMeasures([]);
  }, []);

  const pickPoint = useCallback((clientX, clientY) => {
    const s = t.current;
    if (!s.meshes.length) return null;
    const rect = s.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, s.camera);
    const hits = ray.intersectObjects(s.meshes, false);
    return hits.length ? hits[0].point.clone() : null;
  }, []);

  const addPoint = (p) => {
    const s = t.current;
    if (!s.pending) {
      const marker = makeMarker(p);
      s.measureGroup.add(marker);
      s.pending = { p, marker };
      setPending(true);
      return;
    }
    const a = s.pending.p;
    const b = p;
    const group = new THREE.Group();
    group.add(s.pending.marker); // re-parents the first marker into this measurement
    group.add(makeMarker(b));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color: MEASURE_COLOR, depthTest: false }),
    );
    line.renderOrder = 998;
    group.add(line);
    s.measureGroup.add(group);
    s.pending = null;
    setPending(false);
    const id = `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    s.measureObjs.set(id, { group, mid });
    const m = {
      id,
      a: a.toArray(), b: b.toArray(),
      d: a.distanceTo(b),
      dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y), dz: Math.abs(b.z - a.z),
    };
    setMeasures(prev => [...prev, m]);
  };

  // a click (not a drag) in measure mode picks a point on the surface
  const down = useRef(null);
  const onPointerDown = (e) => { down.current = { x: e.clientX, y: e.clientY, b: e.button }; };
  const onPointerUp = (e) => {
    const d0 = down.current;
    down.current = null;
    if (!measuring || !d0 || d0.b !== 0) return;
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5) return;
    const p = pickPoint(e.clientX, e.clientY);
    if (p) addPoint(p);
  };

  useEffect(() => {
    if (!measuring) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMeasuring(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [measuring]);

  // leaving measure mode drops a half-picked point (finished measurements stay until Clear)
  useEffect(() => {
    if (!measuring) clearPendingMarker();
  }, [measuring]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- loading -----------------------------------------------------------------------------
  useEffect(() => {
    if (!fileUrl) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const occt = await loadOcct();
        const resp = await fetch(fileUrl);
        const buf = new Uint8Array(await resp.arrayBuffer());
        const ext = String(fileName || '').split('.').pop().toLowerCase();
        let result;
        if (ext === 'step' || ext === 'stp') result = occt.ReadStepFile(buf, null);
        else if (ext === 'iges' || ext === 'igs') result = occt.ReadIgesFile(buf, null);
        else throw new Error('Only STEP and IGES files can be shown in 3D');
        if (!result || !result.success) throw new Error((result && result.error) || 'The CAD file could not be read');
        if (cancelled) return;
        build(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('CAD load failed:', err);
        setError(err.message || String(err));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, fileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const build = (data) => {
    const s = t.current;
    clearMeasures();
    while (s.root.children.length) {
      const o = s.root.children[0];
      s.root.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
    s.meshes = [];
    s.edges = [];
    (data.meshes || []).forEach((md, index) => {
      const g = new THREE.BufferGeometry();
      if (md.attributes.position) g.setAttribute('position', new THREE.Float32BufferAttribute(md.attributes.position.array, 3));
      if (md.attributes.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(md.attributes.normal.array, 3));
      if (md.index) g.setIndex(new THREE.Uint32BufferAttribute(md.index.array, 1));
      if (!md.attributes.normal) g.computeVertexNormals();
      g.computeBoundingBox();
      const mat = new THREE.MeshStandardMaterial({
        color: PART_COLOR, metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.userData = { index };
      s.root.add(mesh);
      s.meshes.push(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true }));
      s.root.add(edge);
      s.edges.push(edge);
    });

    const box = new THREE.Box3();
    s.meshes.forEach(m => box.expandByObject(m));
    if (box.isEmpty()) box.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
    const size = box.getSize(new THREE.Vector3());
    s.box = box;
    s.sphere = box.getBoundingSphere(new THREE.Sphere());
    s.camera.near = Math.max(s.sphere.radius / 500, 0.01);
    s.camera.far = s.sphere.radius * 200;
    s.camera.updateProjectionMatrix();
    s.controls.minDistance = s.sphere.radius * 0.05;
    s.controls.maxDistance = s.sphere.radius * 40;

    if (s.boxHelper) {
      s.scene.remove(s.boxHelper);
      s.boxHelper.geometry.dispose();
      s.boxHelper.material.dispose();
    }
    s.boxHelper = new THREE.Box3Helper(box, ACCENT);
    s.boxHelper.visible = false;
    s.scene.add(s.boxHelper);
    setBoxSize([size.x, size.y, size.z]);
    moveCamera(VIEWS[0][2], false);
  };

  // ---- display mode / box ------------------------------------------------------------------
  useEffect(() => {
    const s = t.current;
    s.meshes.forEach((m) => {
      const mat = m.material;
      const transparent = mode === 'transparent';
      m.visible = mode !== 'wire';
      mat.transparent = transparent;
      mat.opacity = transparent ? opacity : 1;
      mat.depthWrite = !transparent;
      mat.needsUpdate = true;
    });
    s.edges.forEach((e) => {
      e.visible = mode !== 'shaded';
      e.material.opacity = mode === 'edges' ? 0.85 : mode === 'transparent' ? 0.7 : 1;
      e.material.color.setHex(mode === 'wire' ? 0x1f2a3a : EDGE_COLOR);
    });
  }, [mode, opacity, loading]);

  useEffect(() => {
    const s = t.current;
    if (s.boxHelper) s.boxHelper.visible = showBox;
  }, [showBox, loading]);

  // ---- test hook ---------------------------------------------------------------------------
  const live = useRef({});
  live.current = { measures, mode, opacity, showBox, measuring, boxSize, loading, error, pending };
  useEffect(() => {
    const hook = {
      state() {
        const s = t.current;
        const L = live.current;
        const mat = s.meshes[0] && s.meshes[0].material;
        return {
          ready: !L.loading && !L.error && s.meshes.length > 0,
          error: L.error,
          camera: s.camera ? s.camera.position.toArray() : null,
          target: s.controls ? s.controls.target.toArray() : null,
          boxSize: L.boxSize,
          boxVisible: !!(s.boxHelper && s.boxHelper.visible),
          mode: L.mode,
          opacity: mat ? mat.opacity : null,
          transparent: mat ? mat.transparent : null,
          measuring: L.measuring,
          pending: L.pending,
          measurements: L.measures.length,
          lastMeasurement: L.measures.length ? L.measures[L.measures.length - 1] : null,
          animating: !!s.tween,
        };
      },
      hitAt(x, y) { return !!pickPoint(x, y); },
    };
    window.__protoViewer = hook;
    return () => { if (window.__protoViewer === hook) delete window.__protoViewer; };
  }, [pickPoint]);

  const ready = !loading && !error;
  return (
    <div ref={containerRef} className={`cad3d-root ${measuring ? 'measuring' : ''}`} data-cad3d>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} />

      <div className="cad3d-bar">
        <div className="cad3d-group" role="group" aria-label="Views">
          {VIEWS.map(([id, name, dir]) => (
            <button type="button" key={id} disabled={!ready} onClick={() => setView(dir)} title={`${name} view`}>{name}</button>
          ))}
          <button type="button" disabled={!ready} onClick={fit} title="Fit the part in view">Fit</button>
        </div>
        <div className="cad3d-group" role="group" aria-label="Display">
          <select aria-label="Display mode" value={mode} onChange={e => setMode(e.target.value)} disabled={!ready}>
            {MODES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {mode === 'transparent' && (
            <>
              <input type="range" aria-label="Opacity" min="0.05" max="0.95" step="0.05" value={opacity}
                onChange={e => setOpacity(Number(e.target.value))} />
              <span className="cad3d-op">{Math.round(opacity * 100)}%</span>
            </>
          )}
        </div>
        <div className="cad3d-group" role="group" aria-label="Tools">
          <button type="button" className={showBox ? 'on' : ''} disabled={!ready} aria-pressed={showBox}
            onClick={() => setShowBox(v => !v)} title="Show the bounding box and its size">Bounding box</button>
          <button type="button" className={measuring ? 'on' : ''} disabled={!ready} aria-pressed={measuring}
            onClick={() => setMeasuring(v => !v)} title="Click two points on the part to measure (Esc to stop)">Measure</button>
          <button type="button" disabled={!measures.length && !pending} onClick={clearMeasures} title="Remove all measurements">Clear</button>
        </div>
      </div>

      {measures.map(m => (
        <div key={m.id} className="cad3d-label" data-measure ref={(el) => { if (el) t.current.labelEls.set(m.id, el); else t.current.labelEls.delete(m.id); }}>
          <b>{fmt(m.d)} mm</b><br />
          <span>dX {fmt(m.dx)} · dY {fmt(m.dy)} · dZ {fmt(m.dz)}</span>
        </div>
      ))}

      <div className="cad3d-foot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', minWidth: 0 }}>
          {showBox && boxSize && (
            <div className="cad3d-chip" data-box-size>
              X {fmt(boxSize[0])} × Y {fmt(boxSize[1])} × Z {fmt(boxSize[2])} mm
            </div>
          )}
          {label && <div className="cad3d-chip">{label}</div>}
        </div>
        {measuring && (
          <div className="cad3d-chip hint">{pending ? 'Click the second point' : 'Click two points on the part · Esc to stop'}</div>
        )}
      </div>

      {loading && !error && <div className="cad3d-overlay"><div className="aq-spinner" />Loading 3D model…</div>}
      {error && <div className="cad3d-overlay err">Could not show this model: {error}</div>}
    </div>
  );
}
