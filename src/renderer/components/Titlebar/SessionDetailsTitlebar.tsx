import React from 'react';
import { Activity, Download } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface SessionDetailsTitlebarProps {
  sessionId?: string;
  directory?: string;
  onExport?: () => void;
}

export const SessionDetailsTitlebar: React.FC<SessionDetailsTitlebarProps> = ({
  sessionId,
  directory,
  onExport,
}) => {
  const titleText = sessionId
    ? `Session: ${sessionId.slice(0, 8)}`
    : 'Session Details';

  return (
    <BaseTitlebar title={
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={16} />
        <span>{titleText}</span>
        {directory && (
          <span style={{ opacity: 0.7, fontSize: '0.9em' }}>
            - {directory}
          </span>
        )}
      </div>
    }>
      {onExport && (
        <TitlebarButton
          onClick={onExport}
          icon={<Download size={16} />}
          ariaLabel="Export Session"
          title="Export Session Data"
          position="left"
        />
      )}
    </BaseTitlebar>
  );
};