import React from 'react';
import { FileText, Github } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface EditorTitlebarProps {
  filePath?: string;
  fileName?: string;
  isRemote?: boolean;
  repository?: string;
  onOpenInGitHub?: () => void;
  onOpenInExplorer?: () => void;
}

export const EditorTitlebar: React.FC<EditorTitlebarProps> = ({
  filePath,
  fileName,
  isRemote = false,
  repository,
  onOpenInGitHub,
  onOpenInExplorer,
}) => {
  const title = fileName || filePath || 'File Editor';
  const subtitle = isRemote && repository ? ` - ${repository}` : '';

  return (
    <BaseTitlebar
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} />
          <span>
            {title}
            {subtitle}
          </span>
        </div>
      }
    >
      {isRemote && onOpenInGitHub && (
        <TitlebarButton
          onClick={onOpenInGitHub}
          icon={<Github size={16} />}
          ariaLabel="Open in GitHub"
          title="Open in GitHub"
          position="left"
        />
      )}
      {!isRemote && onOpenInExplorer && (
        <TitlebarButton
          onClick={onOpenInExplorer}
          icon={<FileText size={16} />}
          ariaLabel="Open in Explorer"
          title="Open in Explorer"
          position="left"
        />
      )}
    </BaseTitlebar>
  );
};
