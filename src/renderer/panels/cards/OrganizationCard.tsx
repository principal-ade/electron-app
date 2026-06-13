import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { LIST_AVATAR_SIZE } from './listCardLayout';

export interface OrganizationCardData {
  login: string;
  avatarUrl: string;
  description?: string | null;
  hasActivity?: boolean;
}

export interface OrganizationCardProps {
  organization: OrganizationCardData;
  onClick?: () => void;
}

export const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization, onClick }) => {
  const { theme } = useTheme();
  const avatarRadius = theme.radii?.[1] || 4;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        padding: '8px 10px',
        backgroundColor: 'transparent',
        borderRadius: theme.radii?.[1] || 4,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={organization.avatarUrl}
            alt={organization.login}
            style={{
              width: LIST_AVATAR_SIZE,
              height: LIST_AVATAR_SIZE,
              borderRadius: avatarRadius,
              display: 'block',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {organization.hasActivity && (
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
            height: LIST_AVATAR_SIZE,
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
            {organization.login}
          </div>
          {organization.description && (
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
              {organization.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationCard;
