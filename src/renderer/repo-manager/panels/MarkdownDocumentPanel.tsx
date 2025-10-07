import React from 'react';
import { FileText } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownDocumentViewer } from '../shared/MarkdownDocumentViewer';
import { PanelEmptyState } from './PanelEmptyState';

interface MarkdownDocumentPanelProps {
  // Document data
  docPath: string | null;
  docContent: string | null;

  // Loading state
  loading?: boolean;

  // Close handler
  onClose?: () => void;
}

export const MarkdownDocumentPanel: React.FC<MarkdownDocumentPanelProps> = ({
  docPath,
  docContent,
  loading = false,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!docPath || !docContent) {
    return (
      <PanelEmptyState
        icon={FileText}
        title="No document selected"
        description="Select a markdown file from the docs tab to view it here"
      />
    );
  }

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
      {/* Document header */}
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
          <FileText size={16} color={theme.colors.primary} />
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

      {/* Document content */}
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
            Loading document...
          </div>
        ) : (
          <MarkdownDocumentViewer
            viewMode="document"
            showEditor={false}
            content={docContent}
            slides={[docContent]}
            currentSlide={0}
            theme={theme}
            showSegmented={true}
            onContentChange={() => {}}
            onSlideNavigate={() => {}}
            onCheckboxChange={() => {}}
          />
        )}
      </div>
    </div>
  );
};
