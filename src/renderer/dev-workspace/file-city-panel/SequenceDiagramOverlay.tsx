import React, { useState } from 'react';
import { SequenceDiagramRenderer } from '@principal-ai/principal-view-react';
import '@xyflow/react/dist/style.css';

import type { SequenceDiagramPayload } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const COLLAPSE_MS = 320;
const RESIZE_HANDLE_HEIGHT = 6;
const MIN_HEIGHT_PCT = 20;
const MAX_HEIGHT_PCT = 85;

export interface SequenceDiagramOverlayProps {
  payload: SequenceDiagramPayload;
  selectedEventId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  onClose: () => void;
  /** Drawer height as a percentage of the panel height. */
  heightPct: number;
  /** Called as the user drags the top edge to resize. */
  onHeightChange: (pct: number) => void;
}

export const SequenceDiagramOverlay: React.FC<SequenceDiagramOverlayProps> = ({
  payload,
  selectedEventId,
  onNodeClick,
  onClose,
  heightPct,
  onHeightChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<
    { startY: number; startPct: number; parentHeight: number } | null
  >(null);

  const handleResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || collapsed) return;
      const parent = containerRef.current?.parentElement;
      const parentHeight = parent?.clientHeight ?? window.innerHeight;
      e.preventDefault();
      dragStateRef.current = {
        startY: e.clientY,
        startPct: heightPct,
        parentHeight,
      };
      setIsResizing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [collapsed, heightPct],
  );

  const handleResizePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      // Drawer is anchored to `bottom: 0`, so dragging *up* should grow it
      // — flip the sign on `dy` when converting to a percent delta.
      const dy = e.clientY - drag.startY;
      const deltaPct = (-dy / drag.parentHeight) * 100;
      const next = Math.min(
        MAX_HEIGHT_PCT,
        Math.max(MIN_HEIGHT_PCT, drag.startPct + deltaPct),
      );
      onHeightChange(next);
    },
    [onHeightChange],
  );

  const handleResizePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      setIsResizing(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  const handleNodeClick = (nodeId: string) => {
    onNodeClick(selectedEventId === nodeId ? null : nodeId);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${heightPct}%`,
        transform: collapsed
          ? 'translateY(calc(100% - 36px))'
          : 'translateY(0)',
        // Skip the slide animation while the user is dragging — height is
        // driven by pointer movement and shouldn't smooth-interpolate.
        transition: isResizing
          ? 'none'
          : `transform ${COLLAPSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1), height ${COLLAPSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize sequence diagram"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          style={{
            position: 'absolute',
            top: -RESIZE_HANDLE_HEIGHT / 2,
            left: 0,
            right: 0,
            height: RESIZE_HANDLE_HEIGHT,
            cursor: 'ns-resize',
            backgroundColor: isResizing
              ? 'rgba(125, 211, 252, 0.55)'
              : 'transparent',
            transition: isResizing ? undefined : 'background-color 120ms ease',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 31,
          }}
          onMouseEnter={(e) => {
            if (isResizing) return;
            e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.55)';
          }}
          onMouseLeave={(e) => {
            if (isResizing) return;
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />
      )}
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
          layoutOptions={payload.layoutOptions}
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
