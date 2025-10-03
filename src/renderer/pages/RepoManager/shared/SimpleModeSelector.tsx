import { useTheme } from '@a24z/industry-theme';
import type { RepositoryViewType } from '../../../../shared/types/userPreferences.types';

export type RepositoryMode = RepositoryViewType;

interface SimpleModeSelectorProps {
  mode: RepositoryMode;
  onModeChange?: (mode: RepositoryMode) => void;
  hasLocalClones?: boolean;
  disabled?: boolean;
}

interface ModeOption {
  value: RepositoryMode;
  label: string;
  color: string;
  requiresClone?: boolean;
}

export const SimpleModeSelector: React.FC<SimpleModeSelectorProps> = ({
  mode,
  onModeChange,
  hasLocalClones = false,
  disabled = false,
}) => {
  const { theme } = useTheme();

  const modes: ModeOption[] = [
    {
      value: 'exploration',
      label: 'Explore',
      color: '#3b82f6',
    },
    {
      value: 'deployment',
      label: 'Maintain',
      color: '#8b5cf6',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
        backgroundColor: theme.colors.backgroundTertiary,
        borderRadius: '8px',
        gap: '2px',
      }}
    >
      {modes.map((modeOption) => {
        const isActive = mode === modeOption.value;
        const isDisabled = disabled || (modeOption.requiresClone && !hasLocalClones);

        return (
          <button
            key={modeOption.value}
            onClick={() => {
              if (!isDisabled && !isActive) {
                onModeChange?.(modeOption.value);
              }
            }}
            disabled={isDisabled}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: isActive
                ? theme.colors.background
                : 'transparent',
              cursor: isDisabled ? 'not-allowed' : isActive ? 'default' : 'pointer',
              fontSize: '13px',
              color: isActive
                ? modeOption.color
                : isDisabled
                ? theme.colors.textTertiary
                : theme.colors.textSecondary,
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s',
              boxShadow: isActive
                ? '0 1px 3px rgba(0,0,0,0.1)'
                : 'none',
              opacity: isDisabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isDisabled && !isActive) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabled && !isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
            title={
              isDisabled && modeOption.requiresClone
                ? `${modeOption.label} (requires local clone)`
                : modeOption.label
            }
          >
            {modeOption.label}
          </button>
        );
      })}
    </div>
  );
};