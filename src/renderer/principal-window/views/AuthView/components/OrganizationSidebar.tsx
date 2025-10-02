import { useTheme } from '@a24z/industry-theme';
import { Building, Folder, Github, GitBranch, Users, User, Settings } from 'lucide-react';
import type { OrganizationInfo } from '../utils/repositoryOrganizer';

interface GitHubUser {
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface OrganizationSidebarProps {
  organizations: OrganizationInfo[];
  selectedOrg: string | null;
  onSelectOrg: (orgName: string | null) => void;
  totalRepositories: number;
  isAuthenticated: boolean;
  user: GitHubUser | null;
  showAuthView: boolean;
  onToggleAuthView: () => void;
}

export const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  organizations,
  selectedOrg,
  onSelectOrg,
  totalRepositories,
  isAuthenticated,
  user,
  showAuthView,
  onToggleAuthView,
}) => {
  const { theme } = useTheme();

  const getOrgIcon = (org: OrganizationInfo) => {
    if (org.type === 'github') return <Github size={16} />;
    if (org.type === 'remote') return <GitBranch size={16} />;
    if (org.name === 'Local') return <Folder size={16} />;
    return <Building size={16} />;
  };

  const backgroundColor = theme.colors.backgroundSecondary;

  return (
    <div
      style={{
        height: '100%',
        backgroundColor,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* User Header */}
      <button
        onClick={onToggleAuthView}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          border: 'none',
          borderBottom: `2px solid ${showAuthView ? theme.colors.primary : theme.colors.border}`,
          backgroundColor: showAuthView ? `${theme.colors.primary}10` : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          if (!showAuthView) {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
          }
        }}
        onMouseLeave={(e) => {
          if (!showAuthView) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {isAuthenticated && user ? (
          <>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.login}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `1px solid ${theme.colors.border}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.background,
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                {user.login?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: showAuthView ? theme.colors.primary : theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name || user.login}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                @{user.login}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: theme.colors.backgroundTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <User size={18} style={{ color: theme.colors.textSecondary }} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: showAuthView ? theme.colors.primary : theme.colors.text,
                }}
              >
                Not Signed In
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                Click to sign in
              </div>
            </div>
          </>
        )}
        <Settings
          size={16}
          style={{
            color: showAuthView ? theme.colors.primary : theme.colors.textSecondary,
            flexShrink: 0,
          }}
        />
      </button>

      {/* Organizations Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Organizations
        </h3>
        <p
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          {organizations.length} organization{organizations.length !== 1 ? 's' : ''}, {totalRepositories} repositories
        </p>
      </div>

      {/* Organization list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {/* All repositories option */}
        <button
          onClick={() => {
            if (showAuthView) {
              onToggleAuthView(); // Switch back to repository view
            }
            onSelectOrg(null);
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            marginBottom: '4px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: !showAuthView && selectedOrg === null
              ? `${theme.colors.primary}15`
              : 'transparent',
            color: !showAuthView && selectedOrg === null
              ? theme.colors.primary
              : theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            if (selectedOrg !== null || showAuthView) {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (selectedOrg !== null || showAuthView) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Users size={16} />
            <span
              style={{
                fontSize: '14px',
                fontWeight: selectedOrg === null ? 500 : 400,
              }}
            >
              All Repositories
            </span>
          </div>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: selectedOrg === null
                ? `${theme.colors.primary}20`
                : theme.colors.backgroundTertiary,
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 500,
            }}
          >
            {totalRepositories}
          </span>
        </button>

        {/* Separator */}
        <div
          style={{
            height: '1px',
            backgroundColor: theme.colors.border,
            margin: '8px 0',
          }}
        />

        {/* Organizations */}
        {organizations.map((org) => (
          <button
            key={org.name}
            onClick={() => {
              if (showAuthView) {
                onToggleAuthView(); // Switch back to repository view
              }
              onSelectOrg(org.name);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              marginBottom: '4px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: !showAuthView && selectedOrg === org.name
                ? `${theme.colors.primary}15`
                : 'transparent',
              color: !showAuthView && selectedOrg === org.name
                ? theme.colors.primary
                : theme.colors.text,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (selectedOrg !== org.name || showAuthView) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedOrg !== org.name || showAuthView) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: 0,
                flex: 1,
              }}
            >
              {org.avatarUrl ? (
                <img
                  src={org.avatarUrl}
                  alt={org.name}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                getOrgIcon(org)
              )}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: selectedOrg === org.name ? 500 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={org.name}
              >
                {org.name}
              </span>
            </div>
            <span
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                backgroundColor: selectedOrg === org.name
                  ? `${theme.colors.primary}20`
                  : theme.colors.backgroundTertiary,
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {org.repositoryCount}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};