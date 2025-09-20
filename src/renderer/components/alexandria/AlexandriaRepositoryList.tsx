import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Search, Plus, RefreshCw, Filter } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaRepositoryCard } from './AlexandriaRepositoryCard';

interface AlexandriaEntryListProps {
  repositories: AlexandriaEntry[];
  onSelectRepository: (repo: AlexandriaEntry) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  selectedRepository?: AlexandriaEntry | null;
}

export const AlexandriaRepositoryList: React.FC<AlexandriaEntryListProps> = ({
  repositories,
  onSelectRepository,
  onRefresh,
  isLoading = false,
  selectedRepository,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByViews, setFilterByViews] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stars' | 'views'>('name');

  // Filter repositories based on search and filters
  const filteredRepos = repositories.filter((repo) => {
    const matchesSearch =
      !searchQuery ||
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.github?.description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      repo.github?.topics?.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesFilter = !filterByViews || repo.hasViews;

    return matchesSearch && matchesFilter;
  });

  // Sort repositories
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    switch (sortBy) {
      case 'stars':
        return (b.github?.stars || 0) - (a.github?.stars || 0);
      case 'views':
        return b.viewCount - a.viewCount;
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Repository grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: theme.space[4],
        }}
      >
        {sortedRepos.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textMuted,
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[6],
                marginBottom: theme.space[3],
              }}
            >
              📚
            </div>
            <h3
              style={{
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights.medium,
                marginBottom: theme.space[2],
              }}
            >
              No repositories found
            </h3>
            <p style={{ fontSize: theme.fontSizes[2] }}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Add your first repository to get started'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: theme.space[5],
              paddingBottom: theme.space[4],
            }}
          >
            {sortedRepos.map((repo) => (
              <AlexandriaRepositoryCard
                key={repo.name}
                repository={repo}
                onSelect={onSelectRepository}
                isSelected={selectedRepository?.name === repo.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
