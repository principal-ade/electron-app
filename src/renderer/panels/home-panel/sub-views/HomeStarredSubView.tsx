/**
 * HomeStarredSubView
 *
 * The "Starred Projects" sub-view: filter + sort + flat repo list.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Search, Star } from 'lucide-react';
import { GithubService } from '../../../main-process-api/GithubService';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { getLanguageColor } from '../languageColors';
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
      .then((r) => { if (!cancelled) setRepos(r); })
      .catch(() => { if (!cancelled) setRepos([]); });
    return () => { cancelled = true; };
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
      if (sort === 'stars') return (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0);
      if (sort === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {filtered === null ? (
          <ListMessage>Loading starred repos…</ListMessage>
        ) : filtered.length === 0 ? (
          <ListMessage>
            {repos?.length === 0
              ? "You haven't starred any repos yet."
              : `No starred repos match "${filter}".`}
          </ListMessage>
        ) : (
          filtered.map((repo) => (
            <StarredRow key={repo.id} repo={repo} onSelect={() => onSelectRepo?.(repo)} />
          ))
        )}
      </div>
    </>
  );
};

function StarredRow({
  repo,
  onSelect,
}: {
  repo: GitHubRepository;
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ borderBottom: `1px solid ${theme.colors.border}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 16px',
          background: hovered
            ? `color-mix(in srgb, ${theme.colors.primary} 6%, ${theme.colors.background})`
            : 'transparent',
          color: theme.colors.text,
          cursor: 'pointer',
          border: 'none',
          display: 'block',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {repo.owner?.avatar_url && (
            <img
              src={repo.owner.avatar_url}
              alt=""
              width={20}
              height={20}
              style={{ borderRadius: 4, flexShrink: 0 }}
            />
          )}
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.full_name}
          </span>
        </div>

        {repo.description && (
          <div
            style={{
              marginTop: 4,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[0],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.description}
          </div>
        )}

        <div
          style={{
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[0],
          }}
        >
          {(repo.stargazers_count ?? 0) > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Star size={11} />
              {repo.stargazers_count!.toLocaleString()}
            </span>
          )}
          {repo.language && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getLanguageColor(repo.language),
                  display: 'inline-block',
                }}
              />
              {repo.language}
            </span>
          )}
          <span>
            Updated {new Date(repo.updated_at).toLocaleDateString()}
          </span>
        </div>
      </button>
    </div>
  );
}

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
