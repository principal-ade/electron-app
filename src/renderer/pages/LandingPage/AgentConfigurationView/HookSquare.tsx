import React, { useState } from 'react';
import {
  FileText,
  Scroll,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Settings,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface HookSquareProps {
  command: string;
  matcher: string;
  color: string;
  onEdit: () => void;
  onRemove: () => void;
  onShowInfo: () => void;
  enabled?: boolean;
  onToggle?: () => void;
  layout?: 'grid' | 'list';
}

export const HookSquare: React.FC<HookSquareProps> = ({
  command,
  matcher,
  color,
  onEdit,
  onRemove,
  onShowInfo,
  enabled = true,
  onToggle,
  layout = 'grid',
}) => {
  const { theme } = useTheme();
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Extract command name for display
  const fullName = command.split('/').pop() || command;
  const commandName = fullName.replace(/\.(sh|js|py)$/, '');
  const fileExtension = fullName.match(/\.(sh|js|py)$/)?.[1] || 'sh';

  // List layout
  if (layout === 'list') {
    return (
      <div
        className={`flex items-center justify-between rounded-lg p-4 transition-all ${!enabled ? 'opacity-50' : ''}`}
        style={{ 
          backgroundColor: isHovered ? theme.colors.backgroundHover : theme.colors.surface 
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* File type icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <span style={{ color }}>
              {fileExtension === 'js' ? (
                <Scroll size={20} />
              ) : fileExtension === 'py' ? (
                '🐍'
              ) : (
                <FileText size={20} />
              )}
            </span>
          </div>

          {/* Hook info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate" title={commandName}>
              {commandName}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <code 
                className="px-2 py-0.5 rounded font-mono"
                style={{ 
                  backgroundColor: theme.colors.background, 
                  color: theme.colors.textTertiary 
                }}
              >
                {matcher}
              </code>
              <span className="truncate" style={{ color: theme.colors.textSecondary }} title={command}>
                {command}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
          {/* Enable/Disable Toggle */}
          {onToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-2 rounded transition-colors flex items-center gap-1"
              style={{ 
                backgroundColor: hoveredButton === 'toggle' ? theme.colors.background : 'transparent' 
              }}
              onMouseEnter={() => setHoveredButton('toggle')}
              onMouseLeave={() => setHoveredButton(null)}
              title={enabled ? 'Disable hook' : 'Enable hook'}
            >
              {enabled ? (
                <ToggleRight size={20} className="text-green-500" />
              ) : (
                <ToggleLeft size={20} style={{ color: theme.colors.textSecondary }} />
              )}
              <span className="text-xs ml-1" style={{ color: theme.colors.textSecondary }}>
                {enabled ? 'On' : 'Off'}
              </span>
            </button>
          )}

          {/* Configure button */}
          <button
            onClick={onEdit}
            className="p-2 rounded transition-colors flex items-center gap-1"
            style={{ 
              backgroundColor: hoveredButton === 'configure' ? theme.colors.background : 'transparent' 
            }}
            onMouseEnter={() => setHoveredButton('configure')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Configure hook"
          >
            <Settings size={16} style={{ color: theme.colors.textSecondary }} />
            <span className="text-xs" style={{ color: theme.colors.textSecondary }}>Configure</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 mx-1" style={{ backgroundColor: theme.colors.border }} />

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const confirmed = window.confirm(
                `Are you sure you want to remove the hook "${commandName}"?`,
              );
              if (confirmed) {
                onRemove();
              }
            }}
            className="p-2 rounded hover:bg-red-600/20 transition-colors"
            title="Remove hook"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  // Grid layout (original)
  return (
    <div
      className="relative rounded-lg p-4 aspect-square flex flex-col items-center justify-center transition-all group cursor-pointer"
      style={{ 
        backgroundColor: showActions ? theme.colors.backgroundHover : theme.colors.surface 
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onEdit}
    >
      {/* File type icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <span style={{ color }}>
          {fileExtension === 'js' ? (
            <Scroll size={20} />
          ) : fileExtension === 'py' ? (
            '🐍'
          ) : (
            <FileText size={20} />
          )}
        </span>
      </div>

      {/* Hook name */}
      <p
        className="text-sm font-medium text-white truncate max-w-full px-2 mb-2"
        title={commandName}
      >
        {commandName}
      </p>

      {/* Matcher */}
      <code 
        className="text-xs px-2 py-1 rounded font-mono"
        style={{ 
          backgroundColor: theme.colors.background, 
          color: theme.colors.textTertiary 
        }}
      >
        {matcher}
      </code>

      {/* Hover actions - positioned at top */}
      <div className="absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded transition-colors"
            style={{ 
              backgroundColor: hoveredButton === 'edit' ? theme.colors.surface : `${theme.colors.background}e6` 
            }}
            onMouseEnter={() => setHoveredButton('edit')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Edit hook"
          >
            <svg
              className="w-4 h-4"
              style={{ color: theme.colors.textTertiary }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowInfo();
            }}
            className="p-1 rounded transition-colors"
            style={{ 
              backgroundColor: hoveredButton === 'edit' ? theme.colors.surface : `${theme.colors.background}e6` 
            }}
            onMouseEnter={() => setHoveredButton('edit')}
            onMouseLeave={() => setHoveredButton(null)}
            title="View details"
          >
            <svg
              className="w-4 h-4"
              style={{ color: theme.colors.textTertiary }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded transition-colors"
            style={{ 
              backgroundColor: hoveredButton === 'remove' ? 'rgba(220, 38, 38, 0.2)' : `${theme.colors.background}e6` 
            }}
            onMouseEnter={() => setHoveredButton('remove')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Remove hook"
          >
            <svg
              className="w-4 h-4 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
