import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Github, FolderPlus, Globe, HardDrive, GitBranch, Cloud } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const AddRepositoryModal = ({ isOpen, onClose, onSelectLocal, onSelectRemote, }) => {
    const { theme } = useTheme();
    const [hoveredCard, setHoveredCard] = useState(null);
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
                maxWidth: '720px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
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
                                    }, children: "Add Repository" }), _jsx("p", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                        margin: 0,
                                    }, children: "Choose how you'd like to add a repository to PrincipalAI" })] }), _jsx("button", { onClick: onClose, style: {
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
                            }, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: {
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '28px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                        }, children: [_jsx("div", { style: {
                                    backgroundColor: theme.colors.primary + '20',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: _jsx(GitBranch, { size: 24, color: theme.colors.primary }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: {
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            margin: '0 0 8px 0',
                                        }, children: "Understanding Repository Types" }), _jsxs("p", { style: {
                                            fontSize: '13px',
                                            color: theme.colors.textSecondary,
                                            lineHeight: '1.6',
                                            margin: 0,
                                        }, children: ["PrincipalAI works with both ", _jsx("strong", { children: "local repositories" }), " (already on your computer) and", _jsx("strong", { children: " remote repositories" }), " (hosted on GitHub). Local repos give you immediate access to code analysis and mapping, while remote repos can be explored and cloned when needed."] })] })] }) }), _jsxs("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '20px',
                    }, children: [_jsxs("div", { onClick: onSelectLocal, onMouseEnter: () => setHoveredCard('local'), onMouseLeave: () => setHoveredCard(null), style: {
                                backgroundColor: theme.colors.background,
                                borderRadius: '12px',
                                padding: '24px',
                                border: `2px solid ${hoveredCard === 'local' ? theme.colors.primary : theme.colors.border}`,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                transform: hoveredCard === 'local' ? 'translateY(-4px)' : 'translateY(0)',
                                boxShadow: hoveredCard === 'local'
                                    ? '0 8px 24px rgba(0, 0, 0, 0.15)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.05)',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '16px',
                                    }, children: [_jsx("div", { style: {
                                                backgroundColor: '#10b981' + '20',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }, children: _jsx(HardDrive, { size: 24, color: '#10b981' }) }), _jsx("h3", { style: {
                                                fontSize: '18px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0,
                                            }, children: "Add Local Repository" })] }), _jsx("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.6',
                                        marginBottom: '16px',
                                    }, children: "Select a Git repository that already exists on your computer. Perfect for projects you're actively working on or have cloned previously." }), _jsxs("div", { style: {
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '16px',
                                    }, children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '8px' }, children: _jsx("strong", { children: "Use this when:" }) }), _jsxs("ul", { style: {
                                                margin: 0,
                                                paddingLeft: '20px',
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                                lineHeight: '1.5',
                                            }, children: [_jsx("li", { children: "You have code on your machine" }), _jsx("li", { children: "You want immediate file access" }), _jsx("li", { children: "Working on private/local projects" })] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingTop: '12px',
                                        borderTop: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsxs("span", { style: {
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: hoveredCard === 'local' ? theme.colors.primary : theme.colors.text,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }, children: [_jsx(FolderPlus, { size: 16 }), "Browse for folder"] }), _jsx("span", { style: {
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#10b981' + '20',
                                                color: '#10b981',
                                                fontWeight: 500,
                                            }, children: "Recommended" })] })] }), _jsxs("div", { onClick: onSelectRemote, onMouseEnter: () => setHoveredCard('remote'), onMouseLeave: () => setHoveredCard(null), style: {
                                backgroundColor: theme.colors.background,
                                borderRadius: '12px',
                                padding: '24px',
                                border: `2px solid ${hoveredCard === 'remote' ? theme.colors.primary : theme.colors.border}`,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                transform: hoveredCard === 'remote' ? 'translateY(-4px)' : 'translateY(0)',
                                boxShadow: hoveredCard === 'remote'
                                    ? '0 8px 24px rgba(0, 0, 0, 0.15)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.05)',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '16px',
                                    }, children: [_jsx("div", { style: {
                                                backgroundColor: theme.colors.primary + '20',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }, children: _jsx(Cloud, { size: 24, color: theme.colors.primary }) }), _jsx("h3", { style: {
                                                fontSize: '18px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0,
                                            }, children: "Add Remote Repository" })] }), _jsx("p", { style: {
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                        lineHeight: '1.6',
                                        marginBottom: '16px',
                                    }, children: "Add a GitHub repository by URL. You can explore its structure and metadata, then clone it locally when you're ready to work with the code." }), _jsxs("div", { style: {
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '16px',
                                    }, children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '8px' }, children: _jsx("strong", { children: "Use this when:" }) }), _jsxs("ul", { style: {
                                                margin: 0,
                                                paddingLeft: '20px',
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary,
                                                lineHeight: '1.5',
                                            }, children: [_jsx("li", { children: "Exploring new repositories" }), _jsx("li", { children: "Tracking repos you may clone later" }), _jsx("li", { children: "Managing team repositories" })] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingTop: '12px',
                                        borderTop: `1px solid ${theme.colors.border}`,
                                    }, children: [_jsxs("span", { style: {
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: hoveredCard === 'remote' ? theme.colors.primary : theme.colors.text,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                            }, children: [_jsx(Github, { size: 16 }), "Enter GitHub URL"] }), _jsx("span", { style: {
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: theme.colors.primary + '20',
                                                color: theme.colors.primary,
                                                fontWeight: 500,
                                            }, children: "Clone later" })] })] })] }), _jsxs("div", { style: {
                        marginTop: '24px',
                        padding: '16px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                    }, children: [_jsx(Globe, { size: 18, color: theme.colors.primary, style: { marginTop: '2px', flexShrink: 0 } }), _jsx("div", { children: _jsxs("p", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    lineHeight: '1.5',
                                    margin: 0,
                                }, children: [_jsx("strong", { children: "Pro tip:" }), " Start with local repositories for immediate analysis. Remote repositories are great for exploring open-source projects or tracking repositories you might work with in the future. You can always clone a remote repository to work with it locally."] }) })] })] }) }));
};
