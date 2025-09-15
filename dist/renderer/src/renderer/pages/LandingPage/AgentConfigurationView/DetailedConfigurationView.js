import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect } from 'react';
import { Bot, Lock, Unlock, Wand2 } from 'lucide-react';
import { getAgentInfo, SupportedAgent } from "@principal-ai/agent-monitoring";
import { useTheme } from 'themed-markdown';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';
import { AgentInstallationCard } from './AgentInstallationCard';
import { HooksGrid } from './HooksGrid';
import { HooksToggle } from './HooksToggle';
import { WatchingFileViewer } from './WatchingFileViewer';
// =============================================================================
// MAIN COMPONENT
// =============================================================================
export const DetailedConfigurationView = ({ agentType, initialAgentStatus, checkAgentStatus, onBackToSetup, }) => {
    const { theme } = useTheme();
    const agentConfig = getAgentInfo(agentType);
    // =========================================================================
    // STATE - View Control
    // =========================================================================
    const [agentStatus, setAgentStatus] = React.useState(initialAgentStatus);
    const [viewMode, setViewMode] = React.useState('hooks');
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [currentFileContent, setCurrentFileContent] = React.useState('');
    // =========================================================================
    // STATE - File Management
    // =========================================================================
    const [configFileExists, setConfigFileExists] = React.useState(false);
    const [configFilePath, setConfigFilePath] = React.useState('');
    const [hooksFilePath, setHooksFilePath] = React.useState('');
    const [hooksFileExists, setHooksFileExists] = React.useState(false);
    const [mcpFilePath, setMcpFilePath] = React.useState('');
    const [mcpFileExists, setMcpFileExists] = React.useState(false);
    // =========================================================================
    // STATE - MCP Configuration
    // =========================================================================
    const [mcpServers, setMcpServers] = React.useState({});
    // =========================================================================
    // FILE CHECKING FUNCTIONS
    // =========================================================================
    useEffect(() => {
        setAgentStatus(initialAgentStatus);
    }, [initialAgentStatus]);
    const checkConfigFile = async () => {
        try {
            // Get the MCP file path for MCP-specific operations
            const mcpPathResult = await AgentConfigurationService.getAgentMCPFilePath(agentType);
            const mcpPath = mcpPathResult;
            setMcpFilePath(mcpPath);
            // Get the agent setup status which includes the config path
            const statusResult = await AgentConfigurationService.getAgentSetupStatus(agentType);
            if (!statusResult.success || !statusResult.status) {
                setConfigFileExists(false);
                setMcpServers({});
                return;
            }
            const filePath = statusResult.status.configPath;
            setConfigFilePath(filePath);
            // Check MCP file separately
            const mcpFileResult = await FileSystemService.readFile(mcpPath);
            if (mcpFileResult && mcpFileResult.content) {
                setMcpFileExists(true);
                // Parse MCP servers from the MCP config file
                try {
                    const mcpConfig = JSON.parse(mcpFileResult.content);
                    /*
                    // For Claude, it's in projects, for others it's at root level
          
                    if (agentType === 'claude') {
                      const projectPath = await fileSystem.getCurrentWorkingDirectory();
                      const projectConfig = mcpConfig.projects?.[projectPath];
                      const mcpServersFound = projectConfig?.mcpServers || {};
                      setMcpServers(mcpServersFound);
                    } else {
                    }
                    */
                    setMcpServers(mcpConfig.mcpServers || {});
                }
                catch (parseError) {
                    console.error('Error parsing MCP config:', parseError);
                    setMcpServers({});
                }
            }
            else {
                setMcpFileExists(false);
                setMcpServers({});
            }
            const result = await FileSystemService.readFile(filePath);
            if (result && result.content) {
                setConfigFileExists(true);
                // Parse MCP servers from the config
                try {
                    const config = JSON.parse(result.content);
                    /*
                    // Get current working directory to find the project-specific config
                    const projectPath = await fileSystem.getCurrentWorkingDirectory();
                    const projectConfig = config.projects?.[projectPath];
                    const mcpServersFound = projectConfig?.mcpServers || {};
                    setMcpServers(mcpServersFound);
                     */
                }
                catch (parseError) {
                    console.error('Error parsing MCP config:', parseError);
                    setMcpServers({});
                }
            }
            else {
                setConfigFileExists(false);
                setMcpServers({});
            }
        }
        catch (error) {
            setConfigFileExists(false);
            setMcpServers({});
        }
    };
    // =========================================================================
    // MCP PROJECT MANAGEMENT
    // =========================================================================
    // =========================================================================
    // FILE EDITING FUNCTIONS
    // =========================================================================
    const handleSaveConfig = async (content) => {
        setIsSaving(true);
        try {
            // Determine which file to save based on current view mode
            const pathToSave = viewMode === 'hooks' ? hooksFilePath : mcpFilePath;
            if (!pathToSave) {
                throw new Error('No file path available for saving');
            }
            // Write the file
            await FileSystemService.writeFile(pathToSave, content);
            // Update local state
            if (viewMode === 'mcp') {
                try {
                    const config = JSON.parse(content);
                    setMcpServers(config.mcpServers || {});
                }
                catch (parseError) {
                    console.error('Error parsing saved MCP config:', parseError);
                }
            }
            // Refresh agent status
            checkAgentStatus();
            // Exit edit mode after successful save
            setIsEditMode(false);
            setHasUnsavedChanges(false);
        }
        catch (error) {
            console.error('Error saving config file:', error);
            throw error;
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleCancel = () => {
        if (hasUnsavedChanges) {
            // Show confirmation dialog
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
            if (!confirmed) {
                return;
            }
        }
        // Exit edit mode and reset unsaved changes
        setIsEditMode(false);
        setHasUnsavedChanges(false);
        // Force re-check of configuration files to reset the view
        const checkFiles = async () => {
            try {
                // Get the agent setup status which includes the config path
                const statusResult = await AgentConfigurationService.getAgentSetupStatus(agentType);
                if (!statusResult.success || !statusResult.status) {
                    return;
                }
                const filePath = statusResult.status.configPath;
                setConfigFilePath(filePath);
                const result = await FileSystemService.readFile(filePath);
                if (result && result.content) {
                    setConfigFileExists(true);
                    setCurrentFileContent(result.content);
                    try {
                        const config = JSON.parse(result.content);
                        setMcpServers(config.mcpServers || {});
                    }
                    catch (parseError) {
                        console.error('Error parsing MCP config:', parseError);
                        setMcpServers({});
                    }
                }
            }
            catch (error) {
                console.error('Error reloading config:', error);
            }
        };
        checkFiles();
    };
    // =========================================================================
    // EFFECTS
    // =========================================================================
    const checkHooksFile = async (hooksFilePath) => {
        try {
            const fileResult = await FileSystemService.readFile(hooksFilePath);
            console.log('Hooks file content:', fileResult?.content);
            setHooksFileExists(!!fileResult?.content);
        }
        catch {
            setHooksFileExists(false);
        }
    };
    React.useEffect(() => {
        const loadHooksFilePath = async () => {
            const agentHooksFilePath = await AgentConfigurationService.getAgentHooksFilePath(agentType);
            setHooksFilePath(agentHooksFilePath);
            checkHooksFile(agentHooksFilePath);
        };
        loadHooksFilePath();
    }, [agentType]);
    // Load MCP file path
    React.useEffect(() => {
        const loadMcpFilePath = async () => {
            const agentMcpFilePath = await AgentConfigurationService.getAgentMCPFilePath(agentType);
            setMcpFilePath(agentMcpFilePath);
            // Check if MCP file exists
            try {
                const fileResult = await FileSystemService.readFile(agentMcpFilePath);
                setMcpFileExists(!!fileResult?.content);
                if (fileResult?.content) {
                    try {
                        const mcpConfig = JSON.parse(fileResult.content);
                        // For Claude, it's in projects, for others it's at root level
                        /*
                        if (agentType === 'claude') {
                          const projectPath = await fileSystem.getCurrentWorkingDirectory();
                          const projectConfig = mcpConfig.projects?.[projectPath];
                          const mcpServersFound = projectConfig?.mcpServers || {};
                          setMcpServers(mcpServersFound);
                        } else {
                        }
                         */
                        setMcpServers(mcpConfig.mcpServers || {});
                    }
                    catch (parseError) {
                        console.error('Error parsing MCP config:', parseError);
                        setMcpServers({});
                    }
                }
            }
            catch {
                setMcpFileExists(false);
            }
        };
        loadMcpFilePath();
        checkConfigFile(); // Also check config file for backwards compatibility
    }, [agentType]);
    // Load MCP status when view changes to MCP
    React.useEffect(() => {
        if (viewMode === 'mcp') {
            // All agents load their MCP status in their own components
        }
    }, [viewMode, agentType]);
    // =========================================================================
    // RENDER FUNCTIONS
    // =========================================================================
    const renderHeader = () => (_jsxs("div", { className: "p-4 border-b", style: { borderColor: theme.colors.border }, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center`, style: { backgroundColor: agentConfig.ui.color + '20' }, children: _jsx(Bot, { size: 20, style: { color: agentConfig.ui.color } }) }), _jsxs("div", { children: [_jsxs("h3", { className: "font-semibold", children: [agentConfig.displayName, " Configuration"] }), _jsx("div", { className: "text-sm", style: { color: theme.colors.textSecondary }, children: viewMode === 'install'
                                            ? `${agentConfig.displayName} ${agentStatus?.isInstalled ? 'installed' : 'not installed'}`
                                            : viewMode === 'hooks'
                                                ? agentStatus?.hasHooks
                                                    ? `${agentStatus?.hookCount} hooks configured`
                                                    : 'No hooks configured'
                                                : `${Object.keys(mcpServers).length} MCP servers` })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [viewMode !== 'install' && (_jsx("button", { onClick: () => {
                                    if (isEditMode && hasUnsavedChanges) {
                                        alert('Please save or cancel your changes before locking the configuration.');
                                        return;
                                    }
                                    setIsEditMode(!isEditMode);
                                }, className: "p-2 rounded-lg transition-colors", style: {
                                    backgroundColor: isEditMode ? `${theme.colors.warning}20` : theme.colors.backgroundSecondary,
                                    color: isEditMode ? theme.colors.warning : theme.colors.textSecondary
                                }, onMouseEnter: (e) => {
                                    if (!isEditMode) {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                        e.currentTarget.style.color = theme.colors.text;
                                    }
                                    else {
                                        e.currentTarget.style.backgroundColor = `${theme.colors.warning}30`;
                                    }
                                }, onMouseLeave: (e) => {
                                    if (!isEditMode) {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                        e.currentTarget.style.color = theme.colors.textSecondary;
                                    }
                                    else {
                                        e.currentTarget.style.backgroundColor = `${theme.colors.warning}20`;
                                    }
                                }, title: isEditMode
                                    ? hasUnsavedChanges
                                        ? 'Save or cancel changes before locking'
                                        : 'Lock configuration (disable editing)'
                                    : 'Unlock configuration (enable editing)', disabled: isSaving || (isEditMode && hasUnsavedChanges), children: isEditMode ? _jsx(Unlock, { size: 18 }) : _jsx(Lock, { size: 18 }) })), _jsx("button", { onClick: onBackToSetup, className: "p-2 rounded-lg transition-colors", style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.textSecondary
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                    e.currentTarget.style.color = theme.colors.text;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                }, title: "Return to Setup Wizard", children: _jsx(Wand2, { size: 18 }) })] })] }), _jsxs("div", { className: `flex rounded-lg p-1 ${isEditMode ? 'opacity-50' : ''}`, style: { backgroundColor: theme.colors.backgroundSecondary }, children: [_jsx("button", { onClick: () => !isEditMode && setViewMode('install'), disabled: isEditMode, className: `flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'install' ? 'text-white' : 'text-slate-400 hover:text-white'} ${isEditMode ? 'cursor-not-allowed' : ''}`, style: { backgroundColor: viewMode === 'install' ? agentConfig.ui.color : 'transparent' }, title: isEditMode ? 'Exit edit mode to switch views' : 'View installation information', children: "Install" }), _jsx("button", { onClick: () => !isEditMode && setViewMode('hooks'), disabled: isEditMode, className: `flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'hooks' ? 'text-white' : 'text-slate-400 hover:text-white'} ${isEditMode ? 'cursor-not-allowed' : ''}`, style: { backgroundColor: viewMode === 'hooks' ? agentConfig.ui.color : 'transparent' }, title: isEditMode ? 'Exit edit mode to switch views' : 'View hooks configuration', children: "Hooks" }), _jsx("button", { onClick: () => {
                            console.log('[MCP] Tab button clicked, isEditMode:', isEditMode, 'currentViewMode:', viewMode);
                            if (!isEditMode) {
                                console.log('[MCP] Setting view mode to mcp');
                                setViewMode('mcp');
                            }
                        }, disabled: isEditMode, className: `flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'mcp' ? 'text-white' : 'text-slate-400 hover:text-white'} ${isEditMode ? 'cursor-not-allowed' : ''}`, style: { backgroundColor: viewMode === 'mcp' ? agentConfig.ui.color : 'transparent' }, title: isEditMode ? 'Exit edit mode to switch views' : 'View MCP servers configuration', children: "MCP Servers" })] })] }));
    const renderEditModeWarning = () => {
        if (!isEditMode || viewMode === 'install')
            return null;
        return (_jsx("div", { className: "px-4 py-2 border-b", style: {
                backgroundColor: `${theme.colors.warning}10`,
                borderColor: `${theme.colors.warning}20`
            }, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm", style: { color: theme.colors.warning }, children: [_jsx(Unlock, { size: 16 }), _jsx("span", { children: "Configuration unlocked - editing enabled" }), hasUnsavedChanges && (_jsx("span", { className: "text-xs", style: { color: theme.colors.warning }, children: "(unsaved changes)" }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleSaveConfig(currentFileContent), disabled: !hasUnsavedChanges || isSaving, className: "px-3 py-1 text-xs rounded transition-colors", style: {
                                    backgroundColor: hasUnsavedChanges && !isSaving ? theme.colors.success : theme.colors.backgroundSecondary,
                                    color: hasUnsavedChanges && !isSaving ? '#fff' : theme.colors.textMuted,
                                    cursor: hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed'
                                }, onMouseEnter: (e) => {
                                    if (hasUnsavedChanges && !isSaving) {
                                        e.currentTarget.style.filter = 'brightness(1.1)';
                                    }
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.filter = 'brightness(1)';
                                }, title: hasUnsavedChanges ? 'Save changes (Cmd+S)' : 'No changes to save', children: isSaving ? 'Saving...' : 'Save' }), _jsx("button", { onClick: handleCancel, className: "px-3 py-1 text-xs rounded transition-colors", style: {
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.textSecondary
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                }, title: "Cancel editing and discard changes", children: "Cancel" })] })] }) }));
    };
    const renderInstallContent = () => {
        if (agentType === SupportedAgent.GEMINI || agentType === SupportedAgent.OPENCODE) {
            return (_jsx(AgentInstallationCard, { agentType: agentType, agentConfig: agentConfig, onInstallComplete: () => {
                    checkAgentStatus();
                } }));
        }
        return (_jsxs("div", { className: "text-center py-8", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("h4", { className: "text-lg font-medium text-white mb-2", children: [agentConfig.displayName, " Installation"] }), _jsx("p", { className: "text-slate-400", children: agentStatus?.isInstalled
                                ? `${agentConfig.displayName} is installed and ready to use`
                                : `${agentConfig.displayName} is not installed on this system` })] }), !agentStatus?.isInstalled && (_jsxs("button", { onClick: () => window.open(agentConfig.ui.downloadUrl, '_blank'), className: `px-4 py-2 text-white rounded-md transition-colors`, style: { backgroundColor: agentConfig.ui.color }, children: ["Download ", agentConfig.displayName] }))] }));
    };
    const [hooksGridKey, setHooksGridKey] = React.useState(0);
    const renderHooksContent = () => {
        if (!agentStatus?.isInstalled) {
            return (_jsxs("div", { className: "text-center py-8", children: [_jsxs("p", { className: "text-slate-400 mb-4", children: [agentConfig.displayName, " is not installed"] }), _jsx("button", { onClick: () => setViewMode('install'), className: `px-4 py-2 text-white rounded-md transition-colors`, style: { backgroundColor: agentConfig.ui.color }, children: "Go to Install Tab" })] }));
        }
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex justify-between items-center p-4 rounded-lg", style: { backgroundColor: theme.colors.backgroundSecondary }, children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-white", children: "Quick Toggle" }), _jsx("p", { className: "text-sm text-slate-400 mt-1", children: "Enable or disable all hooks at once" })] }), _jsx(HooksToggle, { hooksEnabled: agentStatus?.hasHooks ?? false, agentType: agentType, onToggle: () => {
                                checkAgentStatus();
                                // Force HooksGrid to reload by changing its key
                                setHooksGridKey(prev => prev + 1);
                            } })] }), _jsx(HooksGrid, { agentType: agentType, color: agentConfig.ui.color, onHooksChange: () => checkAgentStatus(), layout: "list" }, hooksGridKey)] }));
    };
    const renderMCPContent = () => {
        console.log('[MCP] renderMCPContent called for agentType:', agentType);
        if (agentType === 'claude') {
            console.log('[MCP] Rendering Claude MCP content');
            return _jsx(ClaudeMCPContent, {});
        }
        else if (agentType === 'gemini') {
            console.log('[MCP] Rendering Gemini MCP content');
            return _jsx(GeminiMCPContent, {});
        }
        else if (agentType === 'opencode') {
            console.log('[MCP] Rendering OpenCode MCP content');
            return _jsx(OpenCodeMCPContent, {});
        }
        console.log('[MCP] Unknown agent type, returning null');
        return null;
    };
    // Claude-specific MCP content - simplified like Gemini/OpenCode
    const ClaudeMCPContent = () => {
        const [claudeMCPStatus, setClaudeMCPStatus] = React.useState({ hasPrincipleMD: false, mcpServers: {} });
        const [isTogglingClaudeMCP, setIsTogglingClaudeMCP] = React.useState(false);
        React.useEffect(() => {
            loadClaudeMCPStatus();
        }, []);
        const loadClaudeMCPStatus = async () => {
            console.log('[MCP] Loading Claude MCP status...');
            try {
                const mcpResult = await AgentConfigurationService.getAgentMCPStatus(SupportedAgent.CLAUDE);
                console.log('[MCP] Claude MCP status result:', mcpResult);
                if (mcpResult.success && mcpResult.status) {
                    setClaudeMCPStatus({
                        hasPrincipleMD: mcpResult.status.hasMCP,
                        mcpServers: {} // We don't need detailed servers list for now
                    });
                }
            }
            catch (error) {
                console.error('[MCP] Error loading Claude MCP status:', error);
            }
        };
        const handleToggleClaudeMCP = async () => {
            console.log('[MCP] Toggle Claude MCP clicked, current status:', claudeMCPStatus.hasPrincipleMD);
            setIsTogglingClaudeMCP(true);
            try {
                if (claudeMCPStatus.hasPrincipleMD) {
                    console.log('[MCP] Removing MCP from Claude...');
                    const result = await AgentConfigurationService.removeMCPFromAgent(SupportedAgent.CLAUDE);
                    console.log('[MCP] Remove result:', result);
                    if (result.success) {
                        await loadClaudeMCPStatus();
                        checkConfigFile();
                    }
                }
                else {
                    console.log('[MCP] Adding MCP to Claude...');
                    const result = await AgentConfigurationService.addMCPToAgent(SupportedAgent.CLAUDE);
                    console.log('[MCP] Add result:', result);
                    if (result.success) {
                        await loadClaudeMCPStatus();
                        checkConfigFile();
                    }
                }
            }
            catch (error) {
                console.error('[MCP] Error toggling Claude MCP:', error);
            }
            finally {
                setIsTogglingClaudeMCP(false);
            }
        };
        return (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between p-4 rounded-lg border-2 transition-colors", style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: claudeMCPStatus.hasPrincipleMD ? agentConfig.ui.color : 'transparent'
                }, children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-white", children: "Principle MD MCP Server" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: claudeMCPStatus.hasPrincipleMD ? 'Enabled in ~/.claude.json' : 'Not configured' })] }), _jsx("button", { onClick: handleToggleClaudeMCP, disabled: isTogglingClaudeMCP, className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isTogglingClaudeMCP ? 'opacity-50 cursor-not-allowed' : ''}`, style: {
                            backgroundColor: claudeMCPStatus.hasPrincipleMD
                                ? theme.colors.error
                                : theme.colors.success,
                            color: 'white',
                        }, children: isTogglingClaudeMCP ? 'Processing...' : claudeMCPStatus.hasPrincipleMD ? 'Disable' : 'Enable' })] }) }));
    };
    // Gemini-specific MCP content
    // OpenCode-specific MCP content
    const OpenCodeMCPContent = () => {
        const [openCodeMCPStatus, setOpenCodeMCPStatus] = React.useState({ hasPrincipleMD: false, mcpServers: {} });
        const [isTogglingOpenCodeMCP, setIsTogglingOpenCodeMCP] = React.useState(false);
        React.useEffect(() => {
            loadOpenCodeMCPStatus();
        }, []);
        const loadOpenCodeMCPStatus = async () => {
            console.log('[MCP] Loading OpenCode MCP status...');
            try {
                const mcpResult = await AgentConfigurationService.getAgentMCPStatus(SupportedAgent.OPENCODE);
                console.log('[MCP] OpenCode MCP status result:', mcpResult);
                if (mcpResult.success && mcpResult.status) {
                    setOpenCodeMCPStatus({
                        hasPrincipleMD: mcpResult.status.hasMCP,
                        mcpServers: {} // We don't need detailed servers list for now
                    });
                    console.log('[MCP] OpenCode MCP status updated:', {
                        hasPrincipleMD: mcpResult.status.hasMCP
                    });
                }
                else {
                    console.log('[MCP] Failed to get OpenCode MCP status:', mcpResult.error);
                }
            }
            catch (error) {
                console.error('[MCP] Error loading OpenCode MCP status:', error);
            }
        };
        const handleToggleOpenCodeMCP = async () => {
            console.log('[MCP] Toggle OpenCode MCP clicked, current status:', openCodeMCPStatus.hasPrincipleMD);
            setIsTogglingOpenCodeMCP(true);
            try {
                if (openCodeMCPStatus.hasPrincipleMD) {
                    console.log('[MCP] Removing MCP from OpenCode...');
                    const result = await AgentConfigurationService.removeMCPFromAgent(SupportedAgent.OPENCODE);
                    console.log('[MCP] Remove result:', result);
                    if (result.success) {
                        await loadOpenCodeMCPStatus();
                        await checkAgentStatus();
                    }
                }
                else {
                    console.log('[MCP] Adding MCP to OpenCode...');
                    const result = await AgentConfigurationService.addMCPToAgent(SupportedAgent.OPENCODE);
                    console.log('[MCP] Add result:', result);
                    if (result.success) {
                        await loadOpenCodeMCPStatus();
                        await checkAgentStatus();
                    }
                }
            }
            catch (error) {
                console.error('[MCP] Error toggling OpenCode MCP:', error);
            }
            finally {
                setIsTogglingOpenCodeMCP(false);
            }
        };
        return (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between p-4 rounded-lg border-2 transition-colors", style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: openCodeMCPStatus.hasPrincipleMD ? agentConfig.ui.color : 'transparent'
                }, children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-white", children: "Principle MD MCP Server" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: openCodeMCPStatus.hasPrincipleMD ? 'Enabled in ~/.config/openCode/openCode.json' : 'Not configured' })] }), _jsx("button", { onClick: handleToggleOpenCodeMCP, disabled: isTogglingOpenCodeMCP, className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isTogglingOpenCodeMCP ? 'opacity-50 cursor-not-allowed' : ''}`, style: {
                            backgroundColor: openCodeMCPStatus.hasPrincipleMD
                                ? theme.colors.error
                                : theme.colors.success,
                            color: 'white',
                        }, children: isTogglingOpenCodeMCP ? 'Processing...' : openCodeMCPStatus.hasPrincipleMD ? 'Disable' : 'Enable' })] }) }));
    };
    const GeminiMCPContent = () => {
        const [geminiMCPStatusLocal, setGeminiMCPStatusLocal] = React.useState({
            hasPrincipleMD: false,
            mcpServers: {}
        });
        const [isTogglingGeminiMCPLocal, setIsTogglingGeminiMCPLocal] = React.useState(false);
        React.useEffect(() => {
            loadGeminiMCPStatusLocal();
        }, []);
        const loadGeminiMCPStatusLocal = async () => {
            try {
                const mcpResult = await AgentConfigurationService.getAgentMCPStatus(SupportedAgent.GEMINI);
                if (mcpResult.success && mcpResult.status) {
                    setGeminiMCPStatusLocal({
                        hasPrincipleMD: mcpResult.status.hasMCP,
                        mcpServers: {} // We don't need detailed servers list for now
                    });
                }
            }
            catch (error) {
                console.error('Error loading Gemini MCP status:', error);
            }
        };
        const handleToggleGeminiMCPLocal = async () => {
            setIsTogglingGeminiMCPLocal(true);
            try {
                if (geminiMCPStatusLocal.hasPrincipleMD) {
                    const result = await AgentConfigurationService.removeMCPFromAgent(SupportedAgent.GEMINI);
                    if (result.success) {
                        await loadGeminiMCPStatusLocal();
                        checkConfigFile();
                    }
                    else {
                        alert(`Failed to disable MCP: ${result.error}`);
                    }
                }
                else {
                    const result = await AgentConfigurationService.addMCPToAgent(SupportedAgent.GEMINI);
                    if (result.success) {
                        await loadGeminiMCPStatusLocal();
                        checkConfigFile();
                    }
                    else {
                        alert(`Failed to enable MCP: ${result.error}`);
                    }
                }
            }
            catch (error) {
                alert(`Error ${geminiMCPStatusLocal.hasPrincipleMD ? 'disabling' : 'enabling'} MCP for Gemini`);
            }
            finally {
                setIsTogglingGeminiMCPLocal(false);
            }
        };
        return (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between p-4 rounded-lg border-2 transition-colors", style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: geminiMCPStatusLocal.hasPrincipleMD ? agentConfig.ui.color : 'transparent'
                }, children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-white", children: "Principle MD MCP Server" }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: geminiMCPStatusLocal.hasPrincipleMD ? 'Enabled in ~/.gemini/settings.json' : 'Not configured' })] }), _jsx("button", { onClick: handleToggleGeminiMCPLocal, disabled: isTogglingGeminiMCPLocal, className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isTogglingGeminiMCPLocal ? 'opacity-50 cursor-not-allowed' : ''}`, style: {
                            backgroundColor: geminiMCPStatusLocal.hasPrincipleMD
                                ? theme.colors.error
                                : theme.colors.success,
                            color: 'white',
                        }, children: isTogglingGeminiMCPLocal ? 'Processing...' : geminiMCPStatusLocal.hasPrincipleMD ? 'Disable' : 'Enable' })] }) }));
    };
    // =========================================================================
    // LEFT PANEL
    // =========================================================================
    const leftPanel = (_jsxs("div", { className: "flex flex-col h-full", children: [renderHeader(), renderEditModeWarning(), _jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [viewMode === 'install' && renderInstallContent(), viewMode === 'hooks' && renderHooksContent(), viewMode === 'mcp' && renderMCPContent()] })] }));
    // =========================================================================
    // RIGHT PANEL
    // =========================================================================
    const rightPanel = (_jsx("div", { className: "flex flex-col h-full", children: (() => {
            // For install view, show installation details
            if (viewMode === 'install') {
                return _jsx(InstallationDetailsPanel, { theme: theme, agentConfig: agentConfig, agentStatus: agentStatus, agentType: agentType, configFilePath: configFilePath, hooksFilePath: hooksFilePath });
            }
            // For hooks and mcp views, show file viewer
            const showHooksFile = viewMode === 'hooks';
            const fileExists = showHooksFile ? hooksFileExists : mcpFileExists;
            const filePath = showHooksFile ? hooksFilePath : mcpFilePath;
            const fileTitle = showHooksFile
                ? `${agentConfig.name} Hooks Settings`
                : `${agentConfig.name} Configuration`;
            const fileDescription = showHooksFile
                ? 'This file contains hook configurations'
                : 'This file will be created when you configure MCP servers';
            if (fileExists) {
                return (_jsx(WatchingFileViewer, { filePath: filePath, className: "h-full", editable: isEditMode, onSave: handleSaveConfig, onModifiedChange: setHasUnsavedChanges, onContentChange: setCurrentFileContent, hideInternalSaveButton: true }));
            }
            return _jsx(FileNotFoundPanel, { theme: theme, fileTitle: fileTitle, fileDescription: fileDescription, filePath: filePath, onRefresh: async () => {
                    checkAgentStatus();
                } });
        })() }));
    // =========================================================================
    // SUB-COMPONENTS
    // =========================================================================
    // =========================================================================
    // MAIN RENDER
    // =========================================================================
    return (_jsx(AnimatedResizableLayout, { leftPanel: leftPanel, rightPanel: rightPanel, defaultSize: 50, minSize: 20 }));
};
const InstallationDetailsPanel = ({ theme, agentConfig, agentStatus, agentType, configFilePath, hooksFilePath }) => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-4 border-b", style: { borderColor: theme.colors.border }, children: [_jsx("h3", { className: "font-semibold mb-1", style: { color: theme.colors.text }, children: "Installation Details" }), _jsxs("div", { className: "text-sm", style: { color: theme.colors.textSecondary }, children: [agentConfig.displayName, " setup and configuration information"] })] }), _jsx("div", { className: "flex-1 p-6 overflow-y-auto", children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-3", style: { color: theme.colors.textSecondary }, children: "Installation Status" }), _jsx("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.backgroundSecondary }, children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-3 h-3 rounded-full", style: { backgroundColor: agentStatus?.isInstalled ? theme.colors.success : theme.colors.muted } }), _jsx("span", { style: { color: theme.colors.text }, children: agentStatus?.isInstalled ? 'Installed' : 'Not Installed' })] }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-3", style: { color: theme.colors.textSecondary }, children: "Installation Instructions" }), _jsx("div", { className: "rounded-lg p-4 space-y-3", style: { backgroundColor: theme.colors.backgroundSecondary }, children: agentType === SupportedAgent.GEMINI || agentType === SupportedAgent.OPENCODE ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", style: { color: theme.colors.text }, children: [window.appName, " provides a custom ", agentConfig.displayName, " CLI with built-in hooks support."] }), _jsxs("p", { className: "text-sm", style: { color: theme.colors.text }, children: ["Use the installation card on the left to manage your ", agentConfig.displayName, " CLI installation."] })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", style: { color: theme.colors.text }, children: ["1. Download ", agentConfig.displayName, " from the official website"] }), _jsx("p", { className: "text-sm", style: { color: theme.colors.text }, children: "2. Install the application following the standard installation process" }), _jsx("p", { className: "text-sm", style: { color: theme.colors.text }, children: "3. Once installed, return here to configure hooks and MCP servers" })] })) })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-3", style: { color: theme.colors.textSecondary }, children: "Configuration Paths" }), _jsxs("div", { className: "rounded-lg p-4 space-y-3", style: { backgroundColor: theme.colors.backgroundSecondary }, children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs mb-1", style: { color: theme.colors.textSecondary }, children: "Settings Path:" }), _jsx("code", { className: "text-xs", style: { color: theme.colors.success }, children: configFilePath })] }), hooksFilePath && (_jsxs("div", { children: [_jsx("p", { className: "text-xs mb-1", style: { color: theme.colors.textSecondary }, children: "Hooks Path:" }), _jsx("code", { className: "text-xs", style: { color: theme.colors.success }, children: hooksFilePath })] }))] })] }), !agentStatus?.isInstalled && (agentType !== SupportedAgent.GEMINI && agentType !== SupportedAgent.OPENCODE) && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium mb-3", style: { color: theme.colors.textSecondary }, children: "Download" }), _jsx("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.backgroundSecondary }, children: _jsxs("button", { onClick: () => window.open(agentConfig.ui.downloadUrl, '_blank'), className: "w-full px-4 py-2 text-white rounded-md transition-colors flex items-center justify-center gap-2", style: { backgroundColor: agentConfig.ui.color }, children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }), "Open Download Page"] }) })] }))] }) })] }));
const FileNotFoundPanel = ({ theme, fileTitle, fileDescription, filePath, onRefresh }) => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-4 border-b", style: { borderColor: theme.colors.border }, children: [_jsx("h3", { className: "font-semibold mb-1", children: fileTitle }), _jsx("div", { className: "text-sm text-slate-400", children: "No configuration file found" })] }), _jsx("div", { className: "flex-1 p-6", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-slate-300 mb-2", children: "File Path:" }), _jsx("code", { className: "block text-xs rounded p-3", style: { backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textSecondary }, children: filePath })] }), _jsx("div", { className: "pt-4", children: _jsxs("div", { className: "p-4 rounded-lg", style: {
                                backgroundColor: `${theme.colors.warning}20`,
                                border: `1px solid ${theme.colors.warning}30`
                            }, children: [_jsxs("div", { className: "flex items-center gap-2", style: { color: theme.colors.warning }, children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }), _jsx("span", { className: "font-medium", children: "Configuration file not found" })] }), _jsx("p", { className: "text-sm text-slate-300 mt-2", children: fileDescription })] }) }), _jsx("div", { className: "pt-4", children: _jsx("button", { onClick: onRefresh, className: "text-sm text-slate-400 hover:text-white transition-colors", children: "Refresh Status" }) })] }) })] }));
