import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { Star, Library } from 'lucide-react';
export const AlexandriaRepositoryCard = ({ repository, onSelect }) => {
    const { theme } = useTheme();
    // Extract GitHub metadata from the nested github field
    const githubData = repository.github;
    const stars = githubData?.stars || 0;
    // For local repositories without GitHub data, try to extract owner from remoteUrl or name
    let owner = githubData?.owner;
    if (!owner) {
        // Try to extract owner from Git remote URL first
        if (repository.remoteUrl) {
            // Handle both SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git) formats
            const sshMatch = repository.remoteUrl.match(/git@github\.com:([^/]+)\/[^/]+\.git/);
            const httpsMatch = repository.remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/[^/]+/);
            if (sshMatch) {
                owner = sshMatch[1];
            }
            else if (httpsMatch) {
                owner = httpsMatch[1];
            }
        }
        // Fallback: try to extract owner from repository name if it follows owner/repo format
        if (!owner) {
            const nameMatch = repository.name.match(/^([^/]+)\/[^/]+$/);
            if (nameMatch) {
                owner = nameMatch[1];
            }
            else {
                // For local repositories without remote or single-name repos, use "Local"
                owner = 'Local';
            }
        }
    }
    const description = githubData?.description;
    // Calculate spine width logarithmically based on chapter count
    // Base width is 20px, scales up to ~40px for many chapters
    const chapters = repository.viewCount || 0;
    const spineWidth = Math.min(40, Math.max(20, 20 + Math.log(chapters + 1) * 5));
    // Use theme colors
    const bookColor = repository.bookColor || theme.colors.primary;
    const bgColor = theme.colors.backgroundSecondary;
    const borderColor = theme.colors.border;
    const textColor = theme.colors.text;
    const textSecondary = theme.colors.textSecondary;
    const mutedBg = theme.colors.muted;
    return (_jsx("div", { className: "group relative cursor-pointer", style: {
            height: '420px',
            width: '100%',
            maxWidth: '320px',
            margin: '0 auto'
        }, onClick: () => onSelect(repository), children: _jsxs("div", { className: "relative h-full w-full", style: {
                transform: 'perspective(1000px)',
                transition: 'all 0.3s ease'
            }, onMouseEnter: (e) => {
                e.currentTarget.style.transform = 'perspective(1000px) scale(1.05) translateY(-8px)';
            }, onMouseLeave: (e) => {
                e.currentTarget.style.transform = 'perspective(1000px)';
            }, children: [_jsxs("div", { style: {
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${spineWidth}px`,
                        backgroundColor: bookColor,
                        borderRadius: '2px 0 0 2px',
                        boxShadow: theme.shadows[3],
                        background: `linear-gradient(to right, rgba(0,0,0,0.3), transparent), ${bookColor}`
                    }, children: [_jsx("div", { style: {
                                position: 'absolute',
                                top: '16px',
                                bottom: '16px',
                                left: '4px',
                                width: '2px',
                                backgroundColor: 'rgba(0,0,0,0.2)'
                            } }), _jsx("div", { style: {
                                position: 'absolute',
                                top: '16px',
                                bottom: '16px',
                                right: '4px',
                                width: '2px',
                                backgroundColor: 'rgba(0,0,0,0.2)'
                            } }), stars > 100 && (_jsxs("div", { style: {
                                position: 'absolute',
                                bottom: '24px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }, children: [_jsx(Star, { size: 12, style: { color: '#FFC107', fill: '#FFC107' } }), _jsx("div", { style: {
                                        fontSize: '8px',
                                        color: '#FFC107',
                                        fontWeight: 'bold',
                                        marginTop: '2px'
                                    }, children: stars >= 1000 ? `${(stars / 1000).toFixed(0)}k` : stars })] }))] }), _jsxs("div", { style: {
                        position: 'relative',
                        height: '100%',
                        marginLeft: `${spineWidth}px`,
                        width: `calc(100% - ${spineWidth}px)`,
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderLeft: 'none',
                        borderRadius: '0 4px 4px 0',
                        boxShadow: theme.shadows[2],
                        transition: 'box-shadow 0.3s ease'
                    }, children: [_jsx("div", { style: {
                                position: 'absolute',
                                top: '-1px',
                                left: 0,
                                right: '8px',
                                height: '1px',
                                background: `linear-gradient(to right, ${borderColor}, transparent)`
                            } }), _jsx("div", { style: {
                                position: 'absolute',
                                right: 0,
                                top: '8px',
                                bottom: '8px',
                                width: '1px',
                                background: `linear-gradient(to left, ${borderColor}, transparent)`
                            } }), _jsx("div", { style: { padding: '32px 24px 16px' }, children: _jsxs("div", { style: { marginBottom: theme.space[3] }, children: [_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h3", { style: {
                                                    fontSize: theme.fontSizes[5],
                                                    fontWeight: theme.fontWeights.bold,
                                                    lineHeight: theme.lineHeights.tight,
                                                    color: textColor,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical'
                                                }, children: repository.name }), _jsxs("p", { style: {
                                                    fontSize: theme.fontSizes[2],
                                                    color: textSecondary,
                                                    marginTop: theme.space[2],
                                                    fontStyle: 'italic'
                                                }, children: ["by ", owner] })] }), description && (_jsx("p", { style: {
                                            fontSize: theme.fontSizes[2],
                                            color: textSecondary,
                                            lineHeight: theme.lineHeights.relaxed,
                                            marginTop: theme.space[4],
                                            textAlign: 'center',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 4,
                                            WebkitBoxOrient: 'vertical'
                                        }, children: description }))] }) }), _jsx("div", { style: { padding: '0 24px 24px' }, children: githubData?.topics && githubData.topics.length > 0 && (_jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                }, children: [githubData.topics.slice(0, 4).map(topic => (_jsx("span", { style: {
                                            padding: '4px 8px',
                                            backgroundColor: mutedBg,
                                            fontSize: '12px',
                                            borderRadius: '4px',
                                            color: textSecondary
                                        }, children: topic }, topic))), githubData.topics.length > 4 && (_jsxs("span", { style: {
                                            padding: '4px 8px',
                                            backgroundColor: theme.colors.backgroundTertiary,
                                            fontSize: '12px',
                                            borderRadius: '4px',
                                            color: textSecondary
                                        }, children: ["+", githubData.topics.length - 4] }))] })) }), githubData?.license && (_jsx("div", { style: {
                                position: 'absolute',
                                bottom: '16px',
                                left: '16px'
                            }, children: _jsx("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    backgroundColor: `${mutedBg}CC`,
                                    color: textSecondary,
                                    padding: '6px 12px',
                                    borderRadius: '999px',
                                    fontSize: '14px',
                                    fontWeight: theme.fontWeights.medium
                                }, children: githubData.license }) })), repository.hasViews && (_jsx("div", { style: {
                                position: 'absolute',
                                bottom: '16px',
                                right: '16px'
                            }, children: _jsxs("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    backgroundColor: `${mutedBg}CC`,
                                    color: textSecondary,
                                    padding: '6px 12px',
                                    borderRadius: '999px',
                                    fontSize: '14px',
                                    fontWeight: theme.fontWeights.medium
                                }, children: [_jsx(Library, { size: 14 }), repository.viewCount, " ", repository.viewCount === 1 ? 'Chapter' : 'Chapters'] }) }))] })] }) }));
};
