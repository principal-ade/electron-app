import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink, Search, Star, User } from 'lucide-react';
import { githubClient } from '../../../tipc/githubClient';
import type { GitHubRepository, GitHubUser } from '../../../../shared/tipc/githubRouterTypes';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import { useFeedTabs } from '../../contexts/FeedTabsContext';
import { useInboxTabs } from '../../contexts/InboxTabsContext';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { findClonedGithubEntry } from '../../../utils/alexandriaIdentity';
import {
  payloadFromGithub,
  payloadFromLocalEntry,
} from '../../../events/feedRepositorySelected';

type ParsedTitlebarUrl =
  | { type: 'user'; username: string }
  | { type: 'repo'; owner: string; name: string }
  | { type: 'trail'; id: string }
  | { type: 'topic'; id: string };

// web-ade shares trails as flat `…/trail/{uuid}` links and topics as
// `…/topic/{id}`. Match the production host plus any `*.principal-ade.com`
// (covers preview/dev origins) and localhost for local web-ade.
const isWebAdeHost = (hostname: string): boolean =>
  hostname === 'app.principal-ade.com' ||
  hostname.endsWith('.principal-ade.com') ||
  hostname === 'localhost' ||
  hostname === '127.0.0.1';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Topic ids aren't UUIDs (e.g. `topic-1780187765886-n2uii5c5i`); accept the
// url-safe id charset web-ade uses.
const TOPIC_ID_RE = /^[A-Za-z0-9._-]+$/;

const parseTitlebarUrl = (input: string): ParsedTitlebarUrl | null => {
  const trimmed = input.trim();
  // A bare trail UUID (no surrounding URL) is a valid paste target too.
  if (UUID_RE.test(trimmed)) return { type: 'trail', id: trimmed };
  // Bare topic ids are prefixed (`topic-…`), so they're unambiguous as well.
  if (trimmed.startsWith('topic-') && TOPIC_ID_RE.test(trimmed))
    return { type: 'topic', id: trimmed };
  try {
    const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);
    if (isWebAdeHost(url.hostname)) {
      const trailMatch = url.pathname.match(/\/trail\/([0-9a-f-]+)/i);
      if (trailMatch && UUID_RE.test(trailMatch[1]))
        return { type: 'trail', id: trailMatch[1] };
      const topicMatch = url.pathname.match(/\/topic\/([A-Za-z0-9._-]+)/i);
      if (topicMatch) return { type: 'topic', id: topicMatch[1] };
      return null;
    }
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) return { type: 'user', username: parts[0] };
    if (parts.length >= 2) return { type: 'repo', owner: parts[0], name: parts[1] };
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
  const { events } = usePrincipalEvents();
  const { openProjectInfo, openUserProfile, openSharedTrail } = useFeedTabs();
  const { openTopic } = useInboxTabs();
  const [query, setQuery] = useState('');
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

  // Flat list for keyboard nav: users first, then repos
  const flatResults = [...userResults, ...repoResults];
  const totalResults = flatResults.length;

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setUserResults([]);
      setRepoResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const [usersResponse, reposResponse] = await Promise.all([
        githubClient.searchUsers({ query: q, perPage: 5 }),
        githubClient.searchRepos({ query: q, perPage: 5 }),
      ]);
      const users = usersResponse.users || [];
      const repos = reposResponse.repos || [];
      setUserResults(users);
      setRepoResults(repos);
      setIsOpen(users.length > 0 || repos.length > 0);
    } catch {
      setUserResults([]);
      setRepoResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
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
    setUserResults([]);
    setRepoResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, []);

  const handleSelectRepo = useCallback(
    (repo: GitHubRepository) => {
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'feed' },
      });
      // Call FeedTabsContext directly. Going through principalEvents would
      // drop on the floor when FeedView is not yet mounted — the bridge in
      // FeedPanelProvider isn't subscribed until after this tick.
      openProjectInfo(
        payloadFromGithub({
          owner: repo.owner.login,
          name: repo.name,
          description: repo.description ?? undefined,
          stars: repo.stargazers_count ?? 0,
          lastUpdated: repo.updated_at,
          isPublic: !repo.private,
          defaultBranch: repo.default_branch,
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
        payload: { view: 'feed' },
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
        payload: { view: 'feed' },
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
        payload: { view: 'feed' },
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

  const openTrailById = useCallback(
    (id: string) => {
      // A pasted trail URL is someone else's published trail — not in the
      // local library. Open it as a feed tab (next to repo profiles), which
      // self-fetches the payload and conveys its remote-ness. Switch to the
      // feed view first; openSharedTrail is called directly on the context
      // (not via principal events) for the same reason the repo openers are —
      // FeedView may not be mounted yet to receive an event.
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'feed' },
      });
      openSharedTrail(id);
      clearSearch();
    },
    [events, openSharedTrail, clearSearch],
  );

  const openTopicById = useCallback(
    (id: string) => {
      // A pasted topic link is a published web-ade topic. Topic tabs render in
      // the Inbox view (the shared-content surface), so switch there and call
      // openTopic on InboxTabsContext directly — its state lives above the
      // conditional InboxView mount, so the tab survives the view switch. The
      // panel self-fetches the topic and its trails from the bare id.
      events.emit({
        type: 'panel:switch',
        source: 'titlebar-search',
        timestamp: Date.now(),
        payload: { view: 'inbox' },
      });
      openTopic(id);
      clearSearch();
    },
    [events, openTopic, clearSearch],
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
            : parsed.type === 'topic'
              ? 'topic'
              : 'trail';
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
        } else {
          openTrailById(parsed.id);
        }
      }, duration);
    },
    [openUserByUsername, openRepoByOwnerName, openTrailById, openTopicById],
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
      const item = flatResults[idx];
      if (!item) return;
      if (idx < userResults.length) {
        handleSelectUser(item as GitHubUser);
      } else {
        handleSelectRepo(item as GitHubRepository);
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
          transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.15s',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {flashLabel ? (
          <ExternalLink size={14} color="#22c55e" style={{ flexShrink: 0, transition: 'color 0.2s' }} />
        ) : (
          <Search
            size={14}
            color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
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
              {userResults.map((user, i) => (
                <div
                  key={`user-${user.id}`}
                  onMouseDown={() => handleSelectUser(user)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 12px',
                    cursor: 'pointer',
                    backgroundColor:
                      i === selectedIndex
                        ? theme.colors.backgroundTertiary
                        : 'transparent',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    transition: 'background-color 0.1s',
                  }}
                >
                  <img
                    src={`${user.avatar_url}&s=84`}
                    alt={user.login}
                    style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }}
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
                      <span style={{ color: theme.colors.textSecondary, fontWeight: 400 }}>
                        @{user.login}
                      </span>
                    </div>
                  </div>
                  <User size={11} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </>
          )}

          {/* Repositories section */}
          {repoResults.length > 0 && (
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
              {repoResults.map((repo, i) => {
                const flatIndex = userResults.length + i;
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
                        i < repoResults.length - 1
                          ? `1px solid ${theme.colors.border}`
                          : 'none',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    <img
                      src={`${repo.owner.avatar_url}&s=84`}
                      alt={repo.owner.login}
                      style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }}
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
