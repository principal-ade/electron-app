import React, { useState, KeyboardEvent } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface SearchInterfaceProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  error: string | null;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onSearch,
  isSearching,
  error,
}) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('callimachus-recent-searches');
    return saved ? JSON.parse(saved) : [];
  });

  const handleSearch = () => {
    if (!query.trim() || isSearching) return;

    onSearch(query);

    // Add to recent searches
    const updatedSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updatedSearches);
    localStorage.setItem('callimachus-recent-searches', JSON.stringify(updatedSearches));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRecentClick = (searchQuery: string) => {
    setQuery(searchQuery);
    onSearch(searchQuery);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50"
              style={{ color: theme.colors.textSecondary }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for code patterns (e.g., 'React hooks for data fetching')"
              disabled={isSearching}
              className="w-full pl-10 pr-3 py-2 rounded border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
            style={{
              backgroundColor: isSearching || !query.trim() ? theme.colors.backgroundSecondary : theme.colors.primary,
              color: theme.colors.background,
              opacity: isSearching || !query.trim() ? 0.5 : 1,
            }}
          >
            {isSearching ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-500/10 text-red-500 text-sm">
          {error}
        </div>
      )}

      {recentSearches.length > 0 && !isSearching && (
        <div>
          <div className="text-sm opacity-70 mb-2">Recent searches:</div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                className="px-3 py-1 rounded text-sm transition-colors"
                onClick={() => handleRecentClick(search)}
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  borderWidth: '1px',
                  borderColor: theme.colors.border,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};