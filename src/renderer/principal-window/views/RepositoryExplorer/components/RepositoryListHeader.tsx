import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, FolderOpen, Github, RefreshCw, GitBranch } from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface RepositoryListHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddLocalRepository: () => void;
  onAddGithubLink: () => void;
  repositoryCount: number;
  onCheckAllStatus?: () => void;
  isCheckingStatus?: boolean;
  showOnlyWithChanges?: boolean;
  onToggleChangesFilter?: (show: boolean) => void;
}

export const RepositoryListHeader: React.FC<RepositoryListHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onAddLocalRepository,
  onAddGithubLink,
  repositoryCount,
  onCheckAllStatus,
  isCheckingStatus = false,
  showOnlyWithChanges = false,
  onToggleChangesFilter,
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
          {/* Filter Changes Button */}
          {onToggleChangesFilter && (
            <button
              onClick={() => onToggleChangesFilter(!showOnlyWithChanges)}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                backgroundColor: showOnlyWithChanges ? theme.colors.primary : theme.colors.backgroundTertiary,
                color: showOnlyWithChanges ? theme.colors.background : theme.colors.text,
                border: `1px solid ${showOnlyWithChanges ? theme.colors.primary : theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '12px',
                fontWeight: showOnlyWithChanges ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                if (!showOnlyWithChanges) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                } else {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!showOnlyWithChanges) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                } else {
                  e.currentTarget.style.opacity = '1';
                }
              }}
              title={showOnlyWithChanges ? 'Show all repositories' : 'Show only repositories with changes'}
              aria-label="Filter repositories with changes"
            >
              <GitBranch size={14} />
              {showOnlyWithChanges ? 'With Changes' : 'All'}
            </button>
          )}

          {/* Check All Status Button */}
          {onCheckAllStatus && (
            <button
              onClick={onCheckAllStatus}
              disabled={isCheckingStatus}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isCheckingStatus ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                opacity: isCheckingStatus ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isCheckingStatus) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
              title="Check status of all repositories"
              aria-label="Check all repository status"
            >
              <RefreshCw
                size={16}
                style={{
                  animation: isCheckingStatus ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          )}

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