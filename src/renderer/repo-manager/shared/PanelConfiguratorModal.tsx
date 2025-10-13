import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import {
  PanelConfigurator,
  type PanelLayout,
  type PanelDefinition,
} from '@a24z/panels';

export interface PanelConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePanels: PanelDefinition[];
  currentLayout: PanelLayout;
  onChange: (layout: PanelLayout) => void;
}

export const PanelConfiguratorModal: React.FC<PanelConfiguratorModalProps> = ({
  isOpen,
  onClose,
  availablePanels,
  currentLayout,
  onChange,
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            Configure Panel Layout
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginBottom: '24px',
            lineHeight: 1.5,
          }}
        >
          Click a slot, then click a panel to assign it. Click two slots to swap
          their content.
        </p>

        {/* Panel Configurator */}
        <PanelConfigurator
          availablePanels={availablePanels}
          currentLayout={currentLayout}
          onChange={onChange}
          theme={theme}
        />

        {/* Footer */}
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
