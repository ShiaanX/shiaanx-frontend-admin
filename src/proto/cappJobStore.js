import { useEffect, useState } from 'react';

// Which capp_service job belongs to which part (keyed by the part's tmpl id). A convenience cache in
// this browser only (localStorage) — the job itself lives in capp_service. Shared by every panel
// through a tiny subscribe/notify so running the analysis in one place updates the others.
const KEY = 'sx_capp_jobs_v1';
const listeners = new Set();

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
}

export function getCappJobFor(partKey) {
  return partKey ? readAll()[partKey] || null : null;
}

export function setCappJobFor(partKey, entry) {
  const all = readAll();
  if (entry) all[partKey] = { ...entry, at: new Date().toISOString() };
  else delete all[partKey];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage blocked: in-memory only */ }
  listeners.forEach(fn => fn(partKey));
}

export const partKeyOf = (part) => (part ? part.tmpl || part.uuid || part.name : null);

// { entry: {jobId, fileName, at} | null, setEntry }
export function useCappJob(partKey) {
  const [entry, setEntry] = useState(() => getCappJobFor(partKey));
  useEffect(() => {
    setEntry(getCappJobFor(partKey));
    const fn = (k) => { if (k === partKey) setEntry(getCappJobFor(partKey)); };
    listeners.add(fn);
    const onStorage = (e) => { if (e.key === KEY) setEntry(getCappJobFor(partKey)); };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
  }, [partKey]);
  return { entry, setEntry: (e) => setCappJobFor(partKey, e) };
}
