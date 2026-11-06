// In-memory store (per page load) for the DFM viewer's picture of a part and its size, so the quote
// PDF can use the image the viewer already rendered instead of loading the model a second time.
const snapshots = new Map(); // jobId -> PNG data URL
const sizes = new Map();     // jobId -> [x, y, z] in mm

export function setDfmSnapshot(jobId, dataUrl) {
  if (jobId && dataUrl) snapshots.set(jobId, dataUrl);
}

export function getDfmSnapshot(jobId) {
  return snapshots.get(jobId) || null;
}

export function setDfmSize(jobId, size) {
  if (jobId && Array.isArray(size) && size.length === 3) sizes.set(jobId, size);
}

export function getDfmSize(jobId) {
  return sizes.get(jobId) || null;
}
