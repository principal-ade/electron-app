import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Download, Check, AlertCircle } from 'lucide-react';

interface InstallSkillToolbarProps {
  skillName: string;
  skillSource?: {
    owner: string;
    repo: string;
    branch: string;
    skillPath: string;
  };
  isInstalled?: boolean;
  onInstall: (destination: SkillDestination) => Promise<void>;
}

export type SkillDestination =
  | 'global-universal'
  | 'global-claude'
  | 'project-universal'
  | 'project-claude';

const DESTINATIONS: Array<{
  value: SkillDestination;
  label: string;
  description: string;
}> = [
  {
    value: 'global-universal',
    label: 'Global Universal (~/.agent/skills/)',
    description: 'Available to all AI agents globally',
  },
  {
    value: 'global-claude',
    label: 'Global Claude (~/.claude/skills/)',
    description: 'Available to Claude globally',
  },
  {
    value: 'project-universal',
    label: 'Project Universal (.agent/skills/)',
    description: 'Available to all agents in current project',
  },
  {
    value: 'project-claude',
    label: 'Project Claude (.claude/skills/)',
    description: 'Available to Claude in current project',
  },
];

export const InstallSkillToolbar: React.FC<InstallSkillToolbarProps> = ({
  skillName,
  skillSource,
  isInstalled = false,
  onInstall,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInstall = async (destination: SkillDestination) => {
    setInstalling(true);
    setError(null);
    setSuccess(false);

    try {
      await onInstall(destination);
      setSuccess(true);
      setIsOpen(false);

      // Reset success state after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  if (!skillSource) {
    return null;
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      {/* Skill Source Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.text,
            fontWeight: theme.fontWeights.medium,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skillName}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skillSource.owner}/{skillSource.repo}
        </div>
      </div>

      {/* Install Button / Dropdown */}
      <div style={{ position: 'relative' }}>
        {success ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: theme.colors.success,
              color: theme.colors.background,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            <Check size={16} />
            <span>Installed!</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => setIsOpen(!isOpen)}
              disabled={installing || isInstalled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: isInstalled
                  ? theme.colors.backgroundSecondary
                  : theme.colors.primary,
                color: isInstalled ? theme.colors.textSecondary : theme.colors.background,
                cursor: installing || isInstalled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                border: `1px solid ${isInstalled ? theme.colors.border : theme.colors.primary}`,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
                opacity: installing || isInstalled ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!installing && !isInstalled) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (!installing && !isInstalled) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {isInstalled ? (
                <>
                  <Check size={16} />
                  <span>Installed</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>{installing ? 'Installing...' : 'Install Skill'}</span>
                </>
              )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && !installing && !isInstalled && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  minWidth: '300px',
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    fontWeight: theme.fontWeights.medium,
                  }}
                >
                  Choose Installation Destination
                </div>
                {DESTINATIONS.map((dest) => (
                  <button
                    key={dest.value}
                    onClick={() => handleInstall(dest.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      textAlign: 'left',
                      backgroundColor: theme.colors.surface,
                      border: 'none',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.surface;
                    }}
                  >
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                        fontWeight: theme.fontWeights.medium,
                        marginBottom: '2px',
                      }}
                    >
                      {dest.label}
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {dest.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            padding: '8px 12px',
            backgroundColor: theme.colors.error,
            color: theme.colors.background,
            borderRadius: '6px',
            fontSize: theme.fontSizes[0],
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 1001,
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
