import React from 'react';
import { Pencil } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import { PanelEmptyState } from './PanelEmptyState';

interface ExcalidrawPanelProps {
  // Document data
  docPath: string | null;
  docContent: string | null;

  // Loading state
  loading?: boolean;

  // Close handler
  onClose?: () => void;
}

export const ExcalidrawPanel: React.FC<ExcalidrawPanelProps> = ({
  docPath,
  docContent,
  loading = false,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!docPath || !docContent) {
    return (
      <PanelEmptyState
        icon={Pencil}
        title="No diagram selected"
        description="Select an Excalidraw diagram file from the docs tab to view it here"
      />
    );
  }

  const excalidrawData = (() => {
    try {
      return JSON.parse(docContent);
    } catch {
      return { elements: [], appState: {}, files: {} };
    }
  })();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Excalidraw header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Pencil size={16} color={theme.colors.primary} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              {docPath.split('/').pop()}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}
            >
              {docPath}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: theme.colors.textSecondary,
              borderRadius: '4px',
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Excalidraw content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            Loading diagram...
          </div>
        ) : (
          <ExcalidrawWrapper
            initialData={excalidrawData}
            onChange={() => {}}
          />
        )}
      </div>
    </div>
  );
};
