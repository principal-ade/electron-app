import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Search, Star } from 'lucide-react';
import { githubClient } from '../../../tipc/githubClient';
import type { GitHubRepository } from '../../../../shared/tipc/githubRouterTypes';
import type {
  AlexandriaEntry,
  ValidatedRepositoryPath,
} from '@principal-ai/alexandria-core-library/types';
import { usePrincipalEvents } from '../../PrincipalEventContext';

const formatStars = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const toAlexandriaEntry = (repo: GitHubRepository): AlexandriaEntry => ({
  name: repo.name,
  path: '' as unknown as ValidatedRepositoryPath,
  remoteUrl: repo.html_url,
  registeredAt: new Date().toISOString(),
  hasViews: false,
  viewCount: 0,
  views: [],
  github: {
    id: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description ?? undefined,
    stars: repo.stargazers_count ?? 0,
    lastUpdated: repo.updated_at,
    isPublic: !repo.private,
    defaultBranch: repo.default_branch,
  },
});

export const TitlebarGitHubSearch: React.FC = () => {
  const { theme } = useTheme();
  const { events } = usePrincipalEvents();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GitHubRepository[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const response = await githubClient.searchRepos({ query: q, perPage: 8 });
      setResults(response.repos || []);
      setIsOpen((response.repos || []).length > 0);
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleSelect = useCallback(
    (repo: GitHubRepository) => {
      const entry = toAlexandriaEntry(repo);

      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'feed' },
      });

      events.emit({
        type: 'feed:repository-selected',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { repository: entry },
      });

      setQuery('');
      setResults([]);
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [events],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = selectedIndex >= 0 ? selectedIndex : 0;
      if (results[idx]) handleSelect(results[idx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '440px',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      {/* Search input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '8px',
          backgroundColor: isFocused
            ? theme.colors.background
            : theme.colors.backgroundTertiary,
          border: `1px solid ${isFocused ? theme.colors.primary : theme.colors.border}`,
          transition: 'border-color 0.15s, background-color 0.15s',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <Search
          size={14}
          color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
          style={{ flexShrink: 0, transition: 'color 0.15s' }}
        />
        <style>{`
          .titlebar-github-search::placeholder {
            color: ${theme.colors.textSecondary};
            opacity: 1;
          }
        `}</style>
        <input
          ref={inputRef}
          className="titlebar-github-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (results.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setIsOpen(false), 150);
          }}
          placeholder="Search GitHub..."
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            flex: 1,
            minWidth: 0,
          }}
        />
        {!isFocused && !query && (
          <span
            style={{
              fontSize: '11px',
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              flexShrink: 0,
              marginLeft: 'auto',
              opacity: 0.7,
            }}
          >
            Command + L
          </span>
        )}
        {loading && (
          <span
            style={{
              fontSize: '10px',
              color: theme.colors.textSecondary,
              flexShrink: 0,
            }}
          >
            ···
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {results.map((repo, i) => (
            <div
              key={repo.id}
              onMouseDown={() => handleSelect(repo)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor:
                  i === selectedIndex
                    ? theme.colors.backgroundTertiary
                    : 'transparent',
                borderBottom:
                  i < results.length - 1
                    ? `1px solid ${theme.colors.border}`
                    : 'none',
                transition: 'background-color 0.1s',
              }}
            >
              <img
                src={`${repo.owner.avatar_url}&s=40`}
                alt={repo.owner.login}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.text,
                    fontWeight: 500,
                    fontFamily: theme.fonts.body,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {repo.full_name}
                </div>
                {repo.description && (
                  <div
                    style={{
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '1px',
                    }}
                  >
                    {repo.description}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: theme.colors.textSecondary,
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  flexShrink: 0,
                }}
              >
                <Star size={11} />
                {formatStars(repo.stargazers_count)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
