import React from 'react';
import { Search, RefreshCw, Settings } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface CallimachusTitlebarProps {
  isConnected?: boolean;
  onRefresh?: () => void;
  onSettings?: () => void;
}

export const CallimachusTitlebar: React.FC<CallimachusTitlebarProps> = ({
  isConnected,
  onRefresh,
  onSettings,
}) => {
  return (
    <BaseTitlebar title={
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={16} />
        <span>Pattern Discovery</span>
        {isConnected && (
          <span style={{
            fontSize: '12px',
            opacity: 0.7,
            marginLeft: '4px'
          }}>
            (Connected)
          </span>
        )}
      </div>
    }>
      {onSettings && (
        <TitlebarButton
          onClick={onSettings}
          icon={<Settings size={16} />}
          ariaLabel="Settings"
          title="Connection Settings"
          position="left"
        />
      )}
      {onRefresh && isConnected && (
        <TitlebarButton
          onClick={onRefresh}
          icon={<RefreshCw size={16} />}
          ariaLabel="Refresh"
          title="Refresh Connection"
          position="left"
          style={{ left: onSettings ? '120px' : '80px' }}
        />
      )}
    </BaseTitlebar>
  );
};