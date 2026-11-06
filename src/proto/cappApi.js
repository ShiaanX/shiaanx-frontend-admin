// capp_service (the ShiaanX CAPP / v3 planning service, FastAPI). Separate from the production-flow
// API in ./api.js: no login, its own base URL. Used by the live-analysis panels (DFM, quote, reply
// assistant, tracking, CMM). Every value these panels show comes from here — on an error the error
// is shown, never fallback numbers.
export const CAPP_BASE = (process.env.REACT_APP_CAPP_API_URL || 'http://localhost:8001').replace(/\/+$/, '');
// Rohit's v3 console (shiaanx_v3_standalone/ui/server.py): the interface that drives PowerMill live.
export const V3_CONSOLE_URL = (process.env.REACT_APP_V3_CONSOLE_URL || 'http://localhost:8765').replace(/\/+$/, '');

// The planner console and PowerMill live on the planning laptop. isLocalHost tells whether this page
// is served from that laptop itself (then the local part-analysis service can start the console).
export const isLocalHost = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const CONSOLE_HELP = 'The planner console runs on the planning laptop. If it does not open, start it with start_v3_console.bat.';

// Opens the ShiaanX planner console (PowerMill) in a new tab. On localhost, capp_service is asked to
// start it first if it isn't running. On any other host (e.g. dev.shiaanx.com) it simply opens
// http://localhost:8765: the browser on the planning laptop reaches the laptop's own console.
// The tab is opened synchronously inside the click so the browser doesn't treat it as a pop-up.
export async function openV3Console() {
  if (!isLocalHost()) { window.open(V3_CONSOLE_URL, '_blank'); return; }
  const w = window.open('', '_blank');
  if (w) w.document.write('<p style="font:16px system-ui;padding:24px">Starting the planner console (PowerMill)…</p>');
  try {
    const res = await fetch(`${CAPP_BASE}/v3-console/ensure`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    const url = body.url || V3_CONSOLE_URL;
    if (!body.ready) throw new Error(`the console did not come up${body.log ? ` (log: ${body.log})` : ''}`);
    if (w) w.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    const msg = `Could not start the planner console: ${e.message}. Is the part-analysis service (port 8001) running?`;
    if (w) w.document.body.innerHTML = `<p style="font:16px system-ui;padding:24px;color:#b00020">${msg}</p>`;
    else console.error(msg);
  }
}

function messageFrom(body, status) {
  if (body) {
    if (typeof body === 'string' && body.trim()) return body;
    const detail = body.detail ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)) : '';
    if (body.error) return detail ? `${body.error}: ${detail}` : String(body.error);
    if (detail) return detail;
  }
  return `Part-analysis service answered ${status}`;
}

async function request(method, path, { json, form, params } = {}) {
  const qs = params
    ? '?' + Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const headers = {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${CAPP_BASE}${path}${qs}`, { method, headers, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  } catch (e) {
    throw new Error(`Could not reach the part-analysis service at ${CAPP_BASE}. Is it running?`);
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  if (!res.ok) {
    const err = new Error(messageFrom(body, res.status));
    err.status = res.status;
    err.body = body; // e.g. reply-draft errors still carry grounded_on
    throw err;
  }
  return body;
}

// Starts the live pipeline on a STEP file. Returns { job_id }.
export function createCappJob(file, fileName, partName, material) {
  const form = new FormData();
  form.append('step_file', file, fileName || file.name || 'part.step');
  form.append('part_name', partName || 'Part');
  form.append('material', material || 'aluminium');
  return request('POST', '/jobs', { form });
}

export const getCappJob = (id) => request('GET', `/jobs/${id}`);
export const getDfm = (id, { retry } = {}) => request('GET', `/jobs/${id}/dfm`, { params: retry ? { retry: 'true' } : undefined });
export const getQuote = (id, { qty, material } = {}) => request('GET', `/jobs/${id}/quote`, { params: { qty, material } });
// A comment can raise several topics, so no topic is sent; the draft answers each one raised.
export const postReplyDraft = (id, { client_comment, qty, material }) => request('POST', `/jobs/${id}/reply-draft`, { json: { client_comment, qty, material } });
export const getTracking = (id) => request('GET', `/jobs/${id}/tracking`);
export const getCmm = (id) => request('GET', `/jobs/${id}/cmm`);
// The job's original STEP file, as uploaded (used by the DFM 3D viewer).
export const cappStepUrl = (id) => `${CAPP_BASE}/jobs/${id}/step`;

// Process plan & CAM program (AI, v3) for a job: the plan, the live PowerMill program when there is
// one, and whether it has been approved. Answers {status:"running"} while it is being worked out.
export const getProgram = (id) => request('GET', `/jobs/${id}/program`);
export const approveProgram = (id, by) => request('POST', `/jobs/${id}/program/approve`, { json: { by } });
export const programImageUrl = (id, name) => `${CAPP_BASE}/jobs/${id}/program/image/${encodeURIComponent(name)}`;
// Real past batches of this part (machine, program, QC result).
export const getProductionHistory = (id) => request('GET', `/jobs/${id}/production-history`);

// The client quote PDF (price, terms, DFM summary). Resolves to a Blob. The service recomputes the
// quote and the DFM review from the job; only `edits` (price, lead time, terms, notes) comes from here.
export async function postQuotePdf(id, body) {
  let res;
  try {
    res = await fetch(`${CAPP_BASE}/jobs/${id}/quote-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`Could not reach the part-analysis service at ${CAPP_BASE}. Is it running?`);
  }
  if (!res.ok) {
    const text = await res.text();
    let b = null;
    try { b = JSON.parse(text); } catch (e) { b = text; }
    throw new Error(messageFrom(b, res.status));
  }
  return res.blob();
}

