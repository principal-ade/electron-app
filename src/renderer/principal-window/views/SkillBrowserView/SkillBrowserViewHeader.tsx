import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Zap, Github, Download, RefreshCw, Settings, Upload, AlertCircle, ChevronDown, FileText, FolderCog } from 'lucide-react';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GlobalDirectoriesConfig } from './GlobalDirectoriesConfig';
import { PendingChangesPanel } from './PendingChangesPanel';
import { useSkillsPendingChanges } from '../../../hooks/useSkillsPendingChanges';

export type ViewMode = 'installed' | 'browse';

interface SkillBrowserViewHeaderProps {
  githubUrl: string;
  onGithubUrlChange: (url: string) => void;
  onFetchSkills: (url?: string) => void;
  isLoading?: boolean;
  syncEnabled?: boolean;
  syncConfig?: { repoUrl: string; enabled: boolean } | null;
  onEnableSync?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export const SkillBrowserViewHeader: React.FC<SkillBrowserViewHeaderProps> = ({
  githubUrl,
  onGithubUrlChange,
  onFetchSkills,
  isLoading = false,
  syncEnabled = false,
  syncConfig,
  onEnableSync,
  viewMode = 'installed',
  onViewModeChange,
}) => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(githubUrl);
  const [showDirectoriesConfig, setShowDirectoriesConfig] = useState(false);
  const [showPendingChanges, setShowPendingChanges] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unsyncedSkills, setUnsyncedSkills] = useState<Array<{ name: string; path: string; directory: string }>>([]);
  const [isAddingSkills, setIsAddingSkills] = useState(false);
  const { totalPendingCount } = useSkillsPendingChanges();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

        {/* View Mode Toggle */}
        <div
          style={{
            display: 'flex',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            onClick={() => onViewModeChange?.('installed')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: viewMode === 'installed' ? theme.colors.primary : 'transparent',
              color: viewMode === 'installed' ? theme.colors.background : theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            Installed
          </button>
          <button
            onClick={() => onViewModeChange?.('browse')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: viewMode === 'browse' ? theme.colors.primary : 'transparent',
              color: viewMode === 'browse' ? theme.colors.background : theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            Browse
          </button>
        </div>
      </div>

      {/* Center: GitHub URL Input (only in Browse mode) */}
      {viewMode === 'browse' && (
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
      )}

      {/* Spacer when in Installed mode */}
      {viewMode === 'installed' && <div style={{ flex: 1 }} />}

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
      {syncEnabled && (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
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
            <ChevronDown size={16} />
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

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                minWidth: '200px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setShowPendingChanges(true);
                  setShowDropdown(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: theme.colors.text,
                  fontSize: theme.fontSizes[1],
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FileText size={16} color={totalPendingCount > 0 ? '#f59e0b' : theme.colors.textSecondary} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: theme.fontWeights.medium }}>Pending Changes</div>
                  {totalPendingCount > 0 && (
                    <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, marginTop: '2px' }}>
                      {totalPendingCount} file{totalPendingCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </button>

              <div style={{ height: '1px', backgroundColor: theme.colors.border }} />

              <button
                onClick={() => {
                  setShowDirectoriesConfig(true);
                  setShowDropdown(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: theme.colors.text,
                  fontSize: theme.fontSizes[1],
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FolderCog size={16} color={theme.colors.textSecondary} />
                <div style={{ fontWeight: theme.fontWeights.medium }}>Configure Directories</div>
              </button>
            </div>
          )}
        </div>
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
