import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Zap, Github, Download, X, FolderPlus, Plus } from 'lucide-react';

export type ViewMode = 'installed' | 'browse';

export interface DetectedDirectory {
  id: string;
  path: string;
  displayName: string;
  icon: string;
  skillCount: number;
  skills: string[];
}

interface SkillBrowserViewHeaderProps {
  githubUrl: string;
  onGithubUrlChange: (url: string) => void;
  onFetchSkills: (url?: string) => void;
  isLoading?: boolean;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showGithubInput?: boolean;
  currentRepo?: {
    owner: string;
    repo: string;
    branch: string;
  } | null;
  onClearRepo?: () => void;
  hasDetectedDirectories?: boolean;
  onOpenSetup?: () => void;
  detectedDirectories?: DetectedDirectory[];
}

export const SkillBrowserViewHeader: React.FC<SkillBrowserViewHeaderProps> = ({
  githubUrl,
  onGithubUrlChange,
  onFetchSkills,
  isLoading = false,
  viewMode = 'installed',
  onViewModeChange,
  showGithubInput = true,
  currentRepo,
  onClearRepo,
  hasDetectedDirectories = true,
  onOpenSetup,
  detectedDirectories = [],
}) => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState(githubUrl);

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

      {/* Center: Current Repo or GitHub URL Input */}
      {viewMode === 'browse' && currentRepo ? (
        /* Show current repo info with clear button */
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingLeft: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <Github size={16} color={theme.colors.primary} />
            <span
              style={{
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.monospace,
                color: theme.colors.text,
                fontWeight: theme.fontWeights.medium,
              }}
            >
              {currentRepo.owner}/{currentRepo.repo}
            </span>
            <span
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.monospace,
              }}
            >
              @{currentRepo.branch}
            </span>
          </div>
          {onClearRepo && (
            <button
              onClick={onClearRepo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.error;
                e.currentTarget.style.color = theme.colors.error;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>
      ) : viewMode === 'browse' && showGithubInput ? (
        /* Show GitHub URL input in Browse mode when showing input */
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
      ) : null}

      {/* Spacer */}
      {(viewMode === 'installed' || (viewMode === 'browse' && !showGithubInput && !currentRepo)) && <div style={{ flex: 1 }} />}

      {/* Setup button when no directories detected in Installed mode */}
      {viewMode === 'installed' && !hasDetectedDirectories && onOpenSetup && (
        <button
          onClick={onOpenSetup}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            cursor: 'pointer',
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <FolderPlus size={16} />
          Set Up Agent Skills
        </button>
      )}

      {/* Detected directories info when in Installed mode */}
      {viewMode === 'installed' && hasDetectedDirectories && detectedDirectories.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            whiteSpace: 'nowrap',
          }}>
            <span>Identified Agent Skills:</span>
            <span style={{
              color: theme.colors.text,
              fontWeight: theme.fontWeights.medium,
            }}>
              {detectedDirectories
                .filter(dir => dir.id !== 'agent-universal')
                .map(dir => dir.displayName)
                .join(', ')}
            </span>
          </div>
          {onOpenSetup && (
            <button
              onClick={onOpenSetup}
              title="Add more agent directories"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      )}
      </div>
    </>
  );
};
