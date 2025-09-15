import React from 'react';
import { useTheme } from 'themed-markdown';

interface MetricBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  isExceeded?: boolean;
  threshold?: number;
  customColor?: string; // For custom colors like segments
  onClick?: () => void; // For clickable metric boxes
  isClickable?: boolean; // Visual indication of clickability
}

export const MetricBox: React.FC<MetricBoxProps> = ({
  icon,
  label,
  value,
  isExceeded,
  threshold,
  customColor,
  onClick,
  isClickable = false,
}) => {
  const { theme } = useTheme();

  // Use custom color if provided, otherwise use default logic
  const valueColor =
    customColor || (isExceeded ? '#F44336' : theme.colors.text);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundTertiary,
        borderRadius: '8px',
        border: `1px solid ${isExceeded ? '#F44336' : theme.colors.border}`,
        flex: '1 1 0',
        minWidth: '0',
        position: 'relative',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundSecondary;
          e.currentTarget.style.borderColor = isExceeded
            ? '#F44336'
            : theme.colors.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary;
          e.currentTarget.style.borderColor = isExceeded
            ? '#F44336'
            : theme.colors.border;
        }
      }}
    >
      {isExceeded && (
        <div
          title={`Exceeded threshold of ${threshold}`}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            backgroundColor: '#F44336',
            borderRadius: '50%',
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            color: customColor || (isExceeded ? '#F44336' : 'inherit'),
            opacity: 0.8,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
            flex: 1,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: valueColor,
          textAlign: 'center',
        }}
      >
        {value.toLocaleString()}
      </div>
      {isExceeded && threshold && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '11px',
            color: '#F44336',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⚠️</span>
          <span>&gt; {threshold}</span>
        </div>
      )}
    </div>
  );
};
