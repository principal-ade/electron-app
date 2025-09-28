import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Code, ChevronDown } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { ShellService } from '../../main-process-api/ShellService';
import type { Repository } from '../../../shared/types/repository.types';

interface TitlebarOpenInIDEProps {
  repository?: Repository;
}

export const TitlebarOpenInIDE: React.FC<TitlebarOpenInIDEProps> = ({
  repository
}) => {
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getRepositoryPath = useCallback(() => {
    if (!repository) return null;

    // Check if repository has localClones and use the first one
    if (repository.localClones && repository.localClones.length > 0) {
      return repository.localClones[0].path;
    }

    // Fallback to local_path if it exists
    if ('local_path' in repository && repository.local_path) {
      return repository.local_path;
    }

    return null;
  }, [repository]);

  const handleOpenInIDE = useCallback(async (editor: 'vscode' | 'cursor' | 'webstorm' | 'sublime' | 'intellij') => {
    const repoPath = getRepositoryPath();
    if (!repoPath) return;

    try {
      const result = await ShellService.openInEditor({
        editor,
        dir: repoPath
      });

      if (!result.success) {
        console.error('Failed to open in IDE:', result.error);
      }
    } catch (error) {
      console.error('Error opening in IDE:', error);
    }

    setShowDropdown(false);
  }, [getRepositoryPath]);

  const handleOpenInDefaultIDE = useCallback(async () => {
    const repoPath = getRepositoryPath();
    if (!repoPath) return;

    try {
      const result = await ShellService.openInDefaultEditor(repoPath);
      if (!result.success) {
        console.error('Failed to open in default IDE:', result.error);
      }
    } catch (error) {
      console.error('Error opening in default IDE:', error);
    }

    setShowDropdown(false);
  }, [getRepositoryPath]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  if (!repository) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        WebkitAppRegion: 'no-drag' as any,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: 'transparent',
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s',
          height: '32px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          e.currentTarget.style.borderColor = theme.colors.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = theme.colors.border;
        }}
        title="Open repository in external IDE"
      >
        <Code size={14} />
        <span>Open in IDE</span>
        <ChevronDown size={12} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '180px',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={handleOpenInDefaultIDE}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            Default (VS Code)
          </button>

          <div
            style={{
              height: '1px',
              backgroundColor: theme.colors.border,
            }}
          />

          <button
            onClick={() => handleOpenInIDE('vscode')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            VS Code
          </button>

          <button
            onClick={() => handleOpenInIDE('cursor')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            Cursor
          </button>

          <button
            onClick={() => handleOpenInIDE('webstorm')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            WebStorm
          </button>

          <button
            onClick={() => handleOpenInIDE('sublime')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            Sublime Text
          </button>

          <button
            onClick={() => handleOpenInIDE('intellij')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Code size={16} />
            IntelliJ IDEA
          </button>
        </div>
      )}
    </div>
  );
};