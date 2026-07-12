/**
 * HomeProjectsSubView
 *
 * The "Your Projects" sub-view of the Home panel: grouped repos (user's own +
 * org repos) with a filter input and sticky section headers.
 */

import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, Lock, Search, Star } from 'lucide-react';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { getLanguageColor } from '../languageColors';
import { SubViewHeader } from './SubViewHeader';

export interface ProjectSection {
  key: string;
  label: string;
  avatar_url?: string;
  repos: GitHubRepository[];
}

export interface HomeProjectsSubViewProps {
  sections: ProjectSection[] | null;
  onBack: () => void;
  onSelectRepo?: (repo: GitHubRepository) => void;
}

export const HomeProjectsSubView: React.FC<HomeProjectsSubViewProps> = ({
  sections,
  onBack,
  onSelectRepo,
}) => {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  const totalRepos = useMemo(
    () => (sections ?? []).reduce((n, s) => n + s.repos.length, 0),
    [sections],
  );

  const filtered = useMemo(() => {
    if (!sections) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        repos: s.repos.filter(
          (r) =>
            r.full_name.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.description?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((s) => s.repos.length > 0);
  }, [sections, filter]);

  return (
    <>
      <SubViewHeader
        icon={<FolderGit2 size={14} />}
        label="Your Projects"
        count={totalRepos || undefined}
        onBack={onBack}
      />

      {sections != null && totalRepos >= 8 && (
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
            placeholder="Filter projects"
            style={{
              flex: 1,
              background: 'transparent',
              outline: 'none',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {filtered === null ? (
          <ListMessage>Loading your projects…</ListMessage>
        ) : totalRepos === 0 ? (
          <ListMessage>
            No projects yet. Repos you own and your organizations' repos will show up here.
          </ListMessage>
        ) : filtered.length === 0 ? (
          <ListMessage>No projects match "{filter}".</ListMessage>
        ) : (
          filtered.map((section) => (
            <div key={section.key}>
              <SectionHeader section={section} />
              {section.repos.map((repo) => (
                <RepoRow
                  key={repo.id}
                  repo={repo}
                  onSelect={() => onSelectRepo?.(repo)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
};

function SectionHeader({ section }: { section: ProjectSection }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.backgroundSecondary,
      }}
    >
      {section.avatar_url && (
        <img
          src={section.avatar_url}
          alt=""
          width={16}
          height={16}
          style={{ borderRadius: 4, background: theme.colors.background }}
        />
      )}
      <span
        style={{
          fontSize: theme.fontSizes[0],
          fontWeight: 600,
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {section.label}
      </span>
      <span style={{ fontSize: theme.fontSizes[0], color: theme.colors.textMuted }}>
        {section.repos.length}
      </span>
    </div>
  );
}

function RepoRow({
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
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.name}
          </span>
          {repo.private && (
            <Lock size={12} style={{ flexShrink: 0, color: theme.colors.textMuted }} />
          )}
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

        {(repo.language || (repo.stargazers_count ?? 0) > 0) && (
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
            {(repo.stargazers_count ?? 0) > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={11} />
                {repo.stargazers_count!.toLocaleString()}
              </span>
            )}
          </div>
        )}
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
