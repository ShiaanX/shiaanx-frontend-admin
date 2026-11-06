import React from 'react';
import QcView3D from './QcView3D';
import { useProtoData } from '../ProtoDataContext';

// "QC - 3D view" at the bottom of the order page, for one ordered part. Same view as the Inspection page.
// The QC sheet is the document on the job's Inspection report line; once it is there the view builds
// itself (autoSetup) and every measurement shows on the 3D part.
function PartQc({ row, part, index }) {
  const { artifactState, openFile, fetchFile, patchPartLibrary, partLibrary } = useProtoData();
  const docs = artifactState[row.orderId] || artifactState[row.id] || {};
  const uploaded = docs[`p${index}.inspReport`] || (index === 0 ? docs.inspReport : null);
  const reportKey = uploaded && uploaded.fileKey;
  const balloonDoc = docs[`p${index}.balloon`] || (index === 0 ? docs.inspPlan : null);
  const balloonKey = (balloonDoc && balloonDoc.fileKey) || null;
  const linked = part.tmpl ? (partLibrary[part.tmpl] || {}).qcJobId || null : null;

  if (!part.tmpl) return null;
  return (
    <QcView3D compact autoSetup part={part} linkedJob={linked} reportKey={reportKey} balloonKey={balloonKey}
      openFile={openFile} fetchFile={fetchFile}
      onLink={(jobId) => patchPartLibrary(part.tmpl, { qcJobId: jobId })} />
  );
}

export default function OrderQcSection({ row, parts }) {
  return <>{parts.map(p => <PartQc key={p.tmpl || p.name} row={row} part={p} index={row.parts.indexOf(p)} />)}</>;
}
