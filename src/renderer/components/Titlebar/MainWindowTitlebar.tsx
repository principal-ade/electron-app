import React, { useState } from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';
import { Sparkles, Activity } from 'lucide-react';
import { WindowService } from '../../main-process-api/WindowService';
import { ObservabilityConfigModal } from '../observability/ObservabilityConfigModal';
import { UpdateNotification } from '../UpdateNotification';

export interface MainWindowTitlebarProps {
  hasUpdateAvailable?: boolean;
  onUpdateAvailable?: (hasUpdate: boolean) => void;
}

export const MainWindowTitlebar: React.FC<MainWindowTitlebarProps> = ({
  hasUpdateAvailable,
  onUpdateAvailable,
}) => {
  const [showObservabilityModal, setShowObservabilityModal] = useState(false);
  const [localHasUpdate, setLocalHasUpdate] = useState(false);

  const handleCallimachusClick = async () => {
    await WindowService.openCallimachusWindow();
  };


  const handleObservabilityClick = () => {
    setShowObservabilityModal(true);
  };

  const handleUpdateAvailable = (hasUpdate: boolean) => {
    setLocalHasUpdate(hasUpdate);
    onUpdateAvailable?.(hasUpdate);
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <>
      <BaseTitlebar title="Principal View" showThemeDropdown={true}>
        {/* Update notification positioned on the right side */}
        <div
          style={{
            position: 'absolute',
            right: isMac ? '160px' : '195px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <UpdateNotification
            onUpdateAvailable={handleUpdateAvailable}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              borderRadius: '4px',
            }}
          />
        </div>
        <TitlebarButton
          icon={<Activity size={18} />}
          ariaLabel="Observability Settings"
          title="Configure Observability"
          onClick={handleObservabilityClick}
          position="right"
          style={{ right: isMac ? '125px' : '160px' }}
        />
        <TitlebarButton
          icon={<Sparkles size={18} />}
          ariaLabel="Pattern Discovery"
          title="Open Pattern Discovery (Callimachus)"
          onClick={handleCallimachusClick}
          position="right"
          style={{ right: isMac ? '55px' : '90px' }}
        />
      </BaseTitlebar>
      <ObservabilityConfigModal
        open={showObservabilityModal}
        onClose={() => setShowObservabilityModal(false)}
      />
    </>
  );
};