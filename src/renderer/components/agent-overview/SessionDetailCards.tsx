import { useTheme } from '@principal-ade/industry-theme';

interface FileActionButtonsProps {
  fileFilter: string;
  createdFiles: number;
  deletedFiles: number;
  largeFiles: number;
  onFilterChange: (filter: string) => void;
}

export const FileActionButtons: React.FC<FileActionButtonsProps> = ({
  fileFilter,
  createdFiles,
  deletedFiles,
  largeFiles,
  onFilterChange,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }}
    >
      <button
        onClick={() => onFilterChange('created')}
        style={{
          backgroundColor: `${theme.colors.success}20`,
          border: `1px solid ${theme.colors.success}80`,
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'left',
          transition: 'all 0.2s',
          width: '100%',
          cursor: 'pointer',
          boxShadow:
            fileFilter === 'created'
              ? `0 0 0 2px ${theme.colors.success}`
              : 'none',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.success}30`)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.success}20`)
        }
      >
        <p
          style={{
            color: theme.colors.success,
            fontSize: theme.fontSizes[2],
            margin: '0 0 4px 0',
          }}
        >
          Created Files
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[4],
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {createdFiles}
        </p>
      </button>

      <button
        onClick={() => onFilterChange('deleted')}
        style={{
          backgroundColor: `${theme.colors.error}20`,
          border: `1px solid ${theme.colors.error}80`,
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'left',
          transition: 'all 0.2s',
          width: '100%',
          cursor: 'pointer',
          boxShadow:
            fileFilter === 'deleted'
              ? `0 0 0 2px ${theme.colors.error}`
              : 'none',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.error}30`)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.error}20`)
        }
      >
        <p
          style={{
            color: theme.colors.error,
            fontSize: theme.fontSizes[2],
            margin: '0 0 4px 0',
          }}
        >
          Deleted Files
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[4],
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {deletedFiles}
        </p>
      </button>

      <button
        onClick={() => onFilterChange('large')}
        style={{
          backgroundColor: `${theme.colors.warning}20`,
          border: `1px solid ${theme.colors.warning}80`,
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'left',
          transition: 'all 0.2s',
          width: '100%',
          cursor: 'pointer',
          boxShadow:
            fileFilter === 'large'
              ? `0 0 0 2px ${theme.colors.warning}`
              : 'none',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.warning}30`)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = `${theme.colors.warning}20`)
        }
      >
        <p
          style={{
            color: theme.colors.warning,
            fontSize: theme.fontSizes[2],
            margin: '0 0 4px 0',
          }}
        >
          Large Files
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[4],
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {largeFiles}
        </p>
      </button>
    </div>
  );
};

interface ToolStatsCardsProps {
  totalCalls: number;
  uniqueTools: number;
}

export const ToolStatsCards: React.FC<ToolStatsCardsProps> = ({
  totalCalls,
  uniqueTools,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Total Calls
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {totalCalls}
        </p>
      </div>
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Unique Tools
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {uniqueTools}
        </p>
      </div>
    </div>
  );
};

interface ToolUsageCardProps {
  toolCounts: Record<string, number>;
}

export const ToolUsageCard: React.FC<ToolUsageCardProps> = ({ toolCounts }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundTertiary,
        padding: '12px',
      }}
    >
      <h3
        style={{
          fontWeight: theme.fontWeights.medium,
          marginBottom: '8px',
          color: theme.colors.text,
          fontSize: theme.fontSizes[2],
        }}
      >
        Tool Usage
      </h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {Object.entries(toolCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([toolName, count]) => (
            <div
              key={toolName}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
                padding: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.text,
                }}
              >
                {toolName}
              </span>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                }}
              >
                {count}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

interface RecentToolCallsCardProps {
  toolCalls: Array<{
    toolName: string;
    timestamp: number;
    parameters: any;
  }>;
}

export const RecentToolCallsCard: React.FC<RecentToolCallsCardProps> = ({
  toolCalls,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundTertiary,
        padding: '16px',
      }}
    >
      <h3
        style={{
          fontWeight: theme.fontWeights.medium,
          marginBottom: '12px',
          color: theme.colors.text,
        }}
      >
        Recent Calls
      </h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '384px',
          overflowY: 'auto',
        }}
      >
        {toolCalls
          .slice(-20)
          .reverse()
          .map((toolCall, index) => (
            <div
              key={index}
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
                padding: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontFamily: theme.fonts.monospace,
                    fontSize: theme.fontSizes[2],
                    color: theme.colors.text,
                  }}
                >
                  {toolCall.toolName}
                </span>
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                  }}
                >
                  {new Date(toolCall.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {toolCall.parameters &&
                Object.keys(toolCall.parameters).length > 0 && (
                  <div
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {Object.entries(toolCall.parameters).map(([key, value]) => (
                      <div key={key} style={{ marginTop: '4px' }}>
                        <span style={{ color: theme.colors.textTertiary }}>
                          {key}:
                        </span>{' '}
                        <span style={{ color: theme.colors.textSecondary }}>
                          {JSON.stringify(value).substring(0, 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
      </div>
    </div>
  );
};

interface KnipAnalysisStatsProps {
  unusedFiles: number;
  unusedExports: number;
  unusedDependencies: number;
  unresolvedImports: number;
}

export const KnipAnalysisStats: React.FC<KnipAnalysisStatsProps> = ({
  unusedFiles,
  unusedExports,
  unusedDependencies,
  unresolvedImports,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Unused Files
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {unusedFiles}
        </p>
      </div>
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Unused Exports
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {unusedExports}
        </p>
      </div>
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Unused Dependencies
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {unusedDependencies}
        </p>
      </div>
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: '0 0 4px 0',
          }}
        >
          Unresolved Imports
        </p>
        <p
          style={{
            fontSize: theme.fontSizes[3],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          {unresolvedImports}
        </p>
      </div>
    </div>
  );
};
