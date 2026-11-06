// capp_service (the ShiaanX CAPP / v3 planning service, FastAPI). Separate from the production-flow
// API in ./api.js: no login, its own base URL. Used by the live-analysis panels (DFM, quote, reply
// assistant, tracking, CMM). Every value these panels show comes from here — on an error the error
// is shown, never fallback numbers.
export const CAPP_BASE = (process.env.REACT_APP_CAPP_API_URL || 'http://localhost:8001').replace(/\/+$/, '');
// Rohit's v3 console (shiaanx_v3_standalone/ui/server.py): the interface that drives PowerMill live.
export const V3_CONSOLE_URL = (process.env.REACT_APP_V3_CONSOLE_URL || 'http://localhost:8765').replace(/\/+$/, '');

// The v3 console and PowerMill live on the planning workstation, so the button that opens them is
// only offered when the app itself is served from this machine.
export const isLocalHost = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Opens the v3 console in a new tab, asking capp_service to start it first if it isn't running.
// The tab is opened synchronously inside the click so the browser doesn't treat it as a pop-up.
export async function openV3Console() {
  const w = window.open('', '_blank');
  if (w) w.document.write('<p style="font:16px system-ui;padding:24px">Starting the v3 console (drives PowerMill)…</p>');
  try {
    const res = await fetch(`${CAPP_BASE}/v3-console/ensure`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    const url = body.url || V3_CONSOLE_URL;
    if (!body.ready) throw new Error(`the console did not come up${body.log ? ` (log: ${body.log})` : ''}`);
    if (w) w.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    const msg = `Could not start the v3 console: ${e.message}. Is the part-analysis service (port 8001) running?`;
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
export const postReplyDraft = (id, { client_comment, topic, qty, material }) => request('POST', `/jobs/${id}/reply-draft`, { json: { client_comment, topic, qty, material } });
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
