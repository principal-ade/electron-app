/**
 * HomeStarredSubView
 *
 * The "Starred Projects" sub-view: filter + sort + flat repo list.
 * Rows use the shared StarredRepoCard (same as Projects → Starred and
 * Home → Other Clones).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Search, Star } from 'lucide-react';
import { GithubService } from '../../../main-process-api/GithubService';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { StarredRepoCard } from '../../cards/StarredRepoCard';
import { SubViewHeader } from './SubViewHeader';

type SortKey = 'name' | 'stars' | 'updated';

export interface HomeStarredSubViewProps {
  onBack: () => void;
  onSelectRepo?: (repo: GitHubRepository) => void;
}

export const HomeStarredSubView: React.FC<HomeStarredSubViewProps> = ({
  onBack,
  onSelectRepo,
}) => {
  const { theme } = useTheme();
  const [repos, setRepos] = useState<GitHubRepository[] | null>(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('name');

  useEffect(() => {
    let cancelled = false;
    GithubService.getUserStarredRepositories({ perPage: 100 })
      .then((r) => {
        if (!cancelled) setRepos(r);
      })
      .catch(() => {
        if (!cancelled) setRepos([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!repos) return null;
    const q = filter.trim().toLowerCase();
    const items = q
      ? repos.filter(
          (r) =>
            r.full_name.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.description?.toLowerCase().includes(q) ?? false),
        )
      : repos;

    return [...items].sort((a, b) => {
      if (sort === 'stars')
        return (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0);
      if (sort === 'updated')
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      return a.name.localeCompare(b.name);
    });
  }, [repos, filter, sort]);

  return (
    <>
      <SubViewHeader
        icon={<Star size={14} />}
        label="Starred Projects"
        count={repos?.length || undefined}
        onBack={onBack}
      />

      {repos != null && repos.length >= 8 && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Search size={14} style={{ color: theme.colors.textMuted }} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter starred"
            style={{
              flex: 1,
              background: 'transparent',
              outline: 'none',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              border: 'none',
            }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 4,
              padding: '2px 4px',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.body,
              cursor: 'pointer',
            }}
          >
            <option value="name">A-Z</option>
            <option value="stars">Stars</option>
            <option value="updated">Updated</option>
          </select>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '4px 6px',
        }}
      >
        {filtered === null ? (
          <ListMessage>Loading starred repos…</ListMessage>
        ) : filtered.length === 0 ? (
          <ListMessage>
            {repos?.length === 0
              ? "You haven't starred any repos yet."
              : `No starred repos match "${filter}".`}
          </ListMessage>
        ) : (
          filtered.map((repo) => {
            const [owner, name] = repo.full_name.split('/');
            return (
              <StarredRepoCard
                key={repo.id}
                repo={{
                  owner: owner || repo.owner?.login || 'unknown',
                  name: name || repo.name,
                  ownerAvatarUrl: repo.owner?.avatar_url,
                  description: repo.description,
                  language: repo.language,
                  stargazersCount: repo.stargazers_count,
                }}
                onClick={() => onSelectRepo?.(repo)}
              />
            );
          })
        )}
      </div>
    </>
  );
};

function ListMessage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '24px 16px',
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
