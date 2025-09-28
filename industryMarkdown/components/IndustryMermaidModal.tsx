import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Theme } from '../../industryTheme';

import { IndustryZoomableMermaidDiagram } from './IndustryZoomableMermaidDiagram';

interface IndustryMermaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  mermaidCode: string;
  theme: Theme;
}

export function IndustryMermaidModal({
  isOpen,
  onClose,
  mermaidCode,
  theme,
}: IndustryMermaidModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: theme.space[4],
      }}
    >
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: theme.colors.background,
          borderRadius: theme.radii[3],
          padding: theme.space[5],
          width: '90vw',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: theme.shadows[4],
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: theme.space[4],
            right: theme.space[4],
            background: 'none',
            border: 'none',
            fontSize: theme.fontSizes[5],
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            lineHeight: 1,
            padding: `${theme.space[1]}px`,
            borderRadius: theme.radii[1],
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          aria-label="Close"
        >
          ×
        </button>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <IndustryZoomableMermaidDiagram
            id="mermaid-modal-diagram"
            code={mermaidCode}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
