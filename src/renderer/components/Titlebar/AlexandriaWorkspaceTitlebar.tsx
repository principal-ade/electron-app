import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Workspace } from '@a24z/core-library';

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({ workspace }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        height: '56px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        fontFamily: theme.fonts.body,
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'drag',
      }}
    >
      {/* Left: Workspace name and color indicator */}
      <div
        style={{
          marginLeft: '80px', // Position after traffic lights on macOS
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Color indicator */}
        {workspace.color && (
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: workspace.color,
            }}
          />
        )}

        {/* Workspace name */}
        <span
          style={{
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
          }}
        >
          {workspace.name}
        </span>

        {/* Description */}
        {workspace.description && (
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspace.description}
          </span>
        )}
      </div>

      {/* Right: Actions will go here */}
      <div
        style={{
          marginLeft: 'auto',
          marginRight: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Actions placeholder */}
      </div>
    </div>
  );
};
