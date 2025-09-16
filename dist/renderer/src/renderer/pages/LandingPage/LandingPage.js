import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown, FolderOpen, Github, Search, } from 'lucide-react';
import { SupportedLLMProvider } from '../../../shared/main-process-api-interfaces/LLMModelsAPI';
import { useTheme } from 'themed-markdown';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import { aiService } from '../../main-process-api/AIService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { useComponentTracking } from '../../components/withComponentTracking';
import { UpdateNotification } from '../../components/UpdateNotification';
// import { ProjectsView } from './ProjectsView'; // Old view - replaced with Alexandria
import { AlexandriaRepositoryManager } from '../alexandria/AlexandriaRepositoryManager';
import { OnboardingFlowV2 } from './OnboardingFlowV2';
export const LandingPage = ({ initialAgentStatus, onUpdateAvailable, }) => {
    const { theme } = useTheme();
    const trackingProps = useComponentTracking('LandingPage', 'src/renderer/pages/LandingPage.tsx');
    const [bottomViewMode] = useState('repos');
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [, setAgentStatus] = useState(initialAgentStatus);
    const [, setHasUpdateAvailable] = useState(false);
    const [showAddProjectDropdown, setShowAddProjectDropdown] = useState(false);
    const dropdownRef = useRef(null);
    // Setup configuration status
    const [, setSetupStatus] = useState({
        agentsInstalled: false,
        hooksConfigured: false,
        llmConfigured: false,
        mcpConfigured: false,
        isOllamaRunning: false,
        hasOpenRouterKey: false,
    });
    const [setupLoading, setSetupLoading] = useState(true);
    const checkSetup = useCallback(async () => {
        try {
            console.info('Checking setup...');
            setSetupLoading(true);
            // Check agent installations
            const agentStatusData = await AgentConfigurationService.checkAgentInstallations();
            setAgentStatus(agentStatusData);
            const agentsInstalled = agentStatusData.claude.isInstalled || agentStatusData.gemini.isInstalled || agentStatusData.opencode.isInstalled;
            const hooksConfigured = (agentStatusData.claude.hookCount || 0) > 0 || (agentStatusData.gemini.hookCount || 0) > 0 || (agentStatusData.opencode.hookCount || 0) > 0;
            // Check LLM configuration
            const [ollamaStatus, openRouterConfig] = await Promise.all([
                aiService.checkOllamaStatus().catch(() => null),
                aiService.getProviderConfig(SupportedLLMProvider.OPENROUTER).catch(() => null),
            ]);
            const llmConfigured = (ollamaStatus?.running && ollamaStatus.models.length > 0) ||
                (openRouterConfig?.enabled && openRouterConfig?.apiKey);
            // Check MCP configuration
            let mcpConfigured = false;
            let claudeMCP = false;
            let geminiMCP = false;
            let opencodeMCP = false;
            try {
                mcpConfigured = claudeMCP || geminiMCP || opencodeMCP;
            }
            catch (e) {
                console.error('Failed to check MCP status:', e);
                mcpConfigured = false;
            }
            setSetupStatus({
                agentsInstalled,
                hooksConfigured,
                llmConfigured: !!llmConfigured,
                mcpConfigured,
                isOllamaRunning: ollamaStatus?.running || false,
                hasOpenRouterKey: !!openRouterConfig?.enabled && !!openRouterConfig?.apiKey,
            });
        }
        catch (error) {
            console.error('Failed to check setup configuration:', error);
        }
        finally {
            setSetupLoading(false);
        }
    }, []);
    // Check full setup configuration status
    useEffect(() => {
        checkSetup();
    }, [checkSetup]);
    // Handle click outside dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAddProjectDropdown(false);
            }
        };
        if (showAddProjectDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAddProjectDropdown]);
    // Handle adding local repository
    const handleAddLocalRepository = async () => {
        try {
            const result = await FileSystemService.selectDirectory({
                title: 'Select Local Repository',
                buttonLabel: 'Select Repository',
                properties: ['openDirectory'],
            });
            if (!result || result.canceled) {
                return;
            }
            // Handle both possible response formats
            const selectedPath = result.filePaths?.[0] || result.filePath || result.path;
            if (selectedPath) {
                const name = selectedPath.split('/').pop() || 'unnamed';
                await AlexandriaService.registerRepository(name, selectedPath);
                // Backend will emit event to update repository list
            }
        }
        catch (err) {
            console.error('Failed to add local repository:', err);
        }
    };
    // Handle pasting GitHub link
    const handleAddGithubLink = async () => {
        // TODO: Implement GitHub link modal
        console.info('Add GitHub link - not yet implemented');
    };
    // Handle GitHub search
    const handleSearchGithub = async () => {
        // TODO: Implement GitHub search modal
        console.info('Search GitHub - not yet implemented');
    };
    return (_jsxs(_Fragment, { children: [isOnboardingOpen && (_jsx("div", { style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                }, children: _jsxs("div", { style: {
                        width: '95%',
                        maxWidth: '1400px',
                        height: '95%',
                        maxHeight: '900px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    }, children: [_jsx("button", { onClick: () => setIsOnboardingOpen(false), style: {
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: theme.colors.backgroundSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                zIndex: 10,
                                transition: 'all 0.2s ease',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            }, children: _jsx(X, { size: 18, color: theme.colors.textSecondary }) }), _jsx(OnboardingFlowV2, { onComplete: () => {
                                setIsOnboardingOpen(false);
                                checkSetup(); // Refresh the setup status
                            }, onSkip: () => setIsOnboardingOpen(false) })] }) })), _jsxs("div", { ...trackingProps, style: {
                    height: '100%',
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    display: 'flex',
                    flexDirection: 'column',
                }, children: [_jsx("div", { style: {
                            width: '100%',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'flex-start', // Align items to top
                                justifyContent: 'space-between',
                                position: 'relative',
                            }, children: [_jsx("div", { style: {
                                        position: 'absolute',
                                        top: '0',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 10,
                                    }, children: _jsx(UpdateNotification, { onUpdateAvailable: (hasUpdate) => {
                                            setHasUpdateAvailable(hasUpdate);
                                            onUpdateAvailable?.(hasUpdate);
                                        } }) }), _jsx("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                    }, children: _jsx("div", { style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            gap: '4px',
                                        }, children: _jsx("p", { style: {
                                                fontSize: '24px',
                                                color: theme.colors.textSecondary,
                                                margin: 0,
                                                fontWeight: 300,
                                            }, children: "Codebase Manager" }) }) }), _jsx("div", { style: {
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'center',
                                    }, children: _jsxs("div", { ref: dropdownRef, style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => setShowAddProjectDropdown(!showAddProjectDropdown), style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    backgroundColor: theme.colors.primary,
                                                    color: theme.colors.background,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    transition: 'all 0.2s',
                                                }, onMouseEnter: (e) => {
                                                    e.currentTarget.style.opacity = '0.9';
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                }, children: [_jsx(Plus, { size: 16 }), "Add Project", _jsx(ChevronDown, { size: 14, style: {
                                                            transform: showAddProjectDropdown ? 'rotate(180deg)' : 'rotate(0)',
                                                            transition: 'transform 0.2s',
                                                        } })] }), showAddProjectDropdown && (_jsxs("div", { style: {
                                                    position: 'absolute',
                                                    top: '100%',
                                                    right: 0,
                                                    marginTop: '4px',
                                                    backgroundColor: theme.colors.backgroundSecondary,
                                                    border: `1px solid ${theme.colors.border}`,
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                    minWidth: '200px',
                                                    zIndex: 1000,
                                                    overflow: 'hidden',
                                                }, children: [_jsxs("button", { onClick: () => {
                                                            setShowAddProjectDropdown(false);
                                                            handleAddLocalRepository();
                                                        }, style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            backgroundColor: 'transparent',
                                                            color: theme.colors.text,
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            textAlign: 'left',
                                                            transition: 'background-color 0.2s',
                                                        }, onMouseEnter: (e) => {
                                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                        }, onMouseLeave: (e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }, children: [_jsx(FolderOpen, { size: 16 }), "Local Folder"] }), _jsx("div", { style: {
                                                            height: '1px',
                                                            backgroundColor: theme.colors.border,
                                                        } }), _jsxs("button", { onClick: () => {
                                                            setShowAddProjectDropdown(false);
                                                            handleAddGithubLink();
                                                        }, style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            backgroundColor: 'transparent',
                                                            color: theme.colors.text,
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            textAlign: 'left',
                                                            transition: 'background-color 0.2s',
                                                        }, onMouseEnter: (e) => {
                                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                        }, onMouseLeave: (e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }, children: [_jsx(Github, { size: 16 }), "Paste Link"] }), _jsx("div", { style: {
                                                            height: '1px',
                                                            backgroundColor: theme.colors.border,
                                                        } }), _jsxs("button", { onClick: () => {
                                                            setShowAddProjectDropdown(false);
                                                            handleSearchGithub();
                                                        }, style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            backgroundColor: 'transparent',
                                                            color: theme.colors.text,
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 500,
                                                            textAlign: 'left',
                                                            transition: 'background-color 0.2s',
                                                        }, onMouseEnter: (e) => {
                                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                        }, onMouseLeave: (e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }, children: [_jsx(Search, { size: 16 }), "Search GitHub"] })] }))] }) })] }) }), _jsx("div", { style: {
                            flex: 1,
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }, children: _jsxs("div", { style: {
                                flex: 1,
                                width: '100%',
                                display: 'flex',
                                borderRadius: '0',
                                overflow: 'hidden',
                                flexDirection: 'column',
                                minHeight: 0,
                            }, children: [setupLoading && (_jsxs("div", { style: {
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 0,
                                        padding: '40px',
                                    }, children: [_jsx("style", { children: `
                  @keyframes shimmer {
                    0% {
                      background-position: -200% 0;
                    }
                    100% {
                      background-position: 200% 0;
                    }
                  }
                  
                  .shimmer-box {
                    background: linear-gradient(
                      90deg,
                      ${theme.colors.backgroundSecondary} 25%,
                      ${theme.colors.backgroundTertiary} 50%,
                      ${theme.colors.backgroundSecondary} 75%
                    );
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                    border-radius: 8px;
                  }
                ` }), _jsxs("div", { style: {
                                                width: '100%',
                                                maxWidth: '800px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '24px',
                                            }, children: [_jsx("div", { className: "shimmer-box", style: { height: '32px', width: '250px' } }), _jsx("div", { className: "shimmer-box", style: { height: '20px', width: '400px', opacity: 0.7 } }), _jsx("div", { style: {
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                                        gap: '16px',
                                                        marginTop: '20px',
                                                    }, children: [1, 2, 3].map((i) => (_jsx("div", { className: "shimmer-box", style: {
                                                            height: '180px',
                                                            opacity: 0.6 - (i * 0.1),
                                                        } }, i))) }), _jsx("div", { style: {
                                                        textAlign: 'center',
                                                        marginTop: '20px',
                                                        fontSize: '14px',
                                                        color: theme.colors.textSecondary,
                                                    }, children: "Checking setup status..." })] })] })), bottomViewMode === 'repos' && !setupLoading && (_jsx(AlexandriaRepositoryManager, {}))] }) })] })] }));
};
