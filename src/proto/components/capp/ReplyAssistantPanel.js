import React, { useState } from 'react';
import { FiLock, FiCopy } from 'react-icons/fi';
import { postReplyDraft } from '../../cappApi';
import { CappError, Spinner } from './CappCommon';
import { cappMaterialOf } from './CappJobRunner';

// Internal tool: drafts a reply to a client comment, grounded on this job's quote / DFM / plan.
// POST /jobs/{id}/reply-draft. Nothing is sent anywhere — the team copies the draft.
export default function ReplyAssistantPanel({ jobId, part }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setBusy(true); setError(''); setCopied(false);
    try {
      const qty = part && Number(part.qty) > 0 ? Number(part.qty) : undefined;
      const material = part ? cappMaterialOf(part.material) : undefined;
      const out = await postReplyDraft(jobId, { client_comment: comment.trim(), qty, material });
      setResult(out); setDraft((out && out.draft) || '');
    } catch (e) {
      setResult(null); setDraft(''); setError(e.message || String(e));
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
        <div className="cell-sub" style={{ flex: 1 }}>One comment can raise several points (price, lead time, tolerance, finish). The draft answers each in turn.</div>
        <button type="button" className="btn px-btn-primary" disabled={busy || !comment.trim()} onClick={run}>{busy ? 'Drafting…' : 'Draft reply with AI'}</button>
      </div>

      {busy && <div className="cx-state" style={{ marginTop: 14 }}><Spinner /> Drafting from this job's quote, DFM and plan…</div>}
      {error && (/HTTP 402|credits are depleted/i.test(error)
        ? <div className="stub-note" style={{ marginTop: 14, marginBottom: 0 }} data-reply-credits><div><b>AI drafting is paused: the Gemini API account is out of prepaid credits.</b><div style={{ marginTop: 4 }}>Top up the Gemini key to get a draft.</div></div></div>
        : <div style={{ marginTop: 14 }}><CappError message={error} /></div>)}
      {result && !busy && (
        <>
          <div className="cx-sec" style={{ marginTop: 18 }}>
            <span>Draft — edit before sending</span>
            {result.model && <span className="cx-src">model: {result.model}</span>}
          </div>
          <div className="field"><textarea rows={10} value={draft} onChange={e => { setDraft(e.target.value); setCopied(false); }} style={{ lineHeight: 1.55 }} /></div>
          <button type="button" className="btn-sm ghost" style={{ marginTop: 8 }} onClick={copy}><FiCopy size={12} /> {copied ? 'Copied' : 'Copy draft'}</button>
        </>
      )}
    </div>
  );
}
