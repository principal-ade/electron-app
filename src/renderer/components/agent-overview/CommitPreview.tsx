import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  GitCommit,
  FileText,
  FilePlus,
  FileX,
  FileEdit,
  ArrowRight,
} from 'lucide-react';

interface CommitPreviewProps {
  sessionId: string;
  directory: string;
  onCommit?: () => void;
}

interface UncommittedChanges {
  segments: Array<{
    timestamp: number;
    hasCommit: boolean;
  }>;
  changes: {
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
    stats: { additions: number; deletions: number };
  } | null;
  filesFromSegments: string[];
}

export const CommitPreview: React.FC<CommitPreviewProps> = ({
  sessionId,
  directory,
  onCommit,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [uncommittedChanges, setUncommittedChanges] =
    useState<UncommittedChanges | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadUncommittedChanges();
  }, [sessionId]);

  const loadUncommittedChanges = async () => {
    setLoading(true);
    try {
      const result =
        await window.electron?.agentSession?.getUncommittedChangesForSegments(
          sessionId,
        );
      if (result) {
        setUncommittedChanges(result);

        // Generate default commit message
        if (result.changes) {
          const parts = [];
          if (result.changes.created.length > 0) {
            parts.push(
              `Added ${result.changes.created.length} file${result.changes.created.length > 1 ? 's' : ''}`,
            );
          }
          if (result.changes.modified.length > 0) {
            parts.push(
              `Modified ${result.changes.modified.length} file${result.changes.modified.length > 1 ? 's' : ''}`,
            );
          }
          if (result.changes.deleted.length > 0) {
            parts.push(
              `Deleted ${result.changes.deleted.length} file${result.changes.deleted.length > 1 ? 's' : ''}`,
            );
          }
          setCommitMessage(parts.join(', ') || 'Update files');
        }
      }
    } catch (error) {
      console.error('Failed to load uncommitted changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || !uncommittedChanges) return;

    setCommitting(true);
    try {
      const result = await window.electron?.agentSession?.performManualCommit(
        sessionId,
        commitMessage,
      );

      if (result?.success) {
        // Reload changes
        await loadUncommittedChanges();
        setCommitMessage('');
        onCommit?.();
      } else {
        console.error('Commit failed:', result?.error);
      }
    } catch (error) {
      console.error('Failed to commit:', error);
    } finally {
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          margin: '16px',
        }}
      >
        <div style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          Loading changes...
        </div>
      </div>
    );
  }

  if (
    !uncommittedChanges ||
    !uncommittedChanges.changes ||
    (uncommittedChanges.changes.created.length === 0 &&
      uncommittedChanges.changes.modified.length === 0 &&
      uncommittedChanges.changes.deleted.length === 0)
  ) {
    return null;
  }

  const { changes, segments } = uncommittedChanges;
  const totalChanges =
    changes.created.length +
    changes.modified.length +
    changes.deleted.length +
    changes.renamed.length;

  return (
    <div
      style={{
        margin: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCommit size={20} color={theme.colors.primary} />
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Uncommitted Changes
          </h3>
          <span
            style={{
              fontSize: '12px',
              padding: '2px 8px',
              backgroundColor: `${theme.colors.primary}20`,
              color: theme.colors.primary,
              borderRadius: '12px',
            }}
          >
            {segments.length} segment{segments.length > 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.primary,
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Summary */}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {changes.created.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FilePlus size={16} color={theme.colors.success} />
            <span style={{ fontSize: '14px', color: theme.colors.text }}>
              {changes.created.length} created
            </span>
          </div>
        )}
        {changes.modified.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileEdit size={16} color={theme.colors.warning} />
            <span style={{ fontSize: '14px', color: theme.colors.text }}>
              {changes.modified.length} modified
            </span>
          </div>
        )}
        {changes.deleted.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileX size={16} color={theme.colors.danger} />
            <span style={{ fontSize: '14px', color: theme.colors.text }}>
              {changes.deleted.length} deleted
            </span>
          </div>
        )}
        {changes.renamed.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowRight size={16} color={theme.colors.info} />
            <span style={{ fontSize: '14px', color: theme.colors.text }}>
              {changes.renamed.length} renamed
            </span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: theme.colors.success }}>
            +{changes.stats.additions}
          </span>
          <span style={{ fontSize: '14px', color: theme.colors.danger }}>
            -{changes.stats.deletions}
          </span>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div
          style={{
            padding: '0 16px 16px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {changes.created.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '4px',
                }}
              >
                Created Files
              </div>
              {changes.created.map((file, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    color: theme.colors.success,
                    marginLeft: '16px',
                  }}
                >
                  + {file}
                </div>
              ))}
            </div>
          )}
          {changes.modified.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '4px',
                }}
              >
                Modified Files
              </div>
              {changes.modified.map((file, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    color: theme.colors.warning,
                    marginLeft: '16px',
                  }}
                >
                  ~ {file}
                </div>
              ))}
            </div>
          )}
          {changes.deleted.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '4px',
                }}
              >
                Deleted Files
              </div>
              {changes.deleted.map((file, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    color: theme.colors.danger,
                    marginLeft: '16px',
                  }}
                >
                  - {file}
                </div>
              ))}
            </div>
          )}
          {changes.renamed.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '4px',
                }}
              >
                Renamed Files
              </div>
              {changes.renamed.map((rename, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    color: theme.colors.info,
                    marginLeft: '16px',
                  }}
                >
                  {rename.from} → {rename.to}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commit Form */}
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || committing}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor:
                commitMessage.trim() && !committing ? 'pointer' : 'not-allowed',
              opacity: commitMessage.trim() && !committing ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (commitMessage.trim() && !committing) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity =
                commitMessage.trim() && !committing ? '1' : '0.5';
            }}
          >
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  );
};
