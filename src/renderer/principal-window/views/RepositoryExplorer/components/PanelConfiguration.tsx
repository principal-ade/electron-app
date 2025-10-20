import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { RepositoryPanelVisibility } from '../../../../../shared/types/repositoryPanel.types';
import type { RepositoryPanelId } from '../../../../../shared/panels/repositoryPanelCatalog';
import { getRepositoryPanelsForSurface } from '../../../../panels/registry';

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

  const explorerPanels = getRepositoryPanelsForSurface('explorer');

  const handleToggle = (key: RepositoryPanelId) => {
    const isCurrentlyVisible = panelVisibility.visibility[key];
    const newVisibility = !isCurrentlyVisible;

    // Update visibility
    const updatedVisibility = {
      ...panelVisibility.visibility,
      [key]: newVisibility,
    };

    // Update order
    let updatedOrder: RepositoryPanelId[];
    if (newVisibility) {
      // Panel is being enabled - add to end of order if not already there
      updatedOrder = panelVisibility.order.includes(key)
        ? panelVisibility.order
        : [...panelVisibility.order, key];
    } else {
      // Panel is being disabled - remove from order
      updatedOrder = panelVisibility.order.filter((id) => id !== key);
    }

    onPanelVisibilityChange({
      visibility: updatedVisibility,
      order: updatedOrder,
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
        {explorerPanels.map(({ id, label }) => {
          const panelId = id as RepositoryPanelId;
          return (
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
                checked={panelVisibility.visibility[panelId] ?? true}
                onChange={() => handleToggle(panelId)}
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
          );
        })}
      </div>
    </div>
  );
};
