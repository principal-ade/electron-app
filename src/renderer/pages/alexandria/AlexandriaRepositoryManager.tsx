/**
 * TODO: This component is scheduled for refactoring
 *
 * The AlexandriaRepositoryManager will be changed to focus primarily on the search functionality
 * rather than showing the full Alexandria UI. The landing page has shifted to handle repository
 * management directly, so this component should be simplified to just the DocumentSearchView part.
 *
 * Current issues that won't be fixed due to pending refactor:
 * - Uses height: '100vh' which doesn't account for window titlebar
 * - Missing proper titlebar component integration
 * - Shows repository list that duplicates landing page functionality
 *
 * @deprecated The repository list functionality will be removed in favor of landing page
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Trash2, ExternalLink } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaRepositoryList } from '../../components/alexandria/AlexandriaRepositoryList';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WindowService } from '../../main-process-api/WindowService';
import { DocumentSearchView } from '../DocumentSearch/DocumentSearchView';
import { RemoveRepositoryDialog } from '../../components/dialogs/RemoveRepositoryDialog';

interface AlexandriaRepositoryManagerProps {
  showSearch?: boolean;
  onSearchClose?: () => void;
}

export const AlexandriaRepositoryManager: React.FC<
  AlexandriaRepositoryManagerProps
> = ({ showSearch = false, onSearchClose }) => {
  const { theme } = useTheme();
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepository, setSelectedRepository] = useState<AlexandriaEntry | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Load repositories on mount and listen for backend events
  useEffect(() => {
    loadRepositories();

    // Subscribe to repository changes from backend
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      // For removal events, we handle the state update locally
      // Only reload for add/update events from external sources
      if (event.type !== 'removed') {
        loadRepositories();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const loadRepositories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call the Alexandria service
      const repos = await AlexandriaService.getRepositories();
      setRepositories(repos);
    } catch (err) {
      console.error('Failed to load repositories:', err);
      setError('Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepository = (repo: AlexandriaEntry) => {
    setSelectedRepository(repo);
  };

  const handleOpenDashboard = async () => {
    if (!selectedRepository) return;

    try {
      await WindowService.openRepositoryDashboard(selectedRepository);
    } catch (err) {
      console.error('Failed to open repository:', err);
    }
  };

  const handleRemoveClick = () => {
    if (!selectedRepository) return;
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async (deleteLocal: boolean) => {
    if (!selectedRepository) return;

    try {
      const removedName = selectedRepository.name;
      const success = await AlexandriaService.removeRepository(
        removedName,
        deleteLocal
      );

      if (success) {
        // Update local state immediately for smooth UX
        setRepositories(prev => prev.filter(repo => repo.name !== removedName));
        setSelectedRepository(null);
        setShowRemoveDialog(false);
      } else {
        console.error('Failed to remove repository');
        // Could show an error toast here
      }
    } catch (err) {
      console.error('Error removing repository:', err);
    }
  };

  const handleRemoveCancel = () => {
    setShowRemoveDialog(false);
  };

  const handleRefresh = async () => {
    await loadRepositories();
  };

  // Show search view if active
  if (showSearch) {
    return <DocumentSearchView onClose={onSearchClose || (() => {})} />;
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: theme.colors.background,
          color: theme.colors.error,
        }}
      >
        <h2 style={{ marginBottom: theme.space[3] }}>Error</h2>
        <p>{error}</p>
        <button
          onClick={loadRepositories}
          style={{
            marginTop: theme.space[4],
            padding: `${theme.space[2]}px ${theme.space[4]}px`,
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: theme.radii[2],
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Action Buttons */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          Repositories
        </h1>

        {/* Action buttons for selected repository */}
        {selectedRepository && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                padding: '4px 12px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                fontSize: '13px',
                color: theme.colors.textSecondary,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={selectedRepository.name}
            >
              {selectedRepository.name}
            </div>

            <button
              onClick={handleOpenDashboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <ExternalLink size={14} />
              Open Dashboard
            </button>

            <button
              onClick={handleRemoveClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: theme.colors.error || '#ef4444',
                border: `1px solid ${theme.colors.error || '#ef4444'}`,
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.colors.error || '#ef4444'}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Repository List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AlexandriaRepositoryList
          repositories={repositories}
          onSelectRepository={handleSelectRepository}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          selectedRepository={selectedRepository}
        />
      </div>

      {/* Remove Repository Dialog */}
      {showRemoveDialog && selectedRepository && (
        <RemoveRepositoryDialog
          repository={selectedRepository}
          onConfirm={handleRemoveConfirm}
          onCancel={handleRemoveCancel}
        />
      )}
    </div>
  );
};
