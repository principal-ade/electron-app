import React, { useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
import { WindowService } from '../main-process-api/WindowService';
import type { RepositoryWindowState, TabTransferData } from '../main-process-api/WindowService';

interface SendTabButtonProps {
  /** Which direction the tab should travel. */
  direction: 'to-dev-workspace' | 'to-principal';
  /** The currently active tab id (the one that will be sent). */
  activeTabId: string | null;
  /** The cwd / local-path of the active tab, used as target routing hint. */
  cwd: string;
  /** Session id of the active terminal tab (may be undefined for non-terminal tabs). */
  sessionId?: string;
  /** When direction is `to-dev-workspace`, the list of open repo windows. */
  repoWindows?: RepositoryWindowState[];
  /** Called after the tab has been dispatched (so the parent can close it). */
  onTabDispatched?: () => void;
}

export const SendTabButton: React.FC<SendTabButtonProps> = ({
  direction,
  activeTabId,
  cwd,
  sessionId,
  repoWindows,
  onTabDispatched,
}) => {
  const label =
    direction === 'to-dev-workspace'
      ? 'open in repo window'
      : 'open in main window';

  const disabled = !activeTabId;

  const handleClick = useCallback(() => {
    if (!activeTabId) return;

    const data: TabTransferData = {
      tabId: activeTabId,
      sessionId,
      cwd,
      direction,
    };

    void WindowService.sendTabToWindow(data);
    onTabDispatched?.();
  }, [activeTabId, sessionId, cwd, direction, onTabDispatched]);

  const multipleRepoWindows =
    direction === 'to-dev-workspace' &&
    repoWindows &&
    repoWindows.filter((rw) => rw.localPath).length > 1;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'inherit' : 'inherit',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        padding: '0 8px',
        whiteSpace: 'nowrap',
      }}
      title={
        direction === 'to-dev-workspace'
          ? 'Move this tab to a repository window'
          : 'Move this tab to the main window'
      }
    >
      {label}
      {multipleRepoWindows && <ChevronUp size={12} />}
    </button>
  );
};
