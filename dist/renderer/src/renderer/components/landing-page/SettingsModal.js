import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useMemo, useState } from 'react';
import { X, RefreshCw, Info, Settings as SettingsIcon, Database, Globe, Code, Sparkles, Terminal, CheckCircle, AlertCircle, Container, Bot, Palette } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { EDITOR_LABELS } from '../../../shared/types/editor.types';
import { AppVersionManagerService } from '../../main-process-api/AppVersionManagerService';
import { DockerService } from '../../main-process-api/DockerService';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import { SystemService } from '../../main-process-api/SystemService';
import { AgentConfigurationView } from '../../pages/LandingPage/AgentConfigurationView';
import { TerminalConfigurationView } from '../../components/configuration/TerminalConfigurationView';
import { IDEConfigurationView } from '../../components/configuration/IDEConfigurationView';
import { predefinedThemes, getThemeNames } from '../../themes/predefinedThemes';
import { ThemeService } from '../../services/ThemeService';
import { WindowService } from '../../main-process-api/WindowService';
export const SettingsModal = ({ isOpen, onClose, }) => {
    const { theme } = useTheme();
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [currentVersion, setCurrentVersion] = useState('0.0.0');
    const [isDevMode, setIsDevMode] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [availableVersion, setAvailableVersion] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadError, setDownloadError] = useState(null);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [defaultEditor, setDefaultEditor] = useState("vscode");
    const [selectedTheme, setSelectedTheme] = useState("default");
    const [pendingTheme, setPendingTheme] = useState(null);
    const [isApplyingTheme, setIsApplyingTheme] = useState(false);
    const [useCustomMarkdownTheme, setUseCustomMarkdownTheme] = useState(false);
    const [markdownThemeChoice, setMarkdownThemeChoice] = useState('app');
    const [customThemeJson, setCustomThemeJson] = useState('');
    const [customThemeError, setCustomThemeError] = useState(null);
    const [showCustomThemeEditor, setShowCustomThemeEditor] = useState(false);
    const [activeCategory, setActiveCategory] = useState('general');
    const [agentStatus, setAgentStatus] = useState(null);
    const [activeAgentView, setActiveAgentView] = useState(null);
    const [activeToolsView, setActiveToolsView] = useState(null);
    const [agentViewLayout, setAgentViewLayout] = useState('simple');
    const [cliToolStatuses, setCliToolStatuses] = useState({});
    const [checkingCliTools, setCheckingCliTools] = useState(false);
    const [dockerStatus, setDockerStatus] = useState(null);
    const [checkingDocker, setCheckingDocker] = useState(false);
    const editorOptions = useMemo(() => Object.entries(EDITOR_LABELS), []);
    // Function to check CLI tool availability
    const checkCliTools = async () => {
        setCheckingCliTools(true);
        const statuses = {};
        try {
            // Check gh CLI
            const ghCheck = await window.mainProcess?.github?.checkAuthStatus();
            statuses['gh'] = ghCheck?.isAuthenticated || false;
            // Check git
            try {
                const gitVersion = await SystemService.executeCommand({
                    command: 'git',
                    args: ['--version']
                });
                statuses['git'] = gitVersion.success;
            }
            catch {
                statuses['git'] = false;
            }
        }
        catch (error) {
            console.error('Error checking CLI tools:', error);
        }
        setCliToolStatuses(statuses);
        setCheckingCliTools(false);
    };
    // Function to check Docker status
    const checkDockerStatus = async () => {
        setCheckingDocker(true);
        try {
            const status = await DockerService.checkStatus();
            if (status) {
                // Also check for Knip image
                const hasKnipImage = await DockerService.hasKnipImage();
                setDockerStatus({
                    installed: status.installed,
                    running: status.running,
                    version: status.version,
                    hasKnipImage: hasKnipImage
                });
            }
            else {
                setDockerStatus({
                    installed: false,
                    running: false
                });
            }
        }
        catch (error) {
            console.error('Error checking Docker status:', error);
            setDockerStatus({
                installed: false,
                running: false
            });
        }
        setCheckingDocker(false);
    };
    // Check agent status
    const checkAgentStatus = React.useCallback(async () => {
        try {
            const status = await AgentConfigurationService.checkAgentInstallations();
            setAgentStatus(status);
        }
        catch (error) {
            console.error('Failed to check agent status:', error);
        }
    }, []);
    // Reset sub-views when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            setActiveAgentView(null);
            setActiveToolsView(null);
            setAgentViewLayout('simple');
        }
    }, [isOpen]);
    // Fetch version and dev mode when component mounts or modal opens
    React.useEffect(() => {
        if (isOpen) {
            AppVersionManagerService.getVersion().then(setCurrentVersion);
            AppVersionManagerService.isDevMode().then(setIsDevMode);
            // Load stored default editor and theme preferences
            UserPreferencesService.getPreferences()
                .then((prefs) => {
                const editor = (prefs.defaultEditor ?? 'vscode');
                setDefaultEditor(editor);
                // Load markdown theme preferences
                setUseCustomMarkdownTheme(prefs.useCustomMarkdownTheme ?? false);
                if (prefs.useCustomMarkdownTheme && prefs.customMarkdownTheme) {
                    // Check if it's the GitHub theme by comparing key properties
                    const isGitHubTheme = prefs.customMarkdownTheme.colors?.text === '#24292e' &&
                        prefs.customMarkdownTheme.colors?.background === '#ffffff' &&
                        prefs.customMarkdownTheme.colors?.primary === '#0366d6';
                    if (isGitHubTheme) {
                        setMarkdownThemeChoice('github');
                    }
                    else {
                        setMarkdownThemeChoice('custom');
                        // Load the custom theme JSON for display
                        setCustomThemeJson(JSON.stringify(prefs.customMarkdownTheme, null, 2));
                    }
                }
                else {
                    setMarkdownThemeChoice('app');
                }
            })
                .catch(() => {
                setDefaultEditor('vscode');
                setUseCustomMarkdownTheme(false);
                setMarkdownThemeChoice('app');
            });
            // Get current theme from ThemeService
            const currentTheme = ThemeService.getCurrentThemeName();
            setSelectedTheme(currentTheme);
            setPendingTheme(null);
            // Check agent status
            checkAgentStatus();
            // Check CLI tools and Docker when developer tab is active
            if (activeCategory === 'developer') {
                checkCliTools();
                checkDockerStatus();
            }
        }
    }, [isOpen, activeCategory, checkAgentStatus]);
    // Set up persistent update listeners when modal opens
    React.useEffect(() => {
        if (!isOpen)
            return;
        const handleUpdateAvailable = (info) => {
            console.log('[SettingsModal] Update available:', info);
            setUpdateInfo(info); // Store the full update info for debugging
            setUpdateAvailable(true);
            setAvailableVersion(info.version);
            setUpdateStatus(`Update available: v${info.version}`);
            setLastCheck(new Date());
            setIsChecking(false);
            setIsDownloaded(false);
            setDownloadProgress(0);
            setDownloadError(null);
        };
        const handleUpdateNotAvailable = (info) => {
            console.log('[SettingsModal] No update available:', info);
            setUpdateAvailable(false);
            setAvailableVersion(null);
            setUpdateStatus('You have the latest version');
            setLastCheck(new Date());
            setIsChecking(false);
        };
        const handleUpdateError = (err) => {
            console.error('[SettingsModal] Update error:', err);
            let errorMessage = err.message || err.toString();
            // Parse common error types for better user feedback
            if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
                errorMessage = 'Update file not found. The update server may be temporarily unavailable.';
            }
            else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')) {
                errorMessage = 'Cannot connect to update server. Please check your internet connection.';
            }
            else if (errorMessage.includes('ETIMEDOUT')) {
                errorMessage = 'Update server timeout. Please try again later.';
            }
            else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                errorMessage = 'Access denied. The update may not be available for your platform.';
            }
            else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                errorMessage = 'Update not found. There may be no update available for your version.';
            }
            else if (errorMessage.includes('CERT') || errorMessage.includes('certificate')) {
                errorMessage = 'Certificate error. Please check your system date/time or proxy settings.';
            }
            else if (errorMessage.includes('sha512') || errorMessage.includes('checksum')) {
                errorMessage = 'Update verification failed. The update file may be corrupted or the server configuration may be incorrect. Please try again later.';
            }
            // Check if this is a download error
            if (isDownloading) {
                setDownloadError(errorMessage);
                setIsDownloading(false);
                setUpdateStatus('Download failed');
            }
            else {
                setUpdateAvailable(false);
                setAvailableVersion(null);
                setUpdateStatus(`Error: ${errorMessage}`);
            }
            setIsChecking(false);
        };
        const handleUpdateDownloadProgress = (progress) => {
            console.log('[SettingsModal] Download progress:', progress);
            setDownloadProgress(progress.percent || 0);
        };
        const handleUpdateDownloaded = (info) => {
            console.log('[SettingsModal] Update downloaded:', info);
            setIsDownloaded(true);
            setIsDownloading(false);
            setDownloadProgress(100);
            setUpdateStatus('Update downloaded successfully');
        };
        const removeUpdateAvailable = AppVersionManagerService.onUpdateAvailable(handleUpdateAvailable);
        const removeUpdateNotAvailable = AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable);
        const removeUpdateError = AppVersionManagerService.onUpdateError(handleUpdateError);
        const removeUpdateDownloadProgress = AppVersionManagerService.onUpdateDownloadProgress(handleUpdateDownloadProgress);
        const removeUpdateDownloaded = AppVersionManagerService.onUpdateDownloaded(handleUpdateDownloaded);
        const handleUpdateCheckComplete = () => {
            setIsChecking(false);
        };
        const removeUpdateCheckComplete = AppVersionManagerService.onUpdateCheckComplete(handleUpdateCheckComplete);
        return () => {
            removeUpdateAvailable();
            removeUpdateNotAvailable();
            removeUpdateError();
            removeUpdateCheckComplete();
            removeUpdateDownloadProgress();
            removeUpdateDownloaded();
        };
    }, [isOpen, isDownloading]);
    // Check for updates when modal opens
    React.useEffect(() => {
        if (isOpen) {
            console.log('[SettingsModal] Starting silent update check...');
            setIsChecking(true);
            AppVersionManagerService.checkForUpdateSilently();
        }
    }, [isOpen]);
    const checkForUpdates = () => {
        console.log('[SettingsModal] Manual update check initiated');
        setIsChecking(true);
        setUpdateStatus(null);
        setDownloadError(null);
        AppVersionManagerService.checkForUpdate();
    };
    const downloadUpdate = () => {
        console.log('[SettingsModal] Downloading update...');
        setIsDownloading(true);
        setDownloadError(null);
        setDownloadProgress(0);
        setUpdateStatus('Downloading update...');
        AppVersionManagerService.downloadUpdate();
    };
    const installUpdate = () => {
        console.log('[SettingsModal] Installing update...');
        setUpdateStatus('Installing update...');
        AppVersionManagerService.installUpdate();
    };
    // Move the early return check into the render, but keep hooks always running
    // This ensures our event listeners stay active even when modal is hidden
    return !isOpen ? null : (_jsxs(_Fragment, { children: [_jsx("style", { children: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        ` }), _jsx("div", { style: {
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                }, onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderRadius: '16px',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        width: '90%',
                        maxWidth: '1200px',
                        height: '80vh',
                        margin: '0 16px',
                        border: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px 24px',
                                borderBottom: `1px solid ${theme.colors.border}`,
                                flexShrink: 0,
                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(SettingsIcon, { size: 20, color: theme.colors.text }), _jsx("h2", { style: { fontSize: '20px', fontWeight: 600, margin: 0 }, children: "Settings" })] }), _jsx("button", { onClick: onClose, style: {
                                        padding: '4px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor =
                                            theme.colors.backgroundTertiary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }, children: _jsx(X, { size: 20, color: theme.colors.text }) })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsx("div", { style: {
                                        width: '240px',
                                        borderRight: `1px solid ${theme.colors.border}`,
                                        padding: '20px',
                                        flexShrink: 0,
                                        backgroundColor: theme.colors.backgroundSecondary,
                                    }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '4px' }, children: [_jsxs("button", { onClick: () => {
                                                    setActiveCategory('general');
                                                    setActiveAgentView(null);
                                                    setActiveToolsView(null);
                                                }, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: activeCategory === 'general' ? theme.colors.primary + '20' : 'transparent',
                                                    color: activeCategory === 'general' ? theme.colors.primary : theme.colors.text,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px',
                                                    fontWeight: activeCategory === 'general' ? 600 : 500,
                                                    textAlign: 'left',
                                                    width: '100%',
                                                }, onMouseEnter: (e) => {
                                                    if (activeCategory !== 'general') {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (activeCategory !== 'general') {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx(Globe, { size: 18 }), "General"] }), _jsxs("button", { onClick: () => {
                                                    setActiveCategory('ai-assistants');
                                                    setActiveAgentView(null);
                                                    setActiveToolsView(null);
                                                }, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: activeCategory === 'ai-assistants' ? theme.colors.primary + '20' : 'transparent',
                                                    color: activeCategory === 'ai-assistants' ? theme.colors.primary : theme.colors.text,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px',
                                                    fontWeight: activeCategory === 'ai-assistants' ? 600 : 500,
                                                    textAlign: 'left',
                                                    width: '100%',
                                                }, onMouseEnter: (e) => {
                                                    if (activeCategory !== 'ai-assistants') {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (activeCategory !== 'ai-assistants') {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx(Bot, { size: 18 }), "AI Assistants"] }), _jsxs("button", { onClick: () => {
                                                    setActiveCategory('updates');
                                                    setActiveAgentView(null);
                                                    setActiveToolsView(null);
                                                }, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: activeCategory === 'updates' ? theme.colors.primary + '20' : 'transparent',
                                                    color: activeCategory === 'updates' ? theme.colors.primary : theme.colors.text,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px',
                                                    fontWeight: activeCategory === 'updates' ? 600 : 500,
                                                    textAlign: 'left',
                                                    width: '100%',
                                                    position: 'relative',
                                                }, onMouseEnter: (e) => {
                                                    if (activeCategory !== 'updates') {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (activeCategory !== 'updates') {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx(RefreshCw, { size: 18 }), "Updates", updateAvailable && (_jsx("div", { style: {
                                                            position: 'absolute',
                                                            top: '12px',
                                                            right: '12px',
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: theme.colors.warning,
                                                            boxShadow: `0 0 8px ${theme.colors.warning}80`,
                                                        } }))] }), _jsxs("button", { onClick: () => {
                                                    setActiveCategory('developer-tools');
                                                    setActiveAgentView(null);
                                                    setActiveToolsView(null);
                                                }, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: activeCategory === 'developer-tools' ? theme.colors.primary + '20' : 'transparent',
                                                    color: activeCategory === 'developer-tools' ? theme.colors.primary : theme.colors.text,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px',
                                                    fontWeight: activeCategory === 'developer-tools' ? 600 : 500,
                                                    textAlign: 'left',
                                                    width: '100%',
                                                }, onMouseEnter: (e) => {
                                                    if (activeCategory !== 'developer-tools') {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (activeCategory !== 'developer-tools') {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx(Terminal, { size: 18 }), "Developer Tools"] }), _jsxs("button", { onClick: () => {
                                                    setActiveCategory('developer');
                                                    setActiveAgentView(null);
                                                    setActiveToolsView(null);
                                                }, style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: activeCategory === 'developer' ? theme.colors.primary + '20' : 'transparent',
                                                    color: activeCategory === 'developer' ? theme.colors.primary : theme.colors.text,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px',
                                                    fontWeight: activeCategory === 'developer' ? 600 : 500,
                                                    textAlign: 'left',
                                                    width: '100%',
                                                }, onMouseEnter: (e) => {
                                                    if (activeCategory !== 'developer') {
                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (activeCategory !== 'developer') {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                }, children: [_jsx(Code, { size: 18 }), "Developer"] })] }) }), _jsxs("div", { style: {
                                        flex: 1,
                                        padding: '32px',
                                        overflowY: 'auto',
                                    }, children: [activeCategory === 'general' && (_jsxs("div", { style: { maxWidth: '800px' }, children: [_jsxs("h3", { style: {
                                                        fontSize: '24px',
                                                        fontWeight: 600,
                                                        marginBottom: '32px',
                                                        color: theme.colors.text,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                    }, children: [_jsx(Globe, { size: 24 }), "General Settings"] }), _jsxs("div", { style: { marginBottom: '32px' }, children: [_jsx("h4", { style: {
                                                                fontSize: '16px',
                                                                fontWeight: 600,
                                                                marginBottom: '16px',
                                                                color: theme.colors.text,
                                                            }, children: "About Specktor" }), _jsxs("div", { style: {
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                borderRadius: '12px',
                                                                padding: '20px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }, children: [_jsx("div", { style: {
                                                                                width: '48px',
                                                                                height: '48px',
                                                                                borderRadius: '12px',
                                                                                background: `linear-gradient(135deg, ${theme.colors.primary}, #10b981)`,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                            }, children: _jsx(Sparkles, { size: 24, color: "white" }) }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }, children: "Specktor" }), _jsxs("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }, children: ["Version ", currentVersion, " ", isDevMode && _jsx("span", { style: { color: theme.colors.warning }, children: "(Dev Mode)" })] })] })] }), _jsx("p", { style: {
                                                                        fontSize: '14px',
                                                                        lineHeight: 1.6,
                                                                        margin: '0 0 12px 0',
                                                                        color: theme.colors.textSecondary,
                                                                    }, children: "A powerful tool for creating and presenting markdown slides, with integrated AI assistance and code analysis capabilities." }), _jsx("a", { href: "https://principle-md.com", target: "_blank", rel: "noopener noreferrer", style: {
                                                                        fontSize: '14px',
                                                                        color: theme.colors.primary,
                                                                        textDecoration: 'none',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                    }, onMouseEnter: (e) => {
                                                                        e.currentTarget.style.textDecoration = 'underline';
                                                                    }, onMouseLeave: (e) => {
                                                                        e.currentTarget.style.textDecoration = 'none';
                                                                    }, children: "Visit our website \u2192" })] })] }), _jsxs("div", { style: { marginBottom: '32px' }, children: [_jsx("h4", { style: {
                                                                fontSize: '16px',
                                                                fontWeight: 600,
                                                                marginBottom: '16px',
                                                                color: theme.colors.text,
                                                            }, children: "Default Code Editor" }), _jsxs("div", { style: {
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                borderRadius: '12px',
                                                                padding: '20px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                            }, children: [_jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '12px' }, children: "Choose your preferred editor for opening local repositories" }), _jsx("select", { id: "default-editor", value: defaultEditor, onChange: async (e) => {
                                                                        const value = e.target.value;
                                                                        setDefaultEditor(value);
                                                                        await UserPreferencesService.updatePreferences({ defaultEditor: value });
                                                                    }, style: {
                                                                        padding: '10px 14px',
                                                                        borderRadius: '8px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                        backgroundColor: theme.colors.background,
                                                                        color: theme.colors.text,
                                                                        cursor: 'pointer',
                                                                        fontSize: '14px',
                                                                        minWidth: '200px',
                                                                    }, children: editorOptions.map(([id, label]) => (_jsx("option", { value: id, children: label }, id))) })] })] }), _jsxs("div", { style: { marginBottom: '32px' }, children: [_jsx("h4", { style: {
                                                                fontSize: '16px',
                                                                fontWeight: 600,
                                                                marginBottom: '16px',
                                                                color: theme.colors.text,
                                                            }, children: "Interface Theme" }), _jsxs("div", { style: {
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                borderRadius: '12px',
                                                                padding: '20px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                            }, children: [_jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '12px' }, children: "Choose your preferred color theme for the application" }), _jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'center' }, children: [_jsx("select", { id: "selected-theme", value: pendingTheme || selectedTheme, onChange: (e) => {
                                                                                const value = e.target.value;
                                                                                setPendingTheme(value);
                                                                            }, style: {
                                                                                padding: '10px 14px',
                                                                                borderRadius: '8px',
                                                                                border: `1px solid ${theme.colors.border}`,
                                                                                backgroundColor: theme.colors.background,
                                                                                color: theme.colors.text,
                                                                                cursor: 'pointer',
                                                                                fontSize: '14px',
                                                                                minWidth: '200px',
                                                                                flex: 1,
                                                                            }, children: getThemeNames().map((name) => {
                                                                                const themeInfo = predefinedThemes[name];
                                                                                return (_jsx("option", { value: name, children: themeInfo.name }, name));
                                                                            }) }), pendingTheme && pendingTheme !== selectedTheme && (_jsx("button", { onClick: async () => {
                                                                                setIsApplyingTheme(true);
                                                                                try {
                                                                                    // Apply the theme using ThemeService
                                                                                    await ThemeService.applyTheme(pendingTheme, true);
                                                                                    setSelectedTheme(pendingTheme);
                                                                                    setPendingTheme(null);
                                                                                    // Show success feedback
                                                                                    setTimeout(() => {
                                                                                        setIsApplyingTheme(false);
                                                                                    }, 500);
                                                                                }
                                                                                catch (error) {
                                                                                    console.error('Failed to apply theme:', error);
                                                                                    setIsApplyingTheme(false);
                                                                                }
                                                                            }, disabled: isApplyingTheme, style: {
                                                                                padding: '8px 16px',
                                                                                borderRadius: '8px',
                                                                                border: 'none',
                                                                                backgroundColor: theme.colors.primary,
                                                                                color: theme.colors.background,
                                                                                cursor: isApplyingTheme ? 'not-allowed' : 'pointer',
                                                                                fontSize: '14px',
                                                                                fontWeight: 500,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '6px',
                                                                                opacity: isApplyingTheme ? 0.6 : 1,
                                                                                transition: 'all 0.2s',
                                                                            }, children: isApplyingTheme ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { size: 14, style: { animation: 'spin 1s linear infinite' } }), "Applying..."] })) : (_jsxs(_Fragment, { children: [_jsx(Palette, { size: 14 }), "Apply Theme"] })) }))] }), _jsxs("div", { style: {
                                                                        marginTop: '12px',
                                                                        padding: '12px',
                                                                        backgroundColor: theme.colors.backgroundLight,
                                                                        borderRadius: '8px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px'
                                                                    }, children: [_jsx(Palette, { size: 16, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '13px', color: theme.colors.textSecondary }, children: predefinedThemes[pendingTheme || selectedTheme]?.description || 'Standard theme' })] }), pendingTheme && pendingTheme !== selectedTheme && (_jsxs("p", { style: {
                                                                        fontSize: '12px',
                                                                        color: theme.colors.info,
                                                                        marginTop: '12px',
                                                                        fontStyle: 'italic'
                                                                    }, children: ["Click \"Apply Theme\" to switch to ", predefinedThemes[pendingTheme]?.name, " immediately"] }))] })] }), _jsxs("div", { style: { marginBottom: '32px' }, children: [_jsx("h4", { style: {
                                                                fontSize: '16px',
                                                                fontWeight: 600,
                                                                marginBottom: '16px',
                                                                color: theme.colors.text,
                                                            }, children: "Markdown Rendering Theme" }), _jsxs("div", { style: {
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                borderRadius: '12px',
                                                                padding: '20px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                            }, children: [_jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '16px' }, children: "Choose how markdown documents are styled" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }, children: [_jsx("input", { type: "radio", name: "markdownTheme", value: "app", checked: markdownThemeChoice === 'app', onChange: (e) => {
                                                                                        setMarkdownThemeChoice('app');
                                                                                        setUseCustomMarkdownTheme(false);
                                                                                        UserPreferencesService.updatePreferences({
                                                                                            useCustomMarkdownTheme: false
                                                                                        });
                                                                                    }, style: { cursor: 'pointer' } }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.text }, children: "Use application theme" }), _jsx("span", { style: { fontSize: '12px', color: theme.colors.textMuted, marginLeft: '4px' }, children: "(Follows interface theme)" })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }, children: [_jsx("input", { type: "radio", name: "markdownTheme", value: "github", checked: markdownThemeChoice === 'github', onChange: (e) => {
                                                                                        setMarkdownThemeChoice('github');
                                                                                        setUseCustomMarkdownTheme(true);
                                                                                        // Apply GitHub theme
                                                                                        const githubTheme = {
                                                                                            colors: {
                                                                                                text: '#24292e',
                                                                                                background: '#ffffff',
                                                                                                primary: '#0366d6',
                                                                                                secondary: '#586069',
                                                                                                accent: '#28a745',
                                                                                                border: '#d1d5da',
                                                                                                backgroundSecondary: '#f6f8fa',
                                                                                                backgroundLight: '#fafbfc',
                                                                                                textSecondary: '#586069',
                                                                                                textMuted: '#6a737d',
                                                                                                warning: '#ffd33d',
                                                                                                error: '#d73a49',
                                                                                                info: '#0366d6',
                                                                                                success: '#28a745'
                                                                                            }
                                                                                        };
                                                                                        UserPreferencesService.updatePreferences({
                                                                                            useCustomMarkdownTheme: true,
                                                                                            customMarkdownTheme: githubTheme
                                                                                        });
                                                                                    }, style: { cursor: 'pointer' } }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.text }, children: "GitHub style" }), _jsx("span", { style: { fontSize: '12px', color: theme.colors.textMuted, marginLeft: '4px' }, children: "(Classic GitHub markdown)" })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }, children: [_jsx("input", { type: "radio", name: "markdownTheme", value: "custom", checked: markdownThemeChoice === 'custom', onChange: (e) => {
                                                                                        setMarkdownThemeChoice('custom');
                                                                                        setShowCustomThemeEditor(true);
                                                                                    }, style: { cursor: 'pointer' } }), _jsx("span", { style: { fontSize: '14px', color: theme.colors.text }, children: "Custom theme" }), _jsx("span", { style: { fontSize: '12px', color: theme.colors.textMuted, marginLeft: '4px' }, children: "(Paste JSON)" })] })] }), (showCustomThemeEditor || markdownThemeChoice === 'custom') && (_jsxs("div", { style: {
                                                                        marginTop: '16px',
                                                                        padding: '16px',
                                                                        backgroundColor: theme.colors.backgroundLight,
                                                                        borderRadius: '8px',
                                                                        border: `1px solid ${theme.colors.border}`
                                                                    }, children: [_jsxs("div", { style: {
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center',
                                                                                marginBottom: '12px'
                                                                            }, children: [_jsx("h5", { style: {
                                                                                        fontSize: '14px',
                                                                                        fontWeight: 600,
                                                                                        margin: 0,
                                                                                        color: theme.colors.text
                                                                                    }, children: "Custom Theme JSON" }), _jsx("button", { onClick: () => {
                                                                                        // Show example theme
                                                                                        const exampleTheme = {
                                                                                            colors: {
                                                                                                text: '#1a1a1a',
                                                                                                background: '#ffffff',
                                                                                                primary: '#0969da',
                                                                                                secondary: '#57606a',
                                                                                                accent: '#1f883d',
                                                                                                border: '#d0d7de',
                                                                                                backgroundSecondary: '#f6f8fa',
                                                                                                backgroundLight: '#ffffff',
                                                                                                textSecondary: '#57606a',
                                                                                                textMuted: '#8c959f',
                                                                                                warning: '#9a6700',
                                                                                                error: '#cf222e',
                                                                                                info: '#0969da',
                                                                                                success: '#1f883d'
                                                                                            }
                                                                                        };
                                                                                        setCustomThemeJson(JSON.stringify(exampleTheme, null, 2));
                                                                                    }, style: {
                                                                                        padding: '4px 12px',
                                                                                        fontSize: '12px',
                                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                                        color: theme.colors.primary,
                                                                                        border: `1px solid ${theme.colors.border}`,
                                                                                        borderRadius: '4px',
                                                                                        cursor: 'pointer'
                                                                                    }, children: "Load Example" })] }), _jsx("textarea", { value: customThemeJson, onChange: (e) => {
                                                                                setCustomThemeJson(e.target.value);
                                                                                setCustomThemeError(null);
                                                                            }, placeholder: 'Paste your theme JSON here. Example:\n{\n  "colors": {\n    "text": "#1a1a1a",\n    "background": "#ffffff",\n    "primary": "#0969da",\n    ...\n  }\n}', style: {
                                                                                width: '100%',
                                                                                height: '200px',
                                                                                padding: '12px',
                                                                                backgroundColor: theme.colors.background,
                                                                                color: theme.colors.text,
                                                                                border: `1px solid ${theme.colors.border}`,
                                                                                borderRadius: '4px',
                                                                                fontFamily: 'monospace',
                                                                                fontSize: '12px',
                                                                                resize: 'vertical'
                                                                            } }), customThemeError && (_jsx("div", { style: {
                                                                                marginTop: '8px',
                                                                                padding: '8px 12px',
                                                                                backgroundColor: `${theme.colors.error}20`,
                                                                                color: theme.colors.error,
                                                                                borderRadius: '4px',
                                                                                fontSize: '12px'
                                                                            }, children: customThemeError })), _jsxs("div", { style: {
                                                                                display: 'flex',
                                                                                gap: '8px',
                                                                                marginTop: '12px'
                                                                            }, children: [_jsx("button", { onClick: () => {
                                                                                        try {
                                                                                            // Validate and save the custom theme
                                                                                            const parsedTheme = JSON.parse(customThemeJson);
                                                                                            // Basic validation
                                                                                            if (!parsedTheme.colors) {
                                                                                                throw new Error('Theme must have a "colors" property');
                                                                                            }
                                                                                            // Save the custom theme
                                                                                            setUseCustomMarkdownTheme(true);
                                                                                            UserPreferencesService.updatePreferences({
                                                                                                useCustomMarkdownTheme: true,
                                                                                                customMarkdownTheme: parsedTheme
                                                                                            });
                                                                                            setCustomThemeError(null);
                                                                                            setShowCustomThemeEditor(false);
                                                                                        }
                                                                                        catch (err) {
                                                                                            setCustomThemeError(err instanceof Error ? err.message : 'Invalid JSON format');
                                                                                        }
                                                                                    }, style: {
                                                                                        padding: '8px 16px',
                                                                                        backgroundColor: theme.colors.primary,
                                                                                        color: theme.colors.background,
                                                                                        border: 'none',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '13px',
                                                                                        fontWeight: 500,
                                                                                        cursor: 'pointer'
                                                                                    }, children: "Apply Custom Theme" }), _jsx("button", { onClick: () => {
                                                                                        setShowCustomThemeEditor(false);
                                                                                        if (markdownThemeChoice === 'custom' && !customThemeJson) {
                                                                                            setMarkdownThemeChoice('app');
                                                                                        }
                                                                                    }, style: {
                                                                                        padding: '8px 16px',
                                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                                        color: theme.colors.text,
                                                                                        border: `1px solid ${theme.colors.border}`,
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '13px',
                                                                                        cursor: 'pointer'
                                                                                    }, children: "Cancel" })] })] })), _jsxs("div", { style: {
                                                                        marginTop: '16px',
                                                                        padding: '12px',
                                                                        backgroundColor: theme.colors.backgroundLight,
                                                                        borderRadius: '8px',
                                                                        fontSize: '12px',
                                                                        color: theme.colors.textSecondary,
                                                                        lineHeight: 1.5
                                                                    }, children: [_jsx("strong", { children: "Note:" }), " This setting affects how markdown content is displayed in the editor and preview. It does not affect the application interface theme."] })] })] })] })), activeCategory === 'ai-assistants' && (_jsx("div", { style: { maxWidth: '100%', height: '100%' }, children: !activeAgentView ? (_jsxs("div", { style: { maxWidth: '800px' }, children: [_jsxs("h3", { style: {
                                                            fontSize: '24px',
                                                            fontWeight: 600,
                                                            marginBottom: '32px',
                                                            color: theme.colors.text,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                        }, children: [_jsx(Bot, { size: 24 }), "AI Assistants Configuration"] }), _jsx("div", { style: { marginBottom: '32px' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsx("div", { style: {
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '12px',
                                                                        padding: '20px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                    }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                                                            width: '40px',
                                                                                            height: '40px',
                                                                                            borderRadius: '8px',
                                                                                            background: 'linear-gradient(135deg, #D4500F20, #D4500F40)',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                        }, children: _jsx(Bot, { size: 20, color: "#D4500F" }) }), _jsxs("div", { children: [_jsx("h5", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }, children: "Claude" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, margin: 0 }, children: "Anthropic's AI assistant" }), agentStatus?.claude?.isInstalled && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }, children: [_jsx(CheckCircle, { size: 12, color: theme.colors.success }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.success }, children: "Installed" })] }))] })] }), _jsx("button", { onClick: () => {
                                                                                    setActiveAgentView('claude');
                                                                                    setAgentViewLayout('simple');
                                                                                }, style: {
                                                                                    padding: '8px 16px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${theme.colors.border}`,
                                                                                    backgroundColor: theme.colors.background,
                                                                                    color: theme.colors.text,
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '13px',
                                                                                }, children: "Configure" })] }) }), _jsx("div", { style: {
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '12px',
                                                                        padding: '20px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                    }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                                                            width: '40px',
                                                                                            height: '40px',
                                                                                            borderRadius: '8px',
                                                                                            background: 'linear-gradient(135deg, #4285F420, #4285F440)',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                        }, children: _jsx(Bot, { size: 20, color: "#4285F4" }) }), _jsxs("div", { children: [_jsx("h5", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }, children: "Gemini" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, margin: 0 }, children: "Google's AI assistant" }), agentStatus?.gemini?.isInstalled && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }, children: [_jsx(CheckCircle, { size: 12, color: theme.colors.success }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.success }, children: "Installed" })] }))] })] }), _jsx("button", { onClick: () => {
                                                                                    setActiveAgentView('gemini');
                                                                                    setAgentViewLayout('simple');
                                                                                }, style: {
                                                                                    padding: '8px 16px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${theme.colors.border}`,
                                                                                    backgroundColor: theme.colors.background,
                                                                                    color: theme.colors.text,
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '13px',
                                                                                }, children: "Configure" })] }) }), _jsx("div", { style: {
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '12px',
                                                                        padding: '20px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                    }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                                                            width: '40px',
                                                                                            height: '40px',
                                                                                            borderRadius: '8px',
                                                                                            background: 'linear-gradient(135deg, #10b98120, #10b98140)',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                        }, children: _jsx(Bot, { size: 20, color: "#10b981" }) }), _jsxs("div", { children: [_jsx("h5", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }, children: "OpenCode" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, margin: 0 }, children: "Open-source AI assistant" }), agentStatus?.opencode?.isInstalled && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }, children: [_jsx(CheckCircle, { size: 12, color: theme.colors.success }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.success }, children: "Installed" })] }))] })] }), _jsx("button", { onClick: () => {
                                                                                    setActiveAgentView('opencode');
                                                                                    setAgentViewLayout('simple');
                                                                                }, style: {
                                                                                    padding: '8px 16px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${theme.colors.border}`,
                                                                                    backgroundColor: theme.colors.background,
                                                                                    color: theme.colors.text,
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '13px',
                                                                                }, children: "Configure" })] }) })] }) })] })) : (_jsxs("div", { style: { height: '100%', overflow: 'auto' }, children: [_jsx("div", { style: { padding: '20px 0', borderBottom: `1px solid ${theme.colors.border}`, marginBottom: '20px' }, children: _jsx("button", { onClick: () => setActiveAgentView(null), style: {
                                                                padding: '8px 16px',
                                                                borderRadius: '6px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                                backgroundColor: theme.colors.background,
                                                                color: theme.colors.text,
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                marginBottom: '16px',
                                                            }, children: "\u2190 Back to AI Assistants" }) }), activeAgentView === 'claude' && agentStatus && (_jsx(AgentConfigurationView, { agentType: SupportedAgent.CLAUDE, agentStatus: agentStatus.claude, checkAgentStatus: checkAgentStatus, viewLayout: agentViewLayout, onShowDetails: () => setAgentViewLayout('detailed'), onBackToSetup: () => setAgentViewLayout('simple') })), activeAgentView === 'gemini' && agentStatus && (_jsx(AgentConfigurationView, { agentType: SupportedAgent.GEMINI, agentStatus: agentStatus.gemini, checkAgentStatus: checkAgentStatus, viewLayout: agentViewLayout, onShowDetails: () => setAgentViewLayout('detailed'), onBackToSetup: () => setAgentViewLayout('simple') })), activeAgentView === 'opencode' && agentStatus && (_jsx(AgentConfigurationView, { agentType: SupportedAgent.OPENCODE, agentStatus: agentStatus.opencode, checkAgentStatus: checkAgentStatus, viewLayout: agentViewLayout, onShowDetails: () => setAgentViewLayout('detailed'), onBackToSetup: () => setAgentViewLayout('simple') }))] })) })), activeCategory === 'developer-tools' && (_jsx("div", { style: { maxWidth: '100%', height: '100%' }, children: !activeToolsView ? (_jsxs("div", { style: { maxWidth: '800px' }, children: [_jsxs("h3", { style: {
                                                            fontSize: '24px',
                                                            fontWeight: 600,
                                                            marginBottom: '32px',
                                                            color: theme.colors.text,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                        }, children: [_jsx(Terminal, { size: 24 }), "Developer Tools"] }), _jsx("div", { style: { marginBottom: '32px' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsx("div", { style: {
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '12px',
                                                                        padding: '20px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                    }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                                                            width: '40px',
                                                                                            height: '40px',
                                                                                            borderRadius: '8px',
                                                                                            background: 'linear-gradient(135deg, #000000, #333333)',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                        }, children: _jsx(Terminal, { size: 20, color: "white" }) }), _jsxs("div", { children: [_jsx("h5", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }, children: "Terminal" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, margin: 0 }, children: "Terminal integration settings" })] })] }), _jsx("button", { onClick: () => setActiveToolsView('terminal'), style: {
                                                                                    padding: '8px 16px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${theme.colors.border}`,
                                                                                    backgroundColor: theme.colors.background,
                                                                                    color: theme.colors.text,
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '13px',
                                                                                }, children: "Configure" })] }) }), _jsx("div", { style: {
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '12px',
                                                                        padding: '20px',
                                                                        border: `1px solid ${theme.colors.border}`,
                                                                    }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                                                            width: '40px',
                                                                                            height: '40px',
                                                                                            borderRadius: '8px',
                                                                                            background: 'linear-gradient(135deg, #007ACC20, #007ACC40)',
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                        }, children: _jsx(Code, { size: 20, color: "#007ACC" }) }), _jsxs("div", { children: [_jsx("h5", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }, children: "IDE/Editor" }), _jsx("p", { style: { fontSize: '13px', color: theme.colors.textSecondary, margin: 0 }, children: "Code editor integration settings" })] })] }), _jsx("button", { onClick: () => setActiveToolsView('ide'), style: {
                                                                                    padding: '8px 16px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${theme.colors.border}`,
                                                                                    backgroundColor: theme.colors.background,
                                                                                    color: theme.colors.text,
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '13px',
                                                                                }, children: "Configure" })] }) })] }) })] })) : (_jsxs("div", { style: { height: '100%', overflow: 'auto' }, children: [_jsx("div", { style: { padding: '20px 0', borderBottom: `1px solid ${theme.colors.border}`, marginBottom: '20px' }, children: _jsx("button", { onClick: () => setActiveToolsView(null), style: {
                                                                padding: '8px 16px',
                                                                borderRadius: '6px',
                                                                border: `1px solid ${theme.colors.border}`,
                                                                backgroundColor: theme.colors.background,
                                                                color: theme.colors.text,
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                marginBottom: '16px',
                                                            }, children: "\u2190 Back to Developer Tools" }) }), activeToolsView === 'terminal' && _jsx(TerminalConfigurationView, {}), activeToolsView === 'ide' && _jsx(IDEConfigurationView, {})] })) })), activeCategory === 'updates' && (_jsxs("div", { style: { maxWidth: '800px' }, children: [_jsxs("h3", { style: {
                                                        fontSize: '24px',
                                                        fontWeight: 600,
                                                        marginBottom: '32px',
                                                        color: theme.colors.text,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                    }, children: [_jsx(RefreshCw, { size: 24 }), "Application Updates"] }), _jsx("div", { style: { marginBottom: '32px' }, children: _jsxs("div", { style: {
                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                            borderRadius: '12px',
                                                            padding: '20px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("h4", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }, children: "Current Version" }), _jsxs("p", { style: { fontSize: '24px', fontWeight: 700, color: theme.colors.primary, margin: 0 }, children: ["v", currentVersion] }), lastCheck && (_jsxs("p", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginTop: '8px' }, children: ["Last checked: ", lastCheck.toLocaleTimeString()] }))] }), _jsxs("button", { onClick: checkForUpdates, disabled: isChecking, style: {
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px',
                                                                            padding: '12px 20px',
                                                                            backgroundColor: isChecking
                                                                                ? theme.colors.backgroundTertiary
                                                                                : updateAvailable
                                                                                    ? theme.colors.warning
                                                                                    : theme.colors.primary,
                                                                            color: isChecking ? theme.colors.textSecondary : '#ffffff',
                                                                            border: 'none',
                                                                            borderRadius: '8px',
                                                                            cursor: isChecking ? 'not-allowed' : 'pointer',
                                                                            opacity: isChecking ? 0.5 : 1,
                                                                            transition: 'all 0.2s',
                                                                            fontSize: '14px',
                                                                            fontWeight: 600,
                                                                        }, onMouseEnter: (e) => {
                                                                            if (!isChecking) {
                                                                                e.currentTarget.style.transform = 'scale(1.02)';
                                                                            }
                                                                        }, onMouseLeave: (e) => {
                                                                            e.currentTarget.style.transform = 'scale(1)';
                                                                        }, children: [_jsx(RefreshCw, { size: 16, className: isChecking ? 'animate-spin' : '' }), isChecking
                                                                                ? 'Checking...'
                                                                                : updateAvailable
                                                                                    ? `Update to v${availableVersion}`
                                                                                    : 'Check for Updates'] })] }), updateStatus && (_jsx("div", { style: {
                                                                    marginTop: '16px',
                                                                    padding: '12px',
                                                                    backgroundColor: updateStatus.includes('available')
                                                                        ? `${theme.colors.warning}15`
                                                                        : updateStatus.includes('Error')
                                                                            ? `${theme.colors.error}15`
                                                                            : `${theme.colors.success}15`,
                                                                    borderRadius: '8px',
                                                                    border: `1px solid ${updateStatus.includes('available')
                                                                        ? theme.colors.warning + '30'
                                                                        : updateStatus.includes('Error')
                                                                            ? theme.colors.error + '30'
                                                                            : theme.colors.success + '30'}`,
                                                                }, children: _jsx("p", { style: {
                                                                        fontSize: '14px',
                                                                        margin: 0,
                                                                        color: updateStatus.includes('available')
                                                                            ? theme.colors.warning
                                                                            : updateStatus.includes('Error')
                                                                                ? theme.colors.error
                                                                                : theme.colors.success,
                                                                    }, children: updateStatus }) }))] }) }), updateAvailable && availableVersion && (_jsxs("div", { style: {
                                                        backgroundColor: `${theme.colors.warning}10`,
                                                        border: `2px solid ${theme.colors.warning}`,
                                                        borderRadius: '12px',
                                                        padding: '24px',
                                                        marginBottom: '32px',
                                                    }, children: [_jsxs("h4", { style: {
                                                                fontSize: '18px',
                                                                fontWeight: 600,
                                                                margin: '0 0 16px 0',
                                                                color: theme.colors.warning,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                            }, children: [_jsx(Sparkles, { size: 20 }), "New Version Available!"] }), _jsx("div", { style: { marginBottom: '20px' }, children: _jsxs("p", { style: { fontSize: '14px', margin: '0 0 8px 0', color: theme.colors.text }, children: [_jsx("strong", { children: "Current:" }), " v", currentVersion, " \u2192 ", _jsx("strong", { children: "Available:" }), " v", availableVersion] }) }), isDevMode ? (_jsxs("div", { children: [_jsx("div", { style: {
                                                                        padding: '12px',
                                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                                        borderRadius: '8px',
                                                                        marginBottom: '12px',
                                                                    }, children: _jsxs("p", { style: { fontSize: '13px', margin: 0, color: theme.colors.textSecondary }, children: [_jsx(Info, { size: 14, style: { display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' } }), "Development mode: Updates are detected but not automatically downloaded."] }) }), _jsx("button", { style: {
                                                                        padding: '10px 20px',
                                                                        backgroundColor: theme.colors.warning,
                                                                        color: '#ffffff',
                                                                        border: 'none',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                    }, onClick: () => {
                                                                        setIsDownloading(true);
                                                                        setDownloadError(null);
                                                                        setDownloadProgress(0);
                                                                        setUpdateStatus('Test downloading update (won\'t auto-install)...');
                                                                        AppVersionManagerService.testDownloadUpdate();
                                                                    }, disabled: isDownloading || !updateAvailable, children: "Test Download (No Auto-Install)" })] })) : (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'center' }, children: [_jsx("button", { style: {
                                                                                padding: '10px 20px',
                                                                                backgroundColor: isDownloaded
                                                                                    ? theme.colors.success
                                                                                    : isDownloading
                                                                                        ? theme.colors.backgroundTertiary
                                                                                        : theme.colors.warning,
                                                                                color: isDownloading ? theme.colors.textSecondary : '#ffffff',
                                                                                border: 'none',
                                                                                borderRadius: '8px',
                                                                                cursor: isDownloading ? 'not-allowed' : 'pointer',
                                                                                fontSize: '14px',
                                                                                fontWeight: 600,
                                                                                opacity: isDownloading ? 0.7 : 1,
                                                                                transition: 'all 0.2s',
                                                                            }, onClick: isDownloaded ? installUpdate : downloadUpdate, disabled: isDownloading, children: isDownloading
                                                                                ? `Downloading... ${Math.round(downloadProgress)}%`
                                                                                : isDownloaded
                                                                                    ? 'Install & Restart'
                                                                                    : 'Download Update' }), _jsx("span", { style: { fontSize: '13px', color: theme.colors.textSecondary }, children: isDownloaded
                                                                                ? 'Ready to install'
                                                                                : 'The app will restart after installation' })] }), isDownloading && (_jsx("div", { style: {
                                                                        width: '100%',
                                                                        height: '4px',
                                                                        backgroundColor: theme.colors.backgroundTertiary,
                                                                        borderRadius: '2px',
                                                                        overflow: 'hidden',
                                                                        marginTop: '12px',
                                                                    }, children: _jsx("div", { style: {
                                                                            width: `${downloadProgress}%`,
                                                                            height: '100%',
                                                                            backgroundColor: theme.colors.primary,
                                                                            transition: 'width 0.3s ease',
                                                                        } }) })), downloadError && (_jsx("div", { style: {
                                                                        marginTop: '12px',
                                                                        padding: '12px',
                                                                        backgroundColor: `${theme.colors.error}15`,
                                                                        border: `1px solid ${theme.colors.error}30`,
                                                                        borderRadius: '8px',
                                                                    }, children: _jsx("p", { style: { fontSize: '13px', margin: 0, color: theme.colors.error }, children: downloadError }) }))] }))] })), _jsxs("div", { style: {
                                                        backgroundColor: theme.colors.backgroundSecondary,
                                                        borderRadius: '12px',
                                                        padding: '20px',
                                                        border: `1px solid ${theme.colors.border}`,
                                                    }, children: [_jsx("h4", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }, children: "Automatic Updates" }), _jsx("p", { style: { fontSize: '14px', margin: 0, color: theme.colors.textSecondary, lineHeight: 1.6 }, children: "The application checks for updates on startup and every hour while running. Updates are downloaded automatically and you'll be prompted to restart when ready." })] })] })), activeCategory === 'developer' && (_jsxs("div", { style: { maxWidth: '800px' }, children: [_jsxs("h3", { style: {
                                                        fontSize: '24px',
                                                        fontWeight: 600,
                                                        marginBottom: '32px',
                                                        color: theme.colors.text,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                    }, children: [_jsx(Code, { size: 24 }), "Developer Tools"] }), _jsx("div", { style: { marginBottom: '24px' }, children: _jsx("div", { style: {
                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                            borderRadius: '12px',
                                                            padding: '20px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                        }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("h4", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }, children: "Database Viewer" }), _jsx("p", { style: { fontSize: '14px', margin: 0, color: theme.colors.textSecondary }, children: "Inspect and manage application data stored in the local database" })] }), _jsxs("button", { onClick: async () => {
                                                                        try {
                                                                            await WindowService.openStoreViewer();
                                                                        }
                                                                        catch (error) {
                                                                            console.error('Failed to open store viewer:', error);
                                                                        }
                                                                    }, style: {
                                                                        padding: '10px 20px',
                                                                        borderRadius: '8px',
                                                                        border: 'none',
                                                                        backgroundColor: theme.colors.primary,
                                                                        color: 'white',
                                                                        cursor: 'pointer',
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px',
                                                                        transition: 'all 0.2s',
                                                                    }, onMouseEnter: (e) => e.currentTarget.style.transform = 'scale(1.02)', onMouseLeave: (e) => e.currentTarget.style.transform = 'scale(1)', children: [_jsx(Database, { size: 16 }), "Open Viewer"] })] }) }) }), _jsx("div", { style: { marginBottom: '24px' }, children: _jsx("div", { style: {
                                                            backgroundColor: theme.colors.backgroundSecondary,
                                                            borderRadius: '12px',
                                                            padding: '20px',
                                                            border: `1px solid ${theme.colors.border}`,
                                                        }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsxs("h4", { style: {
                                                                                fontSize: '16px',
                                                                                fontWeight: 600,
                                                                                margin: '0 0 8px 0',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '8px'
                                                                            }, children: [_jsx(Container, { size: 20 }), "Docker Integration"] }), _jsx("p", { style: { fontSize: '14px', margin: 0, color: theme.colors.textSecondary }, children: "Run code analysis tools like Knip in isolated Docker containers" }), dockerStatus && (_jsxs("div", { style: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [dockerStatus.installed ? (_jsx(CheckCircle, { size: 16, style: { color: theme.colors.success } })) : (_jsx(AlertCircle, { size: 16, style: { color: theme.colors.error } })), _jsxs("span", { style: { fontSize: '13px', color: theme.colors.text }, children: ["Docker ", dockerStatus.installed ? `installed (v${dockerStatus.version || 'unknown'})` : 'not installed'] })] }), dockerStatus.installed && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [dockerStatus.running ? (_jsx(CheckCircle, { size: 16, style: { color: theme.colors.success } })) : (_jsx(AlertCircle, { size: 16, style: { color: theme.colors.warning } })), _jsxs("span", { style: { fontSize: '13px', color: theme.colors.text }, children: ["Docker daemon ", dockerStatus.running ? 'is running' : 'is not running'] })] })), dockerStatus.installed && dockerStatus.running && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [dockerStatus.hasKnipImage ? (_jsx(CheckCircle, { size: 16, style: { color: theme.colors.success } })) : (_jsx(Info, { size: 16, style: { color: theme.colors.textSecondary } })), _jsxs("span", { style: { fontSize: '13px', color: theme.colors.text }, children: ["Knip Docker image ", dockerStatus.hasKnipImage ? 'available' : 'not installed'] })] }))] }))] }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { onClick: checkDockerStatus, disabled: checkingDocker, style: {
                                                                                padding: '10px',
                                                                                borderRadius: '8px',
                                                                                border: `1px solid ${theme.colors.border}`,
                                                                                backgroundColor: theme.colors.background,
                                                                                color: theme.colors.text,
                                                                                cursor: checkingDocker ? 'not-allowed' : 'pointer',
                                                                                fontSize: '14px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '6px',
                                                                                transition: 'all 0.2s',
                                                                            }, onMouseEnter: (e) => {
                                                                                if (!checkingDocker) {
                                                                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                                                }
                                                                            }, onMouseLeave: (e) => {
                                                                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                                                            }, children: _jsx(RefreshCw, { size: 16, className: checkingDocker ? 'animate-spin' : '' }) }), dockerStatus && !dockerStatus.installed && (_jsx("button", { onClick: () => {
                                                                                window.open('https://www.docker.com/products/docker-desktop/', '_blank');
                                                                            }, style: {
                                                                                padding: '10px 20px',
                                                                                borderRadius: '8px',
                                                                                border: 'none',
                                                                                backgroundColor: theme.colors.primary,
                                                                                color: 'white',
                                                                                cursor: 'pointer',
                                                                                fontSize: '14px',
                                                                                fontWeight: 600,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '8px',
                                                                                transition: 'all 0.2s',
                                                                            }, onMouseEnter: (e) => e.currentTarget.style.transform = 'scale(1.02)', onMouseLeave: (e) => e.currentTarget.style.transform = 'scale(1)', children: "Install Docker" })), dockerStatus && dockerStatus.installed && dockerStatus.running && !dockerStatus.hasKnipImage && (_jsx("button", { onClick: async () => {
                                                                                try {
                                                                                    const success = await DockerService.pullImage('knip/knip:latest');
                                                                                    if (success) {
                                                                                        await checkDockerStatus(); // Refresh status
                                                                                    }
                                                                                }
                                                                                catch (error) {
                                                                                    console.error('Failed to pull Knip image:', error);
                                                                                }
                                                                            }, style: {
                                                                                padding: '10px 20px',
                                                                                borderRadius: '8px',
                                                                                border: 'none',
                                                                                backgroundColor: theme.colors.primary,
                                                                                color: 'white',
                                                                                cursor: 'pointer',
                                                                                fontSize: '14px',
                                                                                fontWeight: 600,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '8px',
                                                                                transition: 'all 0.2s',
                                                                            }, onMouseEnter: (e) => e.currentTarget.style.transform = 'scale(1.02)', onMouseLeave: (e) => e.currentTarget.style.transform = 'scale(1)', children: "Install Knip" }))] })] }) }) }), isDevMode && (_jsxs("div", { style: {
                                                        backgroundColor: `${theme.colors.warning}15`,
                                                        border: `1px solid ${theme.colors.warning}30`,
                                                        borderRadius: '12px',
                                                        padding: '20px',
                                                    }, children: [_jsx("h4", { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: theme.colors.warning }, children: "Development Mode Active" }), _jsx("p", { style: { fontSize: '14px', margin: 0, color: theme.colors.textSecondary, lineHeight: 1.6 }, children: "You are running a development build. Some features may behave differently than in production. Auto-update is disabled to prevent overwriting your development environment." })] }))] }))] })] })] }) })] }));
};
