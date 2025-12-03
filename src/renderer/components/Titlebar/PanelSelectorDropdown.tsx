import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelLeft, PanelRight } from 'lucide-react';

export interface PanelOption {
  id: string;
  label: string;
}

export interface PanelSelectorDropdownProps {
  side: 'left' | 'right';
  currentPanelId: string;
  availablePanels: PanelOption[];
  onPanelChange: (panelId: string) => void;
}

export const PanelSelectorDropdown: React.FC<PanelSelectorDropdownProps> = ({
  side,
  currentPanelId,
  availablePanels,
  onPanelChange,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const currentPanel = availablePanels.find(p => p.id === currentPanelId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handlePanelChange = (panelId: string) => {
    onPanelChange(panelId);
    setIsDropdownOpen(false);
  };

  const Icon = side === 'left' ? PanelLeft : PanelRight;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
        zIndex: 100,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsDropdownOpen(!isDropdownOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          color: theme.colors.textSecondary,
          cursor: 'pointer',
          fontSize: `${theme.fontSizes[0]}px`,
          fontWeight: theme.fontWeights.medium,
          fontFamily: theme.fonts.body,
          transition: 'all 0.2s ease',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
          position: 'relative',
          zIndex: 101,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary || 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={`Change ${side} panel`}
      >
        <Icon size={14} />
        <span>{currentPanel?.label || 'Panel'}</span>
      </button>

      {isDropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            [side === 'left' ? 'left' : 'right']: 0,
            marginTop: '4px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            minWidth: '180px',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {availablePanels.map((panel) => {
            const isSelected = panel.id === currentPanelId;
            return (
              <button
                key={panel.id}
                onClick={() => handlePanelChange(panel.id)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: isSelected
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                  border: 'none',
                  color: isSelected ? theme.colors.primary : theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: theme.fonts.body,
                  textAlign: 'left',
                  transition: 'background-color 0.2s ease',
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {panel.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
