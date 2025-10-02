import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, FolderOpen, Github } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';

interface RepositoryListHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddLocalRepository: () => void;
  onAddGithubLink: () => void;
  repositoryCount: number;
}

export const RepositoryListHeader: React.FC<RepositoryListHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onAddLocalRepository,
  onAddGithubLink,
  repositoryCount,
}) => {
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
      style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
      }}
    >
      {/* Header Title and Count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h2
          style={{
            fontSize: theme.fontSizes[2], // 16px
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Repositories
          {repositoryCount > 0 && (
            <span
              style={{
                fontSize: theme.fontSizes[0], // 12px
                fontWeight: 500,
                color: theme.colors.textSecondary,
                backgroundColor: theme.colors.backgroundTertiary,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {repositoryCount}
            </span>
          )}
        </h2>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Add Repository Button */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Add Repository"
            aria-label="Add Repository"
          >
            <Plus size={18} />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
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
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          position: 'relative',
          width: '100%',
        }}
      >
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textSecondary,
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            height: '32px',
            paddingLeft: '32px',
            paddingRight: '12px',
            backgroundColor: theme.colors.backgroundTertiary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            color: theme.colors.text,
            fontSize: theme.fontSizes[1], // 14px
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        />
      </div>
    </div>
    </>
  );
};