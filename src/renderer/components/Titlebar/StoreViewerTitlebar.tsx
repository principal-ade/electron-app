import React from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';

export interface StoreViewerTitlebarProps {
  agent?: string;
  namespace?: string;
  onRefresh?: () => void;
}

export const StoreViewerTitlebar: React.FC<StoreViewerTitlebarProps> = ({
  agent,
  namespace,
  onRefresh,
}) => {
  let titleText = 'Store Viewer';
  if (agent && namespace) {
    titleText = `${agent} - ${namespace}`;
  } else if (agent) {
    titleText = `Store: ${agent}`;
  } else if (namespace) {
    titleText = `Namespace: ${namespace}`;
  }

  return (
    <BaseTitlebar
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} />
          <span>{titleText}</span>
        </div>
      }
    >
      {onRefresh && (
        <TitlebarButton
          onClick={onRefresh}
          icon={<RefreshCw size={16} />}
          ariaLabel="Refresh"
          title="Refresh Store Data"
          position="left"
        />
      )}
    </BaseTitlebar>
  );
};
