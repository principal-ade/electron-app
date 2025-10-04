import React, { useState, useEffect } from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarButton } from './TitlebarButton';
import { Sparkles } from 'lucide-react';
import { WindowService } from '../../main-process-api/WindowService';
import { UpdateNotification } from '../UpdateNotification';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../shared/types/userPreferences.types';

export interface MainWindowTitlebarProps {
  hasUpdateAvailable?: boolean;
  onUpdateAvailable?: (hasUpdate: boolean) => void;
}

export const MainWindowTitlebar: React.FC<MainWindowTitlebarProps> = ({
  hasUpdateAvailable,
  onUpdateAvailable,
}) => {
  const [localHasUpdate, setLocalHasUpdate] = useState(false);
  const [showThemeButton, setShowThemeButton] = useState(true);
  const [showCustomizeButton, setShowCustomizeButton] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const applyPreferences = (preferences: UserPreferences) => {
      if (!isMounted) {
        return;
      }

      setShowThemeButton(preferences.titlebarButtons?.theme ?? true);
      setShowCustomizeButton(preferences.titlebarButtons?.customize ?? true);
    };

    void UserPreferencesService.getPreferences().then(applyPreferences);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        applyPreferences(detail);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  const handleCallimachusClick = async () => {
    await WindowService.openCallimachusWindow();
  };

  const handleUpdateAvailable = (hasUpdate: boolean) => {
    setLocalHasUpdate(hasUpdate);
    onUpdateAvailable?.(hasUpdate);
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <>
      <BaseTitlebar
        title="Principal View"
        showThemeDropdown={showThemeButton}
        showCustomizeButton={showCustomizeButton}
      >
        {/* Update notification positioned on the right side */}
        <div
          style={{
            position: 'absolute',
            right: isMac ? '90px' : '125px',
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
          icon={<Sparkles size={18} />}
          ariaLabel="Pattern Discovery"
          title="Open Pattern Discovery (Callimachus)"
          onClick={handleCallimachusClick}
          position="right"
          style={{ right: isMac ? '55px' : '90px' }}
        />
      </BaseTitlebar>
    </>
  );
};