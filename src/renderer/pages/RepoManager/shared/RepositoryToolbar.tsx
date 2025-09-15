import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Search, Layers, FileText, Filter, X } from 'lucide-react';
import { useTheme } from 'themed-markdown';

export interface ToolbarItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  count?: number;
  color?: string;
  active: boolean;
  onClick: () => void;
  tooltip?: string;
}

interface RepositoryToolbarProps {
  items: ToolbarItem[];
  position?: 'top' | 'bottom';
  expanded?: boolean;
}

export const RepositoryToolbar: React.FC<RepositoryToolbarProps> = ({
  items,
  position = 'top',
  expanded = false,
}) => {
  const { theme } = useTheme();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const activeItems = items.filter(item => item.active);
  const hasActiveItems = activeItems.length > 0;
  
  if (items.length === 0) {
    return null;
  }
  
  if (!expanded) {
    return null;
  }
  
  return (
    <div style={{
      borderTop: position === 'bottom' ? `1px solid ${theme.colors.border}` : undefined,
      borderBottom: position === 'top' ? `1px solid ${theme.colors.border}` : undefined,
      backgroundColor: theme.colors.background,
      transition: 'all 0.2s ease',
    }}>
      {/* Expanded toolbar content */}
      <div style={{
        padding: '8px 12px',
      }}>
        {/* Tools grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '6px',
          }}>
            {items.map(item => (
              <button
                key={item.id}
                onClick={item.onClick}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: item.active 
                    ? 'none'
                    : `1px solid ${theme.colors.border}`,
                  backgroundColor: item.active 
                    ? (item.color || theme.colors.primary) + '22'
                    : hoveredItem === item.id
                    ? theme.colors.backgroundTertiary
                    : theme.colors.background,
                  color: item.active 
                    ? (item.color || theme.colors.primary)
                    : theme.colors.text,
                  fontSize: '12px',
                  fontWeight: item.active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
                title={item.tooltip || `Toggle ${item.label}`}
              >
                {React.cloneElement(item.icon as React.ReactElement, { size: 14 })}
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <span style={{
                    padding: '1px 4px',
                    borderRadius: '3px',
                    backgroundColor: item.active
                      ? (item.color || theme.colors.primary) + '33'
                      : theme.colors.backgroundTertiary,
                    fontSize: '10px',
                    fontWeight: 600,
                  }}>
                    {item.count}
                  </span>
                )}
                {item.active && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: item.color || theme.colors.primary,
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
  );
};