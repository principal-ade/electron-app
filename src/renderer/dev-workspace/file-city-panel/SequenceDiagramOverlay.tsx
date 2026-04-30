import React, { useState } from 'react';
import { SequenceDiagramRenderer } from '@principal-ai/principal-view-react';
import '@xyflow/react/dist/style.css';

import type { SequenceDiagramPayload } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const OVERLAY_HEIGHT_PCT = 50;
const COLLAPSE_MS = 320;

export interface SequenceDiagramOverlayProps {
  payload: SequenceDiagramPayload;
  selectedEventId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  onClose: () => void;
}

export const SequenceDiagramOverlay: React.FC<SequenceDiagramOverlayProps> = ({
  payload,
  selectedEventId,
  onNodeClick,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleNodeClick = (nodeId: string) => {
    onNodeClick(selectedEventId === nodeId ? null : nodeId);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${OVERLAY_HEIGHT_PCT}%`,
        transform: collapsed
          ? 'translateY(calc(100% - 36px))'
          : 'translateY(0)',
        transition: `transform ${COLLAPSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            color: '#e5e7eb',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {payload.title ?? 'Sequence Diagram'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={pillButtonStyle}
          >
            <span
              style={{
                display: 'inline-block',
                transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: `transform ${COLLAPSE_MS}ms ease`,
                fontSize: 13,
                lineHeight: 1,
              }}
            >
              ▲
            </span>
            <span>{collapsed ? 'Show' : 'Hide'}</span>
          </button>
          <button onClick={onClose} style={pillButtonStyle}>
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0b0f14',
          borderTop: '1px solid #1f2937',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: `opacity ${COLLAPSE_MS}ms ease`,
        }}
      >
        <SequenceDiagramRenderer
          events={payload.events}
          edges={payload.edges}
          width="100%"
          height="100%"
          showControls={false}
          showBackground={false}
          stickyHeaders
          selectedNodeId={selectedEventId ?? undefined}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};

const pillButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 14px',
  backgroundColor: 'rgba(17, 24, 39, 0.92)',
  border: '1px solid #374151',
  borderRadius: 999,
  color: '#e5e7eb',
  fontSize: 11,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
};
