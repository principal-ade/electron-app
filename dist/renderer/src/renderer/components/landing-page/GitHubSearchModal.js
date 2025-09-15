import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, Search, Star, GitFork, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { RepositoryService } from '../../main-process-api/RepositoryService';
export const GitHubSearchModal = ({ isOpen, onClose, onSelectRepository, }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setError(null);
            setHasSearched(false);
        }
    }, [isOpen]);
    const handleSearch = async () => {
        if (!searchQuery.trim())
            return;
        setIsSearching(true);
        setError(null);
        setHasSearched(true);
        try {
            const results = await RepositoryService.searchGitHubRepositories(searchQuery, {
                sort: 'stars',
                order: 'desc',
                perPage: 20,
            });
            setSearchResults(results.items || []);
        }
        catch (err) {
            console.error('Failed to search GitHub:', err);
            setError('Failed to search GitHub repositories. Please try again.');
            setSearchResults([]);
        }
        finally {
            setIsSearching(false);
        }
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !isSearching) {
            handleSearch();
        }
    };
    const handleSelectRepo = (repo) => {
        const [owner, name] = repo.full_name.split('/');
        onSelectRepository({
            owner,
            name,
            remoteUrl: repo.html_url,
            description: repo.description,
        });
        onClose();
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '800px',
                width: '90%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '24px',
                    }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        margin: '0 0 8px 0',
                                    }, children: "Search GitHub Repositories" }), _jsx("p", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                        margin: 0,
                                    }, children: "Search for public repositories on GitHub" })] }), _jsx("button", { onClick: onClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '8px',
                                color: theme.colors.textSecondary,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                e.currentTarget.style.color = theme.colors.text;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = theme.colors.textSecondary;
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '24px',
                    }, children: [_jsxs("div", { style: {
                                flex: 1,
                                position: 'relative',
                            }, children: [_jsx(Search, { size: 18, style: {
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: theme.colors.textSecondary,
                                    } }), _jsx("input", { type: "text", placeholder: "Search repositories (e.g., react, tensorflow, vue...)", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyPress: handleKeyPress, autoFocus: true, style: {
                                        width: '100%',
                                        padding: '10px 12px 10px 40px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                    }, onFocus: (e) => {
                                        e.target.style.borderColor = theme.colors.primary;
                                    }, onBlur: (e) => {
                                        e.target.style.borderColor = theme.colors.border;
                                    } })] }), _jsx("button", { onClick: handleSearch, disabled: isSearching || !searchQuery.trim(), style: {
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                                opacity: isSearching || !searchQuery.trim() ? 0.5 : 1,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }, onMouseEnter: (e) => {
                                if (!isSearching && searchQuery.trim()) {
                                    e.currentTarget.style.opacity = '0.9';
                                }
                            }, onMouseLeave: (e) => {
                                if (!isSearching && searchQuery.trim()) {
                                    e.currentTarget.style.opacity = '1';
                                }
                            }, children: isSearching ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 16, style: { animation: 'spin 1s linear infinite' } }), "Searching..."] })) : (_jsxs(_Fragment, { children: [_jsx(Search, { size: 16 }), "Search"] })) })] }), _jsxs("div", { style: {
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0,
                    }, children: [error && (_jsxs("div", { style: {
                                padding: '16px',
                                borderRadius: '8px',
                                backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                                border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(AlertCircle, { size: 20, color: theme.colors.error || '#ef4444' }), _jsx("span", { style: { color: theme.colors.text, fontSize: '14px' }, children: error })] })), isSearching && (_jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '48px',
                                color: theme.colors.textSecondary,
                            }, children: [_jsx(Loader2, { size: 32, style: { animation: 'spin 1s linear infinite', marginBottom: '16px' } }), _jsx("p", { children: "Searching GitHub repositories..." })] })), !isSearching && hasSearched && searchResults.length === 0 && !error && (_jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '48px',
                                color: theme.colors.textSecondary,
                            }, children: [_jsx(Search, { size: 48, style: { marginBottom: '16px', opacity: 0.5 } }), _jsx("p", { style: { fontSize: '16px', marginBottom: '8px' }, children: "No repositories found" }), _jsx("p", { style: { fontSize: '14px', opacity: 0.7 }, children: "Try a different search term" })] })), !isSearching && searchResults.length > 0 && (_jsx("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }, children: searchResults.map((repo) => (_jsx("button", { onClick: () => handleSelectRepo(repo), style: {
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: `1px solid ${theme.colors.border}`,
                                    backgroundColor: theme.colors.background,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.background;
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                }, children: _jsx("div", { style: {
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                    }, children: _jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: {
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    color: theme.colors.primary,
                                                    margin: '0 0 4px 0',
                                                }, children: repo.full_name }), repo.description && (_jsx("p", { style: {
                                                    fontSize: '14px',
                                                    color: theme.colors.textSecondary,
                                                    margin: '0 0 8px 0',
                                                    lineHeight: 1.4,
                                                }, children: repo.description })), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '16px',
                                                    fontSize: '13px',
                                                    color: theme.colors.textSecondary,
                                                }, children: [repo.language && (_jsxs("span", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx("span", { style: {
                                                                    width: '12px',
                                                                    height: '12px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: theme.colors.accent || '#8b7355',
                                                                    display: 'inline-block',
                                                                } }), repo.language] })), _jsxs("span", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx(Star, { size: 14 }), repo.stargazers_count.toLocaleString()] }), _jsxs("span", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }, children: [_jsx(GitFork, { size: 14 }), repo.forks_count.toLocaleString()] })] })] }) }) }, repo.id))) })), !isSearching && !hasSearched && (_jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '48px',
                                color: theme.colors.textSecondary,
                            }, children: [_jsx(Search, { size: 48, style: { marginBottom: '16px', opacity: 0.5 } }), _jsx("p", { style: { fontSize: '16px', marginBottom: '8px' }, children: "Search for repositories" }), _jsx("p", { style: { fontSize: '14px', opacity: 0.7 }, children: "Enter a search term above to find GitHub repositories" })] }))] }), _jsx("style", { children: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        ` })] }) }));
};
