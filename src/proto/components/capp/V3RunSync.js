import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CAPP_BASE } from '../../cappApi';
import { useProtoData } from '../../ProtoDataContext';

// Runs made in the planner console live on the planning laptop (its local part-analysis service,
// http://localhost:8001). This lets the shared app pick up the newest run for the part: it looks the
// runs up on the laptop, and "Use this run" publishes the run's summary to the app's own service so
// the program view and Approve use it. When the app itself runs on the laptop, that service already
// reads the runs directly, so the button only refreshes.
const LAPTOP = 'http://localhost:8001';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const same = (a, b) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
const isLocalApp = same(CAPP_BASE, LAPTOP) || same(CAPP_BASE, 'http://127.0.0.1:8001');
const fmtWhen = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };

async function getJson(url, ms = 2000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// What the app is showing now, in words.
function sourceText(live) {
  if (!live) return '';
  if (live.source_label) return live.source_label;
  const name = live.run_name || live.run;
  return name ? `planner run ${name}` : '';
}

export default function V3RunSync({ jobId, partName, live, onDone }) {
  const { me } = useProtoData();
  const [state, setState] = useState({ phase: 'checking', latest: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const check = useCallback(async () => {
    const key = norm(partName);
    try {
      const list = await getJson(`${LAPTOP}/v3/runs`);
      const mine = ((list && list.runs) || [])
        .filter(r => r.usable && key.length >= 4 && (r.part_key === key || r.part_key.includes(key) || key.includes(r.part_key)))
        .slice(0, 3);
      for (const r of mine) {
        const s = await getJson(`${LAPTOP}/v3/runs/${encodeURIComponent(r.name)}/summary`, 8000);
        if (s && s.summary) {
          const sm = s.summary;
          if (alive.current) setState({ phase: 'ok', latest: { run: r, summary: sm, n: (sm.toolpaths || []).length, minutes: sm.powermill_cutting_minutes_total } });
          return;
        }
      }
      if (alive.current) setState({ phase: 'ok', latest: null });
    } catch (e) {
      if (alive.current) setState({ phase: 'unreachable', latest: null });
    }
  }, [partName]);

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  const { phase, latest } = state;
  const current = sourceText(live);
  const upToDate = !!(latest && live && (live.run_name || live.run) === latest.run.name
    && live.powermill_cutting_minutes_total === latest.minutes
    && (live.toolpaths || []).length === latest.n
    && (!latest.summary.project_saved_at || live.project_saved_at === latest.summary.project_saved_at));

  const use = async () => {
    setMsg('');
    setBusy(true);
    try {
      if (!isLocalApp) {
        const by = (me && (me.name || me.email)) || 'Unknown user';
        const res = await fetch(`${CAPP_BASE}/jobs/${jobId}/program/publish`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: latest.summary, run_name: latest.run.name, published_by: by }),
        });
        if (!res.ok) {
          let d = '';
          try { const b = await res.json(); d = b && (b.detail || b.error); } catch (e) { /* no body */ }
          throw new Error(d ? String(d) : `The service answered ${res.status}`);
        }
      }
      if (onDone) onDone();
      await check();
      if (alive.current) setMsg(isLocalApp ? 'Refreshed.' : 'This run is now the one shown and approved.');
    } catch (e) {
      if (alive.current) setMsg(`Could not use this run: ${e.message || e}`);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (phase === 'checking') return current ? <div className="cell-sub" style={{ marginTop: 8 }} data-v3sync-source>Showing: {current}</div> : null;
  if (phase === 'unreachable') {
    if (isLocalApp && !current) return null;
    return (
      <div className="cell-sub" style={{ marginTop: 8, color: '#8a8f98' }} data-v3sync>
        {current ? <div data-v3sync-source>Showing: {current}</div> : null}
        {!isLocalApp && <div data-v3sync-unreachable>Planner runs from this laptop are not reachable.</div>}
      </div>
    );
  }
  if (!latest && !current) return null;
  return (
    <div style={{ marginTop: 10 }} data-v3sync>
      {latest && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span data-v3sync-latest>
            <b>Latest planner run:</b> {latest.run.name}, {fmtWhen(latest.run.updated || latest.run.started)}, {latest.n} toolpaths
          </span>
          <button type="button" className="btn btn-ghost" disabled={busy || (upToDate && !isLocalApp)} onClick={use} data-v3sync-use>
            {busy ? 'Working…' : upToDate && !isLocalApp ? 'In use' : isLocalApp ? 'Refresh' : 'Use this run'}
          </button>
        </div>
      )}
      {current && <div className="cell-sub" style={{ marginTop: 4 }} data-v3sync-source>Showing: {current}</div>}
      {msg && <div className="cell-sub" style={{ marginTop: 4 }} data-v3sync-msg>{msg}</div>}
    </div>
  );
}
