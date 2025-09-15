import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, Search, FolderOpen, GitFork, Code2, FolderSearch, NotebookPen } from 'lucide-react';
import { RepositoryService } from '../../../main-process-api/RepositoryService';
import { RepositoryAvatar } from '../../../components/repository-maps/RepositoryAvatar';
import { LicenseBadge } from '../../../components/common/LicenseBadge';
export const RepositorySwitcherModal = ({ isOpen, onClose, currentRepository, onSelectRepository, }) => {
    const { theme } = useTheme();
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredRepo, setHoveredRepo] = useState(null);
    // Load repositories when modal opens
    useEffect(() => {
        if (isOpen) {
            loadRepositories();
        }
    }, [isOpen]);
    const loadRepositories = async () => {
        try {
            setLoading(true);
            const repos = await RepositoryService.getRepositories();
            // Filter out the current repository
            const otherRepos = repos.filter(r => r.remoteUrl !== currentRepository.remoteUrl);
            setRepositories(otherRepos);
        }
        catch (error) {
            console.error('Failed to load repositories:', error);
            setRepositories([]);
        }
        finally {
            setLoading(false);
        }
    };
    // Filter repositories based on search
    const filteredRepositories = repositories.filter(repo => {
        const query = searchQuery.toLowerCase();
        return (repo.name.toLowerCase().includes(query) ||
            repo.owner.toLowerCase().includes(query) ||
            repo.tags?.some(tag => tag.toLowerCase().includes(query)));
    });
    const handleSelectRepository = (repo, mode, openInNewWindow = true) => {
        onSelectRepository(repo, mode, openInNewWindow);
        onClose();
    };
    if (!isOpen)
        return null;
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(4px)',
        }, onClick: onClose, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '16px',
                    width: '90%',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                    animation: 'slideUp 0.3s ease-out',
                }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '24px 24px 16px 24px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                        }, children: [_jsxs("div", { children: [_jsx("h2", { style: {
                                            fontSize: '20px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            margin: 0,
                                        }, children: "Switch Repository" }), _jsx("p", { style: {
                                            fontSize: '14px',
                                            color: theme.colors.textSecondary,
                                            marginTop: '4px',
                                            margin: '4px 0 0 0',
                                        }, children: "Select a repository to open" })] }), _jsx("button", { onClick: onClose, style: {
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    color: theme.colors.textSecondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                    e.currentTarget.style.color = theme.colors.text;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                }, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: {
                            padding: '16px 24px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                        }, children: _jsxs("div", { style: {
                                position: 'relative',
                            }, children: [_jsx(Search, { size: 18, style: {
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: theme.colors.textSecondary,
                                    } }), _jsx("input", { type: "text", placeholder: "Search repositories...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), autoFocus: true, style: {
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
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }, onBlur: (e) => {
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    } })] }) }), _jsx("div", { style: {
                            flex: 1,
                            overflowY: 'auto',
                            padding: '16px',
                        }, children: loading ? (_jsx("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: theme.colors.textSecondary,
                                fontSize: '14px',
                            }, children: "Loading repositories..." })) : filteredRepositories.length === 0 ? (_jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: theme.colors.textSecondary,
                                fontSize: '14px',
                                gap: '8px',
                            }, children: [_jsx(FolderOpen, { size: 48, style: { opacity: 0.3 } }), _jsx("span", { children: searchQuery ? 'No repositories match your search' : 'No other repositories available' })] })) : (_jsx("div", { style: {
                                display: 'grid',
                                gap: '12px',
                            }, children: filteredRepositories.map((repo) => {
                                const hasLocalClones = (repo.localClones?.length ?? 0) > 0;
                                const isHovered = hoveredRepo === repo.remoteUrl;
                                return (_jsx("div", { style: {
                                        backgroundColor: isHovered ? theme.colors.backgroundTertiary : theme.colors.background,
                                        border: `2px ${hasLocalClones ? 'solid' : 'dashed'} ${isHovered ? theme.colors.primary : theme.colors.border}`,
                                        borderRadius: '12px',
                                        padding: '16px',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                                        boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
                                    }, onClick: () => {
                                        // Default action: open in explore mode when clicking the card
                                        const defaultMode = hasLocalClones ? 'develop' : 'explore';
                                        handleSelectRepository(repo, defaultMode, true);
                                    }, onMouseEnter: () => setHoveredRepo(repo.remoteUrl), onMouseLeave: () => setHoveredRepo(null), children: _jsxs("div", { style: {
                                            display: 'flex',
                                            gap: '16px',
                                            alignItems: 'center',
                                        }, children: [_jsx(RepositoryAvatar, { repository: repo, size: 48, type: "repository" }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            marginBottom: '4px',
                                                        }, children: [_jsx("h3", { style: {
                                                                    fontSize: '16px',
                                                                    fontWeight: 600,
                                                                    color: theme.colors.text,
                                                                    margin: 0,
                                                                }, children: repo.name }), repo.metadata?.license && (_jsx(LicenseBadge, { license: repo.metadata.license, size: "small", interactive: false })), repo.metadata?.isFork && (_jsxs("div", { style: {
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    backgroundColor: '#f59e0b15',
                                                                    border: '1px solid #f59e0b40',
                                                                    fontSize: '11px',
                                                                    fontWeight: 500,
                                                                    color: '#f59e0b',
                                                                }, children: [_jsx(GitFork, { size: 10 }), "Fork"] }))] }), _jsxs("p", { style: {
                                                            fontSize: '13px',
                                                            color: theme.colors.textSecondary,
                                                            margin: '0 0 8px 0',
                                                        }, children: ["by ", repo.owner] }), _jsx("div", { style: {
                                                            display: 'flex',
                                                            gap: '8px',
                                                            opacity: isHovered ? 1 : 0,
                                                            visibility: isHovered ? 'visible' : 'hidden',
                                                            transition: 'opacity 0.2s, visibility 0.2s',
                                                        }, children: hasLocalClones ? (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        handleSelectRepository(repo, 'planning', true);
                                                                    }, style: {
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: theme.colors.backgroundLight,
                                                                        color: theme.colors.text,
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        transition: 'all 0.2s',
                                                                    }, onMouseEnter: (e) => {
                                                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                                                        e.currentTarget.style.borderColor = theme.colors.textSecondary;
                                                                    }, onMouseLeave: (e) => {
                                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                                                        e.currentTarget.style.borderColor = theme.colors.border;
                                                                    }, children: [_jsx(NotebookPen, { size: 12 }), "Plan"] }), _jsxs("button", { onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        handleSelectRepository(repo, 'develop', true);
                                                                    }, style: {
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: theme.colors.primary,
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        transition: 'opacity 0.2s',
                                                                    }, onMouseEnter: (e) => {
                                                                        e.currentTarget.style.opacity = '0.9';
                                                                    }, onMouseLeave: (e) => {
                                                                        e.currentTarget.style.opacity = '1';
                                                                    }, children: [_jsx(Code2, { size: 12 }), "Develop"] }), _jsxs("button", { onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        handleSelectRepository(repo, 'explore', true);
                                                                    }, style: {
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                                        color: theme.colors.text,
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        transition: 'all 0.2s',
                                                                    }, onMouseEnter: (e) => {
                                                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                                                        e.currentTarget.style.color = theme.colors.primary;
                                                                    }, onMouseLeave: (e) => {
                                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                                        e.currentTarget.style.borderColor = theme.colors.border;
                                                                        e.currentTarget.style.color = theme.colors.text;
                                                                    }, children: [_jsx(FolderSearch, { size: 12 }), "Evaluate"] })] })) : (_jsxs("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                handleSelectRepository(repo, 'explore', true);
                                                            }, style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                backgroundColor: theme.colors.backgroundLight,
                                                                color: theme.colors.text,
                                                                border: `1px solid ${theme.colors.border}`,
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                transition: 'all 0.2s',
                                                            }, onMouseEnter: (e) => {
                                                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                                                e.currentTarget.style.borderColor = theme.colors.textSecondary;
                                                            }, onMouseLeave: (e) => {
                                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                                                e.currentTarget.style.borderColor = theme.colors.border;
                                                            }, children: [_jsx(FolderSearch, { size: 12 }), "Evaluate"] })) })] })] }) }, repo.remoteUrl));
                            }) })) }), _jsx("div", { style: {
                            padding: '16px 24px',
                            borderTop: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundTertiary,
                            borderBottomLeftRadius: '16px',
                            borderBottomRightRadius: '16px',
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                            }, children: [_jsx("span", { children: "Currently viewing:" }), _jsx("strong", { style: { color: theme.colors.text }, children: currentRepository.name }), _jsxs("span", { children: ["by ", currentRepository.owner] })] }) })] }), _jsx("style", { children: `
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      ` })] }));
};
