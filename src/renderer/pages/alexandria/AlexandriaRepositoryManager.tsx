import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Search } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaRepositoryList } from '../../components/alexandria/AlexandriaRepositoryList';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WindowService } from '../../main-process-api/WindowService';
import { DocumentSearchView } from '../DocumentSearch/DocumentSearchView';

export const AlexandriaRepositoryManager: React.FC = () => {
  const { theme } = useTheme();
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  
  // Load repositories on mount and listen for backend events
  useEffect(() => {
    loadRepositories();
    
    // Subscribe to repository changes from backend
    const unsubscribe = window.mainProcess.alexandria.onRepositoryChange(() => {
      // Reload repositories when any change occurs
      loadRepositories();
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
  
  const handleSelectRepository = async (repo: AlexandriaEntry) => {
    try {
      // Open repository dashboard - backend will handle the mapping
      await WindowService.openRepositoryDashboard(repo);
    } catch (err) {
      console.error('Failed to open repository:', err);
    }
  };
  
  
  const handleRefresh = async () => {
    await loadRepositories();
  };
  
  // Show search view if active
  if (showSearch) {
    return <DocumentSearchView onClose={() => setShowSearch(false)} />;
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.error
      }}>
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
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Search Button */}
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: theme.colors.text,
          margin: 0
        }}>
          Repositories
        </h1>
        <button
          onClick={() => setShowSearch(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Search size={18} />
          Search Documentation
        </button>
      </div>

      {/* Repository List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AlexandriaRepositoryList
          repositories={repositories}
          onSelectRepository={handleSelectRepository}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};