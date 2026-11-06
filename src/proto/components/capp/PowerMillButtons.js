import React, { useCallback, useEffect, useRef, useState } from 'react';

// Opens the generated program in the PowerMill on the planning laptop (its local service,
// http://localhost:8001, from any page host) and lets the viewer step through its toolpaths there.
const LAPTOP = 'http://localhost:8001';

async function call(path, method = 'GET', body, ms = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${LAPTOP}${path}`, {
      method,
      signal: ctl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok && !(data && data.ok === false), data: data || {} };
  } finally {
    clearTimeout(timer);
  }
}

const errText = (r) => (r && r.data && r.data.error) || 'PowerMill did not respond.';

export default function PowerMillButtons() {
  const [reach, setReach] = useState('checking'); // checking | yes | no
  const [phase, setPhase] = useState('idle'); // idle | opening | open | calculating
  const [info, setInfo] = useState(null); // {project, toolpaths, names}
  const [index, setIndex] = useState(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    call('/v3/powermill/status', 'GET', null, 4000)
      .then(r => { if (alive.current) setReach(r.data && r.data.state !== undefined ? 'yes' : 'no'); })
      .catch(() => { if (alive.current) setReach('no'); });
  }, []);


  const open = async () => {
    setErr(''); setMsg(''); setPhase('opening');
    try {
      const r = await call('/v3/powermill/open-program', 'POST', {}, 360000);
      if (!alive.current) return;
      if (!r.ok) { setErr(errText(r)); setPhase('idle'); return; }
      setInfo({ project: r.data.project, count: r.data.toolpaths, names: r.data.toolpath_names || [] });
      setIndex(0);
      setPhase('open');
      setMsg(`Opened in PowerMill: ${r.data.toolpaths} toolpaths, ${(r.data.setups || []).length} setups.`);
    } catch (e) {
      if (!alive.current) return;
      setErr('PowerMill did not answer in time. If a window is open in PowerMill, click Cancel there.');
      setPhase('idle');
    }
  };

  const show = useCallback(async (i) => {
    if (!info || !info.names.length) return;
    const n = info.names.length;
    const next = ((i % n) + n) % n;
    setErr('');
    try {
      const r = await call('/v3/powermill/show-toolpath', 'POST', { name: info.names[next] });
      if (!alive.current) return;
      if (!r.ok) { setErr(errText(r)); return; }
      setIndex(next);
      setMsg(`Showing toolpath ${next + 1} of ${n}: ${info.names[next]}`);
    } catch (e) {
      if (alive.current) setErr('PowerMill did not answer. If a window is open there, click Cancel.');
    }
  }, [info]);

  const recalc = async () => {
    if (!info) return;
    setErr(''); setPhase('calculating'); setMsg(`Recalculating ${info.names[index]} in PowerMill. This can take up to a minute…`);
    try {
      const r = await call('/v3/powermill/recalculate', 'POST', { name: info.names[index] }, 180000);
      if (!alive.current) return;
      if (!r.ok) setErr(errText(r));
      else if (r.data.status === 'still_running') setMsg(r.data.message);
      else setMsg(`Recalculated ${info.names[index]} in ${r.data.seconds} s. Look at PowerMill.`);
    } catch (e) {
      if (alive.current) setErr('PowerMill did not answer. If a window is open there, click Cancel.');
    }
    if (alive.current) setPhase('open');
  };

  if (reach === 'no') {
    return (
      <div className="cell-sub" style={{ marginTop: 8, color: '#8a8f98' }} data-powermill>
        Opening the program in PowerMill works from the planning laptop only.
      </div>
    );
  }

  const isOpen = phase === 'open' || phase === 'calculating';
  return (
    <div style={{ marginTop: 10 }} data-powermill>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" disabled={phase === 'opening' || phase === 'calculating'} onClick={open} data-powermill-open>
          {phase === 'opening' ? 'Opening in PowerMill…' : 'Show the program in PowerMill'}
        </button>
        {isOpen && (
          <>
            <button type="button" className="btn btn-ghost" disabled={phase === 'calculating'} onClick={() => show(index - 1)} data-powermill-prev>Previous toolpath</button>
            <button type="button" className="btn btn-ghost" disabled={phase === 'calculating'} onClick={() => show(index + 1)} data-powermill-next>Next toolpath</button>
            <button type="button" className="btn btn-ghost" disabled={phase === 'calculating'} onClick={recalc} data-powermill-recalc>Recalculate this toolpath</button>
          </>
        )}
      </div>
      {msg && !err && <div className="cell-sub" style={{ marginTop: 4 }} data-powermill-msg>{msg}</div>}
      {err && <div className="cell-sub" style={{ marginTop: 4, color: '#b42318' }} data-powermill-error>{err}</div>}
    </div>
  );
}
