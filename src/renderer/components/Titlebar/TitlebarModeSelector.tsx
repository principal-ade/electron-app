import React from 'react';
import {
  SimpleModeSelector,
  type RepositoryMode,
} from '../../repo-manager/shared/SimpleModeSelector';

interface TitlebarModeSelectorProps {
  mode: RepositoryMode;
  onModeChange?: (mode: RepositoryMode) => void;
  hasLocalClones: boolean;
  position?: 'center';
}

export const TitlebarModeSelector: React.FC<TitlebarModeSelectorProps> = ({
  mode,
  onModeChange,
  hasLocalClones,
  position = 'center',
}) => {
  return (
    <div
      style={{
        WebkitAppRegion: 'no-drag' as any,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SimpleModeSelector
        mode={mode}
        onModeChange={onModeChange}
        hasLocalClones={hasLocalClones}
        disabled={!onModeChange}
      />
    </div>
  );
};
