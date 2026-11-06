import * as THREE from 'three';
import { cappStepUrl } from '../../cappApi';
import { loadStepFaces } from './dfmStepLoader';
import { getDfmSnapshot, setDfmSnapshot } from './dfmSnapshotStore';

// A picture of the part (ISO view, every issue coloured) without the viewer on screen: loads the
// STEP the same way the viewer does, paints faces from the /dfm categories, renders 900x600 offscreen.
// Resolves to a PNG data URL, or null on any failure or after `timeoutMs`.
const BASE = new THREE.Color(0xcfd5dd);

function render(meshes, dfm, width, height) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const cats = (dfm && Array.isArray(dfm.categories)) ? dfm.categories : [];
  const faceColor = new Map();
  const sevOrder = { block: 0, warn: 1, info: 2 };
  [...cats].sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3)).forEach((c) => {
    const col = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c.color || '').trim()) ? c.color.trim() : '#e5484d';
    (c.items || []).forEach(it => (it.face_indices || []).forEach((f) => { if (!faceColor.has(f)) faceColor.set(f, col); }));
  });
  let total = 0;
  meshes.forEach(md => { total += md.faces.length / 2; });
  const colourOn = dfm && Number.isInteger(dfm.face_count) && dfm.face_count === total;

  const c = new THREE.Color();
  let faceNo = 0;
  const bb = new THREE.Box3();
  meshes.forEach((md) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(md.pos), 3));
    if (md.nrm && md.nrm.length === md.pos.length) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(md.nrm), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(md.idx), 1));
    if (!g.attributes.normal) g.computeVertexNormals();
    const col = new Float32Array(md.pos.length);
    for (let k = 0; k < md.faces.length / 2; k += 1) {
      let v0 = Infinity; let v1 = -1;
      for (let tr = md.faces[2 * k]; tr <= md.faces[2 * k + 1]; tr += 1) {
        for (let j = 0; j < 3; j += 1) { const vi = md.idx[3 * tr + j]; if (vi < v0) v0 = vi; if (vi > v1) v1 = vi; }
      }
      if (colourOn && faceColor.has(faceNo)) c.set(faceColor.get(faceNo)); else c.copy(BASE);
      for (let v = v0; v <= v1; v += 1) { col[3 * v] = c.r; col[3 * v + 1] = c.g; col[3 * v + 2] = c.b; }
      faceNo += 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, metalness: 0.05, roughness: 0.68, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    root.add(mesh);
    root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x4f5d73, transparent: true, opacity: 0.32 })));
    bb.expandByObject(mesh);
  });
  if (bb.isEmpty()) return null;
  const sph = bb.getBoundingSphere(new THREE.Sphere());

  const camera = new THREE.PerspectiveCamera(35, width / height, sph.radius / 500, sph.radius * 200);
  camera.up.set(0, 0, 1);
  const fovV = THREE.MathUtils.degToRad(camera.fov);
  const dist = (sph.radius / Math.sin(fovV / 2)) * 1.08 * 0.72;
  camera.position.copy(sph.center).addScaledVector(new THREE.Vector3(1, -1, 0.8).normalize(), dist);
  camera.lookAt(sph.center);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.6, 0.8, 1);
  camera.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-1, -0.4, -0.6);
  camera.add(fill);

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0xeaf1fa, 1);
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  renderer.dispose();
  return url;
}

export async function ensureDfmSnapshot(jobId, dfm, { width = 900, height = 600, timeoutMs = 20000 } = {}) {
  const have = getDfmSnapshot(jobId);
  if (have) return have;
  try {
    const url = await Promise.race([
      loadStepFaces(cappStepUrl(jobId)).then(meshes => render(meshes, dfm, width, height)),
      new Promise(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (url) setDfmSnapshot(jobId, url);
    return url || null;
  } catch (e) {
    return null;
  }
}
