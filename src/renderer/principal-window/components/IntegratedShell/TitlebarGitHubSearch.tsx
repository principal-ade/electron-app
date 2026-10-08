import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ExternalLink,
  FolderGit2,
  Search,
  Star,
  Terminal,
  User,
} from 'lucide-react';
import { githubClient } from '../../../tipc/githubClient';
import type {
  GitHubRepository,
  GitHubUser,
} from '../../../../shared/tipc/githubRouterTypes';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import { usePortalEvents } from '../../PortalEventContext';
import { useProjectsTabs } from '../../contexts/ProjectsTabsContext';
import {
  emitTopicOpen,
  emitTerminalOpen,
} from '../../../events/portalIntents';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { findClonedGithubEntry } from '../../../utils/alexandriaIdentity';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import {
  payloadFromGithub,
  payloadFromLocalEntry,
} from '../../../events/repositorySelected';

type ParsedTitlebarUrl =
  | { type: 'user'; username: string }
  | { type: 'repo'; owner: string; name: string }
  | { type: 'topic'; id: string };

// web-ade shares topics as `…/topic/{id}`. Match the production host plus any
// `*.principal-ade.com`
// (covers preview/dev origins) and localhost for local web-ade.
const isWebAdeHost = (hostname: string): boolean =>
  hostname === 'app.principal-ade.com' ||
  hostname.endsWith('.principal-ade.com') ||
  hostname === 'localhost' ||
  hostname === '127.0.0.1';

// Topic ids aren't UUIDs (e.g. `topic-1780187765886-n2uii5c5i`); accept the
// url-safe id charset web-ade uses.
const TOPIC_ID_RE = /^[A-Za-z0-9._-]+$/;

const parseTitlebarUrl = (input: string): ParsedTitlebarUrl | null => {
  const trimmed = input.trim();
  // Bare topic ids are prefixed (`topic-…`), so they're unambiguous as well.
  if (trimmed.startsWith('topic-') && TOPIC_ID_RE.test(trimmed))
    return { type: 'topic', id: trimmed };
  try {
    const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);
    if (isWebAdeHost(url.hostname)) {
      const topicMatch = url.pathname.match(/\/topic\/([A-Za-z0-9._-]+)/i);
      if (topicMatch) return { type: 'topic', id: topicMatch[1] };
      // web-ade mirrors GitHub's `…/{owner}/{repo}` (and `…/{user}`) paths, so
      // a non-topic link like `app.principal-ade.com/owner/repo` resolves
      // to the same repo/user as the equivalent github.com link.
      // (falls through to the shared owner/repo parsing below)
    } else if (url.hostname !== 'github.com') {
      return null;
    }
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

export const TitlebarGitHubSearch: React.FC = () => {
  const { theme } = useTheme();
  // `events` (principalEvents) carries the `panel:switch` navigation; the portal
  // bus carries the content-open intents. Repo/user profile opens still call the
  // Projects tab context directly (a separate, view-local domain).
  const { events } = usePrincipalEvents();
  const { events: portalEvents } = usePortalEvents();
  const { openProjectInfo, openUserProfile } = useProjectsTabs();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<AlexandriaEntry[]>([]);
  const [repoResults, setRepoResults] = useState<GitHubRepository[]>([]);
  const [userResults, setUserResults] = useState<GitHubUser[]>([]);
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

  // A GitHub repo we already have cloned locally is dropped from the GitHub
  // section — the local row (which opens a terminal) supersedes it, so the same
  // repo never appears twice.
  const githubRepoResults = repoResults.filter(
    (repo) => !findClonedGithubEntry(localResults, repo.owner.login, repo.name),
  );
  // Flat list for keyboard nav: local clones first, then users, then repos.
  const flatResults = [...localResults, ...userResults, ...githubRepoResults];
  const totalResults = flatResults.length;

  const search = useCallback((q: string) => {
    if (!q || q.trim().length < 2) {
      searchSeq.current++;
      setLocalResults([]);
      setUserResults([]);
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

    const users = githubClient
      .searchUsers({ query: q, perPage: 5 })
      .then((res) => {
        if (!isCurrent()) return;
        const found = res.users || [];
        setUserResults(found);
        if (found.length > 0) setIsOpen(true);
      })
      .catch(() => {
        if (isCurrent()) setUserResults([]);
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

    void Promise.allSettled([local, users, repos]).then(() => {
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

  const clearSearch = useCallback(() => {
    setQuery('');
    setLocalResults([]);
    setUserResults([]);
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
      // bus; the shell listens for `terminal:open` on that bus.
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      emitTerminalOpen(portalEvents, 'titlebar-search', {
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

  const handleSelectUser = useCallback(
    (user: GitHubUser) => {
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'projects' },
      });
      openUserProfile(user.login);
      clearSearch();
    },
    [events, openUserProfile, clearSearch],
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

  const openTopicById = useCallback(
    (id: string) => {
      // A pasted topic link is a published web-ade topic. Topic tabs render in
      // the Inbox view (the shared-content surface), so switch there and emit
      // `topic:open` on the portal bus — its always-mounted listener opens the
      // tab in InboxTabsContext (whose state lives above the conditional
      // InboxView mount), so the tab survives the view switch. The panel
      // self-fetches the topic brief from the bare id.
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'inbox' },
      });
      emitTopicOpen(portalEvents, 'titlebar-search', {
        topicId: id,
        surface: 'inbox',
      });
      clearSearch();
    },
    [events, portalEvents, clearSearch],
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
          : parsed.type === 'repo'
            ? `${parsed.owner}/${parsed.name}`
            : 'topic';
      const message = `Opening ${entity}`;
      const duration = message.length * 30 + 250;
      setFlashLabel(message);
      setTimeout(() => {
        setFlashLabel(null);
        if (parsed.type === 'user') {
          openUserByUsername(parsed.username);
        } else if (parsed.type === 'repo') {
          openRepoByOwnerName(parsed.owner, parsed.name);
        } else if (parsed.type === 'topic') {
          openTopicById(parsed.id);
        }
      }, duration);
    },
    [openUserByUsername, openRepoByOwnerName, openTopicById],
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
      if (idx < localResults.length) {
        const entry = localResults[idx];
        if (entry) handleSelectLocal(entry);
      } else if (idx < localResults.length + userResults.length) {
        const user = userResults[idx - localResults.length];
        if (user) handleSelectUser(user);
      } else {
        const repo =
          githubRepoResults[idx - localResults.length - userResults.length];
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
          {/* Local clones section — selecting one opens a terminal at the checkout */}
          {localResults.length > 0 && (
            <>
              <div
                style={{
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
                Local clones
              </div>
              {localResults.map((entry, i) => {
                const flatIndex = i;
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

          {/* Users section */}
          {userResults.length > 0 && (
            <>
              <div
                style={{
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
                Users
              </div>
              {userResults.map((user, i) => {
                const flatIndex = localResults.length + i;
                return (
                  <div
                    key={`user-${user.id}`}
                    onMouseDown={() => handleSelectUser(user)}
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
                    <img
                      src={`${user.avatar_url}&s=84`}
                      alt={user.login}
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
                          fontSize: `${theme.fontSizes[2]}px`,
                          color: theme.colors.text,
                          fontWeight: 500,
                          fontFamily: theme.fonts.body,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.name ? `${user.name} ` : ''}
                        <span
                          style={{
                            color: theme.colors.textSecondary,
                            fontWeight: 400,
                          }}
                        >
                          @{user.login}
                        </span>
                      </div>
                    </div>
                    <User
                      size={11}
                      color={theme.colors.textSecondary}
                      style={{ flexShrink: 0 }}
                    />
                  </div>
                );
              })}
            </>
          )}

          {/* Repositories section */}
          {githubRepoResults.length > 0 && (
            <>
              <div
                style={{
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
                Repositories
              </div>
              {githubRepoResults.map((repo, i) => {
                const flatIndex = localResults.length + userResults.length + i;
                return (
                  <div
                    key={`repo-${repo.id}`}
                    onMouseDown={() => handleSelectRepo(repo)}
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
                      borderBottom:
                        i < githubRepoResults.length - 1
                          ? `1px solid ${theme.colors.border}`
                          : 'none',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    <img
                      src={`${repo.owner.avatar_url}&s=84`}
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
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};
