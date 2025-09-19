import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  Check,
  Loader2,
  GitPullRequest,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { FileTreeSource } from '../../types/file-tree-source';
import { useGitChanges } from '../../contexts/GitChangesContext';

interface GitChangesButtonProps {
  source: FileTreeSource;
  style?: React.CSSProperties;
}

export const GitChangesButton: React.FC<GitChangesButtonProps> = ({
  source,
  style,
}) => {
  const { theme } = useTheme();
  const { checkGitStatus, toggleGitChanges, getGitState } = useGitChanges();
  const [isChecking, setIsChecking] = useState(false);

  const gitState = getGitState(source.id);

  // Check git status on mount and when source changes
  useEffect(() => {
    if (source.type === 'local' && !gitState?.gitStatus) {
      setIsChecking(true);
      checkGitStatus(source).finally(() => {
        setIsChecking(false);
      });
    }
  }, [source, gitState?.gitStatus, checkGitStatus]);

  // Don't show for non-local sources
  if (source.type !== 'local') {
    return null;
  }

  // Determine button state and appearance
  const getButtonConfig = () => {
    // Loading HEAD tree
    if (gitState?.loading) {
      return {
        icon: <Loader2 size={14} className="animate-spin" />,
        text: 'Loading changes...',
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.backgroundTertiary,
        clickable: false,
        title: 'Loading git changes',
      };
    }

    // Error state
    if (gitState?.error) {
      return {
        icon: <AlertCircle size={14} />,
        text: 'Error loading changes',
        color: '#ef4444',
        backgroundColor: '#ef444420',
        clickable: true,
        title: gitState.error,
      };
    }

    // Changes visible (enabled)
    if (gitState?.enabled) {
      // Special case: no commits yet
      if (gitState.hasNoCommits) {
        return {
          icon: <GitBranch size={14} />,
          text: 'Hide view (no commits yet)',
          color: '#fff',
          backgroundColor: theme.colors.primary,
          clickable: true,
          title: 'Repository has no commits yet. All files shown as new.',
        };
      }

      const changeCount =
        (gitState.gitStatus?.created.length || 0) +
        (gitState.gitStatus?.modified.length || 0) +
        (gitState.gitStatus?.deleted.length || 0);

      return {
        icon: <GitPullRequest size={14} />,
        text: `Hide changes (${changeCount})`,
        color: '#fff',
        backgroundColor: theme.colors.primary,
        clickable: true,
        title: 'Click to hide git changes',
      };
    }

    // Checking status
    if (isChecking) {
      return {
        icon: <Loader2 size={14} className="animate-spin" />,
        text: 'Checking...',
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.backgroundTertiary,
        clickable: false,
        title: 'Checking for git changes',
      };
    }

    // Special case: no commits yet (not enabled)
    if (gitState?.hasNoCommits) {
      return {
        icon: <GitBranch size={14} />,
        text: 'No commits yet',
        color: theme.colors.primary,
        backgroundColor: theme.colors.primary + '20',
        border: `1px solid ${theme.colors.primary}40`,
        clickable: true,
        title: 'Repository has no commits. Click to view all files as new.',
      };
    }

    // Has changes (not enabled)
    if (gitState?.hasChanges) {
      const changeCount =
        (gitState.gitStatus?.created.length || 0) +
        (gitState.gitStatus?.modified.length || 0) +
        (gitState.gitStatus?.deleted.length || 0);

      return {
        icon: <GitBranch size={14} />,
        text: `Show changes (${changeCount})`,
        color: theme.colors.primary,
        backgroundColor: theme.colors.primary + '20',
        border: `1px solid ${theme.colors.primary}40`,
        clickable: true,
        title: `${changeCount} uncommitted changes. Click to visualize.`,
      };
    }

    // Clean branch
    return {
      icon: <Check size={14} />,
      text: 'Branch is clean',
      color: '#10b981',
      backgroundColor: '#10b98120',
      clickable: false,
      title: 'No uncommitted changes',
    };
  };

  const config = getButtonConfig();

  const handleClick = () => {
    if (!config.clickable) return;

    // Toggle git changes
    toggleGitChanges(source, !gitState?.enabled);
  };

  return (
    <button
      onClick={handleClick}
      disabled={!config.clickable}
      title={config.title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        border: config.border || 'none',
        backgroundColor: config.backgroundColor,
        color: config.color,
        fontSize: '12px',
        fontWeight: 500,
        cursor: config.clickable ? 'pointer' : 'default',
        opacity: config.clickable ? 1 : 0.8,
        transition: 'all 0.2s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (config.clickable) {
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (config.clickable) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {config.icon}
      <span>{config.text}</span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </button>
  );
};
