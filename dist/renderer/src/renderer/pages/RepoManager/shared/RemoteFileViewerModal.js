import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { X, ExternalLink } from 'lucide-react';
import { FileViewer } from '../../../components/FileViewer';
export const RemoteFileViewerModal = ({ filePath, relativePath, contentProvider, onClose, repository, }) => {
    const { theme } = useTheme();
    const [loadError, setLoadError] = useState(null);
    const [isRateLimited, setIsRateLimited] = useState(false);
    // Content loader function for FileViewer
    const contentLoader = useCallback(async () => {
        try {
            // Check if content provider can provide content
            if (!contentProvider.canProvideContent()) {
                setLoadError('Content viewing is not available for this repository type.');
                return null;
            }
            const fileContent = await contentProvider.readFileContent(filePath);
            if (fileContent === null) {
                // Check if we're rate limited
                const capabilities = contentProvider.getCapabilities();
                if (capabilities.rateLimit && capabilities.rateLimit.remaining === 0) {
                    setIsRateLimited(true);
                    setLoadError('GitHub API rate limit exceeded. Please authenticate with GitHub CLI (gh auth login) or wait before trying again.');
                }
                else {
                    setLoadError('Unable to load file content. The file may not exist or may be inaccessible.');
                }
                return null;
            }
            setLoadError(null);
            return fileContent;
        }
        catch (err) {
            console.error('Error loading file content:', err);
            // Check for rate limiting in error message
            if (err instanceof Error && err.message.includes('rate limit')) {
                setIsRateLimited(true);
                setLoadError('GitHub API rate limit exceeded. Please authenticate with GitHub CLI (gh auth login) or wait before trying again.');
            }
            else {
                setLoadError(err instanceof Error ? err.message : 'Failed to load file content');
            }
            return null;
        }
    }, [filePath, contentProvider]);
    // Handle open in GitHub
    const handleOpenInGitHub = useCallback(() => {
        if (repository) {
            const url = `https://github.com/${repository.owner}/${repository.repo}/blob/${repository.branch || 'main'}/${relativePath}`;
            window.open(url, '_blank');
        }
    }, [repository, relativePath]);
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
                width: '90%',
                maxWidth: '1200px',
                height: '85%',
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative',
            }, children: [_jsx("button", { onClick: onClose, style: {
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        cursor: 'pointer',
                        color: theme.colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 10,
                    }, title: "Close (Esc)", children: _jsx(X, { size: 20 }) }), repository && (_jsxs("button", { onClick: handleOpenInGitHub, style: {
                        position: 'absolute',
                        top: '16px',
                        right: '60px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        cursor: 'pointer',
                        color: theme.colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        zIndex: 10,
                    }, title: "Open in GitHub", children: [_jsx(ExternalLink, { size: 14 }), "GitHub"] })), loadError && (_jsxs("div", { style: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: theme.colors.background,
                        padding: '32px',
                        borderRadius: '12px',
                        border: `1px solid ${theme.colors.border}`,
                        zIndex: 20,
                        maxWidth: '500px',
                        textAlign: 'center',
                    }, children: [_jsx("h3", { style: { color: theme.colors.text, marginBottom: '16px' }, children: isRateLimited ? 'Rate Limited' : 'Error Loading File' }), _jsx("p", { style: { color: theme.colors.textSecondary, marginBottom: '24px' }, children: loadError }), isRateLimited && (_jsxs("div", { style: {
                                textAlign: 'left',
                                backgroundColor: theme.colors.backgroundSecondary,
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                            }, children: [_jsx("h4", { style: { marginBottom: '8px', color: theme.colors.text }, children: "How to fix:" }), _jsxs("ol", { style: {
                                        marginLeft: '20px',
                                        color: theme.colors.textSecondary,
                                        fontSize: '14px',
                                        lineHeight: '1.6'
                                    }, children: [_jsxs("li", { children: ["Install GitHub CLI: ", _jsx("code", { children: "brew install gh" })] }), _jsxs("li", { children: ["Authenticate: ", _jsx("code", { children: "gh auth login" })] }), _jsx("li", { children: "Reload this view" })] })] })), _jsx("button", { onClick: handleOpenInGitHub, style: {
                                padding: '8px 16px',
                                borderRadius: '6px',
                                backgroundColor: theme.colors.primary,
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                            }, children: "Open on GitHub Instead" })] })), _jsx("div", { style: {
                        flex: 1,
                        overflow: 'hidden',
                        borderRadius: '12px',
                    }, children: _jsx(FileViewer, { filePath: relativePath, displayPath: relativePath, className: "full-height", contentLoader: contentLoader, editable: false, enableVimMode: false }) })] }) }));
};
