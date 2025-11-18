import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { Copy, FolderOpen, Scissors, FileText, RotateCcw } from 'lucide-react';
import { ShellService } from '../main-process-api/ShellService';
import { GitService } from '../main-process-api/GitService';
import type { GitStatus } from '../../shared/types/repository.types';

interface GitChangesContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  isFolder: boolean;
  repositoryPath: string;
  fileStatus?: 'staged' | 'unstaged' | 'untracked' | 'deleted';
  onClose: () => void;
  onOpenFile?: (filePath: string) => void;
  onRefreshStatus?: () => void;
}

export const GitChangesContextMenu: React.FC<GitChangesContextMenuProps> = ({
  x,
  y,
  filePath,
  isFolder,
  repositoryPath,
  fileStatus,
  onClose,
  onOpenFile,
  onRefreshStatus,
}) => {
  const { theme } = useTheme();

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      onClose();
    };
    // Small delay to prevent immediate close
    setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 0);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const handleCopyPath = useCallback(() => {
    const fullPath = `${repositoryPath}/${filePath}`;
    navigator.clipboard.writeText(fullPath);
    onClose();
  }, [filePath, repositoryPath, onClose]);

  const handleCopyRelativePath = useCallback(() => {
    navigator.clipboard.writeText(filePath);
    onClose();
  }, [filePath, onClose]);

  const handleRevealInFinder = useCallback(async () => {
    const fullPath = `${repositoryPath}/${filePath}`;
    try {
      await ShellService.showItemInFolder(fullPath);
    } catch (error) {
      console.error('Failed to reveal in finder:', error);
    }
    onClose();
  }, [filePath, repositoryPath, onClose]);

  const handleOpenFile = useCallback(() => {
    if (onOpenFile) {
      onOpenFile(filePath);
    }
    onClose();
  }, [filePath, onOpenFile, onClose]);

  const handleDiscardChanges = useCallback(async () => {
    // Confirm discard - this is a destructive operation
    const confirmed = window.confirm(
      `Are you sure you want to discard changes to "${filePath}"?\n\nThis will permanently revert the file to its last committed state. This action cannot be undone.`,
    );

    if (!confirmed) {
      onClose();
      return;
    }

    try {
      // Try git restore first (modern git)
      try {
        await GitService.execCommand(repositoryPath, ['restore', filePath]);
      } catch (restoreError) {
        // Fallback to checkout for older git versions
        await GitService.execCommand(repositoryPath, [
          'checkout',
          'HEAD',
          '--',
          filePath,
        ]);
      }

      // Refresh git status to show updated state
      if (onRefreshStatus) {
        onRefreshStatus();
      }

      console.log(`Successfully discarded changes to: ${filePath}`);
    } catch (error) {
      console.error('Failed to discard changes:', error);
      alert(`Failed to discard changes: ${error}`);
    }
    onClose();
  }, [filePath, repositoryPath, onClose, onRefreshStatus]);

  // Determine which menu items to show based on file status
  const menuItems = [];

  // Always show copy and reveal options
  menuItems.push(
    {
      label: 'Copy Path',
      icon: <Copy size={14} />,
      onClick: handleCopyPath,
    },
    {
      label: 'Copy Relative Path',
      icon: <Scissors size={14} />,
      onClick: handleCopyRelativePath,
    },
    {
      label: 'Reveal in Finder',
      icon: <FolderOpen size={14} />,
      onClick: handleRevealInFinder,
    },
  );

  // Add "Open File" for files (not folders)
  if (!isFolder && onOpenFile) {
    menuItems.push({
      label: 'Open File',
      icon: <FileText size={14} />,
      onClick: handleOpenFile,
    });
  }

  // Add "Discard Changes" for modified or deleted files (not untracked)
  if (!isFolder && fileStatus && fileStatus !== 'untracked') {
    menuItems.push({
      label: 'Discard Changes',
      icon: <RotateCcw size={14} />,
      onClick: handleDiscardChanges,
      dangerous: true,
    });
  }

  // Adjust position if menu would go off screen
  const menuWidth = 220;
  const menuHeight = menuItems.length * 36 + 8;
  const adjustedX =
    x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : x;
  const adjustedY =
    y + menuHeight > window.innerHeight
      ? window.innerHeight - menuHeight - 10
      : y;

  const menuContent = (
    <div
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        padding: '4px',
        minWidth: menuWidth,
        zIndex: 999999, // Very high z-index to ensure it appears above all panels
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            background: 'transparent',
            color: item.dangerous ? theme.colors.error : theme.colors.text,
            fontSize: '13px',
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.background;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // Render using a portal to escape parent overflow constraints
  return createPortal(menuContent, document.body);
};
