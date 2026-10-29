import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink, FolderGit2, Search, Star, Terminal } from 'lucide-react';
import { githubClient } from '../../../tipc/githubClient';
import type { GitHubRepository } from '../../../../shared/tipc/githubRouterTypes';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import { usePortalEvents } from '../../PortalEventContext';
import { useProjectsTabs } from '../../contexts/ProjectsTabsContext';
import { emitTerminalNew } from '../../../events/portalIntents';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { findClonedGithubEntry } from '../../../utils/alexandriaIdentity';
import { useGithubProjectSections } from '../../../hooks/useGithubGraph';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import {
  payloadFromGithub,
  payloadFromLocalEntry,
} from '../../../events/repositorySelected';

type ParsedTitlebarUrl =
  | { type: 'user'; username: string }
  | { type: 'repo'; owner: string; name: string };

const parseTitlebarUrl = (input: string): ParsedTitlebarUrl | null => {
  const trimmed = input.trim();
  try {
    const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) return { type: 'user', username: parts[0] };
    if (parts.length >= 2)
      return { type: 'repo', owner: parts[0], name: parts[1] };
  } catch {
    // not a valid URL
  }
  return null;
};

const formatStars = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

/** One query-matched slice of the shared GitHub project graph. */
interface MatchedProjectSection {
  key: string;
  label: string;
  avatarUrl?: string;
  repos: GitHubRepository[];
}

/** Cap per owner so a single org can't fill the whole dropdown. */
const MAX_PROJECT_RESULTS_PER_SECTION = 3;

/** Minimum query length before any source is searched. */
const MIN_QUERY_LENGTH = 2;

const repoKey = (owner: string, name: string): string =>
  `${owner}/${name}`.toLowerCase();

/** Match the way GitHub lists a repo: name, owner/name, and description. */
const repoMatchesQuery = (repo: GitHubRepository, q: string): boolean =>
  repo.name.toLowerCase().includes(q) ||
  repo.full_name.toLowerCase().includes(q) ||
  (repo.description?.toLowerCase().includes(q) ?? false);

const avatarSrc = (url: string, size: number): string =>
  `${url}${url.includes('?') ? '&' : '?'}s=${size}`;

/** Uppercase divider naming a result group. */
const SectionHeader: React.FC<{ label: string; avatarUrl?: string }> = ({
  label,
  avatarUrl,
}) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px 4px',
        fontSize: `${theme.fontSizes[0]}px`,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {avatarUrl && (
        <img
          src={avatarSrc(avatarUrl, 28)}
          alt=""
          style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }}
        />
      )}
      {label}
    </div>
  );
};

/** A GitHub repo row, shared by the project-graph sections and global search. */
const RepositoryRow: React.FC<{
  repo: GitHubRepository;
  flatIndex: number;
  selectedIndex: number;
  onSelect: (repo: GitHubRepository) => void;
  onHover: (index: number) => void;
  isLast?: boolean;
}> = ({ repo, flatIndex, selectedIndex, onSelect, onHover, isLast }) => {
  const { theme } = useTheme();
  return (
    <div
      onMouseDown={() => onSelect(repo)}
      onMouseEnter={() => onHover(flatIndex)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 12px',
        cursor: 'pointer',
        backgroundColor:
          flatIndex === selectedIndex
            ? theme.colors.backgroundTertiary
            : 'transparent',
        borderBottom: isLast ? 'none' : `1px solid ${theme.colors.border}`,
        transition: 'background-color 0.1s',
      }}
    >
      <img
        src={avatarSrc(repo.owner.avatar_url, 84)}
        alt={repo.owner.login}
        style={{
          width: 42,
          height: 42,
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
  );
};

/**
 * The titlebar (Command+K) search. Results are grouped so each repo appears
 * once, in its most specific group:
 *
 *   1. Your repositories + one group per org — filtered locally over the cached
 *      GitHub project graph (`githubProjectsStore`), so they paint instantly and
 *      cost no API calls. Capped at 100 recently-updated repos per owner.
 *   2. Local clones — Alexandria registry entries; selecting one opens a
 *      terminal at the checkout.
 *   3. Repositories — the global GitHub search, for anything outside the graph.
 *
 * Pasting a GitHub URL bypasses search entirely (see `handlePaste`).
 */
export const TitlebarGitHubSearch: React.FC = () => {
  const { theme } = useTheme();
  // Cached GitHub project graph — the user's own repos plus one group per org.
  // Read, not fetched: the store owns the cadence, so this costs no API calls.
  const projectSections = useGithubProjectSections();
  // `events` (principalEvents) carries the `panel:switch` navigation; the portal
  // bus carries the content-open intents. Repo/user profile opens still call the
  // Projects tab context directly (a separate, view-local domain).
  const { events } = usePrincipalEvents();
  const { events: portalEvents } = usePortalEvents();
  const { openProjectInfo, openUserProfile } = useProjectsTabs();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<AlexandriaEntry[]>([]);
  const [repoResults, setRepoResults] = useState<GitHubRepository[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every search; each async result checks it's still the latest
  // before applying, so a slow response from an old keystroke can't clobber a
  // newer query's results.
  const searchSeq = useRef(0);

  // Matches from the cached graph: your repos first, then one group per org.
  // Filtered locally against the shared store, so results appear as fast as you
  // type; repos that aren't cached still surface via the global search below.
  const trimmedQuery = query.trim().toLowerCase();
  const projectMatches: MatchedProjectSection[] =
    trimmedQuery.length < MIN_QUERY_LENGTH
      ? []
      : (projectSections ?? [])
          .map((section) => ({
            key: section.key,
            label: section.label,
            avatarUrl: section.avatar_url,
            repos: section.repos
              .filter((repo) => repoMatchesQuery(repo, trimmedQuery))
              // A cloned repo gets a terminal row in its own group; the clone
              // wins so the same repo never appears twice.
              .filter(
                (repo) =>
                  !findClonedGithubEntry(
                    localResults,
                    repo.owner.login,
                    repo.name,
                  ),
              )
              .slice(0, MAX_PROJECT_RESULTS_PER_SECTION),
          }))
          .filter((section) => section.repos.length > 0);
  const projectRepos = projectMatches.flatMap((section) => section.repos);
  const projectKeys = new Set(
    projectRepos.map((repo) => repoKey(repo.owner.login, repo.name)),
  );

  // Global GitHub hits already shown as a clone or in a project group are
  // dropped, so each repo appears once, in its most specific group.
  const githubRepoResults = repoResults.filter(
    (repo) =>
      !findClonedGithubEntry(localResults, repo.owner.login, repo.name) &&
      !projectKeys.has(repoKey(repo.owner.login, repo.name)),
  );

  // Flat list for keyboard nav: project groups, then local clones, then global.
  const flatResults = [...projectRepos, ...localResults, ...githubRepoResults];
  const totalResults = flatResults.length;

  // Where each project group's first row sits in the flat list.
  let projectOffset = 0;
  const projectSectionViews = projectMatches.map((section) => {
    const start = projectOffset;
    projectOffset += section.repos.length;
    return { section, start };
  });

  const search = useCallback((q: string) => {
    if (!q || q.trim().length < MIN_QUERY_LENGTH) {
      searchSeq.current++;
      setLocalResults([]);
      setRepoResults([]);
      setIsOpen(false);
      return;
    }
    const seq = ++searchSeq.current;
    const isCurrent = () => seq === searchSeq.current;
    setLoading(true);

    // Each source resolves and paints on its own — no Promise.all barrier — so
    // the dropdown fills in as results arrive instead of waiting for the
    // slowest call. Local clones come off local disk and show near-instantly;
    // the GitHub calls stream in behind them. Each result is discarded if a
    // newer keystroke has superseded it (isCurrent). A failed source clears
    // only its own slice, so it can't sink the others.
    const local = AlexandriaService.searchRepositories(q)
      .then((entries) => {
        if (!isCurrent()) return;
        const locals = (entries || []).slice(0, 5);
        setLocalResults(locals);
        if (locals.length > 0) setIsOpen(true);
      })
      .catch(() => {
        if (isCurrent()) setLocalResults([]);
      });

    const repos = githubClient
      .searchRepos({ query: q, perPage: 5 })
      .then((res) => {
        if (!isCurrent()) return;
        const found = res.repos || [];
        setRepoResults(found);
        if (found.length > 0) setIsOpen(true);
      })
      .catch(() => {
        if (isCurrent()) setRepoResults([]);
      });

    void Promise.allSettled([local, repos]).then(() => {
      if (isCurrent()) setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (flashLabel !== null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search, flashLabel]);

  useEffect(() => {
    if (flashLabel === null) {
      setDisplayedText('');
      return;
    }
    let i = 0;
    setDisplayedText('');
    const id = setInterval(() => {
      i++;
      setDisplayedText(flashLabel.slice(0, i));
      if (i >= flashLabel.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [flashLabel]);

  // Project matches come off the cache, so they can be the only results. Open
  // the dropdown for them without waiting on either async source.
  const hasProjectMatches = projectRepos.length > 0;
  useEffect(() => {
    if (hasProjectMatches) setIsOpen(true);
  }, [hasProjectMatches, trimmedQuery.length]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setLocalResults([]);
    setRepoResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, []);

  const handleSelectLocal = useCallback(
    (entry: AlexandriaEntry) => {
      // Reveal the workspace shell (the persistent terminal-tab host under the
      // Home/Settings overlays), then open a terminal rooted at the checkout.
      // Mirrors how topic opens switch view before emitting on the portal
      // bus; the shell listens for `terminal:new` on that bus.
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      emitTerminalNew(portalEvents, 'titlebar-search', {
        directory: String(entry.path),
        label: entry.name,
      });
      clearSearch();
    },
    [events, portalEvents, clearSearch],
  );

  const handleSelectRepo = useCallback(
    (repo: GitHubRepository) => {
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      // Open directly on the shared workspace bucket (always mounted), so the
      // tab lands even though the portal shell may currently show another surface.
      openProjectInfo(
        payloadFromGithub({
          owner: repo.owner.login,
          name: repo.name,
          description: repo.description ?? undefined,
          stars: repo.stargazers_count ?? 0,
          lastUpdated: repo.updated_at,
          isPublic: !repo.private,
          defaultBranch: repo.default_branch,
          createdAt: repo.created_at,
        }),
      );
      clearSearch();
    },
    [events, openProjectInfo, clearSearch],
  );

  const openUserByUsername = useCallback(
    (username: string) => {
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      openUserProfile(username);
      clearSearch();
    },
    [events, openUserProfile, clearSearch],
  );

  const openRepoByOwnerName = useCallback(
    async (owner: string, repoName: string) => {
      const allEntries = await AlexandriaService.getRepositories();
      const existing = findClonedGithubEntry(allEntries, owner, repoName);
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      openProjectInfo(
        existing
          ? payloadFromLocalEntry(existing)
          : payloadFromGithub({ owner, name: repoName }),
      );
      clearSearch();
    },
    [events, openProjectInfo, clearSearch],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text');
      const parsed = parseTitlebarUrl(pasted);
      if (!parsed) return;
      e.preventDefault();
      const entity =
        parsed.type === 'user'
          ? `@${parsed.username}`
          : `${parsed.owner}/${parsed.name}`;
      const message = `Opening ${entity}`;
      const duration = message.length * 30 + 250;
      setFlashLabel(message);
      setTimeout(() => {
        setFlashLabel(null);
        if (parsed.type === 'user') {
          openUserByUsername(parsed.username);
        } else {
          openRepoByOwnerName(parsed.owner, parsed.name);
        }
      }, duration);
    },
    [openUserByUsername, openRepoByOwnerName],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalResults - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = selectedIndex >= 0 ? selectedIndex : 0;
      if (idx < projectRepos.length) {
        const repo = projectRepos[idx];
        if (repo) handleSelectRepo(repo);
      } else if (idx < projectRepos.length + localResults.length) {
        const entry = localResults[idx - projectRepos.length];
        if (entry) handleSelectLocal(entry);
      } else {
        const repo =
          githubRepoResults[idx - projectRepos.length - localResults.length];
        if (repo) handleSelectRepo(repo);
      }
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
        width: '580px',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      {/* Search input */}
      <div
        className={flashLabel ? 'titlebar-url-flash' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '8px',
          backgroundColor: theme.colors.background,
          border: `1px solid ${flashLabel ? '#22c55e' : isFocused ? theme.colors.primary : theme.colors.border}`,
          transition:
            'border-color 0.2s, box-shadow 0.2s, background-color 0.15s',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {flashLabel ? (
          <ExternalLink
            size={14}
            color="#22c55e"
            style={{ flexShrink: 0, transition: 'color 0.2s' }}
          />
        ) : (
          <Search
            size={14}
            color={
              isFocused ? theme.colors.primary : theme.colors.textSecondary
            }
            style={{ flexShrink: 0, transition: 'color 0.15s' }}
          />
        )}
        <style>{`
          .titlebar-github-search::placeholder {
            color: ${theme.colors.textSecondary};
            opacity: 1;
          }
          @keyframes titlebar-url-flash-glow {
            0%   { box-shadow: 0 0 0 0px rgba(34,197,94,0.5); }
            30%  { box-shadow: 0 0 0 4px rgba(34,197,94,0.25); }
            100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.0); }
          }
          .titlebar-url-flash {
            animation: titlebar-url-flash-glow 0.6s ease-out forwards;
          }
        `}</style>
        <input
          ref={inputRef}
          className="titlebar-github-search"
          value={flashLabel !== null ? displayedText : query}
          readOnly={flashLabel !== null}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            setIsFocused(true);
            if (totalResults > 0) setIsOpen(true);
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
            color: flashLabel ? '#22c55e' : theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            flex: 1,
            minWidth: 0,
            transition: 'color 0.2s',
          }}
        />
        {!isFocused && !query && !flashLabel && (
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
            Command + K
          </span>
        )}
        {loading && !flashLabel && (
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
      {isOpen && totalResults > 0 && (
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
          {/* Your repos, then one group per org — cached graph, local filter */}
          {projectSectionViews.map(({ section, start }) => (
            <React.Fragment key={`project-${section.key}`}>
              <SectionHeader
                label={section.label}
                avatarUrl={section.avatarUrl}
              />
              {section.repos.map((repo, i) => (
                <RepositoryRow
                  key={`project-${section.key}-${repo.id}`}
                  repo={repo}
                  flatIndex={start + i}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelectRepo}
                  onHover={setSelectedIndex}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Local clones section — selecting one opens a terminal at the checkout */}
          {localResults.length > 0 && (
            <>
              <SectionHeader label="Local clones" />
              {localResults.map((entry, i) => {
                const flatIndex = projectRepos.length + i;
                // The registry entry carries no avatar URL; when it has a GitHub
                // owner, derive the avatar GitHub serves by login. Local-only
                // clones (no GitHub remote) fall back to a folder icon.
                const ownerLogin = entry.github?.owner;
                return (
                  <div
                    key={`local-${String(entry.path)}`}
                    onMouseDown={() => handleSelectLocal(entry)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 12px',
                      cursor: 'pointer',
                      backgroundColor:
                        flatIndex === selectedIndex
                          ? theme.colors.backgroundTertiary
                          : 'transparent',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      transition: 'background-color 0.1s',
                    }}
                  >
                    {ownerLogin ? (
                      <img
                        src={`https://github.com/${ownerLogin}.png?size=84`}
                        alt={ownerLogin}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '8px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.colors.backgroundTertiary,
                        }}
                      >
                        <FolderGit2
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </div>
                    )}
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
                        {entry.name}
                      </div>
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
                        {String(entry.path)}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: theme.colors.textSecondary,
                        fontSize: `${theme.fontSizes[0]}px`,
                        fontFamily: theme.fonts.body,
                        flexShrink: 0,
                      }}
                    >
                      <Terminal size={11} />
                      Terminal
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Repositories section — global GitHub search */}
          {githubRepoResults.length > 0 && (
            <>
              <SectionHeader label="Repositories" />
              {githubRepoResults.map((repo, i) => (
                <RepositoryRow
                  key={`repo-${repo.id}`}
                  repo={repo}
                  flatIndex={projectRepos.length + localResults.length + i}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelectRepo}
                  onHover={setSelectedIndex}
                  isLast={i === githubRepoResults.length - 1}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
