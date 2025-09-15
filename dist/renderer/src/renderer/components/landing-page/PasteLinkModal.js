import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, Link, AlertCircle, Loader2, Github } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { RepositoryService } from '../../main-process-api/RepositoryService';
export const PasteLinkModal = ({ isOpen, onClose, onRepositoryAdded, }) => {
    const { theme } = useTheme();
    const [url, setUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setUrl('');
            setError(null);
        }
    }, [isOpen]);
    const parseGitHubUrl = (url) => {
        try {
            // Support various GitHub URL formats
            const patterns = [
                /github\.com\/([^\/]+)\/([^\/\?#]+)/, // https://github.com/owner/repo
                /^([^\/]+)\/([^\/\?#]+)$/, // owner/repo shorthand
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    let [, owner, name] = match;
                    // Remove .git extension if present
                    name = name.replace(/\.git$/, '');
                    return { owner, name };
                }
            }
        }
        catch (err) {
            console.error('Failed to parse GitHub URL:', err);
        }
        return null;
    };
    const handleSubmit = async () => {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            setError('Please enter a GitHub repository URL');
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const parsed = parseGitHubUrl(trimmedUrl);
            if (!parsed) {
                setError('Invalid GitHub URL. Please use format: https://github.com/owner/repo or owner/repo');
                setIsProcessing(false);
                return;
            }
            const { owner, name } = parsed;
            const remoteUrl = `https://github.com/${owner}/${name}`;
            // Add the repository
            await RepositoryService.addRepository({
                remoteUrl,
                owner,
                name,
            });
            // Success - close modal and refresh
            onRepositoryAdded();
            onClose();
        }
        catch (err) {
            console.error('Failed to add repository:', err);
            if (err.message?.includes('already exists')) {
                setError('This repository has already been added');
            }
            else {
                setError('Failed to add repository. Please check the URL and try again.');
            }
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !isProcessing) {
            handleSubmit();
        }
    };
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setUrl(text);
                // Auto-validate on paste
                const parsed = parseGitHubUrl(text);
                if (!parsed) {
                    setError('The pasted text doesn\'t appear to be a valid GitHub URL');
                }
                else {
                    setError(null);
                }
            }
        }
        catch (err) {
            console.error('Failed to read clipboard:', err);
        }
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
                maxWidth: '600px',
                width: '90%',
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
                                    }, children: "Add GitHub Repository" }), _jsx("p", { style: {
                                        fontSize: '14px',
                                        color: theme.colors.textSecondary,
                                        margin: 0,
                                    }, children: "Paste a GitHub repository URL to add it to your projects" })] }), _jsx("button", { onClick: onClose, style: {
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
                            }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { style: { marginBottom: '24px' }, children: [_jsx("label", { style: {
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Repository URL" }), _jsxs("div", { style: {
                                display: 'flex',
                                gap: '8px',
                            }, children: [_jsxs("div", { style: {
                                        flex: 1,
                                        position: 'relative',
                                    }, children: [_jsx(Link, { size: 18, style: {
                                                position: 'absolute',
                                                left: '12px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: theme.colors.textSecondary,
                                            } }), _jsx("input", { type: "text", placeholder: "https://github.com/owner/repo or owner/repo", value: url, onChange: (e) => {
                                                setUrl(e.target.value);
                                                setError(null);
                                            }, onKeyPress: handleKeyPress, autoFocus: true, style: {
                                                width: '100%',
                                                padding: '10px 12px 10px 40px',
                                                borderRadius: '8px',
                                                border: `1px solid ${error ? (theme.colors.error || '#ef4444') : theme.colors.border}`,
                                                backgroundColor: theme.colors.background,
                                                color: theme.colors.text,
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: 'border-color 0.2s',
                                            }, onFocus: (e) => {
                                                if (!error) {
                                                    e.target.style.borderColor = theme.colors.primary;
                                                }
                                            }, onBlur: (e) => {
                                                if (!error) {
                                                    e.target.style.borderColor = theme.colors.border;
                                                }
                                            } })] }), _jsx("button", { onClick: handlePaste, style: {
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.colors.border}`,
                                        backgroundColor: theme.colors.background,
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                    }, children: "Paste" })] }), _jsx("div", { style: {
                                marginTop: '8px',
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                            }, children: "Examples: https://github.com/facebook/react or facebook/react" })] }), error && (_jsxs("div", { style: {
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                        border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }, children: [_jsx(AlertCircle, { size: 18, color: theme.colors.error || '#ef4444' }), _jsx("span", { style: { color: theme.colors.text, fontSize: '14px' }, children: error })] })), _jsx("div", { style: {
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        border: `1px solid ${theme.colors.border}`,
                        marginBottom: '24px',
                    }, children: _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                        }, children: [_jsx(Github, { size: 20, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { children: [_jsx("h4", { style: {
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            margin: '0 0 4px 0',
                                        }, children: "Public repositories only" }), _jsx("p", { style: {
                                            fontSize: '13px',
                                            color: theme.colors.textSecondary,
                                            margin: 0,
                                            lineHeight: 1.5,
                                        }, children: "Currently, only public GitHub repositories can be added. Private repository support is coming soon." })] })] }) }), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                    }, children: [_jsx("button", { onClick: onClose, disabled: isProcessing, style: {
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.border}`,
                                backgroundColor: theme.colors.backgroundSecondary,
                                color: theme.colors.text,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.5 : 1,
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                }
                            }, onMouseLeave: (e) => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                }
                            }, children: "Cancel" }), _jsx("button", { onClick: handleSubmit, disabled: isProcessing || !url.trim(), style: {
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: isProcessing || !url.trim() ? 'not-allowed' : 'pointer',
                                opacity: isProcessing || !url.trim() ? 0.5 : 1,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }, onMouseEnter: (e) => {
                                if (!isProcessing && url.trim()) {
                                    e.currentTarget.style.opacity = '0.9';
                                }
                            }, onMouseLeave: (e) => {
                                if (!isProcessing && url.trim()) {
                                    e.currentTarget.style.opacity = '1';
                                }
                            }, children: isProcessing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 16, style: { animation: 'spin 1s linear infinite' } }), "Adding..."] })) : ('Add Repository') })] }), _jsx("style", { children: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        ` })] }) }));
};
