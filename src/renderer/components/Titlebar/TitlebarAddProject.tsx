import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FolderOpen, Github } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';

export interface TitlebarAddProjectProps {
  onAddLocalRepository: () => void;
  onAddGithubLink: () => void;
  position?: 'left' | 'right';
  style?: React.CSSProperties;
}

export const TitlebarAddProject: React.FC<TitlebarAddProjectProps> = ({
  onAddLocalRepository,
  onAddGithubLink,
  position = 'right',
  style,
}) => {
  const { theme, colorMode } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Handle click outside dropdown
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

  const buttonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '26px',
    padding: '0 14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: theme.colors.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    WebkitAppRegion: 'no-drag' as any,
    zIndex: 10,
    whiteSpace: 'nowrap',
    ...style,
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: position === 'right' ? 0 : undefined,
    left: position === 'left' ? 0 : undefined,
    backgroundColor: theme.colors.backgroundSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    minWidth: '180px',
    zIndex: 1000,
    overflow: 'hidden',
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        ...style,
      }}
    >
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        aria-label="Add Project"
        title="Add a new project"
      >
        <span>Add Project</span>
        <ChevronDown
          size={12}
          style={{
            transform: showDropdown ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            marginLeft: '2px',
          }}
        />
      </button>

      {showDropdown && (
        <div style={dropdownStyle}>
          <button
            onClick={() => {
              setShowDropdown(false);
              onAddLocalRepository();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FolderOpen size={14} />
            Local Folder
          </button>

          <div
            style={{
              height: '1px',
              backgroundColor: theme.colors.border,
            }}
          />

          <button
            onClick={() => {
              setShowDropdown(false);
              onAddGithubLink();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Github size={14} />
            Paste Link
          </button>
        </div>
      )}
    </div>
  );
};