import { useTheme } from '@principal-ade/industry-theme';

interface LoadingAnimationProps {
  message: string;
  fileCount?: number;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  message,
  fileCount,
}) => {
  const { theme } = useTheme();

  // Generate a 4x4 grid of squares with deterministic sizes based on position
  const squares = Array.from({ length: 16 }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    // Use position-based sizing for stability (no random values)
    const sizeVariation = ((row + col) % 3) * 5; // Creates pattern: 0, 5, 10, 5, 0...
    const size = 65 + sizeVariation; // Sizes will be 65, 70, or 75px
    const delay = (row + col) * 0.1; // Diagonal wave effect
    return { id: i, size, delay, row, col };
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.backgroundSecondary,
        padding: '40px',
      }}
    >
      {/* Centered container for all content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* Map-like grid of shimmering squares */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 80px)',
            gridTemplateRows: 'repeat(4, 80px)',
            gap: '12px',
            placeItems: 'center',
          }}
        >
          {squares.map((square) => (
            <div
              key={square.id}
              className={`shimmer-square shimmer-square-${square.id}`}
              style={{
                width: `${square.size}px`,
                height: `${square.size}px`,
                borderRadius: '4px',
                background: `linear-gradient(
                  90deg,
                  ${theme.colors.backgroundTertiary} 25%,
                  ${theme.colors.backgroundLight || theme.colors.backgroundSecondary} 50%,
                  ${theme.colors.backgroundTertiary} 75%
                )`,
                backgroundSize: '200% 100%',
                animation: `shimmer 1.5s ease-in-out ${square.delay}s infinite`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>

        {/* Loading text */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              color: theme.colors.text,
              marginBottom: '8px',
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            {message}
          </p>
          {fileCount !== undefined && (
            <p
              style={{
                color: theme.colors.textSecondary,
                fontSize: '14px',
              }}
            >
              Processing {fileCount.toLocaleString()} files...
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
};
