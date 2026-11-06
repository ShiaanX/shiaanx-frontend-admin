// Loads a capp_service job's STEP file into per-B-rep-face triangle ranges for the DFM viewer.
//
// occt-import-js returns meshes[] (one per solid / free shell), each with `brep_faces: [{first,last}]`
// (triangle ranges, one entry per face, empty ranges included) in TopExp_Explorer(shape, FACE) order.
// The global face index is the running count across meshes, which is how capp_service numbers
// `face_indices` (checked against pythonOCC on Motor Mount: 1096/1096 faces, same order).
//
// Parsing a large part takes several seconds, so it runs in a Web Worker built from a blob that loads
// the same public/lib/occt build CadViewer3D uses; if workers are unavailable it falls back to the
// main thread. Results are cached per URL for the session so re-opening the tab is instant.

const cache = new Map();

function libBase() {
  const publicUrl = process.env.PUBLIC_URL || '';
  return new URL(`${publicUrl}/lib/occt/`, window.location.href).href;
}

// Converts an occt-import-js result into transferable typed arrays.
// (WORKER_SRC below carries the same logic in plain ES5, so a build step cannot alter it.)
function packResult(r) {
  const meshes = (r.meshes || []).map((m) => {
    const pos = Float32Array.from(m.attributes.position.array);
    const nrm = m.attributes.normal ? Float32Array.from(m.attributes.normal.array) : null;
    const idx = Uint32Array.from(m.index.array);
    const bf = m.brep_faces || [];
    const faces = new Int32Array(bf.length * 2);
    for (let i = 0; i < bf.length; i += 1) { faces[2 * i] = bf[i].first; faces[2 * i + 1] = bf[i].last; }
    return { pos, nrm, idx, faces };
  });
  return meshes;
}

const WORKER_SRC = `
function packResult(r) {
  return (r.meshes || []).map(function (m) {
    var bf = m.brep_faces || [];
    var faces = new Int32Array(bf.length * 2);
    for (var i = 0; i < bf.length; i++) { faces[2 * i] = bf[i].first; faces[2 * i + 1] = bf[i].last; }
    return {
      pos: Float32Array.from(m.attributes.position.array),
      nrm: m.attributes.normal ? Float32Array.from(m.attributes.normal.array) : null,
      idx: Uint32Array.from(m.index.array),
      faces: faces
    };
  });
}
self.onmessage = function (e) {
  var d = e.data;
  try {
    importScripts(d.base + 'occt-import-js.js');
    self.occtimportjs({ locateFile: function (p) { return d.base + p; } }).then(function (occt) {
      var r = occt.ReadStepFile(new Uint8Array(d.buf), null);
      if (!r || !r.success) { self.postMessage({ ok: false, error: (r && r.error) || 'The STEP file could not be read' }); return; }
      var meshes = packResult(r);
      var transfer = [];
      meshes.forEach(function (m) { transfer.push(m.pos.buffer, m.idx.buffer, m.faces.buffer); if (m.nrm) transfer.push(m.nrm.buffer); });
      self.postMessage({ ok: true, meshes: meshes }, transfer);
    }, function (err) { self.postMessage({ ok: false, worker: true, error: String((err && err.message) || err) }); });
  } catch (err) { self.postMessage({ ok: false, worker: true, error: String((err && err.message) || err) }); }
};`;

function parseInWorker(buf) {
  return new Promise((resolve, reject) => {
    let worker;
    let url;
    try {
      url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      reject(Object.assign(new Error('worker unavailable'), { worker: true }));
      return;
    }
    const done = () => { worker.terminate(); URL.revokeObjectURL(url); };
    worker.onmessage = (e) => {
      done();
      if (e.data.ok) resolve(e.data.meshes);
      else reject(Object.assign(new Error(e.data.error), { worker: !!e.data.worker }));
    };
    worker.onerror = (e) => { done(); reject(Object.assign(new Error(e.message || 'worker failed'), { worker: true })); };
    worker.postMessage({ base: libBase(), buf }, [buf]);
  });
}

let occtMain = null;
function loadOcctMain() {
  if (occtMain) return occtMain;
  const base = libBase();
  occtMain = new Promise((resolve, reject) => {
    if (window.occtimportjs) { resolve(window.occtimportjs); return; }
    const s = document.createElement('script');
    s.src = `${base}occt-import-js.js`;
    s.onload = () => resolve(window.occtimportjs);
    s.onerror = () => reject(new Error('Failed to load the CAD library'));
    document.head.appendChild(s);
  }).then(init => init({ locateFile: p => `${base}${p}` }));
  occtMain.catch(() => { occtMain = null; });
  return occtMain;
}

async function parseOnMain(buf) {
  const occt = await loadOcctMain();
  const r = occt.ReadStepFile(new Uint8Array(buf), null);
  if (!r || !r.success) throw new Error((r && r.error) || 'The STEP file could not be read');
  return packResult(r);
}

async function fetchAndParse(url) {
  let resp;
  try { resp = await fetch(url); } catch (e) { throw new Error('Could not download the STEP file from the part-analysis service'); }
  if (!resp.ok) throw new Error(`The part-analysis service answered ${resp.status} for the STEP file`);
  const buf = await resp.arrayBuffer();
  const copy = buf.slice(0); // the worker takes ownership of `buf`; keep a copy for the fallback
  try {
    return await parseInWorker(buf);
  } catch (e) {
    if (!e.worker) throw e;
    console.warn('DFM viewer: worker parse failed, parsing on the main thread:', e.message);
    return parseOnMain(copy);
  }
}

// Resolves to [{pos: Float32Array, nrm: Float32Array|null, idx: Uint32Array, faces: Int32Array(first,last pairs)}]
export function loadStepFaces(url) {
  if (!cache.has(url)) {
    const p = fetchAndParse(url);
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return cache.get(url);
}
