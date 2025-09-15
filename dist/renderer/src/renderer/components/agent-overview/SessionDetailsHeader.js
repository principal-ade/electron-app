import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { Folder, GitBranch } from 'lucide-react';
export const SessionDetailsHeader = ({ sessionId, workingDirectory, basicGitInfo, repositories, onDeleteSession, }) => {
    const { theme } = useTheme();
    // Analysis modal removed - deprecated feature
    // Get the repository info for display (prefer basicGitInfo, fall back to repositories)
    const hasGitInfo = basicGitInfo || (repositories && repositories.length > 0);
    // Determine repo name with multiple fallbacks
    let repoName = 'No Git Repository';
    let relativePath = '';
    if (basicGitInfo) {
        // Use new basicGitInfo (preferred)
        repoName =
            basicGitInfo.githubRepo ||
                basicGitInfo.gitRoot.split('/').pop() ||
                workingDirectory.split('/').pop() ||
                'Unknown';
        relativePath =
            basicGitInfo.relativePath !== '.' ? basicGitInfo.relativePath : '';
    }
    else if (repositories && repositories.length > 0) {
        // Fall back to old repositories array
        const primaryRepo = repositories[0];
        repoName =
            primaryRepo?.remotes?.[0]?.repo ||
                primaryRepo?.rootDisplay?.split('/').pop() ||
                primaryRepo?.root?.split('/').pop() ||
                workingDirectory.split('/').pop() ||
                'Unknown';
    }
    else {
        // No git info at all - use directory name
        repoName = workingDirectory.split('/').pop() || 'Unknown Directory';
    }
    return (_jsx(_Fragment, { children: _jsx("div", { style: {
                flexShrink: 0,
                padding: '12px 24px',
                borderBottom: `1px solid ${theme.colors.border}`,
                backgroundColor: `${theme.colors.backgroundSecondary}80`,
            }, children: _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: _jsxs("div", { children: [_jsxs("h2", { style: {
                                        margin: 0,
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: hasGitInfo ? _jsx(GitBranch, { size: 18 }) : _jsx(Folder, { size: 18 }) }), repoName, relativePath && (_jsxs("span", { style: {
                                                fontSize: '14px',
                                                color: theme.colors.textSecondary,
                                                fontWeight: 400,
                                            }, children: ["/ ", relativePath] }))] }), !hasGitInfo || !repositories || repositories.length === 0 ? (_jsx("div", { style: {
                                        marginTop: '4px',
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        fontFamily: 'monospace',
                                    }, children: workingDirectory })) : repositories &&
                                    repositories.length > 0 &&
                                    repositories.flatMap((repo) => repo.packages).length > 0 ? (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginTop: '4px',
                                    }, children: [repositories
                                            .flatMap((repo) => repo.packages)
                                            .slice(0, 4)
                                            .map((pkg, idx) => (_jsx("span", { style: {
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: theme.colors.backgroundHover,
                                                color: theme.colors.textSecondary,
                                            }, title: `${pkg.name} v${pkg.version || '?'} (${pkg.type})`, children: pkg.name }, idx))), repositories.reduce((sum, repo) => sum + repo.packages.length, 0) > 4 && (_jsxs("span", { style: {
                                                fontSize: '12px',
                                                color: theme.colors.textTertiary,
                                            }, children: ["+", repositories.reduce((sum, repo) => sum + repo.packages.length, 0) - 4, ' ', "more"] }))] })) : (
                                // Repositories exist but no packages - show working directory
                                _jsx("div", { style: {
                                        marginTop: '4px',
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        fontFamily: 'monospace',
                                    }, children: workingDirectory }))] }) }), _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: onDeleteSession && (_jsxs("button", { onClick: onDeleteSession, style: {
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'transparent',
                                color: theme.colors.error,
                                border: `1px solid ${theme.colors.error}`,
                                cursor: 'pointer',
                                fontSize: '12px',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.error;
                                e.currentTarget.style.color = theme.colors.background;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = theme.colors.error;
                            }, title: "Delete this session", children: [_jsx("svg", { style: { width: '14px', height: '14px' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }), "Delete"] })) })] }) }) }));
};
