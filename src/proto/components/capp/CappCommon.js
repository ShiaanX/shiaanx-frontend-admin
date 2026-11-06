import React, { useCallback, useEffect, useRef, useState } from 'react';
import './capp.css';

export const POLL_MS = 3000;

// Loads one capp_service resource. While it answers {status:"running"} it asks again every 3 s.
// `key` changing starts over. Nothing is substituted on error: `error` holds the message.
export function useCappResource(fetcher, key, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled, running: false, progress: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);
  const timer = useRef(null);

  const load = useCallback(() => {
    clearTimeout(timer.current);
    const my = ++seq.current;
    setState(s => ({ ...s, loading: true, error: null }));
    const attempt = () => {
      fetcherRef.current().then((d) => {
        if (my !== seq.current) return;
        if (d && d.status === 'running') {
          setState({ data: null, error: null, loading: false, running: true, progress: d });
          timer.current = setTimeout(attempt, POLL_MS);
        } else {
          setState({ data: d, error: null, loading: false, running: false, progress: null });
        }
      }).catch((e) => {
        if (my !== seq.current) return;
        setState({ data: null, error: e.message || String(e), loading: false, running: false, progress: null });
      });
    };
    attempt();
  }, []);

  useEffect(() => {
    const seqBox = seq;
    const timerBox = timer;
    if (enabled) load();
    return () => { clearTimeout(timerBox.current); seqBox.current += 1; };
  }, [key, enabled, load]);

  return { ...state, reload: load };
}

export function fmtINR(v, digits = 0) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtNum(v, digits = 1) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits });
}
export function show(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.map(show).join(' · ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function Spinner() { return <div className="cx-spin" />; }

export function CappError({ message, onRetry }) {
  return (
    <div className="cx-err" role="alert">
      <b>Part-analysis service error</b>
      <pre>{message}</pre>
      {onRetry && <button type="button" className="btn-sm ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

// Loading / running / error for a useCappResource result; null once the data is in.
export function ResourceState({ res, runningText, onRetry }) {
  if (res.error) return <CappError message={res.error} onRetry={onRetry || res.reload} />;
  const ago = res.progress && res.progress.started_s_ago;
  if (res.loading || res.running) {
    return (
      <div className="cx-state">
        <Spinner />
        <div>
          <div>{res.running ? runningText : 'Loading…'}</div>
          {res.running && <div className="cx-sub">{ago ? `Started ${Math.round(ago)} s ago · ` : ''}checking again every {POLL_MS / 1000} s</div>}
        </div>
      </div>
    );
  }
  return null;
}
