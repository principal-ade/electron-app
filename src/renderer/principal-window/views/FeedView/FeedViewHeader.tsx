import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitBranch } from 'lucide-react';

export const FeedViewHeader: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GitBranch size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: theme.fontSizes[4], fontWeight: theme.fontWeights.semibold, margin: 0 }}>
          Projects
        </h2>
      </div>
    </div>
  );
};
