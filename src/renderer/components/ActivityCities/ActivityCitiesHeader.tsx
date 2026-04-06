import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ArrowLeft } from 'lucide-react';

export interface ActivityCitiesHeaderProps {
  onlineCount: number;
  onBack?: () => void;
}

/**
 * Header for the Activity Cities panel
 * Bloomberg terminal aesthetic with title and online count
 */
export const ActivityCitiesHeader: React.FC<ActivityCitiesHeaderProps> = ({
  onlineCount,
  onBack,
}) => {
  const { theme } = useTheme();

  // Theme spacing helpers (space is number[])
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing.sm}px ${spacing.md}px`,
    backgroundColor: theme.colors.background,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const leftSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const backButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii?.[1] || 4,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    fontWeight: 700,
    color: theme.colors.text,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  };

  const onlineContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const boltStyle: React.CSSProperties = {
    fontSize: theme.fontSizes[1],
    color: theme.colors.warning,
  };

  const countStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    fontWeight: 600,
    color: theme.colors.text,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  return (
    <div style={containerStyle}>
      <div style={leftSectionStyle}>
        {onBack && (
          <button
            onClick={onBack}
            style={backButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
            title="Back to Feed"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div style={titleStyle}>Live Activity</div>
      </div>
      <div style={onlineContainerStyle}>
        <span style={boltStyle}>&#9889;</span>
        <span style={countStyle}>{onlineCount}</span>
        <span style={labelStyle}>online</span>
      </div>
    </div>
  );
};
