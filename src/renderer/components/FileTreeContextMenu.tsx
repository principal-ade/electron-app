import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { Copy, Trash2, FolderOpen, Scissors } from 'lucide-react';
import { ShellService } from '../main-process-api/ShellService';
import { FileSystemService } from '../main-process-api/FileSystemService';

interface FileTreeContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  isFolder: boolean;
  repositoryPath?: string;
  onClose: () => void;
  onDelete?: (filePath: string) => void;
}

export const FileTreeContextMenu: React.FC<FileTreeContextMenuProps> = ({
  x,
  y,
  filePath,
  isFolder,
  repositoryPath,
  onClose,
  onDelete,
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
    const fullPath = repositoryPath
      ? `${repositoryPath}/${filePath}`
      : filePath;
    navigator.clipboard.writeText(fullPath);
    onClose();
  }, [filePath, repositoryPath, onClose]);

  const handleCopyRelativePath = useCallback(() => {
    navigator.clipboard.writeText(filePath);
    onClose();
  }, [filePath, onClose]);

  const handleRevealInFinder = useCallback(async () => {
    const fullPath = repositoryPath
      ? `${repositoryPath}/${filePath}`
      : filePath;
    try {
      await ShellService.showItemInFolder(fullPath);
    } catch (error) {
      console.error('Failed to reveal in finder:', error);
    }
    onClose();
  }, [filePath, repositoryPath, onClose]);

  const handleDelete = useCallback(async () => {
    const fullPath = repositoryPath
      ? `${repositoryPath}/${filePath}`
      : filePath;

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete ${isFolder ? 'folder' : 'file'} "${filePath}"?\n\nThis will move it to the trash.`,
    );

    if (confirmed) {
      try {
        await ShellService.moveToTrash(fullPath);
        onDelete?.(filePath);
      } catch (error) {
        console.error('Failed to delete:', error);
        alert(`Failed to delete: ${error}`);
      }
    }
    onClose();
  }, [filePath, repositoryPath, isFolder, onClose, onDelete]);

  const menuItems = [
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
    {
      label: `Delete ${isFolder ? 'Folder' : 'File'}`,
      icon: <Trash2 size={14} />,
      onClick: handleDelete,
      dangerous: true,
    },
  ];

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
