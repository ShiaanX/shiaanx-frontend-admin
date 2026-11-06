import React, { useEffect, useState } from 'react';
import QcView3D from './QcView3D';
import { useProtoData } from '../ProtoDataContext';
import { hasPartQcSheet, getPartQcSheet } from '../cappApi';

// "QC - 3D view" at the bottom of the order page, for one ordered part. Same view as the Inspection
// page; when the part has no QC sheet yet and the server holds a prepared one, offers it in one click.
function PartQc({ row, part, index }) {
  const { artifactState, markArtifactDone, openFile, fetchFile, patchPartLibrary, partLibrary } = useProtoData();
  const docs = artifactState[row.orderId] || artifactState[row.id] || {};
  const uploaded = docs[`p${index}.inspReport`] || (index === 0 ? docs.inspReport : null);
  const reportKey = uploaded && uploaded.fileKey;
  const balloonDoc = docs[`p${index}.balloon`] || (index === 0 ? docs.inspPlan : null);
  const balloonKey = (balloonDoc && balloonDoc.fileKey) || null;
  const linked = part.tmpl ? (partLibrary[part.tmpl] || {}).qcJobId || null : null;

  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    let dead = false;
    if (reportKey || linked) { setPrepared(false); return undefined; }
    hasPartQcSheet(part.name).then(d => { if (!dead) setPrepared(!!(d && d.available)); }).catch(() => { if (!dead) setPrepared(false); });
    return () => { dead = true; };
  }, [part.name, reportKey, linked]);

  if (!part.tmpl) return null;
  // Uploads the prepared sheet as the part's Inspection report document (as the Upload button does)
  // and hands it to the 3D view's set-up step.
  const earlier = prepared ? async () => {
    const { blob, name } = await getPartQcSheet(part.name);
    const file = new File([blob], name, { type: blob.type });
    await markArtifactDone(row.orderId, `p${index}.inspReport`, { src: 'human', file });
    return { blob: file, name };
  } : undefined;
  return (
    <QcView3D compact part={part} linkedJob={linked} reportKey={reportKey} balloonKey={balloonKey}
      openFile={openFile} fetchFile={fetchFile} earlier={earlier}
      onLink={(jobId) => patchPartLibrary(part.tmpl, { qcJobId: jobId })} />
  );
}

export default function OrderQcSection({ row, parts }) {
  return <>{parts.map(p => <PartQc key={p.tmpl || p.name} row={row} part={p} index={row.parts.indexOf(p)} />)}</>;
}
