import React, { useState, useRef, useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { GitStatusWithFiles } from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { GitChangesDropdown } from '../GitChanges/GitChangesDropdown';

export interface TitlebarGitChangesProps {
  directory: string;
  gitStatusWithFiles: GitStatusWithFiles | null;
  onFileClick: (filePath: string) => void;
  position?: 'left' | 'right';
}

export const TitlebarGitChanges: React.FC<TitlebarGitChangesProps> = ({
  directory,
  gitStatusWithFiles,
  onFileClick,
  position = 'right',
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { theme, colorMode } = useTheme();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const totalChanges = gitStatusWithFiles
    ? gitStatusWithFiles.modifiedFiles.length +
      gitStatusWithFiles.untrackedFiles.length +
      gitStatusWithFiles.stagedFiles.length +
      gitStatusWithFiles.createdFiles.length +
      gitStatusWithFiles.deletedFiles.length
    : 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        const dropdownElement = document.querySelector('.git-changes-dropdown');
        if (
          dropdownElement &&
          !dropdownElement.contains(event.target as Node)
        ) {
          setShowDropdown(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  if (!gitStatusWithFiles || totalChanges === 0) {
    return null;
  }

  const buttonPosition =
    position === 'right'
      ? { right: isMac ? '100px' : '220px' }
      : { left: isMac ? '120px' : '60px' };

  const handleButtonClick = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="titlebar-git-changes-button"
        style={{
          position: 'absolute',
          ...buttonPosition,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '28px',
          padding: '0 12px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          color: colorMode === 'dark' ? '#9ca3af' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          WebkitAppRegion: 'no-drag' as any,
          zIndex: 10,
          fontSize: '13px',
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            colorMode === 'dark'
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.05)';
          e.currentTarget.style.color =
            colorMode === 'dark' ? '#d1d5db' : '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color =
            colorMode === 'dark' ? '#9ca3af' : '#6b7280';
        }}
        aria-label={`${totalChanges} uncommitted changes`}
        title={`${totalChanges} uncommitted changes`}
      >
        <GitBranch size={14} />
        <span>{totalChanges}</span>
      </button>

      {showDropdown && (
        <GitChangesDropdown
          gitStatusWithFiles={gitStatusWithFiles}
          onFileClick={(filePath) => {
            onFileClick(filePath);
            setShowDropdown(false);
          }}
          onClose={() => setShowDropdown(false)}
          anchorElement={buttonRef.current}
        />
      )}
    </>
  );
};
