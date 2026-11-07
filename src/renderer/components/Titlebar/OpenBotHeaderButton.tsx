import React from 'react';
import { Bot } from 'lucide-react';
import type { Theme } from '@principal-ade/industry-theme';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';

const OPENBOT_APP_PORT = 3010;

export interface OpenBotHeaderButtonProps {
  theme: Theme;
}

/** Opens the locally running OpenBot app in a workspace browser tab. */
export const OpenBotHeaderButton: React.FC<OpenBotHeaderButtonProps> = ({
  theme,
}) => {
  const { openLocalhostBrowser } = useWorkspaceTabs();

  return (
    <button
      type="button"
      onClick={() => openLocalhostBrowser(OPENBOT_APP_PORT, '/', 'OpenBot')}
      title={`Open OpenBot in a tab (localhost:${OPENBOT_APP_PORT})`}
      aria-label="OpenBot"
      style={{
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
        background: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        color: theme.colors.textSecondary,
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s',
        fontSize: theme.fontSizes[1],
        fontWeight: 500,
        fontFamily: theme.fonts.body,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor =
          theme.colors.backgroundTertiary;
        event.currentTarget.style.color = theme.colors.text;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor =
          theme.colors.backgroundSecondary;
        event.currentTarget.style.color = theme.colors.textSecondary;
      }}
    >
      <Bot size={14} />
      <span>OpenBot</span>
    </button>
  );
};

export default OpenBotHeaderButton;
