import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FileText,
  FilePlus,
  FileX,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  GitCommit,
} from 'lucide-react';
import { useSkillsPendingChanges } from '../../../hooks/useSkillsPendingChanges';
import { useSkillsSync } from '../../../hooks/useSkillsSync';

interface PendingChangesPanelProps {
  onClose?: () => void;
}

export const PendingChangesPanel: React.FC<PendingChangesPanelProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const { pendingChanges, hasPendingChanges, totalPendingCount, clearPendingChanges } =
    useSkillsPendingChanges();
  const { config } = useSkillsSync();

  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());
  const [selectedChanges, setSelectedChanges] = useState<Map<string, Set<string>>>(new Map());

  // Toggle directory expansion
  const toggleDirectory = (directoryId: string) => {
    setExpandedDirectories((prev) => {
      const next = new Set(prev);
      if (next.has(directoryId)) {
        next.delete(directoryId);
      } else {
        next.add(directoryId);
        // Auto-select all changes when expanding
        if (!selectedChanges.has(directoryId)) {
          const changes = pendingChanges.get(directoryId);
          if (changes) {
            const allPaths = new Set(changes.changes.map((c) => c.path));
            setSelectedChanges((prev) => {
              const next = new Map(prev);
              next.set(directoryId, allPaths);
              return next;
            });
          }
        }
      }
      return next;
    });
  };

  // Toggle individual change selection
  const toggleChange = (directoryId: string, changePath: string) => {
    setSelectedChanges((prev) => {
      const next = new Map(prev);
      const dirSelection = next.get(directoryId) || new Set();
      if (dirSelection.has(changePath)) {
        dirSelection.delete(changePath);
      } else {
        dirSelection.add(changePath);
      }
      next.set(directoryId, dirSelection);
      return next;
    });
  };

  // Get directory display name from config
  const getDirectoryName = (directoryId: string): string => {
    const directory = config?.directories.find((d) => d.id === directoryId);
    return directory?.displayName || directoryId;
  };

  // Get change type icon
  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <FilePlus className="w-4 h-4 text-green-500" />;
      case 'deleted':
        return <FileX className="w-4 h-4 text-red-500" />;
      case 'modified':
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  // Get change type label
  const getChangeTypeLabel = (type: string): string => {
    switch (type) {
      case 'added':
        return 'Added';
      case 'deleted':
        return 'Deleted';
      case 'modified':
      default:
        return 'Modified';
    }
  };

  // Handle sync for a directory
  const handleSync = async (directoryId: string) => {
    const selected = selectedChanges.get(directoryId);
    if (!selected || selected.size === 0) {
      alert('Please select at least one change to sync');
      return;
    }

    // TODO: Implement actual sync logic
    // For now, just clear the pending changes
    console.info('[PendingChangesPanel] Syncing directory:', directoryId, 'changes:', selected);

    await clearPendingChanges(directoryId);

    // Clear selection
    setSelectedChanges((prev) => {
      const next = new Map(prev);
      next.delete(directoryId);
      return next;
    });
  };

  // Handle discard for a directory
  const handleDiscard = async (directoryId: string) => {
    if (confirm('Are you sure you want to discard these changes? This action cannot be undone.')) {
      await clearPendingChanges(directoryId);

      // Clear selection
      setSelectedChanges((prev) => {
        const next = new Map(prev);
        next.delete(directoryId);
        return next;
      });
    }
  };

  // Handle ignore (just close the panel)
  const handleIgnore = () => {
    onClose?.();
  };

  if (!hasPendingChanges) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#10b981' }} />
        <p style={{ fontSize: '14px', marginBottom: '8px', color: theme.colors.text }}>
          No Pending Changes
        </p>
        <p style={{ fontSize: '12px' }}>
          All skills are in sync. Changes will appear here when detected.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary || theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle className="w-5 h-5" style={{ color: '#f59e0b' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.text }}>
              Pending Skills Changes
            </h3>
          </div>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: '#f59e0b',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {totalPendingCount} change{totalPendingCount !== 1 ? 's' : ''}
          </div>
        </div>
        <p style={{ fontSize: '12px', color: theme.colors.textSecondary, margin: '8px 0 0 0' }}>
          Review and sync changes detected in your global skills directories
        </p>
      </div>

      {/* Directory list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {Array.from(pendingChanges.entries()).map(([directoryId, dirChanges]) => {
          const isExpanded = expandedDirectories.has(directoryId);
          const dirSelection = selectedChanges.get(directoryId) || new Set();
          const selectedCount = dirSelection.size;

          return (
            <div
              key={directoryId}
              style={{
                marginBottom: '16px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                overflow: 'hidden',
              }}
            >
              {/* Directory header */}
              <div
                onClick={() => toggleDirectory(directoryId)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: theme.colors.text }}>
                    {getDirectoryName(directoryId)}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      backgroundColor: theme.colors.backgroundSecondary || theme.colors.background,
                    }}
                  >
                    {dirChanges.changes.length} change{dirChanges.changes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                  {new Date(dirChanges.lastDetected).toLocaleTimeString()}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  {/* Changes list */}
                  <div style={{ padding: '8px' }}>
                    {dirChanges.changes.map((change) => {
                      const isSelected = dirSelection.has(change.path);
                      const skillName = change.path.split('/').pop()?.replace('.md', '') || change.path;

                      return (
                        <div
                          key={change.path}
                          onClick={() => toggleChange(directoryId, change.path)}
                          style={{
                            padding: '8px 12px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: isSelected
                              ? 'rgba(0, 0, 0, 0.05)'
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          {getChangeIcon(change.type)}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', color: theme.colors.text }}>
                              {skillName}
                            </div>
                            <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                              {change.path}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color:
                                change.type === 'added'
                                  ? '#10b981'
                                  : change.type === 'deleted'
                                    ? '#ef4444'
                                    : '#3b82f6',
                            }}
                          >
                            {getChangeTypeLabel(change.type)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: `1px solid ${theme.colors.border}`,
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      onClick={() => handleDiscard(directoryId)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: 'transparent',
                        color: theme.colors.textSecondary,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Discard
                    </button>
                    <button
                      onClick={() => handleSync(directoryId)}
                      disabled={selectedCount === 0}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedCount > 0 ? '#3b82f6' : theme.colors.backgroundSecondary || theme.colors.background,
                        color: selectedCount > 0 ? '#fff' : theme.colors.textSecondary,
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <GitCommit className="w-4 h-4" />
                      Commit & Sync ({selectedCount})
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <p style={{ fontSize: '12px', color: theme.colors.textSecondary, margin: 0 }}>
          Changes are detected from repository monitoring
        </p>
        <button
          onClick={handleIgnore}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
