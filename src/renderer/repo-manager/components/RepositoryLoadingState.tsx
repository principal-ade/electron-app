import { useTheme } from '@principal-ade/industry-theme';

interface RepositoryLoadingStateProps {
  repositoryName: string;
}

export const RepositoryLoadingState: React.FC<RepositoryLoadingStateProps> = ({
  repositoryName,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      {/* Animated Tree Icon */}
      <div
        style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <style>{`
          @keyframes tree-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.3;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.5;
            }
          }
          
          @keyframes tree-ring {
            0% {
              transform: scale(0.8);
              opacity: 0.6;
            }
            100% {
              transform: scale(1.3);
              opacity: 0;
            }
          }
          
          @keyframes dots-fade {
            0%, 100% {
              opacity: 0.3;
            }
            50% {
              opacity: 1;
            }
          }
        `}</style>

        {/* Background rings */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px solid ${theme.colors.primary}`,
            animation: 'tree-ring 2s ease-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px solid ${theme.colors.primary}`,
            animation: 'tree-ring 2s ease-out infinite 0.5s',
          }}
        />

        {/* Tree structure */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            animation: 'tree-pulse 2s ease-in-out infinite',
          }}
        >
          {/* Root node */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary,
            }}
          />

          {/* Branches */}
          <svg
            width="60"
            height="40"
            viewBox="0 0 60 40"
            style={{ opacity: 0.6 }}
          >
            <line
              x1="30"
              y1="0"
              x2="30"
              y2="15"
              stroke={theme.colors.primary}
              strokeWidth="2"
            />
            <line
              x1="30"
              y1="15"
              x2="10"
              y2="30"
              stroke={theme.colors.primary}
              strokeWidth="2"
            />
            <line
              x1="30"
              y1="15"
              x2="50"
              y2="30"
              stroke={theme.colors.primary}
              strokeWidth="2"
            />
            <circle cx="10" cy="30" r="4" fill={theme.colors.primary} />
            <circle cx="50" cy="30" r="4" fill={theme.colors.primary} />
            <line
              x1="10"
              y1="30"
              x2="5"
              y2="38"
              stroke={theme.colors.primary}
              strokeWidth="1.5"
            />
            <line
              x1="10"
              y1="30"
              x2="15"
              y2="38"
              stroke={theme.colors.primary}
              strokeWidth="1.5"
            />
            <line
              x1="50"
              y1="30"
              x2="45"
              y2="38"
              stroke={theme.colors.primary}
              strokeWidth="1.5"
            />
            <line
              x1="50"
              y1="30"
              x2="55"
              y2="38"
              stroke={theme.colors.primary}
              strokeWidth="1.5"
            />
            <circle
              cx="5"
              cy="38"
              r="3"
              fill={theme.colors.primary}
              opacity="0.7"
            />
            <circle
              cx="15"
              cy="38"
              r="3"
              fill={theme.colors.primary}
              opacity="0.7"
            />
            <circle
              cx="45"
              cy="38"
              r="3"
              fill={theme.colors.primary}
              opacity="0.7"
            />
            <circle
              cx="55"
              cy="38"
              r="3"
              fill={theme.colors.primary}
              opacity="0.7"
            />
          </svg>
        </div>
      </div>

      {/* Loading text */}
      <div
        style={{
          textAlign: 'center',
          gap: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          Building Source Tree
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            margin: 0,
          }}
        >
          Analyzing {repositoryName} repository structure
        </p>

        {/* Animated dots */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginTop: '12px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary,
              animation: 'dots-fade 1.5s ease-in-out infinite',
            }}
          />
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary,
              animation: 'dots-fade 1.5s ease-in-out infinite 0.3s',
            }}
          />
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary,
              animation: 'dots-fade 1.5s ease-in-out infinite 0.6s',
            }}
          />
        </div>
      </div>

      {/* Additional info */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success || '#10b981',
              flexShrink: 0,
            }}
          />
          <span>Parsing file structure and dependencies</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success || '#10b981',
              flexShrink: 0,
            }}
          />
          <span>Computing code metrics and statistics</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: theme.colors.warning || '#f59e0b',
              flexShrink: 0,
              animation: 'dots-fade 1s ease-in-out infinite',
            }}
          />
          <span>Generating visualization data...</span>
        </div>
      </div>
    </div>
  );
};
