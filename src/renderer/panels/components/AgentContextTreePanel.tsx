/**
 * AgentContextTreePanel - Display files accessed by agents in a multi-tree view
 *
 * This panel shows all files that have been read, written, edited, or listed
 * by agent sessions, organized by session. Uses MultiFileTree from dynamic-file-tree
 * to display multiple agent sessions side-by-side.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { MultiFileTree } from '@a24z/dynamic-file-tree';
import type {
  LoadedFileTreeSource,
  FileTreeSource,
} from '@principal-ai/repository-abstraction';
import { AgentContextTrackingService } from '../../services/AgentContextTrackingService';
import { Activity, Trash2, RefreshCw } from 'lucide-react';

export interface AgentContextTreePanelProps {
  repositoryPath?: string | null;
  onFileSelect?: (filePath: string) => void;
}

export const AgentContextTreePanel: React.FC<AgentContextTreePanelProps> = ({
  repositoryPath,
  onFileSelect,
}) => {
  const { theme } = useTheme();
  const [sources, setSources] = useState<LoadedFileTreeSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial sources
  useEffect(() => {
    console.log(
      '[AgentContextTreePanel] Loading sources for repository:',
      repositoryPath,
    );
    loadSources();
  }, [repositoryPath]);

  // Subscribe to session updates
  useEffect(() => {
    const unsubscribe = AgentContextTrackingService.subscribe((sessions) => {
      console.log('[AgentContextTreePanel] Sessions updated:', sessions.size);
      loadSources();
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  const loadSources = useCallback(() => {
    setLoading(true);
    try {
      const treeSources = AgentContextTrackingService.getSessionsAsTreeSources(
        repositoryPath || undefined,
      );
      console.log(
        '[AgentContextTreePanel] Loaded sources:',
        treeSources.length,
      );
      setSources(treeSources);
    } catch (error) {
      console.error('[AgentContextTreePanel] Error loading sources:', error);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  const handleFileSelect = useCallback(
    (source: FileTreeSource, filePath: string) => {
      console.log(
        '[AgentContextTreePanel] File selected:',
        filePath,
        'from session:',
        source.id,
      );
      if (onFileSelect) {
        onFileSelect(filePath);
      }
    },
    [onFileSelect],
  );

  const handleClearAll = useCallback(() => {
    if (repositoryPath) {
      AgentContextTrackingService.clearRepositorySessions(repositoryPath);
    } else {
      AgentContextTrackingService.clearAllSessions();
    }
  }, [repositoryPath]);

  const handleRefresh = useCallback(() => {
    loadSources();
  }, [loadSources]);

  const stats = AgentContextTrackingService.getStatistics();

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Activity size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <div style={{ fontSize: '14px' }}>Loading agent context...</div>
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.text,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '4px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: theme.colors.primary }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>
              Agent Context
            </span>
            <span
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                backgroundColor: theme.colors.background,
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              0 sessions
            </span>
          </div>

          <button
            onClick={handleRefresh}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Refresh"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {/* Empty state */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <div>
            <Activity
              size={48}
              style={{ opacity: 0.3, marginBottom: '16px' }}
            />
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
              No agent context available
            </div>
            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              Files accessed by agents will appear here
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '4px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: theme.colors.primary }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Agent Context
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.background,
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {sources.length} {sources.length === 1 ? 'session' : 'sessions'}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.background,
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {stats.totalFiles} {stats.totalFiles === 1 ? 'file' : 'files'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRefresh}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Refresh"
          >
            <RefreshCw size={12} />
            Refresh
          </button>

          <button
            onClick={handleClearAll}
            disabled={sources.length === 0}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color:
                sources.length === 0
                  ? theme.colors.textSecondary
                  : theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: sources.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: sources.length === 0 ? 0.5 : 1,
            }}
            title="Clear all sessions"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Multi-tree view */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MultiFileTree
          sources={sources}
          theme={theme}
          onFileSelect={handleFileSelect}
          showHeader={false}
          showFilters={true}
          showViewModeToggle={true}
          showSelectedFileIndicator={true}
          initialViewMode="all"
          rootDirectoryName="Agent Sessions"
          defaultOpen={true}
        />
      </div>
    </div>
  );
};
