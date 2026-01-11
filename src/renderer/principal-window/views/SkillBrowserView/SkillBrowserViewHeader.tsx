import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Zap, Github, Download, RefreshCw } from 'lucide-react';

interface SkillBrowserViewHeaderProps {
  githubUrl: string;
  onGithubUrlChange: (url: string) => void;
  onFetchSkills: (url?: string) => void;
  isLoading?: boolean;
  syncEnabled?: boolean;
  onEnableSync?: () => void;
}

export const SkillBrowserViewHeader: React.FC<SkillBrowserViewHeaderProps> = ({
  githubUrl,
  onGithubUrlChange,
  onFetchSkills,
  isLoading = false,
  syncEnabled = false,
  onEnableSync,
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={20} color={theme.colors.text} />
        <h2
          style={{
            fontSize: theme.fontSizes[4],
            fontWeight: theme.fontWeights.semibold,
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
    </div>
  );
};
