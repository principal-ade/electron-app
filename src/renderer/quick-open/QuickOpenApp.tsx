/**
 * Quick Open - Search and open repositories and workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import './QuickOpenApp.css';

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
    <div className="quick-open-container">
      <div className="quick-open-dialog">
        <div className="search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search repositories and workspaces..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="items-list">
          {filteredItems.length === 0 ? (
            <div className="no-results">
              {items.length === 0
                ? 'Loading...'
                : 'No matching items found'}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`item ${index === selectedIndex ? 'selected' : ''} ${item.isOpen ? 'open' : ''}`}
                onClick={() => handleSelectItem(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="item-icon">
                  {item.type === 'repository' ? '📦' : '📁'}
                </div>
                <div className="item-content">
                  <div className="item-name">
                    {item.name}
                    {item.isOpen && <span className="open-badge">Open</span>}
                  </div>
                  {item.description && (
                    <div className="item-description">{item.description}</div>
                  )}
                </div>
                <div className="item-type">{item.type}</div>
              </div>
            ))
          )}
        </div>

        <div className="footer">
          <span className="hint">↑↓ Navigate</span>
          <span className="hint">Enter Select</span>
          <span className="hint">Esc Close</span>
        </div>
      </div>
    </div>
  );
};

export default QuickOpenApp;
