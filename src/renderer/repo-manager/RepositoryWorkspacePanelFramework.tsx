import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Layers, Sparkles } from 'lucide-react';

export interface RepositoryWorkspacePanelFrameworkProps {
  repositoryPath: string;
}

/**
 * Panel Framework version of the Repository Workspace
 *
 * This is a simplified, modern panel system that uses:
 * - Registry-based panel definitions
 * - RepositoryPanelProvider for shared data/state
 * - ConfigurablePanelLayout for visual layout management
 */
export const RepositoryWorkspacePanelFramework: React.FC<
  RepositoryWorkspacePanelFrameworkProps
> = ({ repositoryPath }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.colors.background,
        gap: '24px',
        padding: '48px',
      }}
    >
      {/* Icon */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Layers
          size={64}
          style={{
            color: theme.colors.primary,
            opacity: 0.8,
          }}
        />
        <Sparkles
          size={24}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            color: theme.colors.warning,
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: '600px',
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: '12px',
            fontSize: `${theme.fontSizes[4]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
          }}
        >
          Panel Framework Mode
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: `${theme.fontSizes[2]}px`,
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          You've switched to the new Panel Framework experience! This is a modern,
          registry-based panel system that will provide a cleaner and more flexible
          way to work with your repositories.
        </p>
      </div>

      {/* Repository Info */}
      <div
        style={{
          padding: '16px 24px',
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          fontFamily: theme.fonts.monospace,
          fontSize: `${theme.fontSizes[1]}px`,
          color: theme.colors.textMuted,
        }}
      >
        Repository: <span style={{ color: theme.colors.text }}>{repositoryPath}</span>
      </div>

      {/* Status Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: theme.colors.backgroundTertiary,
          border: `1px solid ${theme.colors.warning}`,
          borderRadius: '20px',
          fontSize: `${theme.fontSizes[1]}px`,
          fontWeight: theme.fontWeights.medium,
          color: theme.colors.warning,
        }}
      >
        <Sparkles size={14} />
        Coming Soon - Under Development
      </div>

      {/* Additional Info */}
      <div
        style={{
          marginTop: '24px',
          padding: '20px',
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          maxWidth: '600px',
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: '12px',
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
          }}
        >
          What's Coming:
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: `${theme.fontSizes[2]}px`,
            color: theme.colors.textSecondary,
            lineHeight: 1.8,
          }}
        >
          <li>Clean, registry-based panel system</li>
          <li>Simplified state management with RepositoryPanelProvider</li>
          <li>Configurable panel layouts saved per repository</li>
          <li>Modern, streamlined user experience</li>
          <li>All your favorite panels, reimagined</li>
        </ul>
      </div>
    </div>
  );
};
