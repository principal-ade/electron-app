import React, { useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Download, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface DetectedDirectory {
  id: string;
  path: string;
  displayName: string;
  skillCount: number;
}

interface InstallSkillToolbarProps {
  skillName: string;
  skillSource?: {
    owner: string;
    repo: string;
    branch: string;
    skillPath: string;
    currentSha?: string; // Current SHA from GitHub repo
  };
  isInstalled?: boolean;
  installedMetadata?: {
    sha: string;
    installedAt: string;
    installedFrom: string;
  };
  onInstall: (destination: SkillDestination) => Promise<void>;
  detectedDirectories?: DetectedDirectory[];
}

export type SkillDestination =
  | 'global-universal'
  | 'global-claude'
  | 'global-opencode'
  | 'global-cursor'
  | 'global-windsurf'
  | 'project-universal'
  | 'project-claude';

// Map directory IDs to destination types
const DIRECTORY_ID_TO_DESTINATION: Record<string, SkillDestination> = {
  'agent-universal': 'global-universal',
  'claude-specific': 'global-claude',
  'opencode': 'global-opencode',
  'cursor-ide': 'global-cursor',
  'windsurf': 'global-windsurf',
};

const ALL_DESTINATIONS: Array<{
  value: SkillDestination;
  directoryId: string;
  label: string;
  description: string;
  path: string;
}> = [
  {
    value: 'global-universal',
    directoryId: 'agent-universal',
    label: 'Agent',
    description: 'Available to all AI agents globally',
    path: '~/.agent/skills/',
  },
  {
    value: 'global-claude',
    directoryId: 'claude-specific',
    label: 'Claude',
    description: 'Available to Claude globally',
    path: '~/.claude/skills/',
  },
  {
    value: 'global-opencode',
    directoryId: 'opencode',
    label: 'OpenCode',
    description: 'Available to OpenCode globally',
    path: '~/.config/opencode/skill/',
  },
  {
    value: 'global-cursor',
    directoryId: 'cursor-ide',
    label: 'Cursor',
    description: 'Available to Cursor IDE globally',
    path: '~/.cursor/skills/',
  },
  {
    value: 'global-windsurf',
    directoryId: 'windsurf',
    label: 'Windsurf',
    description: 'Available to Windsurf globally',
    path: '~/.windsurf/skills/',
  },
  {
    value: 'project-universal',
    directoryId: 'project-universal',
    label: 'Project Universal',
    description: 'Available to all agents in current project',
    path: '.agent/skills/',
  },
  {
    value: 'project-claude',
    directoryId: 'project-claude',
    label: 'Project Claude',
    description: 'Available to Claude in current project',
    path: '.claude/skills/',
  },
];

export const InstallSkillToolbar: React.FC<InstallSkillToolbarProps> = ({
  skillName,
  skillSource,
  isInstalled = false,
  installedMetadata,
  onInstall,
  detectedDirectories = [],
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if an update is available
  const hasUpdate = useMemo(() => {
    if (!isInstalled || !installedMetadata || !skillSource?.currentSha) {
      return false;
    }
    return installedMetadata.sha !== skillSource.currentSha;
  }, [isInstalled, installedMetadata, skillSource?.currentSha]);

  // Filter destinations to only show detected directories (excluding agent-universal)
  // and always include project-level options
  const detectedDirectoryIds = new Set(
    detectedDirectories
      .filter(dir => dir.id !== 'agent-universal') // Exclude Agent directory
      .map(dir => dir.id)
  );

  const availableDestinations = ALL_DESTINATIONS.filter(dest => {
    // Exclude project-level destinations
    if (dest.value.startsWith('project-')) {
      return false;
    }
    // Only include global destinations that were detected
    return detectedDirectoryIds.has(dest.directoryId);
  });

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
              disabled={installing || (isInstalled && !hasUpdate)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: hasUpdate
                  ? theme.colors.warning
                  : isInstalled
                    ? theme.colors.success
                    : theme.colors.primary,
                color: theme.colors.background,
                cursor: installing || (isInstalled && !hasUpdate) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
                opacity: installing || (isInstalled && !hasUpdate) ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!installing && (!isInstalled || hasUpdate)) {
                  e.currentTarget.style.opacity = '0.85';
                }
              }}
              onMouseLeave={(e) => {
                if (!installing && (!isInstalled || hasUpdate)) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {hasUpdate ? (
                <>
                  <RefreshCw size={16} />
                  <span>Update Available</span>
                </>
              ) : isInstalled ? (
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
            {isOpen && !installing && (!isInstalled || hasUpdate) && (
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
                  {hasUpdate ? 'Choose Destination to Update' : 'Choose Installation Destination'}
                </div>
                {availableDestinations.map((dest) => (
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
                        fontFamily: theme.fonts.monospace,
                      }}
                    >
                      {dest.path}
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
