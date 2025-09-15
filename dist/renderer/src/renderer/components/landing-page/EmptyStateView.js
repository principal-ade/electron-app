import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Github, Settings2, ArrowRight, Bot, FolderOpen, Globe } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const EmptyStateView = ({ onPasteGitHubUrl, onConfigureHooks, hasConfiguredAgents, onOpenLocalFolder }) => {
    const { theme } = useTheme();
    const [gitUrl, setGitUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const handleSubmitUrl = async () => {
        if (!gitUrl.trim())
            return;
        setIsLoading(true);
        setError(null);
        try {
            await onPasteGitHubUrl(gitUrl.trim());
            setGitUrl('');
            setShowUrlInput(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add repository');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsxs("div", { style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            minHeight: '400px',
        }, children: [_jsxs("div", { style: {
                    maxWidth: '800px',
                    width: '100%',
                    textAlign: 'center',
                }, children: [_jsx("div", { style: {
                            marginBottom: '48px',
                        }, children: _jsx("div", { style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '16px 32px',
                                borderRadius: '100px',
                                backgroundColor: `${theme.colors.primary}15`,
                                marginBottom: '24px',
                            }, children: _jsx("span", { style: {
                                    fontSize: '24px',
                                    fontWeight: 600,
                                    color: theme.colors.primary,
                                }, children: "First Steps" }) }) }), _jsxs("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '24px',
                            marginBottom: '32px',
                        }, children: [_jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '16px',
                                    padding: '32px',
                                    border: `2px solid ${theme.colors.border}`,
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }, onClick: onConfigureHooks, onMouseEnter: (e) => {
                                    e.currentTarget.style.borderColor = theme.colors.accent;
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.accent}20`;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }, children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '4px',
                                            background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.primary})`,
                                        } }), _jsxs("div", { style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '20px',
                                        }, children: [_jsx("div", { style: {
                                                    width: '64px',
                                                    height: '64px',
                                                    borderRadius: '16px',
                                                    backgroundColor: `${theme.colors.accent}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }, children: _jsx(Settings2, { size: 32, color: theme.colors.accent }) }), _jsxs("div", { children: [_jsx("h3", { style: {
                                                            fontSize: '20px',
                                                            fontWeight: 600,
                                                            color: theme.colors.text,
                                                            marginBottom: '8px',
                                                            margin: '0 0 8px 0',
                                                        }, children: "Configure Assistants" }), _jsx("p", { style: {
                                                            fontSize: '14px',
                                                            color: theme.colors.textSecondary,
                                                            margin: '0 0 12px 0',
                                                            lineHeight: 1.5,
                                                        }, children: "Setup your AI assistants with context handoff and event monitoring" }), _jsxs("div", { style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '4px 12px',
                                                            borderRadius: '20px',
                                                            backgroundColor: hasConfiguredAgents ? '#10b98120' : theme.colors.backgroundTertiary,
                                                            color: hasConfiguredAgents ? '#10b981' : theme.colors.textSecondary,
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                        }, children: [_jsx(Bot, { size: 14 }), hasConfiguredAgents ? 'Agents Configured' : 'No Agents Configured'] })] }), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    color: theme.colors.accent,
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                }, children: [_jsx("span", { children: "Configure Now" }), _jsx(ArrowRight, { size: 16 })] })] })] }), _jsxs("div", { style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '16px',
                                    padding: '32px',
                                    border: `2px solid ${theme.colors.border}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }, children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '4px',
                                            background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent})`,
                                        } }), _jsxs("div", { style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '20px',
                                        }, children: [_jsx("div", { style: {
                                                    width: '64px',
                                                    height: '64px',
                                                    borderRadius: '16px',
                                                    backgroundColor: `${theme.colors.primary}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }, children: _jsx(Github, { size: 32, color: theme.colors.primary }) }), _jsxs("div", { children: [_jsx("h3", { style: {
                                                            fontSize: '20px',
                                                            fontWeight: 600,
                                                            color: theme.colors.text,
                                                            marginBottom: '8px',
                                                            margin: '0 0 8px 0',
                                                        }, children: "Add Projects" }), _jsx("p", { style: {
                                                            fontSize: '14px',
                                                            color: theme.colors.textSecondary,
                                                            margin: 0,
                                                            lineHeight: 1.5,
                                                        }, children: "Add a local repository or paste a GitHub URL" })] }), showUrlInput ? (_jsxs("div", { style: {
                                                    width: '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '12px',
                                                }, children: [_jsx("input", { type: "text", value: gitUrl, onChange: (e) => setGitUrl(e.target.value), onKeyDown: (e) => {
                                                            if (e.key === 'Enter')
                                                                handleSubmitUrl();
                                                            if (e.key === 'Escape') {
                                                                setShowUrlInput(false);
                                                                setGitUrl('');
                                                                setError(null);
                                                            }
                                                        }, placeholder: "https://github.com/owner/repository", autoFocus: true, style: {
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            fontSize: '14px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${error ? theme.colors.error : theme.colors.border}`,
                                                            backgroundColor: theme.colors.background,
                                                            color: theme.colors.text,
                                                            outline: 'none',
                                                            transition: 'border-color 0.2s',
                                                        }, onFocus: (e) => {
                                                            if (!error)
                                                                e.currentTarget.style.borderColor = theme.colors.primary;
                                                        }, onBlur: (e) => {
                                                            if (!error)
                                                                e.currentTarget.style.borderColor = theme.colors.border;
                                                        } }), error && (_jsx("p", { style: {
                                                            fontSize: '12px',
                                                            color: theme.colors.error,
                                                            margin: 0,
                                                            textAlign: 'left',
                                                        }, children: error })), _jsxs("div", { style: {
                                                            display: 'flex',
                                                            gap: '8px',
                                                        }, children: [_jsx("button", { onClick: () => {
                                                                    setShowUrlInput(false);
                                                                    setGitUrl('');
                                                                    setError(null);
                                                                }, style: {
                                                                    flex: 1,
                                                                    padding: '10px 16px',
                                                                    borderRadius: '8px',
                                                                    backgroundColor: theme.colors.backgroundTertiary,
                                                                    color: theme.colors.text,
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    fontSize: '14px',
                                                                    fontWeight: 500,
                                                                    transition: 'all 0.2s',
                                                                }, onMouseEnter: (e) => {
                                                                    e.currentTarget.style.backgroundColor = theme.colors.border;
                                                                }, onMouseLeave: (e) => {
                                                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                                }, children: "Cancel" }), _jsx("button", { onClick: handleSubmitUrl, disabled: !gitUrl.trim() || isLoading, style: {
                                                                    flex: 1,
                                                                    padding: '10px 16px',
                                                                    borderRadius: '8px',
                                                                    backgroundColor: gitUrl.trim() && !isLoading ? theme.colors.primary : theme.colors.backgroundTertiary,
                                                                    color: gitUrl.trim() && !isLoading ? 'white' : theme.colors.textSecondary,
                                                                    border: 'none',
                                                                    cursor: gitUrl.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                                                    fontSize: '14px',
                                                                    fontWeight: 500,
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '8px',
                                                                }, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                                                width: '14px',
                                                                                height: '14px',
                                                                                border: '2px solid transparent',
                                                                                borderTopColor: 'currentColor',
                                                                                borderRadius: '50%',
                                                                                animation: 'spin 0.8s linear infinite',
                                                                            } }), "Adding..."] })) : ('Add Repository') })] })] })) : (_jsxs("div", { style: {
                                                    width: '100%',
                                                    display: 'flex',
                                                    gap: '12px',
                                                }, children: [_jsxs("button", { onClick: onOpenLocalFolder, style: {
                                                            flex: 1,
                                                            padding: '12px 20px',
                                                            borderRadius: '8px',
                                                            backgroundColor: theme.colors.background,
                                                            border: `2px solid ${theme.colors.border}`,
                                                            color: theme.colors.text,
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                        }, onMouseEnter: (e) => {
                                                            e.currentTarget.style.borderColor = theme.colors.primary;
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                            e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}20`;
                                                        }, onMouseLeave: (e) => {
                                                            e.currentTarget.style.borderColor = theme.colors.border;
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        }, children: [_jsx(FolderOpen, { size: 18 }), _jsx("span", { children: "Open Folder" })] }), _jsxs("button", { onClick: () => setShowUrlInput(true), style: {
                                                            flex: 1,
                                                            padding: '12px 20px',
                                                            borderRadius: '8px',
                                                            backgroundColor: theme.colors.primary,
                                                            border: 'none',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                        }, onMouseEnter: (e) => {
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                            e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}40`;
                                                            e.currentTarget.style.opacity = '0.9';
                                                        }, onMouseLeave: (e) => {
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                            e.currentTarget.style.opacity = '1';
                                                        }, children: [_jsx(Globe, { size: 18 }), _jsx("span", { children: "Enter URL" })] })] }))] })] })] })] }), _jsx("style", { children: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      ` })] }));
};
