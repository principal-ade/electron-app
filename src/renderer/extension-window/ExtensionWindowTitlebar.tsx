/**
 * Extension Window Titlebar
 *
 * Simple titlebar for the extension browser window using BaseTitlebar.
 */

import React from 'react';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';

interface ExtensionWindowTitlebarProps {
  extensionsDirectory: string;
}

export const ExtensionWindowTitlebar: React.FC<ExtensionWindowTitlebarProps> = ({
  extensionsDirectory,
}) => {
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
      <div
        position="center"
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
