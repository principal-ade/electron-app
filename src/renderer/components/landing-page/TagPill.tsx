import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { getTagColor } from '../../utils/tagUtils';

interface TagPillProps {
  label: string;
  active?: boolean;
  excluded?: boolean;
  count?: number;
  onClick?: (e: React.MouseEvent) => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  color?: string;
}

export const TagPill: React.FC<TagPillProps> = ({
  label,
  active = false,
  excluded = false,
  count,
  onClick,
  onRightClick,
  onRemove,
  showRemove = false,
  color,
}) => {
  const { theme } = useTheme();
  
  const pillColor = color || getTagColor(label);
  
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick?.(e);
  };
  
  return (
    <button
      onClick={onClick}
      onContextMenu={handleRightClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        border: `1px solid ${
          excluded 
            ? theme.colors.error 
            : active 
              ? pillColor 
              : theme.colors.border
        }`,
        backgroundColor: excluded
          ? `${theme.colors.error}15`
          : active
            ? `${pillColor}20`
            : theme.colors.backgroundSecondary,
        color: excluded
          ? theme.colors.error
          : active
            ? pillColor
            : theme.colors.text,
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textDecoration: excluded ? 'line-through' : 'none',
        opacity: excluded ? 0.7 : 1,
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active && !excluded) {
          e.currentTarget.style.backgroundColor = `${pillColor}15`;
          e.currentTarget.style.borderColor = pillColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !excluded) {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          e.currentTarget.style.borderColor = theme.colors.border;
        }
      }}
      title={
        excluded 
          ? `Excluding ${label} (${count || 0} hidden)` 
          : active 
            ? `Showing only ${label} (${count || 0})`
            : `Click to filter by ${label} (${count || 0})`
      }
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            fontSize: '11px',
            opacity: 0.8,
            fontWeight: 400,
          }}
        >
          ({count})
        </span>
      )}
      {showRemove && onRemove && (
        <X
          size={14}
          style={{
            marginLeft: '2px',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
      {excluded && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: theme.colors.error,
            color: 'white',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          !
        </span>
      )}
    </button>
  );
};