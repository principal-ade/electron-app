import React from 'react';
import { useTheme } from 'themed-markdown';
import { MapIcon } from 'lucide-react';

interface EmptyStateProps {
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.backgroundSecondary,
        padding: '40px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <MapIcon
          size={48}
          color={theme.colors.textSecondary}
          style={{ opacity: 0.3, marginBottom: '16px' }}
        />
        <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
          {message}
        </p>
      </div>
    </div>
  );
};
