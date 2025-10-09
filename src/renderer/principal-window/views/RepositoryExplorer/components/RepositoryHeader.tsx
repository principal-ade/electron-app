import React, { useCallback, useState, useRef, useEffect } from 'react';
import { GitBranch, Trash2, ExternalLink, Terminal, RefreshCw, GitPullRequest, Upload, Settings } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import { GitBranchStatus } from '../../../../main-process-api/GitService';
import { TerminalService } from '../../../../main-process-api/TerminalService';

interface RepositoryHeaderProps {
  repository: EnhancedAlexandriaEntry;
  gitStatus: { staged: unknown[]; unstaged: unknown[]; untracked: unknown[]; deleted: unknown[] }; // Add git status prop for dirty state
  branchStatus: GitBranchStatus | null;
  pushStatus: { safe: boolean; reason?: string; needsUpstream: boolean } | null;
  isCheckingUpdates: boolean;
  isFastForwarding: boolean;
  isPushing: boolean;
  terminalWindows: Map<string, number>;
  onPerformFastForward: () => void;
  onPerformPush: () => void;
  onOpenDashboard: () => void;
  onRemove: () => void;
  onConfigure?: () => void;
  onTerminalWindowsUpdate: (windows: Map<string, number>) => void;
  onOpenTerminal?: () => void;
  isNestedRightPanelCollapsed?: boolean;
}

const spinAnimation = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

export const RepositoryHeader: React.FC<RepositoryHeaderProps> = ({
  repository,
  gitStatus,
  branchStatus,
  pushStatus,
  isCheckingUpdates,
  isFastForwarding,
  isPushing,
  terminalWindows,
  onPerformFastForward,
  onPerformPush,
  onOpenDashboard,
  onRemove,
  onConfigure,
  onTerminalWindowsUpdate,
  onOpenTerminal,
  isNestedRightPanelCollapsed,
}) => {
  const { theme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleOpenTerminal = useCallback(async () => {
    if (!repository?.path) return;

    // If we have the onOpenTerminal handler, use it to open the right panel with terminal
    if (onOpenTerminal) {
      onOpenTerminal();
      return;
    }

    // Fallback to pop-out behavior if no handler is provided
    try {
      const existingWindowId = terminalWindows.get(repository.path);

      if (existingWindowId) {
        try {
          await TerminalService.focusWindow(existingWindowId);
          // Focused existing terminal window
          return;
        } catch (focusError) {
          console.warn('Failed to focus existing terminal window, will create new one:', focusError);
          const newMap = new Map(terminalWindows);
          newMap.delete(repository.path);
          onTerminalWindowsUpdate(newMap);
        }
      }

      const terminalId = await TerminalService.getOrCreate(repository.path);
      const { windowId } = await TerminalService.popOut(terminalId);

      const newMap = new Map(terminalWindows);
      newMap.set(repository.path, windowId);
      onTerminalWindowsUpdate(newMap);

      // Created new terminal window
    } catch (error) {
      console.error('Error opening terminal:', error);
    }
  }, [repository, terminalWindows, onTerminalWindowsUpdate, onOpenTerminal]);


  return (
    <div
      style={{
        padding: '20px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundLight,
      }}
    >
      <style>{spinAnimation}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '4px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[5],
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              {repository.name}
            </h2>

            {/* Dirty State Indicator */}
            {gitStatus?.isDirty && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: `${theme.colors.warning}15`,
                  color: theme.colors.warning,
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                ● {(gitStatus.staged || 0) + (gitStatus.unstaged || 0) + (gitStatus.untracked || 0)}
              </span>
            )}

            {/* Branch Status Indicator */}
            {branchStatus && branchStatus.hasUpstream && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor:
                    branchStatus.behind > 0 && branchStatus.ahead === 0
                      ? `${theme.colors.warning}15`
                      : branchStatus.ahead > 0 && branchStatus.behind === 0
                      ? `${theme.colors.info}15`
                      : branchStatus.ahead > 0 && branchStatus.behind > 0
                      ? `${theme.colors.error}15`
                      : `${theme.colors.success}15`,
                  color:
                    branchStatus.behind > 0 && branchStatus.ahead === 0
                      ? theme.colors.warning
                      : branchStatus.ahead > 0 && branchStatus.behind === 0
                      ? theme.colors.info
                      : branchStatus.ahead > 0 && branchStatus.behind > 0
                      ? theme.colors.error
                      : theme.colors.success,
                  border: `1px solid ${
                    branchStatus.behind > 0 && branchStatus.ahead === 0
                      ? theme.colors.warning
                      : branchStatus.ahead > 0 && branchStatus.behind === 0
                      ? theme.colors.info
                      : branchStatus.ahead > 0 && branchStatus.behind > 0
                      ? theme.colors.error
                      : theme.colors.success
                  }30`,
                }}
              >
                <GitBranch size={12} />
                {branchStatus.behind > 0 && branchStatus.ahead === 0 && (
                  <>↓ {branchStatus.behind} {branchStatus.branch}</>
                )}
                {branchStatus.ahead > 0 && branchStatus.behind === 0 && (
                  <>↑ {branchStatus.ahead} {branchStatus.branch}</>
                )}
                {branchStatus.ahead > 0 && branchStatus.behind > 0 && (
                  <>↑{branchStatus.ahead} ↓{branchStatus.behind} {branchStatus.branch}</>
                )}
                {branchStatus.ahead === 0 && branchStatus.behind === 0 && <>{branchStatus.branch}</>}
              </div>
            )}

            {!branchStatus && isCheckingUpdates && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.textSecondary,
                }}
              >
                <RefreshCw size={12} className="spin" />
                Checking...
              </div>
            )}
          </div>
          <p
            style={{
              margin: '0',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            {repository.github?.description || 'No Description'}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
{/* Fast Forward Button - Only show when applicable */}
          {branchStatus?.canFastForward && (
            <button
              onClick={onPerformFastForward}
              disabled={isFastForwarding}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: theme.colors.success,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isFastForwarding ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isFastForwarding ? 0.6 : 1,
                animation: 'pulse 2s infinite',
              }}
              onMouseEnter={(e) => {
                if (!isFastForwarding) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFastForwarding) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
              title={`Fast-forward merge ${branchStatus.behind} commit${branchStatus.behind > 1 ? 's' : ''}`}
            >
              <GitPullRequest
                size={14}
                style={{
                  animation: isFastForwarding ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isFastForwarding ? 'Merging...' : 'Fast Forward'}
            </button>
          )}

          {/* Push Button - Only show when there are commits to push */}
          {pushStatus?.safe && branchStatus?.ahead && branchStatus.ahead > 0 && (
            <button
              onClick={onPerformPush}
              disabled={isPushing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: theme.colors.info || theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isPushing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isPushing ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPushing) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPushing) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
              title={pushStatus.reason || `Push ${branchStatus.ahead} commit${branchStatus.ahead > 1 ? 's' : ''} to remote`}
            >
              <Upload
                size={14}
                style={{
                  animation: isPushing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isPushing ? 'Pushing...' : pushStatus.needsUpstream ? 'Push & Set Upstream' : 'Push'}
            </button>
          )}

          <button
            onClick={handleOpenTerminal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
            title={
              onOpenTerminal
                ? (isNestedRightPanelCollapsed ? "Show preview/terminal panel" : "Hide preview/terminal panel")
                : (repository?.path && terminalWindows.has(repository.path)
                    ? "Focus existing terminal window"
                    : "Open terminal in repository directory")
            }
          >
            <Terminal size={14} />
            {onOpenTerminal
              ? (isNestedRightPanelCollapsed ? "Show Panel" : "Hide Panel")
              : (repository?.path && terminalWindows.has(repository.path)
                  ? "Focus Terminal"
                  : "Terminal")
            }
          </button>

          <button
            onClick={onOpenDashboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <ExternalLink size={14} />
            ADE
          </button>

          {/* Settings Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
              title="Repository settings"
            >
              <Settings size={14} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  minWidth: '160px',
                  backgroundColor: theme.colors.backgroundLight,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                {onConfigure && (
                  <button
                    onClick={() => {
                      onConfigure();
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Settings size={14} />
                    Configure
                  </button>
                )}
                <button
                  onClick={() => {
                    onRemove();
                    setIsDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    color: theme.colors.error || '#ef4444',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${theme.colors.error || '#ef4444'}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};