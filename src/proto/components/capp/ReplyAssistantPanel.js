import React, { useState } from 'react';
import { FiLock, FiCopy } from 'react-icons/fi';
import { postReplyDraft } from '../../cappApi';
import { CappError, Spinner, show } from './CappCommon';
import { cappMaterialOf } from './CappJobRunner';

const TOPICS = [['price', 'Price'], ['lead_time', 'Lead time'], ['tolerance', 'Tolerance'], ['finish', 'Surface finish']];

// Internal tool: drafts a reply to a client comment, grounded on this job's quote / DFM / plan.
// POST /jobs/{id}/reply-draft. Nothing is sent anywhere — the team copies the draft.
export default function ReplyAssistantPanel({ jobId, part }) {
  const [comment, setComment] = useState('');
  const [topic, setTopic] = useState('price');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [errFacts, setErrFacts] = useState([]);

  const run = async () => {
    setBusy(true); setError(''); setCopied(false); setErrFacts([]);
    try {
      const qty = part && Number(part.qty) > 0 ? Number(part.qty) : undefined;
      const material = part ? cappMaterialOf(part.material) : undefined;
      const out = await postReplyDraft(jobId, { client_comment: comment.trim(), topic, qty, material });
      setResult(out); setDraft((out && out.draft) || '');
    } catch (e) {
      setResult(null); setDraft(''); setError(e.message || String(e));
      setErrFacts((e.body && Array.isArray(e.body.grounded_on)) ? e.body.grounded_on : []);
    }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); } catch (e) { setError('Could not copy — select the text and copy it instead.'); }
  };

  return (
    <div className="cx" data-capp-reply>
      <div className="cx-internal"><FiLock size={15} /> Paste the client's follow-up comment. AI drafts our reply from this job's quote, DFM and drawing (internal: the team reviews before sending)</div>
      <div className="field">
        <label>Client feedback / comment</label>
        <textarea rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Paste what the client wrote, e.g. “Your price is higher than our current vendor — can you do better?”" />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Topic</label>
          <select value={topic} onChange={e => setTopic(e.target.value)}>
            {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <button type="button" className="btn px-btn-primary" disabled={busy || !comment.trim()} onClick={run}>{busy ? 'Drafting…' : 'Draft reply with AI'}</button>
      </div>

      {busy && <div className="cx-state" style={{ marginTop: 14 }}><Spinner /> Drafting from this job's quote, DFM and plan…</div>}
      {error && (/HTTP 402|credits are depleted/i.test(error)
        ? <div className="stub-note" style={{ marginTop: 14, marginBottom: 0 }} data-reply-credits><div><b>AI drafting is paused: the Gemini API account is out of prepaid credits.</b><div style={{ marginTop: 4 }}>Top up the Gemini key to get a draft. The facts the draft is grounded on are below.</div></div></div>
        : <div style={{ marginTop: 14 }}><CappError message={error} /></div>)}
      {error && errFacts.length > 0 && (
        <>
          <div className="cx-sec">Facts the draft would have been grounded on</div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>{errFacts.map((g, i) => <li key={i}>{show(g)}</li>)}</ul>
        </>
      )}

      {result && !busy && (
        <>
          <div className="cx-sec" style={{ marginTop: 18 }}>
            <span>Draft — edit before sending</span>
            {result.model && <span className="cx-src">model: {result.model}</span>}
          </div>
          <div className="field"><textarea rows={10} value={draft} onChange={e => { setDraft(e.target.value); setCopied(false); }} style={{ lineHeight: 1.55 }} /></div>
          <button type="button" className="btn-sm ghost" style={{ marginTop: 8 }} onClick={copy}><FiCopy size={12} /> {copied ? 'Copied' : 'Copy draft'}</button>
          {(result.grounded_on || []).length > 0 && (
            <>
              <div className="cx-sec">Grounded on</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                {result.grounded_on.map((g, i) => <li key={i}>{show(g)}</li>)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
