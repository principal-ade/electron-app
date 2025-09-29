import React from 'react';
import { Terminal, Cpu } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarGitChanges } from './TitlebarGitChanges';
import type { GitStatusWithFiles } from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

export interface TerminalTitlebarProps {
  directory?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentSessionName?: string;
  gitStatusWithFiles?: GitStatusWithFiles | null;
  onFileClick?: (filePath: string) => void;
}

export const TerminalTitlebar: React.FC<TerminalTitlebarProps> = ({
  directory,
  sessionId,
  agentSessionId,
  agentSessionName,
  gitStatusWithFiles,
  onFileClick,
}) => {
  const directoryName = directory?.split('/').pop() || 'Terminal';

  const titleContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Terminal size={16} />
      <span>{directoryName}</span>
      {agentSessionId && (
        <>
          <span style={{ opacity: 0.5 }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={14} style={{ opacity: 0.8 }} />
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              {agentSessionName || agentSessionId.slice(0, 8)}
            </span>
          </div>
        </>
      )}
      {sessionId && !agentSessionId && (
        <>
          <span style={{ opacity: 0.5 }}>•</span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            Session: {sessionId.slice(0, 8)}
          </span>
        </>
      )}
    </div>
  );

  return (
    <BaseTitlebar title={titleContent}>
      {directory && gitStatusWithFiles && onFileClick && (
        <TitlebarGitChanges
          directory={directory}
          gitStatusWithFiles={gitStatusWithFiles}
          onFileClick={onFileClick}
          position="right"
        />
      )}
    </BaseTitlebar>
  );
};