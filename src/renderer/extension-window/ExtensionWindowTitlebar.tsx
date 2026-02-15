/**
 * Extension Window Titlebar
 *
 * Simple titlebar for the extension browser window using BaseTitlebar.
 */

import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';

interface ExtensionWindowTitlebarProps {
  extensionsDirectory: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const ExtensionWindowTitlebar: React.FC<
  ExtensionWindowTitlebarProps
> = ({ extensionsDirectory, sidebarCollapsed, onToggleSidebar }) => {
  return (
    <BaseTitlebar
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🧩</span>
          <span>Extensions</span>
        </div>
      }
      showWindowControls={true}
      showThemeDropdown={false}
      showCustomizeButton={false}
    >
      <button
        data-position="left"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
        className="flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 hover:bg-gray-700 text-gray-400 hover:text-white"
        style={
          {
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          } as React.CSSProperties
        }
      >
        {sidebarCollapsed ? (
          <PanelLeft size={18} />
        ) : (
          <PanelLeftClose size={18} />
        )}
      </button>
      <div
        data-position="center"
        style={{
          fontSize: '11px',
          opacity: 0.5,
          maxWidth: '400px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={extensionsDirectory}
      >
        {extensionsDirectory}
      </div>
    </BaseTitlebar>
  );
};
