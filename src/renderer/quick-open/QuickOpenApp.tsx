/**
 * Quick Open - Search and open repositories and workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

import type { QuickOpenItem } from '../../shared/quickOpen';
import { tildifyPath } from '../utils/tildifyPath';

interface GitHubSearchResult {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  stargazers_count: number;
  clone_url: string;
  html_url: string;
}

type QuickOpenMode = 'clones' | 'orgs' | 'github';

/** Mode pills, in display order. */
const MODES: Array<{ id: QuickOpenMode; label: string }> = [
  { id: 'clones', label: 'Clones' },
  { id: 'orgs', label: 'Orgs' },
  { id: 'github', label: 'GitHub' },
];

/** The items a non-GitHub mode lists, before the query filter. */
const itemsForMode = (
  items: QuickOpenItem[],
  mode: QuickOpenMode,
): QuickOpenItem[] =>
  mode === 'orgs'
    ? items.filter((item) => item.type === 'ownerDirectory')
    : items.filter((item) => item.type !== 'ownerDirectory');

// Quick Open specific window type - electronAPI is always defined in this context
interface QuickOpenWindow extends Window {
  electronAPI: {
    onQuickOpenItems: (
      callback: (
        event: Electron.IpcRendererEvent,
        items: QuickOpenItem[],
      ) => void,
    ) => void | (() => void);
    requestQuickOpenItems: () => void;
    selectQuickOpenItem: (item: QuickOpenItem) => void;
    closeQuickOpen: () => void;
    copyToClipboard: (text: string) => Promise<void>;
    // GitHub search
    searchGitHub: (query: string) => Promise<GitHubSearchResult[]>;
    isAuthenticated: () => Promise<boolean>;
  };
}

// Cast window to QuickOpenWindow since we know electronAPI is always present
const quickOpenWindow = window as unknown as QuickOpenWindow;


/**
 * Highlight matching text by splitting into segments
 */
const highlightMatch = (
  text: string,
  query: string,
  highlightColor: string,
): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span style={{ color: highlightColor, fontWeight: 600 }}>{match}</span>
      {after}
    </>
  );
};

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "yesterday")
 */
const formatRelativeTime = (timestamp: string | undefined): string => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}y ago`;
  }
};

const QuickOpenApp: React.FC = () => {
  const { theme } = useTheme();
  const [items, setItems] = useState<QuickOpenItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<QuickOpenItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [isCommandHeld, setIsCommandHeld] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // GitHub search mode state
  const [mode, setMode] = useState<QuickOpenMode>('clones');
  const [isSearching, setIsSearching] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Listen for items from main process
    const handleItems = (
      _event: Electron.IpcRendererEvent,
      receivedItems: QuickOpenItem[],
    ) => {
      setItems(receivedItems);
      setFilteredItems(receivedItems);
    };

    const removeItemsListener =
      quickOpenWindow.electronAPI.onQuickOpenItems(handleItems);

    // Request items now that listener is ready
    quickOpenWindow.electronAPI.requestQuickOpenItems();

    // Focus search input on mount
    searchInputRef.current?.focus();

    // Handle Escape key and Command key state at window level
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        quickOpenWindow.electronAPI.closeQuickOpen();
      }
      // Track Command/Meta key state
      if (e.key === 'Meta') {
        setIsCommandHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Track Command/Meta key release
      if (e.key === 'Meta') {
        setIsCommandHeld(false);
      }
    };

    // Reset command state if window loses focus
    const handleBlur = () => {
      setIsCommandHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      // Clean up IPC listener to prevent memory leak
      removeItemsListener?.();
    };
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    quickOpenWindow.electronAPI.isAuthenticated().then(setIsAuthenticated);
  }, []);

  // Filter the Clones/Orgs lists, or search GitHub, based on mode
  useEffect(() => {
    if (mode !== 'github') {
      const query = searchQuery.trim().toLowerCase();
      const pool = itemsForMode(items, mode);
      setFilteredItems(
        query === ''
          ? pool
          : pool.filter(
              (item) =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query),
            ),
      );
      setSelectedIndex(0);
    } else {
      // GitHub mode: debounced search
      if (searchQuery.trim() === '') {
        setFilteredItems([]);
        setSelectedIndex(0);
        return;
      }

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce search by 300ms
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await quickOpenWindow.electronAPI.searchGitHub(
            searchQuery,
          );
          const mappedResults: QuickOpenItem[] = results.map((repo) => ({
            id: String(repo.id),
            type: 'github' as const,
            name: repo.full_name,
            fullName: repo.full_name,
            description: repo.description || undefined,
            avatarUrl: repo.owner.avatar_url,
            stars: repo.stargazers_count,
            cloneUrl: repo.clone_url,
            remoteUrl: repo.html_url,
            isOpen: false,
          }));
          setFilteredItems(mappedResults);
          setSelectedIndex(0);
        } catch (error) {
          console.error('[Quick Open] GitHub search failed:', error);
          setFilteredItems([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, items, mode]);

  useEffect(() => {
    // Scroll selected item into view
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleSelectItem = (item: QuickOpenItem) => {
    console.info('[Quick Open] Selected item:', item);

    // The main process opens local repositories or browses GitHub in Explorer.
    quickOpenWindow.electronAPI.selectQuickOpenItem(item);
  };

  const handleContextMenu = async (
    e: React.MouseEvent<HTMLDivElement>,
    item: QuickOpenItem,
  ) => {
    e.preventDefault();
    if (item.localPath) {
      console.info('[Quick Open] Copying path to clipboard:', item.localPath);
      try {
        await quickOpenWindow.electronAPI.copyToClipboard(item.localPath);
        console.info('[Quick Open] Path copied successfully');

        // Show "Copied!" message
        setCopiedMessage('Path copied to clipboard!');

        // Close after a brief delay to show the feedback
        setTimeout(() => {
          quickOpenWindow.electronAPI.closeQuickOpen();
        }, 400);
      } catch (error) {
        console.error('[Quick Open] Failed to copy to clipboard:', error);
        setCopiedMessage('Failed to copy path');

        // Clear error message after delay
        setTimeout(() => {
          setCopiedMessage(null);
        }, 2000);
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.info('[Quick Open] Key pressed:', e.key);

    // Handle Command+Shift+Number (1-9) to copy path
    if (e.metaKey && e.shiftKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const itemIndex = parseInt(e.key, 10) - 1; // Convert 1-9 to 0-8
      console.info('[Quick Open] Cmd+Shift+Number - copying path at index:', itemIndex);
      const item = filteredItems[itemIndex];
      if (item?.localPath) {
        handleContextMenu(e as unknown as React.MouseEvent<HTMLDivElement>, item);
      }
      return;
    }

    // Handle Command+Number (1-9) to select items
    if (e.metaKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const itemIndex = parseInt(e.key, 10) - 1; // Convert 1-9 to 0-8
      console.info('[Quick Open] Cmd+Number - selecting item at index:', itemIndex);
      if (filteredItems[itemIndex]) {
        handleSelectItem(filteredItems[itemIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      console.info('[Quick Open] Arrow Down - moving selection down');
      setSelectedIndex((prev) => {
        const newIndex = prev < filteredItems.length - 1 ? prev + 1 : prev;
        console.info('[Quick Open] New index:', newIndex);
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      console.info('[Quick Open] Arrow Up - moving selection up');
      setSelectedIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : prev;
        console.info('[Quick Open] New index:', newIndex);
        return newIndex;
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      console.info('[Quick Open] Tab - cycling mode');
      setMode((prev) => {
        // Skip GitHub while signed out — its pill is disabled.
        const enabled = MODES.filter(
          (m) => m.id !== 'github' || isAuthenticated,
        );
        const index = enabled.findIndex((m) => m.id === prev);
        return enabled[(index + 1) % enabled.length].id;
      });
      setSearchQuery(''); // Clear search when switching modes
      setSelectedIndex(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to copy path
      if (e.metaKey || e.ctrlKey) {
        console.info(
          '[Quick Open] Cmd/Ctrl+Enter - copying path at index:',
          selectedIndex,
        );
        if (filteredItems[selectedIndex]) {
          const item = filteredItems[selectedIndex];
          if (item.localPath) {
            handleContextMenu(
              e as unknown as React.MouseEvent<HTMLDivElement>,
              item,
            );
          }
        }
      } else {
        console.info(
          '[Quick Open] Enter - selecting item at index:',
          selectedIndex,
        );
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
      }
    }
  };

  const handleBackdropClick = () => {
    quickOpenWindow.electronAPI.closeQuickOpen();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '20vh',
        background: 'transparent',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '600px',
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mode Toggle Pills — Clones · Orgs · GitHub */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {MODES.map(({ id, label }) => {
            const requiresAuth = id === 'github';
            const disabled = requiresAuth && !isAuthenticated;
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setSearchQuery('');
                  setSelectedIndex(0);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  border: 'none',
                  background: active
                    ? theme.colors.primary
                    : theme.colors.backgroundSecondary,
                  color: active
                    ? theme.colors.background
                    : theme.colors.textSecondary,
                  fontSize: theme.fontSizes[2],
                  fontFamily: theme.fonts.body,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: disabled ? 0.5 : 1,
                }}
                disabled={disabled}
                title={disabled ? 'Sign in to search GitHub' : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              {
                clones: 'Search cloned repositories...',
                orgs: 'Search owner folders...',
                github: 'Search GitHub repositories...',
              }[mode]
            }
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleInputKeyDown}
            style={{
              width: '100%',
              padding: '12px',
              background: theme.colors.backgroundSecondary || '#1e1e1e',
              border: `1px solid ${theme.colors.border || '#3e3e3e'}`,
              borderRadius: '4px',
              color: theme.colors.text || '#ffffff',
              fontSize: theme.fontSizes[3],
              fontFamily: theme.fonts.body,
              outline: 'none',
              WebkitTextFillColor: theme.colors.text || '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Clipboard feedback overlay */}
        {copiedMessage && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: theme.colors.primary,
                color: theme.colors.background,
                padding: '16px 32px',
                borderRadius: '8px',
                fontSize: theme.fontSizes[4],
                fontFamily: theme.fonts.body,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {'✓ '}
              {copiedMessage}
            </div>
          </div>
        )}

        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              {mode === 'github'
                ? isSearching
                  ? 'Searching GitHub...'
                  : searchQuery.trim() === ''
                    ? 'Type to search GitHub repositories'
                    : 'No repositories found'
                : items.length === 0
                  ? 'Loading...'
                  : mode === 'orgs'
                    ? 'No owner folders found'
                    : 'No matching clones found'}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  ref={isSelected ? selectedItemRef : null}
                  onClick={() => handleSelectItem(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 16px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    opacity: item.isOpen ? 0.7 : 1,
                    background: 'transparent',
                  }}
                >
                  {/* Content */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '64px',
                        height: '64px',
                        borderRadius: '8px',
                        marginRight: '12px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            // Fallback to emoji on load error
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.nextSibling) {
                              (
                                target.nextSibling as HTMLElement
                              ).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <span
                        style={{
                          display: item.avatarUrl ? 'none' : 'flex',
                          fontSize: '16px',
                        }}
                      >
                        {item.type === 'repository' ? '📦' : '📁'}
                      </span>
                      {/* Command+Number badge overlay */}
                      {isCommandHeld && index < 9 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            borderRadius: '8px',
                          }}
                        >
                          <span
                            style={{
                              color: theme.colors.primary,
                              fontSize: '28px',
                              fontFamily: theme.fonts.body,
                              fontWeight: 700,
                            }}
                          >
                            {index + 1}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: theme.colors.text,
                          fontSize: theme.fontSizes[4],
                          fontFamily: theme.fonts.body,
                          fontWeight: 500,
                          lineHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              color: theme.colors.text,
                              borderBottom: isSelected
                                ? `2px solid ${theme.colors.primary}`
                                : '2px solid transparent',
                              paddingBottom: '0px',
                              paddingLeft: '1px',
                              paddingRight: '3px',
                              marginLeft: '-1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {highlightMatch(item.name, searchQuery, theme.colors.primary)}
                          </span>
                          {item.isOpen && (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                background: theme.colors.primary,
                                color: theme.colors.background,
                                fontSize: theme.fontSizes[1],
                                fontFamily: theme.fonts.body,
                                borderRadius: '3px',
                                fontWeight: 600,
                              }}
                            >
                              Open
                            </span>
                          )}
                        </div>
                        {item.type === 'github' && item.stars !== undefined ? (
                          <span
                            style={{
                              color: theme.colors.textSecondary,
                              fontSize: theme.fontSizes[2],
                              fontFamily: theme.fonts.body,
                              fontWeight: 400,
                              flexShrink: 0,
                              marginLeft: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>★</span>
                            {item.stars >= 1000
                              ? `${(item.stars / 1000).toFixed(1)}k`
                              : item.stars}
                          </span>
                        ) : item.type === 'ownerDirectory' ? (
                          <span
                            style={{
                              color: theme.colors.textSecondary,
                              fontSize: theme.fontSizes[2],
                              fontFamily: theme.fonts.body,
                              fontWeight: 400,
                              flexShrink: 0,
                              marginLeft: '12px',
                            }}
                          >
                            {item.cloneCount === 1
                              ? '1 clone'
                              : `${item.cloneCount ?? 0} clones`}{' '}
                            · terminal
                          </span>
                        ) : item.lastOpenedAt ? (
                          <span
                            style={{
                              color: theme.colors.textSecondary,
                              fontSize: theme.fontSizes[2],
                              fontFamily: theme.fonts.body,
                              fontWeight: 400,
                              flexShrink: 0,
                              marginLeft: '12px',
                            }}
                          >
                            {formatRelativeTime(item.lastOpenedAt)}
                          </span>
                        ) : null}
                      </div>
                      {item.description && (
                        <div
                          style={{
                            color: theme.colors.textSecondary,
                            fontSize: theme.fontSizes[3],
                            fontFamily: theme.fonts.body,
                            lineHeight: '32px',
                            marginTop: '0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {highlightMatch(tildifyPath(item.description), searchQuery, theme.colors.primary)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            padding: '8px 16px',
            background: theme.colors.backgroundSecondary,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.primary,
              fontWeight: 600,
            }}
          >
            Tab Mode
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            ↑↓ Navigate
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            {mode === 'clones'
              ? 'Enter Open'
              : mode === 'orgs'
                ? 'Enter Terminal'
                : 'Enter Explore'}
          </span>
          {mode !== 'github' && (
            <>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  color: isCommandHeld
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                  fontWeight: isCommandHeld ? 600 : 400,
                }}
              >
                {isCommandHeld ? '⌘1-9 Select · ⇧ Copy' : '⌘1-9 Quick Select'}
              </span>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                ⌘↵ Copy Path
              </span>
            </>
          )}
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            Esc Close
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickOpenApp;
