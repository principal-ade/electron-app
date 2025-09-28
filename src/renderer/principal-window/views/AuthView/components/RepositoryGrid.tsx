import React, { useState, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Package, Search, X, Cloud, HardDrive, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import type { GitHubRepository } from '../../../../../shared/main-process-api-interfaces/GitHubAPI';
import { UnifiedRepositoryCard } from './UnifiedRepositoryCard';
import { GitCloneModal } from '../../RepositoryExplorer/components/GitCloneModal';

interface RepositoryGridProps {
  repositories: (AlexandriaEntry | EnhancedAlexandriaEntry)[];
  remoteRepositories?: GitHubRepository[];
  selectedOrg: string | null;
  loading?: boolean;
  onOpenRepository: (repo: AlexandriaEntry | EnhancedAlexandriaEntry) => void;
}

export const RepositoryGrid: React.FC<RepositoryGridProps> = ({
  repositories,
  remoteRepositories = [],
  selectedOrg,
  loading = false,
  onOpenRepository,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemote, setShowRemote] = useState(true);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedRepoForClone, setSelectedRepoForClone] = useState<GitHubRepository | null>(null);

  // Filter local repositories based on search query
  const filteredLocalRepositories = useMemo(() => {
    if (!searchQuery.trim()) {
      return repositories;
    }

    const query = searchQuery.toLowerCase();
    return repositories.filter((repo) => {
      const name = repo.name.toLowerCase();
      const description = (repo.github?.description || '').toLowerCase();
      const owner = (repo.github?.owner || '').toLowerCase();
      const language = (repo.github?.primaryLanguage || '').toLowerCase();

      return (
        name.includes(query) ||
        description.includes(query) ||
        owner.includes(query) ||
        language.includes(query)
      );
    });
  }, [repositories, searchQuery]);

  // Filter remote repositories based on search query and organization
  const filteredRemoteRepositories = useMemo(() => {
    if (!showRemote) return [];

    let filtered = remoteRepositories;

    // Filter by selected organization
    if (selectedOrg) {
      filtered = filtered.filter(repo => repo.owner.login === selectedOrg);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((repo) => {
        const name = repo.name.toLowerCase();
        const description = (repo.description || '').toLowerCase();
        const owner = repo.owner.login.toLowerCase();
        const language = (repo.language || '').toLowerCase();

        return (
          name.includes(query) ||
          description.includes(query) ||
          owner.includes(query) ||
          language.includes(query)
        );
      });
    }

    return filtered;
  }, [remoteRepositories, searchQuery, selectedOrg, showRemote]);

  // Create a unified list of all repositories
  const allRepositories = useMemo(() => {
    // Create maps for quick lookup
    const localRepoMap = new Map<string, typeof filteredLocalRepositories[0]>();
    const remoteRepoMap = new Map<string, typeof filteredRemoteRepositories[0]>();

    // Track local repos by multiple keys for better matching
    const localRepoNameSet = new Set<string>();

    filteredLocalRepositories.forEach(repo => {
      // Try to extract owner from various sources
      let owner: string | undefined = repo.github?.owner;

      // If no GitHub owner, try to extract from remote URL
      if (!owner && repo.remoteUrl) {
        const match = repo.remoteUrl.match(/github\.com[:/]([^/]+)\//);
        if (match) {
          owner = match[1];
        }
      }

      // Add to map with owner/name key if we have owner
      if (owner) {
        const key = `${owner}/${repo.name}`.toLowerCase();
        localRepoMap.set(key, repo);
      }

      // Also track just by name for fallback matching
      localRepoNameSet.add(repo.name.toLowerCase());
    });

    filteredRemoteRepositories.forEach(repo => {
      const key = `${repo.owner.login}/${repo.name}`.toLowerCase();
      remoteRepoMap.set(key, repo);
    });

    // Combine repos with merged data
    const combined: Array<{
      repository: AlexandriaEntry | EnhancedAlexandriaEntry | GitHubRepository;
      remoteData?: GitHubRepository;
      isRemote: boolean;
      name: string;
    }> = [];

    // Add all local repositories, enriching with remote data if available
    filteredLocalRepositories.forEach(repo => {
      // Try to find matching remote repo
      let owner: string | undefined = repo.github?.owner;

      // If no GitHub owner, try to extract from remote URL
      if (!owner && repo.remoteUrl) {
        const match = repo.remoteUrl.match(/github\.com[:/]([^/]+)\//);
        if (match) {
          owner = match[1];
        }
      }

      let remoteData: typeof filteredRemoteRepositories[0] | undefined;
      if (owner) {
        const key = `${owner}/${repo.name}`.toLowerCase();
        remoteData = remoteRepoMap.get(key);
      }

      // If we have remote data, enrich the local repo with it
      if (remoteData) {
        // Merge remote data into local repo
        repo.github = {
          ...repo.github,
          description: remoteData.description || repo.github?.description,
          primaryLanguage: remoteData.language || repo.github?.primaryLanguage,
          url: remoteData.html_url,
          lastCommit: remoteData.pushed_at || repo.github?.lastCommit,
          owner: owner || repo.github?.owner,
          isFork: remoteData.fork,
        };
      }

      combined.push({
        repository: repo,
        remoteData,
        isRemote: false,
        name: repo.name,
      });
    });

    // Add remote repositories that aren't already local
    filteredRemoteRepositories.forEach(repo => {
      const key = `${repo.owner.login}/${repo.name}`.toLowerCase();

      // Check if this remote repo exists locally by either full key or just name
      const existsLocally = localRepoMap.has(key) || localRepoNameSet.has(repo.name.toLowerCase());

      if (!existsLocally) {
        combined.push({
          repository: repo,
          isRemote: true,
          name: repo.name,
        });
      }
    });

    // Sort alphabetically by name
    return combined.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }, [filteredLocalRepositories, filteredRemoteRepositories]);

  const totalCount = allRepositories.length;

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>Loading repositories...</p>
        </div>
      </div>
    );
  }

  if (repositories.length === 0 && remoteRepositories.length === 0 && !searchQuery) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>
            {selectedOrg
              ? `No repositories found in ${selectedOrg}`
              : 'No repositories found'}
          </p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Add repositories from the Repository Explorer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '24px',
      }}
    >
      {/* Header with Search */}
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '4px',
            }}
          >
            {selectedOrg || 'All Repositories'}
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
            }}
          >
            {totalCount} {totalCount === 1 ? 'repository' : 'repositories'}
            {searchQuery && totalCount === 0 && ' - No matches found'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Toggle for showing remote repos */}
          <button
            onClick={() => setShowRemote(!showRemote)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: showRemote ? `${theme.colors.primary}20` : theme.colors.backgroundTertiary,
              color: showRemote ? theme.colors.primary : theme.colors.textSecondary,
              border: `1px solid ${showRemote ? theme.colors.primary : theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!showRemote) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!showRemote) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }
            }}
          >
            {showRemote ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            <Cloud size={14} />
            Show Remote
          </button>

          {/* Search Input */}
          <div
            style={{
              position: 'relative',
              minWidth: '200px',
              maxWidth: '300px',
            }}
          >
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 32px 8px 36px',
              fontSize: '14px',
              backgroundColor: theme.colors.backgroundTertiary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.colors.primary}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textSecondary,
              pointerEvents: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Repository Grid or Empty State */}
      {totalCount > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
            paddingBottom: '24px',
          }}
        >
          {allRepositories.map((item) => {
            const key = item.isRemote
              ? `remote-${(item.repository as GitHubRepository).id}`
              : `local-${(item.repository as AlexandriaEntry).path}`;

            return (
              <UnifiedRepositoryCard
                key={key}
                repository={item.repository}
                isRemote={item.isRemote}
                onOpen={(repo) => {
                  if (item.isRemote) {
                    setSelectedRepoForClone(repo as GitHubRepository);
                    setShowCloneModal(true);
                  } else {
                    onOpenRepository(repo as AlexandriaEntry | EnhancedAlexandriaEntry);
                  }
                }}
              />
            );
          })}
        </div>
      ) : searchQuery ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: theme.colors.textSecondary,
          }}
        >
          <Search size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            No repositories match "{searchQuery}"
          </p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Try adjusting your search terms
          </p>
        </div>
      ) : null}

      {/* Git Clone Modal */}
      {showCloneModal && (
        <GitCloneModal
          isOpen={showCloneModal}
          initialUrl={selectedRepoForClone?.clone_url}
          onClose={() => {
            setShowCloneModal(false);
            setSelectedRepoForClone(null);
          }}
          onRepositoryAdded={() => {
            // Repository will be automatically detected and added to the list
            // via the AlexandriaService listener in AuthView
            setShowCloneModal(false);
            setSelectedRepoForClone(null);
          }}
        />
      )}
    </div>
  );
};