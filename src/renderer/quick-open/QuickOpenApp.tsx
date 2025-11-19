/**
 * Quick Open - Search and open repositories and workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

interface QuickOpenItem {
  id: string;
  type: 'repository' | 'workspace';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
}

const QuickOpenApp: React.FC = () => {
  const { theme } = useTheme();
  const [items, setItems] = useState<QuickOpenItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<QuickOpenItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for items from main process
    const handleItems = (_event: any, receivedItems: QuickOpenItem[]) => {
      setItems(receivedItems);
      setFilteredItems(receivedItems);
    };

    const removeItemsListener = window.electronAPI.onQuickOpenItems?.(handleItems);

    // Request items now that listener is ready
    window.electronAPI.requestQuickOpenItems?.();

    // Focus search input on mount
    searchInputRef.current?.focus();

    // Handle Escape key at window level (other keys handled in input)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeQuickOpen?.();
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
    console.log('[Quick Open] Selected item:', item);

    // Trigger animation
    setIsAnimating(true);
    setAnimatingItemId(item.id);

    // Send selection to main process - keep window visible during 2s animation
    setTimeout(() => {
      window.electronAPI?.selectQuickOpenItem?.(item);
    }, 2000);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('[Quick Open] Key pressed:', e.key);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      console.log('[Quick Open] Arrow Down - moving selection down');
      setSelectedIndex((prev) => {
        const newIndex = prev < filteredItems.length - 1 ? prev + 1 : prev;
        console.log('[Quick Open] New index:', newIndex);
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      console.log('[Quick Open] Arrow Up - moving selection up');
      setSelectedIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : prev;
        console.log('[Quick Open] New index:', newIndex);
        return newIndex;
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      console.log('[Quick Open] Tab - cycling selection');
      setSelectedIndex((prev) => {
        const newIndex = prev < filteredItems.length - 1 ? prev + 1 : 0;
        console.log('[Quick Open] New index:', newIndex);
        return newIndex;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      console.log('[Quick Open] Enter - selecting item at index:', selectedIndex);
      if (filteredItems[selectedIndex]) {
        handleSelectItem(filteredItems[selectedIndex]);
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
        opacity: isAnimating ? 0 : 1,
        transition: 'opacity 1.5s ease-out',
      }}
    >
      <div
        style={{
          width: '600px',
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
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
            placeholder="Search repositories and workspaces..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleInputKeyDown}
            style={{
              width: '100%',
              padding: '12px',
              background: theme.colors.panelBackground || '#1e1e1e',
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
              {items.length === 0
                ? 'Loading...'
                : 'No matching items found'}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isAnimatingItem = animatingItemId === item.id;
              return (
                <div
                  key={item.id}
                  ref={isSelected ? selectedItemRef : null}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    borderLeft: isSelected
                      ? `3px solid ${theme.colors.primary}`
                      : '3px solid transparent',
                    opacity: isAnimating && !isAnimatingItem ? 0.3 : item.isOpen ? 0.7 : 1,
                    overflow: 'visible',
                    zIndex: isAnimatingItem ? 1000 : 1,
                  }}
                >
                  {/* Growing background */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: isAnimatingItem
                        ? theme.colors.primary
                        : isSelected
                        ? `${theme.colors.primary}20`
                        : 'transparent',
                      transform: isAnimatingItem ? 'scaleY(20)' : 'scaleY(1)',
                      transformOrigin: 'center',
                      boxShadow: isAnimatingItem
                        ? `0 0 20px ${theme.colors.primary}, 0 0 40px ${theme.colors.primary}80`
                        : 'none',
                      transition: 'all 2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      zIndex: -1,
                    }}
                  />
                  {/* Content stays normal - no transforms */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    <div style={{ fontSize: theme.fontSizes[6], marginRight: '12px' }}>
                      {item.type === 'repository' ? '📦' : '📁'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: isAnimatingItem ? '#fff' : theme.colors.text,
                          fontSize: theme.fontSizes[3],
                          fontFamily: theme.fonts.body,
                          fontWeight: isAnimatingItem ? 600 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {item.name}
                        {item.isOpen && (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              background: isAnimatingItem ? '#fff' : theme.colors.primary,
                              color: isAnimatingItem ? theme.colors.primary : '#fff',
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
                            color: isAnimatingItem ? '#ffffffcc' : theme.colors.textSecondary,
                            fontSize: theme.fontSizes[2],
                            fontFamily: theme.fonts.body,
                            marginTop: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        color: isAnimatingItem ? '#ffffffcc' : theme.colors.textSecondary,
                        fontSize: theme.fontSizes[1],
                        fontFamily: theme.fonts.body,
                        textTransform: 'uppercase',
                        marginLeft: '12px',
                      }}
                    >
                      {item.type}
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
            background: theme.colors.panelBackground,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <span style={{ fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body, color: theme.colors.textSecondary }}>
            ↑↓ Navigate
          </span>
          <span style={{ fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body, color: theme.colors.textSecondary }}>
            Tab Cycle
          </span>
          <span style={{ fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body, color: theme.colors.textSecondary }}>
            Enter Select
          </span>
          <span style={{ fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body, color: theme.colors.textSecondary }}>
            Esc Close
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickOpenApp;
