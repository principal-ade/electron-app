/**
 * HomeProjectsSubView
 *
 * The "Your Projects" sub-view of the Home panel: grouped repos (user's own +
 * org repos) with a filter input, sticky section headers, and a "Cloned only"
 * switch that narrows the list to repos that already exist on disk.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { githubIdToPurl } from '@principal-ai/alexandria-core-library';
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
  /**
   * Set of PURLs for repos that have a local Alexandria clone.
   * Drives the "Cloned only" switch.
   */
  clonedPurls?: ReadonlySet<string>;
}

/** Personal section is always expanded by default; org sections start collapsed. */
function isPersonalSection(section: ProjectSection): boolean {
  return section.label === 'Your repositories';
}

export const HomeProjectsSubView: React.FC<HomeProjectsSubViewProps> = ({
  sections,
  onBack,
  onSelectRepo,
  clonedPurls,
}) => {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');
  const [clonedOnly, setClonedOnly] = useState(false);
  // Keys of sections the user has collapsed. Orgs seed into this set when
  // sections first arrive; personal repos stay out so they start open.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
  const [orgsSeeded, setOrgsSeeded] = useState(false);

  const canFilterCloned = Boolean(clonedPurls && clonedPurls.size > 0);

  // Seed org sections as collapsed once when sections load.
  useEffect(() => {
    if (!sections || orgsSeeded) return;
    const orgKeys = sections
      .filter((s) => !isPersonalSection(s))
      .map((s) => s.key);
    if (orgKeys.length > 0 || sections.length > 0) {
      setCollapsedKeys(new Set(orgKeys));
      setOrgsSeeded(true);
    }
  }, [sections, orgsSeeded]);

  const scopedSections = useMemo(() => {
    if (!sections) return null;

    const sortAlpha = (repos: GitHubRepository[]) =>
      [...repos].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );

    const base =
      !clonedOnly || !clonedPurls
        ? sections
        : sections
            .map((s) => ({
              ...s,
              repos: s.repos.filter((r) =>
                clonedPurls.has(githubIdToPurl(r.full_name)),
              ),
            }))
            .filter((s) => s.repos.length > 0);

    return base.map((s) => ({
      ...s,
      repos: sortAlpha(s.repos),
    }));
  }, [sections, clonedOnly, clonedPurls]);

  const totalRepos = useMemo(
    () => (scopedSections ?? []).reduce((n, s) => n + s.repos.length, 0),
    [scopedSections],
  );

  const filterActive = filter.trim().length > 0;

  const filtered = useMemo(() => {
    if (!scopedSections) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return scopedSections;
    return scopedSections
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
  }, [scopedSections, filter]);

  const toggleSection = (key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <SubViewHeader
        icon={<FolderGit2 size={14} />}
        label="Your Projects"
        count={totalRepos || undefined}
        onBack={onBack}
        trailing={
          <ClonedOnlySwitch
            checked={clonedOnly}
            disabled={!canFilterCloned}
            onChange={setClonedOnly}
          />
        }
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
              border: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {filtered === null ? (
          <ListMessage>Loading your projects…</ListMessage>
        ) : totalRepos === 0 && clonedOnly ? (
          <ListMessage>
            None of your projects are cloned locally yet.
          </ListMessage>
        ) : totalRepos === 0 ? (
          <ListMessage>
            No projects yet. Repos you own and your organizations&apos; repos will show up here.
          </ListMessage>
        ) : filtered.length === 0 ? (
          <ListMessage>No projects match &quot;{filter}&quot;.</ListMessage>
        ) : (
          filtered.map((section) => {
            // While searching, force every matching section open so results
            // aren't hidden behind a collapsed org.
            const isCollapsed =
              !filterActive && collapsedKeys.has(section.key);
            return (
              <div key={section.key}>
                <SectionHeader
                  section={section}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleSection(section.key)}
                />
                {!isCollapsed &&
                  section.repos.map((repo) => (
                    <RepoRow
                      key={repo.id}
                      repo={repo}
                      onSelect={() => onSelectRepo?.(repo)}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

function ClonedOnlySwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={
        disabled
          ? 'No local clones available'
          : checked
            ? 'Showing only cloned projects — click to show all'
            : 'Show only projects that are cloned locally'
      }
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px 4px 4px',
        borderRadius: 999,
        border: `1px solid ${checked ? theme.colors.primary : theme.colors.border}`,
        background: checked
          ? `color-mix(in srgb, ${theme.colors.primary} 14%, ${theme.colors.backgroundSecondary})`
          : theme.colors.backgroundSecondary,
        color: disabled ? theme.colors.textMuted : theme.colors.text,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        fontWeight: 600,
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: checked
            ? theme.colors.primary
            : theme.colors.backgroundTertiary,
          border: `1px solid ${checked ? theme.colors.primary : theme.colors.border}`,
          position: 'relative',
          flexShrink: 0,
          transition: 'background-color 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: checked ? 13 : 1,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
      Cloned only
    </button>
  );
}

function SectionHeader({
  section,
  isCollapsed,
  onToggle,
}: {
  section: ProjectSection;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        width: '100%',
        height: 48,
        boxSizing: 'border-box',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: hovered
          ? `color-mix(in srgb, ${theme.colors.primary} 10%, ${theme.colors.backgroundSecondary})`
          : theme.colors.backgroundSecondary,
        cursor: 'pointer',
        color: hovered ? theme.colors.text : theme.colors.textSecondary,
        textAlign: 'left',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      }}
    >
      {section.avatar_url && (
        <img
          src={section.avatar_url}
          alt=""
          width={24}
          height={24}
          style={{ borderRadius: 6, background: theme.colors.background }}
        />
      )}
      <span
        style={{
          fontSize: theme.fontSizes[2],
          fontWeight: 600,
          // Title case / natural display names read better than all-caps logins.
          textTransform: isPersonalSection(section) ? 'uppercase' : 'none',
          letterSpacing: isPersonalSection(section) ? '0.5px' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
          lineHeight: 1.2,
          color: theme.colors.text,
        }}
      >
        {section.label}
      </span>
      <span
        style={{
          fontSize: theme.fontSizes[2],
          color: theme.colors.textMuted,
          lineHeight: 1,
        }}
      >
        {section.repos.length}
      </span>
    </button>
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
