import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';

export interface CoworkerCardData {
  login: string;
  avatarUrl: string;
  organizations: string[];
  hasActivity?: boolean;
}

export interface CoworkerCardProps {
  coworker: CoworkerCardData;
  onClick?: () => void;
}

export const CoworkerCard: React.FC<CoworkerCardProps> = ({ coworker, onClick }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        padding: spacing.md,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii?.[1] || 4,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={coworker.avatarUrl}
            alt={coworker.login}
            style={{ width: 40, height: 40, borderRadius: '50%', display: 'block' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {coworker.hasActivity && (
            <div
              title="Recent activity"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: theme.colors.success,
                border: `2px solid ${theme.colors.background}`,
              }}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 1,
            transform: 'translateY(-2px)',
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {coworker.login}
          </div>
          {coworker.organizations.length > 0 && (
            <div
              style={{
                fontFamily: theme.fonts?.body,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {coworker.organizations.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoworkerCard;
