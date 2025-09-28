import React from 'react';
import { useTheme } from 'themed-markdown';
import { X } from 'lucide-react';
import { FileViewer } from './FileViewer';

interface FileViewerModalProps {
  filePath: string;
  displayPath?: string;
  onClose: () => void;
  contentLoader?: () => Promise<string | null>;
  initialContent?: string;
  editable?: boolean;
  onSave?: (content: string) => Promise<void>;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  filePath,
  displayPath,
  onClose,
  contentLoader,
  initialContent,
  editable = false,
  onSave,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '1200px',
          height: '85%',
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      >
        {/* Close button overlay */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px',
            borderRadius: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            color: theme.colors.text,
            display: 'flex',
            alignItems: 'center',
            zIndex: 10,
          }}
          title="Close (Esc)"
        >
          <X size={20} />
        </button>

        {/* File viewer content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: '12px',
          }}
        >
          <FileViewer
            key={filePath} // Force remount when file changes
            filePath={filePath}
            displayPath={displayPath}
            className="full-height"
            contentLoader={contentLoader}
            initialContent={initialContent}
            editable={editable}
            onSave={onSave}
            enableVimMode={false}
          />
        </div>
      </div>
    </div>
  );
};
