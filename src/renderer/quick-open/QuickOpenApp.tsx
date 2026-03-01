/**
 * Quick Open - Search and open repositories and workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

interface QuickOpenItem {
  id: string;
  type: 'repository' | 'workspace';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
  // Avatar URL for display (GitHub owner avatar for repositories)
  avatarUrl?: string;
  // Full AlexandriaEntry for repositories (passed through to main process when opening)
  alexandriaEntry?: AlexandriaEntry;
}

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
  };
}

// Cast window to QuickOpenWindow since we know electronAPI is always present
const quickOpenWindow = window as unknown as QuickOpenWindow;

/**
 * Shorten a path by replacing the home directory with ~
 */
const shortenPath = (path: string): string => {
  // macOS: /Users/username/...
  const macMatch = path.match(/^\/Users\/[^/]+/);
  if (macMatch) {
    return path.replace(macMatch[0], '~');
  }
  // Linux: /home/username/...
  const linuxMatch = path.match(/^\/home\/[^/]+/);
  if (linuxMatch) {
    return path.replace(linuxMatch[0], '~');
  }
  return path;
};

const QuickOpenApp: React.FC = () => {
  const { theme } = useTheme();
  const [items, setItems] = useState<QuickOpenItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<QuickOpenItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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

    // Handle Escape key at window level (other keys handled in input)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        quickOpenWindow.electronAPI.closeQuickOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up IPC listener to prevent memory leak
      removeItemsListener?.();
    };
  }, []);

  useEffect(() => {
    // Filter items based on search query
    if (searchQuery.trim() === '') {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      );
      setFilteredItems(filtered);
    }
    setSelectedIndex(0);
  }, [searchQuery, items]);

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
      console.info('[Quick Open] Tab - cycling selection');
      setSelectedIndex((prev) => {
        const newIndex = prev < filteredItems.length - 1 ? prev + 1 : 0;
        console.info('[Quick Open] New index:', newIndex);
        return newIndex;
      });
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

  return (
    <div
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
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search projects and workspaces..."
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

        {/* Copied feedback overlay */}
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
              }}
            >
              ✓ {copiedMessage}
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
              {items.length === 0 ? 'Loading...' : 'No matching items found'}
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
                  }}
                >
                  {/* Selection background */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: isSelected
                        ? `${theme.colors.primary}20`
                        : 'transparent',
                      zIndex: -1,
                    }}
                  />
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
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            color: isSelected
                              ? theme.colors.primary
                              : theme.colors.text,
                          }}
                        >
                          {item.name}
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
                      {item.description && (
                        <div
                          style={{
                            color: isSelected
                              ? theme.colors.accent
                              : theme.colors.textSecondary,
                            fontSize: theme.fontSizes[3],
                            fontFamily: theme.fonts.body,
                            lineHeight: '32px',
                            marginTop: '0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {shortenPath(item.description)}
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
            Tab Cycle
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            Enter Select
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
