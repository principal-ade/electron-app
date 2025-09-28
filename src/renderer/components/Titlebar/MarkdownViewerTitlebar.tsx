import React, { useState } from 'react';
import { Edit3, ExternalLink, Plus, Minus, Copy, Check, Trash2 } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface MarkdownViewerTitlebarProps {
  fileName?: string;
  filePath?: string;
  projectName?: string;
  fontSizeScale?: number;
  onEdit?: () => void;
  onOpenExternal?: () => void;
  onFontSizeIncrease?: () => void;
  onFontSizeDecrease?: () => void;
  onDelete?: () => void;
}

export const MarkdownViewerTitlebar: React.FC<MarkdownViewerTitlebarProps> = ({
  fileName,
  filePath,
  projectName,
  fontSizeScale = 1.0,
  onEdit,
  onOpenExternal,
  onFontSizeIncrease,
  onFontSizeDecrease,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const displayFileName = fileName || filePath || 'Markdown Viewer';
  const displayTitle = displayFileName;
  const fontSizePercent = Math.round(fontSizeScale * 100);

  const handleCopyPath = () => {
    if (filePath) {
      navigator.clipboard.writeText(filePath).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy path:', err);
      });
    }
  };

  return (
    <BaseTitlebar>
      {onEdit && (
        <TitlebarButton
          onClick={onEdit}
          icon={<Edit3 size={16} />}
          ariaLabel="Edit"
          title="Edit Markdown"
          position="left"
        />
      )}
      {onOpenExternal && (
        <TitlebarButton
          onClick={onOpenExternal}
          icon={<ExternalLink size={16} />}
          ariaLabel="Open External"
          title="Open in External Editor"
          position="left"
        />
      )}
      {/* Center content: title with delete button */}
      <div
        position="center" as any
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginLeft: '-100px',
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--color-text)',
          }}
        >
          {displayTitle}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-error, #ef4444)',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              WebkitAppRegion: 'no-drag' as any,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Delete File"
            title="Delete File"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {onFontSizeDecrease && (
        <TitlebarButton
          onClick={onFontSizeDecrease}
          icon={<Minus size={16} />}
          ariaLabel="Decrease Font Size"
          title="Decrease Font Size"
          position="right"
          style={{ right: '120px' }}
        />
      )}
      {(onFontSizeIncrease || onFontSizeDecrease) && (
        <span style={{
          position: 'absolute',
          right: '75px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          userSelect: 'none',
          minWidth: '45px',
          textAlign: 'center',
        }}>
          {fontSizePercent}%
        </span>
      )}
      {onFontSizeIncrease && (
        <TitlebarButton
          onClick={onFontSizeIncrease}
          icon={<Plus size={16} />}
          ariaLabel="Increase Font Size"
          title="Increase Font Size"
          position="right"
          style={{ right: '50px' }}
        />
      )}
      {filePath && (
        <TitlebarButton
          onClick={handleCopyPath}
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          ariaLabel="Copy Path"
          title={copied ? 'Copied!' : `Copy path: ${filePath}`}
          position="right"
        />
      )}
    </BaseTitlebar>
  );
};