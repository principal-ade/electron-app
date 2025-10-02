import { useTheme } from '@a24z/industry-theme';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'dots' | 'skeleton';
  height?: number | string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'spinner',
  height = 200,
}) => {
  const { theme } = useTheme();

  if (variant === 'skeleton') {
    return (
      <div style={{ height }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '60px',
              marginBottom: '8px',
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: '6px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, transparent, ${theme.colors.backgroundSecondary}, transparent)`,
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        ))}
        <style>{`
          @keyframes shimmer {
            to {
              left: 100%;
            }
          }
        `}</style>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: theme.colors.primary,
                animation: `pulse 1.4s infinite ease-in-out ${i * 0.16}s`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          {message}
        </div>
        <style>{`
          @keyframes pulse {
            0%, 80%, 100% {
              transform: scale(0);
              opacity: 0;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // Default spinner variant
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height,
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: `3px solid ${theme.colors.backgroundLight}`,
          borderTopColor: theme.colors.primary,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div
        style={{
          fontSize: '13px',
          color: theme.colors.textSecondary,
        }}
      >
        {message}
      </div>
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
