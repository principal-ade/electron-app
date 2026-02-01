import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Download, Check, RefreshCw } from 'lucide-react';

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
  installedDirectoryIds?: string[]; // IDs of directories where skill is installed
  installedMetadata?: {
    sha: string;
    installedAt: string;
    installedFrom: string;
  };
  onOpenInstallModal: () => void;
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
export const DIRECTORY_ID_TO_DESTINATION: Record<string, SkillDestination> = {
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
    label: 'Agents (Canonical)',
    description: 'Source files stored here, other agents symlink to this',
    path: '~/.agents/skills/',
  },
  {
    value: 'global-claude',
    directoryId: 'claude-specific',
    label: 'Claude',
    description: 'Symlink to canonical (~/.agents/skills/)',
    path: '~/.claude/skills/',
  },
  {
    value: 'global-opencode',
    directoryId: 'opencode',
    label: 'OpenCode',
    description: 'Symlink to canonical (~/.agents/skills/)',
    path: '~/.config/opencode/skill/',
  },
  {
    value: 'global-cursor',
    directoryId: 'cursor-ide',
    label: 'Cursor',
    description: 'Symlink to canonical (~/.agents/skills/)',
    path: '~/.cursor/skills/',
  },
  {
    value: 'global-windsurf',
    directoryId: 'windsurf',
    label: 'Windsurf',
    description: 'Symlink to canonical (~/.agents/skills/)',
    path: '~/.windsurf/skills/',
  },
  {
    value: 'project-universal',
    directoryId: 'project-universal',
    label: 'Project Universal',
    description: 'Direct copy for all agents in project',
    path: '.agents/skills/',
  },
  {
    value: 'project-claude',
    directoryId: 'project-claude',
    label: 'Project Claude',
    description: 'Direct copy for Claude in project',
    path: '.claude/skills/',
  },
];

export const InstallSkillToolbar: React.FC<InstallSkillToolbarProps> = ({
  skillName,
  skillSource,
  isInstalled = false,
  installedDirectoryIds = [],
  installedMetadata,
  onOpenInstallModal,
  detectedDirectories = [],
}) => {
  const { theme } = useTheme();

  // Check if an update is available
  const hasUpdate = useMemo(() => {
    if (!isInstalled || !installedMetadata || !skillSource?.currentSha) {
      return false;
    }
    return installedMetadata.sha !== skillSource.currentSha;
  }, [isInstalled, installedMetadata, skillSource?.currentSha]);

  // Get button label based on installation status
  const buttonLabel = useMemo(() => {
    if (!isInstalled || installedDirectoryIds.length === 0) {
      return 'Install';
    }

    if (installedDirectoryIds.length === 1) {
      const dirId = installedDirectoryIds[0];
      const dir = detectedDirectories.find(d => d.id === dirId);
      return `Installed in ${dir?.displayName || 'Unknown'}`;
    }

    return `Installed in ${installedDirectoryIds.length} directories`;
  }, [isInstalled, installedDirectoryIds, detectedDirectories]);

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
        {skillSource && (
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
        )}
      </div>

      {/* Install Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={onOpenInstallModal}
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
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: 'none',
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
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
              <span>{buttonLabel}</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>Install Skill</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
