import React from 'react';
import { Settings } from 'lucide-react';
import { TitlebarButton } from './TitlebarButton';

export interface TitlebarSettingsProps {
  onSettingsClick?: () => void;
  hasUpdateAvailable?: boolean;
}

export const TitlebarSettings: React.FC<TitlebarSettingsProps> = ({
  onSettingsClick,
  hasUpdateAvailable = false,
}) => {
  if (!onSettingsClick) {
    return null;
  }

  return (
    <TitlebarButton
      onClick={onSettingsClick}
      icon={<Settings size={18} />}
      ariaLabel="Settings"
      title={hasUpdateAvailable ? 'Settings (Update Available)' : 'Settings'}
      badge={hasUpdateAvailable}
      position="right"
    />
  );
};