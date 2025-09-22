import React from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarSettings } from './TitlebarSettings';
import { TitlebarButton } from './TitlebarButton';
import { Search } from 'lucide-react';
import { WindowService } from '../../main-process-api/WindowService';

export interface MainWindowTitlebarProps {
  onSettingsClick?: () => void;
  hasUpdateAvailable?: boolean;
}

export const MainWindowTitlebar: React.FC<MainWindowTitlebarProps> = ({
  onSettingsClick,
  hasUpdateAvailable,
}) => {
  const handleCallimachusClick = async () => {
    await WindowService.openCallimachusWindow();
  };

  return (
    <BaseTitlebar title="Principal AI">
      <TitlebarButton
        icon={<Search size={18} />}
        ariaLabel="Pattern Discovery"
        title="Open Pattern Discovery (Callimachus)"
        onClick={handleCallimachusClick}
        position="right"
        style={{ right: '55px' }}
      />
      <TitlebarSettings
        onSettingsClick={onSettingsClick}
        hasUpdateAvailable={hasUpdateAvailable}
      />
    </BaseTitlebar>
  );
};