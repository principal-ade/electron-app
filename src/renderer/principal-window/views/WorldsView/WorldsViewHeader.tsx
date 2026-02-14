import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Map, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface WorldsViewHeaderProps {
  isRightPanelCollapsed?: boolean;
  onToggleRightPanel?: () => void;
}

export const WorldsViewHeader: React.FC<WorldsViewHeaderProps> = ({
  isRightPanelCollapsed = true,
  onToggleRightPanel,
}) => {
  const { theme } = useTheme();

  // Safety check - use fallback values if theme not loaded
  if (!theme || !theme.colors) {
    return (
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Map size={24} color="#666" />
        <h1
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#333',
          }}
        >
          Worlds
        </h1>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Map size={24} color={theme.colors.primary} />
        <h1
          style={{
            margin: 0,
            fontSize: `${theme.fontSizes[4]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
          }}
        >
          Worlds
        </h1>
      </div>

      {onToggleRightPanel && (
        <button
          onClick={onToggleRightPanel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
          title={isRightPanelCollapsed ? 'Show info panel' : 'Hide info panel'}
        >
          {isRightPanelCollapsed ? (
            <PanelRightOpen size={16} />
          ) : (
            <PanelRightClose size={16} />
          )}
          Info
        </button>
      )}
    </div>
  );
};
