import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const HeaderSearchBar = ({ onSearch, placeholder = "Search files..." }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    const searchTimeoutRef = useRef();
    // Debounced search
    const handleSearchChange = useCallback((value) => {
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
        const handleKeyDown = (e) => {
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
    return (_jsxs("div", { style: {
            position: 'relative',
            width: '100%',
            maxWidth: '300px',
        }, children: [_jsxs("div", { style: {
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
                }, children: [_jsx(Search, { size: 16, style: {
                            color: isFocused ? theme.colors.primary : theme.colors.textSecondary,
                            flexShrink: 0,
                        } }), _jsx("input", { ref: inputRef, type: "text", value: searchQuery, onChange: (e) => handleSearchChange(e.target.value), onFocus: () => setIsFocused(true), onBlur: () => setIsFocused(false), placeholder: placeholder, style: {
                            flex: 1,
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '14px',
                            color: theme.colors.text,
                            width: '100%',
                        } }), searchQuery && (_jsx("button", { onClick: handleClear, style: {
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
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            e.currentTarget.style.color = theme.colors.text;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, title: "Clear search (Esc)", children: _jsx(X, { size: 14 }) }))] }), !isFocused && !searchQuery && (_jsx("div", { style: {
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: theme.colors.textMuted,
                    opacity: 0.5,
                    pointerEvents: 'none',
                }, children: "\u2318F" }))] }));
};
