import React from 'react';
import Icon from '../icons';

export default function Modal({ title, maxWidth, onClose, children, footer }) {
  return (
    <div className="px-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="px-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
