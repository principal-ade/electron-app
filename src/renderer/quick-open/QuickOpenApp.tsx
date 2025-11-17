/**
 * Quick Open - Search and open repositories and workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@a24z/industry-theme';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listen for items from main process
    const handleItems = (_event: any, receivedItems: QuickOpenItem[]) => {
      console.log('[Quick Open] Received items:', receivedItems);
      setItems(receivedItems);
      setFilteredItems(receivedItems);
    };

    window.electronAPI.onQuickOpenItems?.(handleItems);

    // Focus search input on mount
    searchInputRef.current?.focus();

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeQuickOpen?.();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredItems, selectedIndex]);

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

  const handleSelectItem = (item: QuickOpenItem) => {
    console.log('[Quick Open] Selected item:', item);
    window.electronAPI.selectQuickOpenItem?.(item);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
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
          width: '600px',
          background: theme.colors.background,
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
            style={{
              width: '100%',
              padding: '12px',
              background: theme.colors.panelBackground,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text,
              fontSize: '14px',
              outline: 'none',
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
              }}
            >
              {items.length === 0
                ? 'Loading...'
                : 'No matching items found'}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  background:
                    index === selectedIndex
                      ? theme.colors.panelBackground
                      : 'transparent',
                  opacity: item.isOpen ? 0.7 : 1,
                }}
              >
                <div style={{ fontSize: '24px', marginRight: '12px' }}>
                  {item.type === 'repository' ? '📦' : '📁'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: theme.colors.text,
                      fontSize: '14px',
                      fontWeight: 500,
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
                          background: theme.colors.primary,
                          color: '#fff',
                          fontSize: '10px',
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
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
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
                    color: theme.colors.textSecondary,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    marginLeft: '12px',
                  }}
                >
                  {item.type}
                </div>
              </div>
            ))
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
          <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
            ↑↓ Navigate
          </span>
          <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
            Enter Select
          </span>
          <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
            Esc Close
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickOpenApp;
