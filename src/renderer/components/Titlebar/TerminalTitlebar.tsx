import React from 'react';
import { Terminal, FolderOpen, Cpu } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface TerminalTitlebarProps {
  directory?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentSessionName?: string;
  onOpenInExplorer?: () => void;
}

export const TerminalTitlebar: React.FC<TerminalTitlebarProps> = ({
  directory,
  sessionId,
  agentSessionId,
  agentSessionName,
  onOpenInExplorer,
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
      {onOpenInExplorer && directory && (
        <TitlebarButton
          onClick={onOpenInExplorer}
          icon={<FolderOpen size={16} />}
          ariaLabel="Open in Explorer"
          title="Open directory in file explorer"
          position="left"
        />
      )}
    </BaseTitlebar>
  );
};