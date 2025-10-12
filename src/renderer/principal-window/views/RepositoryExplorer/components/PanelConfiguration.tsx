import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { RepositoryPanelVisibility } from '../../../../../shared/types/repositoryPanel.types';
import { repositoryPanelDefinitions } from '../../../../panels/registry';

interface PanelConfigurationProps {
  panelVisibility: RepositoryPanelVisibility;
  onPanelVisibilityChange: (visibility: RepositoryPanelVisibility) => void;
  onHide: () => void;
}

export const PanelConfiguration: React.FC<PanelConfigurationProps> = ({
  panelVisibility,
  onPanelVisibilityChange,
  onHide,
}) => {
  const { theme } = useTheme();

  // Filter to only show Repository Explorer panels
  const explorerPanelIds = [
    'gitChanges',
    'files',
    'gitStatus',
    'tasksAndNotes',
    'cityVisualization',
    'actions',
    'packageInfo',
  ];

  const explorerPanels = repositoryPanelDefinitions.filter((panel) =>
    explorerPanelIds.includes(panel.id),
  );

  const handleToggle = (key: keyof RepositoryPanelVisibility) => {
    onPanelVisibilityChange({
      ...panelVisibility,
      [key]: !panelVisibility[key],
    });
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Panel Configuration
        </h3>
        <button
          onClick={onHide}
          style={{
            padding: '6px 12px',
            backgroundColor: theme.colors.backgroundLight,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.background;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundLight;
          }}
        >
          Hide
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {explorerPanels.map(({ id, label }) => (
          <label
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: theme.colors.backgroundLight,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundLight;
            }}
          >
            <input
              type="checkbox"
              checked={panelVisibility[id] ?? true}
              onChange={() => handleToggle(id)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: theme.colors.text,
              }}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
