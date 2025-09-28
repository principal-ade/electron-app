import React, { useState, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Package, Search, X } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import { RepositoryCard } from './RepositoryCard';

interface RepositoryGridProps {
  repositories: (AlexandriaEntry | EnhancedAlexandriaEntry)[];
  selectedOrg: string | null;
  loading?: boolean;
  onOpenRepository: (repo: AlexandriaEntry | EnhancedAlexandriaEntry) => void;
}

export const RepositoryGrid: React.FC<RepositoryGridProps> = ({
  repositories,
  selectedOrg,
  loading = false,
  onOpenRepository,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter repositories based on search query
  const filteredRepositories = useMemo(() => {
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

  if (repositories.length === 0 && !searchQuery) {
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
            {searchQuery && filteredRepositories.length !== repositories.length
              ? `${filteredRepositories.length} of ${repositories.length}`
              : repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'}
            {searchQuery && filteredRepositories.length === 0 && ' - No matches found'}
          </p>
        </div>

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

      {/* Repository Grid or Empty State */}
      {filteredRepositories.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
            paddingBottom: '24px',
          }}
        >
          {filteredRepositories.map((repo) => (
            <RepositoryCard
              key={repo.path}
              repository={repo}
              onOpen={onOpenRepository}
            />
          ))}
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
    </div>
  );
};