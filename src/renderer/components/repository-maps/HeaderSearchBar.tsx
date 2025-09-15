import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface HeaderSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const HeaderSearchBar: React.FC<HeaderSearchBarProps> = ({
  onSearch,
  placeholder = "Search files..."
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce the search with shorter delay for snappier feel
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, 150);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear search when focused
      if (e.key === 'Escape' && isFocused) {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, handleClear]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '300px',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: isFocused 
            ? theme.colors.backgroundTertiary 
            : theme.colors.backgroundSecondary,
          border: `1px solid ${isFocused ? theme.colors.primary : theme.colors.border}`,
          borderRadius: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        <Search 
          size={16} 
          style={{ 
            color: isFocused ? theme.colors.primary : theme.colors.textSecondary,
            flexShrink: 0,
          }} 
        />
        
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: theme.colors.text,
            width: '100%',
          }}
        />
        
        {searchQuery && (
          <button
            onClick={handleClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Clear search (Esc)"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      {/* Keyboard shortcut hint */}
      {!isFocused && !searchQuery && (
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '11px',
            color: theme.colors.textMuted,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          ⌘F
        </div>
      )}
    </div>
  );
};