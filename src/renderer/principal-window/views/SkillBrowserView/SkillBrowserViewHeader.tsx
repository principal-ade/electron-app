import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Zap, Github, Download, RefreshCw, Settings, Upload, AlertCircle } from 'lucide-react';
import { ShellService } from '../../../main-process-api/ShellService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GlobalDirectoriesConfig } from './GlobalDirectoriesConfig';
import { PendingChangesPanel } from './PendingChangesPanel';
import { useSkillsPendingChanges } from '../../../hooks/useSkillsPendingChanges';

interface SkillBrowserViewHeaderProps {
  githubUrl: string;
  onGithubUrlChange: (url: string) => void;
  onFetchSkills: (url?: string) => void;
  isLoading?: boolean;
  syncEnabled?: boolean;
  syncConfig?: { repoUrl: string; enabled: boolean } | null;
  onEnableSync?: () => void;
}

export const SkillBrowserViewHeader: React.FC<SkillBrowserViewHeaderProps> = ({
  githubUrl,
  onGithubUrlChange,
  onFetchSkills,
  isLoading = false,
  syncEnabled = false,
  syncConfig,
  onEnableSync,
}) => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(githubUrl);
  const [showDirectoriesConfig, setShowDirectoriesConfig] = useState(false);
  const [showPendingChanges, setShowPendingChanges] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{ success?: boolean; error?: string } | null>(null);
  const [unsyncedSkills, setUnsyncedSkills] = useState<Array<{ name: string; path: string; directory: string }>>([]);
  const [isAddingSkills, setIsAddingSkills] = useState(false);
  const { totalPendingCount } = useSkillsPendingChanges();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGithubUrlChange(inputValue);
    // Pass the URL directly to avoid race condition with state update
    onFetchSkills(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const handleOpenInGitHub = async () => {
    if (!syncConfig || !syncConfig.repoUrl) {
      return;
    }

    // Convert repo URL to GitHub web URL
    // Handle formats like:
    // - https://github.com/owner/repo.git
    // - https://github.com/owner/repo
    // - git@github.com:owner/repo.git
    let githubUrl = syncConfig.repoUrl;

    // If it's a git SSH URL, convert to HTTPS
    if (githubUrl.startsWith('git@github.com:')) {
      githubUrl = githubUrl
        .replace('git@github.com:', 'https://github.com/')
        .replace(/\.git$/, '');
    } else {
      // Remove .git suffix if present
      githubUrl = githubUrl.replace(/\.git$/, '');
    }

    try {
      await ShellService.openExternal(githubUrl);
    } catch (error) {
      console.error('[SkillBrowserViewHeader] Failed to open GitHub URL:', error);
    }
  };

  const handlePushToGitHub = async () => {
    try {
      setIsPushing(true);
      setPushStatus(null);

      const result = await FileSystemService.pushSkillsRepo();

      setPushStatus(result);

      // Clear status after 3 seconds
      if (result.success) {
        setTimeout(() => setPushStatus(null), 3000);
      }
    } catch (error) {
      setPushStatus({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsPushing(false);
    }
  };

  const detectUnsyncedSkills = async () => {
    if (!syncEnabled || !syncConfig?.repoUrl) return;

    try {
      const result = await FileSystemService.detectUnsyncedSkills();
      if (result.skills) {
        setUnsyncedSkills(result.skills);
      }
    } catch (error) {
      console.error('[SkillBrowserViewHeader] Failed to detect unsynced skills:', error);
    }
  };

  const handleAddUnsyncedSkills = async () => {
    try {
      setIsAddingSkills(true);

      const skillPaths = unsyncedSkills.map(skill => skill.path);
      const result = await FileSystemService.addSkillsToRepo(skillPaths);

      if (result.success) {
        setUnsyncedSkills([]);
        // Trigger a refresh or show success message
      }
    } catch (error) {
      console.error('[SkillBrowserViewHeader] Failed to add unsynced skills:', error);
    } finally {
      setIsAddingSkills(false);
    }
  };

  // Detect unsynced skills when sync is enabled
  useEffect(() => {
    detectUnsyncedSkills();
  }, [syncEnabled, syncConfig]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0 24px',
          height: '64px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={20} color={theme.colors.primary} />
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          Skill Browser
        </h2>
      </div>

      {/* Center: GitHub URL Input */}
      <div
        style={{
          flex: 1,
          maxWidth: '600px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Github
            size={16}
            color={theme.colors.textSecondary}
            style={{
              position: 'absolute',
              left: '12px',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/owner/repo or owner/repo"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.monospace,
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.backgroundColor = theme.colors.background;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !inputValue.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            border: 'none',
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoading && inputValue.trim()) {
              e.currentTarget.style.opacity = '0.8';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && inputValue.trim()) {
              e.currentTarget.style.opacity = '1';
            }
          }}
        >
          <Download size={16} />
          {isLoading ? 'Loading...' : 'Browse Skills'}
        </button>
      </div>

      {/* Right: Enable Sync button */}
      {!syncEnabled && onEnableSync && (
        <button
          onClick={onEnableSync}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            cursor: 'pointer',
            border: `1px solid ${theme.colors.primary}`,
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary + '10';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <RefreshCw size={16} />
          Enable Sync
        </button>
      )}
      {syncEnabled && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: theme.colors.success || theme.colors.primary,
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <RefreshCw size={16} />
          Sync Enabled
        </div>
      )}
      {syncEnabled && syncConfig?.repoUrl && (
        <button
          onClick={handleOpenInGitHub}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            cursor: 'pointer',
            border: `1px solid ${theme.colors.primary}`,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary + '10';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Github size={16} />
          Open in GitHub
        </button>
      )}
      {syncEnabled && syncConfig?.repoUrl && (
        <button
          onClick={handlePushToGitHub}
          disabled={isPushing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: pushStatus?.success ? theme.colors.success || theme.colors.primary : 'transparent',
            color: pushStatus?.success ? theme.colors.background : theme.colors.primary,
            cursor: isPushing ? 'not-allowed' : 'pointer',
            border: `1px solid ${pushStatus?.success ? (theme.colors.success || theme.colors.primary) : theme.colors.primary}`,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            opacity: isPushing ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isPushing && !pushStatus?.success) {
              e.currentTarget.style.backgroundColor = theme.colors.primary + '10';
            }
          }}
          onMouseLeave={(e) => {
            if (!pushStatus?.success) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <Upload size={16} />
          {isPushing ? 'Pushing...' : pushStatus?.success ? 'Pushed!' : pushStatus?.error ? 'Failed' : 'Push to GitHub'}
        </button>
      )}
      {syncEnabled && (
        <button
          onClick={() => setShowPendingChanges(true)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: totalPendingCount > 0 ? '#f59e0b' + '20' : 'transparent',
            color: totalPendingCount > 0 ? '#f59e0b' : theme.colors.primary,
            cursor: 'pointer',
            border: `1px solid ${totalPendingCount > 0 ? '#f59e0b' : theme.colors.primary}`,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = (totalPendingCount > 0 ? '#f59e0b' : theme.colors.primary) + '20';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = totalPendingCount > 0 ? '#f59e0b' + '20' : 'transparent';
          }}
        >
          <Settings size={16} />
          Directories
          {totalPendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                minWidth: '20px',
                height: '20px',
                borderRadius: '10px',
                backgroundColor: '#f59e0b',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                border: `2px solid ${theme.colors.backgroundSecondary}`,
              }}
            >
              {totalPendingCount}
            </span>
          )}
        </button>
      )}
      {syncEnabled && (
        <button
          onClick={() => setShowDirectoriesConfig(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            border: `1px solid ${theme.colors.border}`,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={16} />
        </button>
      )}
      </div>

      {/* Unsynced Skills Banner */}
      {syncEnabled && unsyncedSkills.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 24px',
            backgroundColor: theme.colors.warning ? theme.colors.warning + '20' : theme.colors.primary + '20',
            borderBottom: `1px solid ${theme.colors.warning || theme.colors.primary}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <AlertCircle size={20} color={theme.colors.warning || theme.colors.primary} />
            <div>
              <div style={{
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                marginBottom: '4px',
              }}>
                {unsyncedSkills.length} skill{unsyncedSkills.length !== 1 ? 's' : ''} not in repository
              </div>
              <div style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
              }}>
                Found in your global directories: {unsyncedSkills.map(s => s.name).join(', ')}
              </div>
            </div>
          </div>
          <button
            onClick={handleAddUnsyncedSkills}
            disabled={isAddingSkills}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: theme.colors.warning || theme.colors.primary,
              color: theme.colors.background,
              cursor: isAddingSkills ? 'not-allowed' : 'pointer',
              border: 'none',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              opacity: isAddingSkills ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isAddingSkills) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAddingSkills) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            <Upload size={16} />
            {isAddingSkills ? 'Adding...' : 'Add to Repository'}
          </button>
        </div>
      )}

      {showDirectoriesConfig && (
        <GlobalDirectoriesConfig
          onClose={() => setShowDirectoriesConfig(false)}
          onDirectoriesChanged={() => {
            // Refresh unsynced skills detection
            detectUnsyncedSkills();
          }}
        />
      )}

      {showPendingChanges && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowPendingChanges(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '800px',
              height: '80%',
              maxHeight: '600px',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            <PendingChangesPanel onClose={() => setShowPendingChanges(false)} />
          </div>
        </div>
      )}
    </>
  );
};
