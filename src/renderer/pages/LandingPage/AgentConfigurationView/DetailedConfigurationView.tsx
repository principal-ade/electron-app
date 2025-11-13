import React, { useEffect } from 'react';
import { Bot, Lock, Unlock, Wand2 } from 'lucide-react';

import {
  AgentInfo,
  getAgentInfo,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';

import type { Theme } from '@a24z/industry-theme';
import { useTheme } from '@a24z/industry-theme';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';

import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';

import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';

import { HooksGrid } from './HooksGrid';
import { HooksToggle } from './HooksToggle';
import { HeadlessFileEditorPanel } from '../../../panels/components/HeadlessFileEditorPanel';

// =============================================================================
// TYPES
// =============================================================================

interface DetailedConfigurationViewProps {
  agentType: SupportedAgent;
  initialAgentStatus: AgentSetupStatus;
  checkAgentStatus: () => Promise<void>;
  onBackToSetup?: () => void;
}

type ViewMode = 'hooks' | 'mcp' | 'install';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const DetailedConfigurationView: React.FC<
  DetailedConfigurationViewProps
> = ({ agentType, initialAgentStatus, checkAgentStatus, onBackToSetup }) => {
  const { theme } = useTheme();
  const agentConfig = getAgentInfo(agentType);

  // =========================================================================
  // STATE - View Control
  // =========================================================================
  const [agentStatus, setAgentStatus] =
    React.useState<AgentSetupStatus>(initialAgentStatus);
  const [viewMode, setViewMode] = React.useState<ViewMode>('hooks');
  const [isEditMode, setIsEditMode] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] =
    React.useState<boolean>(false);
  const [currentFileContent, setCurrentFileContent] =
    React.useState<string>('');

  // =========================================================================
  // STATE - File Management
  // =========================================================================
  const [configFileExists, setConfigFileExists] =
    React.useState<boolean>(false);
  const [configFilePath, setConfigFilePath] = React.useState<string>('');
  const [hooksFilePath, setHooksFilePath] = React.useState<string>('');
  const [hooksFileExists, setHooksFileExists] = React.useState<boolean>(false);
  const [mcpFilePath, setMcpFilePath] = React.useState<string>('');
  const [mcpFileExists, setMcpFileExists] = React.useState<boolean>(false);

  // =========================================================================
  // STATE - MCP Configuration
  // =========================================================================
  const [mcpServers, setMcpServers] = React.useState<any>({});

  // =========================================================================
  // FILE CHECKING FUNCTIONS
  // =========================================================================
  useEffect(() => {
    setAgentStatus(initialAgentStatus);
  }, [initialAgentStatus]);

  const checkConfigFile = async () => {
    try {
      // Get the MCP file path for MCP-specific operations
      const mcpPathResult =
        await AgentConfigurationService.getAgentMCPFilePath(agentType);
      const mcpPath = mcpPathResult;
      setMcpFilePath(mcpPath);

      // Get the agent setup status which includes the config path
      const statusResult =
        await AgentConfigurationService.getAgentSetupStatus(agentType);
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
        } catch (parseError) {
          console.error('Error parsing MCP config:', parseError);
          setMcpServers({});
        }
      } else {
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
        } catch (parseError) {
          console.error('Error parsing MCP config:', parseError);
          setMcpServers({});
        }
      } else {
        setConfigFileExists(false);
        setMcpServers({});
      }
    } catch (error) {
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

  const handleSaveConfig = async (content: string) => {
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
        } catch (parseError) {
          console.error('Error parsing saved MCP config:', parseError);
        }
      }

      // Refresh agent status
      checkAgentStatus();

      // Exit edit mode after successful save
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving config file:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?',
      );
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
        const statusResult =
          await AgentConfigurationService.getAgentSetupStatus(agentType);
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
          } catch (parseError) {
            console.error('Error parsing MCP config:', parseError);
            setMcpServers({});
          }
        }
      } catch (error) {
        console.error('Error reloading config:', error);
      }
    };

    checkFiles();
  };

  // =========================================================================
  // EFFECTS
  // =========================================================================
  const checkHooksFile = async (hooksFilePath: string) => {
    try {
      const fileResult = await FileSystemService.readFile(hooksFilePath);
      console.log('Hooks file content:', fileResult?.content);
      setHooksFileExists(!!fileResult?.content);
    } catch {
      setHooksFileExists(false);
    }
  };

  React.useEffect(() => {
    const loadHooksFilePath = async () => {
      const agentHooksFilePath =
        await AgentConfigurationService.getAgentHooksFilePath(agentType);
      setHooksFilePath(agentHooksFilePath);
      checkHooksFile(agentHooksFilePath);
    };
    loadHooksFilePath();
  }, [agentType]);

  // Load MCP file path
  React.useEffect(() => {
    const loadMcpFilePath = async () => {
      const agentMcpFilePath =
        await AgentConfigurationService.getAgentMCPFilePath(agentType);
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
          } catch (parseError) {
            console.error('Error parsing MCP config:', parseError);
            setMcpServers({});
          }
        }
      } catch {
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

  const renderHeader = () => (
    <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center`}
            style={{ backgroundColor: agentConfig.ui.color + '20' }}
          >
            <Bot size={20} style={{ color: agentConfig.ui.color }} />
          </div>
          <div>
            <h3 className="font-semibold">
              {agentConfig.displayName} Configuration
            </h3>
            <div
              className="text-sm"
              style={{ color: theme.colors.textSecondary }}
            >
              {viewMode === 'install'
                ? `${agentConfig.displayName} ${agentStatus?.isInstalled ? 'installed' : 'not installed'}`
                : viewMode === 'hooks'
                  ? agentStatus?.hasHooks
                    ? `${agentStatus?.hookCount} hooks configured`
                    : 'No hooks configured'
                  : `${Object.keys(mcpServers).length} MCP servers`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit mode lock button - only show when not in install view */}
          {viewMode !== 'install' && (
            <button
              onClick={() => {
                if (isEditMode && hasUnsavedChanges) {
                  alert(
                    'Please save or cancel your changes before locking the configuration.',
                  );
                  return;
                }
                setIsEditMode(!isEditMode);
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: isEditMode
                  ? `${theme.colors.warning}20`
                  : theme.colors.backgroundSecondary,
                color: isEditMode
                  ? theme.colors.warning
                  : theme.colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                if (!isEditMode) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                  e.currentTarget.style.color = theme.colors.text;
                } else {
                  e.currentTarget.style.backgroundColor = `${theme.colors.warning}30`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isEditMode) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                } else {
                  e.currentTarget.style.backgroundColor = `${theme.colors.warning}20`;
                }
              }}
              title={
                isEditMode
                  ? hasUnsavedChanges
                    ? 'Save or cancel changes before locking'
                    : 'Lock configuration (disable editing)'
                  : 'Unlock configuration (enable editing)'
              }
              disabled={isSaving || (isEditMode && hasUnsavedChanges)}
            >
              {isEditMode ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
          )}
          {/* Setup Wizard button */}
          <button
            onClick={onBackToSetup}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.textSecondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundHover;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Return to Setup Wizard"
          >
            <Wand2 size={18} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className={`flex rounded-lg p-1 ${isEditMode ? 'opacity-50' : ''}`}
        style={{ backgroundColor: theme.colors.backgroundSecondary }}
      >
        <button
          onClick={() => !isEditMode && setViewMode('install')}
          disabled={isEditMode}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'install'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          } ${isEditMode ? 'cursor-not-allowed' : ''}`}
          style={{
            backgroundColor:
              viewMode === 'install' ? agentConfig.ui.color : 'transparent',
          }}
          title={
            isEditMode
              ? 'Exit edit mode to switch views'
              : 'View installation information'
          }
        >
          Install
        </button>
        <button
          onClick={() => !isEditMode && setViewMode('hooks')}
          disabled={isEditMode}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'hooks'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          } ${isEditMode ? 'cursor-not-allowed' : ''}`}
          style={{
            backgroundColor:
              viewMode === 'hooks' ? agentConfig.ui.color : 'transparent',
          }}
          title={
            isEditMode
              ? 'Exit edit mode to switch views'
              : 'View hooks configuration'
          }
        >
          Hooks
        </button>
        <button
          onClick={() => {
            console.log(
              '[MCP] Tab button clicked, isEditMode:',
              isEditMode,
              'currentViewMode:',
              viewMode,
            );
            if (!isEditMode) {
              console.log('[MCP] Setting view mode to mcp');
              setViewMode('mcp');
            }
          }}
          disabled={isEditMode}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'mcp'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          } ${isEditMode ? 'cursor-not-allowed' : ''}`}
          style={{
            backgroundColor:
              viewMode === 'mcp' ? agentConfig.ui.color : 'transparent',
          }}
          title={
            isEditMode
              ? 'Exit edit mode to switch views'
              : 'View MCP servers configuration'
          }
        >
          MCP Servers
        </button>
      </div>
    </div>
  );

  const renderEditModeWarning = () => {
    if (!isEditMode || viewMode === 'install') return null;

    return (
      <div
        className="px-4 py-2 border-b"
        style={{
          backgroundColor: `${theme.colors.warning}10`,
          borderColor: `${theme.colors.warning}20`,
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: theme.colors.warning }}
          >
            <Unlock size={16} />
            <span>Configuration unlocked - editing enabled</span>
            {hasUnsavedChanges && (
              <span className="text-xs" style={{ color: theme.colors.warning }}>
                (unsaved changes)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSaveConfig(currentFileContent)}
              disabled={!hasUnsavedChanges || isSaving}
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor:
                  hasUnsavedChanges && !isSaving
                    ? theme.colors.success
                    : theme.colors.backgroundSecondary,
                color:
                  hasUnsavedChanges && !isSaving
                    ? '#fff'
                    : theme.colors.textMuted,
                cursor:
                  hasUnsavedChanges && !isSaving ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={(e) => {
                if (hasUnsavedChanges && !isSaving) {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
              }}
              title={
                hasUnsavedChanges
                  ? 'Save changes (Cmd+S)'
                  : 'No changes to save'
              }
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
              }}
              title="Cancel editing and discard changes"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInstallContent = () => {
    return (
      <div className="text-center py-8">
        <div className="mb-6">
          <h4 className="text-lg font-medium text-white mb-2">
            {agentConfig.displayName} Installation
          </h4>
          <p className="text-slate-400">
            {agentStatus?.isInstalled
              ? `${agentConfig.displayName} is installed and ready to use`
              : `${agentConfig.displayName} is not installed on this system`}
          </p>
        </div>
        {!agentStatus?.isInstalled && (
          <button
            onClick={() => window.open(agentConfig.ui.downloadUrl, '_blank')}
            className={`px-4 py-2 text-white rounded-md transition-colors`}
            style={{ backgroundColor: agentConfig.ui.color }}
          >
            Download {agentConfig.displayName}
          </button>
        )}
      </div>
    );
  };

  const [hooksGridKey, setHooksGridKey] = React.useState(0);

  const renderHooksContent = () => {
    if (!agentStatus?.isInstalled) {
      return (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">
            {agentConfig.displayName} is not installed
          </p>
          <button
            onClick={() => setViewMode('install')}
            className={`px-4 py-2 text-white rounded-md transition-colors`}
            style={{ backgroundColor: agentConfig.ui.color }}
          >
            Go to Install Tab
          </button>
        </div>
      );
    }

    // Special handling for OpenCode - show plugin status instead of hooks
    if (agentType === 'opencode') {
      return (
        <div className="space-y-4">
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: theme.colors.backgroundSecondary }}
          >
            <div className="flex items-start gap-4">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${agentConfig.ui.color}20` }}
              >
                <Wand2 size={24} color={agentConfig.ui.color} />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-white mb-2">
                  OpenCode Plugin System
                </h4>
                <p className="text-sm text-slate-400 mb-4">
                  OpenCode uses a plugin-based monitoring system instead of
                  traditional hooks. The plugin provides better integration and
                  performance.
                </p>
                <div
                  className="flex items-center gap-2 p-3 rounded-md"
                  style={{ backgroundColor: theme.colors.background }}
                >
                  {agentStatus?.hasHooks ? (
                    <>
                      <Unlock size={16} className="text-green-500" />
                      <span className="text-sm text-green-500">
                        Plugin is installed and active
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} className="text-slate-400" />
                      <span className="text-sm text-slate-400">
                        Plugin is not installed
                      </span>
                    </>
                  )}
                </div>
                {!agentStatus?.hasHooks && (
                  <p className="text-xs text-slate-500 mt-3">
                    To install the plugin, use the OpenCode extension manager or
                    run:
                    <code className="block mt-1 p-2 bg-black/20 rounded text-blue-400">
                      opencode --install-plugin principal-monitoring
                    </code>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Regular hooks UI for Claude and other agents
    return (
      <div className="space-y-4">
        <div
          className="flex justify-between items-center p-4 rounded-lg"
          style={{ backgroundColor: theme.colors.backgroundSecondary }}
        >
          <div>
            <h4 className="font-medium text-white">Quick Toggle</h4>
            <p className="text-sm text-slate-400 mt-1">
              Enable or disable all hooks at once
            </p>
          </div>
          <HooksToggle
            hooksEnabled={agentStatus?.hasHooks ?? false}
            agentType={agentType}
            onToggle={() => {
              checkAgentStatus();
              // Force HooksGrid to reload by changing its key
              setHooksGridKey((prev) => prev + 1);
            }}
          />
        </div>
        <HooksGrid
          key={hooksGridKey}
          agentType={agentType}
          color={agentConfig.ui.color}
          onHooksChange={() => checkAgentStatus()}
          layout="list"
        />
      </div>
    );
  };

  const renderMCPContent = () => {
    console.log('[MCP] renderMCPContent called for agentType:', agentType);
    if (agentType === 'claude') {
      console.log('[MCP] Rendering Claude MCP content');
      return <ClaudeMCPContent />;
    } else if (agentType === 'cline') {
      console.log('[MCP] Rendering Cline MCP content');
      return <ClineMCPContent />;
    } else if (agentType === 'opencode') {
      console.log('[MCP] Rendering OpenCode MCP content');
      return <OpenCodeMCPContent />;
    } else if (agentType === 'droid') {
      console.log('[MCP] Rendering Droid MCP content');
      return <DroidMCPContent />;
    }
    console.log('[MCP] Unknown agent type, returning null');
    return null;
  };

  // Claude-specific MCP content - simplified like OpenCode
  const ClaudeMCPContent = () => {
    const [claudeMCPStatus, setClaudeMCPStatus] = React.useState<{
      hasPrincipleMD: boolean;
      mcpServers: Record<string, any>;
    }>({ hasPrincipleMD: false, mcpServers: {} });
    const [isTogglingClaudeMCP, setIsTogglingClaudeMCP] = React.useState(false);

    React.useEffect(() => {
      loadClaudeMCPStatus();
    }, []);

    const loadClaudeMCPStatus = async () => {
      console.log('[MCP] Loading Claude MCP status...');
      try {
        const mcpResult = await AgentConfigurationService.getAgentMCPStatus(
          SupportedAgent.CLAUDE,
        );
        console.log('[MCP] Claude MCP status result:', mcpResult);
        if (mcpResult.success && mcpResult.status) {
          setClaudeMCPStatus({
            hasPrincipleMD: mcpResult.status.hasMCP,
            mcpServers: {}, // We don't need detailed servers list for now
          });
        }
      } catch (error) {
        console.error('[MCP] Error loading Claude MCP status:', error);
      }
    };

    const handleToggleClaudeMCP = async () => {
      console.log(
        '[MCP] Toggle Claude MCP clicked, current status:',
        claudeMCPStatus.hasPrincipleMD,
      );
      setIsTogglingClaudeMCP(true);
      try {
        if (claudeMCPStatus.hasPrincipleMD) {
          console.log('[MCP] Removing MCP from Claude...');
          const result = await AgentConfigurationService.removeMCPFromAgent(
            SupportedAgent.CLAUDE,
          );
          console.log('[MCP] Remove result:', result);
          if (result.success) {
            await loadClaudeMCPStatus();
            checkConfigFile();
          }
        } else {
          console.log('[MCP] Adding MCP to Claude...');
          const result = await AgentConfigurationService.addMCPToAgent(
            SupportedAgent.CLAUDE,
          );
          console.log('[MCP] Add result:', result);
          if (result.success) {
            await loadClaudeMCPStatus();
            checkConfigFile();
          }
        }
      } catch (error) {
        console.error('[MCP] Error toggling Claude MCP:', error);
      } finally {
        setIsTogglingClaudeMCP(false);
      }
    };

    return (
      <div className="p-4">
        <div
          className="flex items-center justify-between p-4 rounded-lg border-2 transition-colors"
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: claudeMCPStatus.hasPrincipleMD
              ? agentConfig.ui.color
              : 'transparent',
          }}
        >
          <div className="flex-1">
            <h4 className="font-medium text-white">Principle MD MCP Server</h4>
            <p className="text-xs text-slate-400 mt-1">
              {claudeMCPStatus.hasPrincipleMD
                ? 'Enabled in ~/.claude.json'
                : 'Not configured'}
            </p>
          </div>
          <button
            onClick={handleToggleClaudeMCP}
            disabled={isTogglingClaudeMCP}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isTogglingClaudeMCP ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: claudeMCPStatus.hasPrincipleMD
                ? theme.colors.error
                : theme.colors.success,
              color: 'white',
            }}
          >
            {isTogglingClaudeMCP
              ? 'Processing...'
              : claudeMCPStatus.hasPrincipleMD
                ? 'Disable'
                : 'Enable'}
          </button>
        </div>
      </div>
    );
  };

  // Cline-specific MCP content - similar to Claude
  const ClineMCPContent = () => {
    const [clineMCPStatus, setClineMCPStatus] = React.useState<{
      hasPrincipleMD: boolean;
      mcpServers: Record<string, any>;
    }>({ hasPrincipleMD: false, mcpServers: {} });
    const [isTogglingClineMCP, setIsTogglingClineMCP] = React.useState(false);

    React.useEffect(() => {
      loadClineMCPStatus();
    }, []);

    const loadClineMCPStatus = async () => {
      console.log('[MCP] Loading Cline MCP status...');
      try {
        const mcpResult = await AgentConfigurationService.getAgentMCPStatus(
          SupportedAgent.CLINE,
        );
        console.log('[MCP] Cline MCP status result:', mcpResult);
        if (mcpResult.success && mcpResult.status) {
          setClineMCPStatus({
            hasPrincipleMD: mcpResult.status.hasMCP,
            mcpServers: {}, // We don't need detailed servers list for now
          });
        }
      } catch (error) {
        console.error('[MCP] Error loading Cline MCP status:', error);
      }
    };

    const handleToggleClineMCP = async () => {
      console.log(
        '[MCP] Toggle Cline MCP clicked, current status:',
        clineMCPStatus.hasPrincipleMD,
      );
      setIsTogglingClineMCP(true);
      try {
        if (clineMCPStatus.hasPrincipleMD) {
          console.log('[MCP] Removing MCP from Cline...');
          const result = await AgentConfigurationService.removeMCPFromAgent(
            SupportedAgent.CLINE,
          );
          console.log('[MCP] Remove result:', result);
          if (result.success) {
            await loadClineMCPStatus();
            checkConfigFile();
          }
        } else {
          console.log('[MCP] Adding MCP to Cline...');
          const result = await AgentConfigurationService.addMCPToAgent(
            SupportedAgent.CLINE,
          );
          console.log('[MCP] Add result:', result);
          if (result.success) {
            await loadClineMCPStatus();
            checkConfigFile();
          }
        }
      } catch (error) {
        console.error('[MCP] Error toggling Cline MCP:', error);
      } finally {
        setIsTogglingClineMCP(false);
      }
    };

    return (
      <div className="p-4">
        <div
          className="flex items-center justify-between p-4 rounded-lg border-2 transition-colors"
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: clineMCPStatus.hasPrincipleMD
              ? agentConfig.ui.color
              : 'transparent',
          }}
        >
          <div className="flex-1">
            <h4 className="font-medium text-white">Principle MD MCP Server</h4>
            <p className="text-xs text-slate-400 mt-1">
              {clineMCPStatus.hasPrincipleMD
                ? 'Enabled in Cline settings'
                : 'Not configured'}
            </p>
          </div>
          <button
            onClick={handleToggleClineMCP}
            disabled={isTogglingClineMCP}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isTogglingClineMCP ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: clineMCPStatus.hasPrincipleMD
                ? theme.colors.error
                : theme.colors.success,
              color: 'white',
            }}
          >
            {isTogglingClineMCP
              ? 'Processing...'
              : clineMCPStatus.hasPrincipleMD
                ? 'Disable'
                : 'Enable'}
          </button>
        </div>
      </div>
    );
  };

  // OpenCode-specific MCP content
  const OpenCodeMCPContent = () => {
    const [openCodeMCPStatus, setOpenCodeMCPStatus] = React.useState<{
      hasPrincipleMD: boolean;
      mcpServers: Record<string, any>;
    }>({ hasPrincipleMD: false, mcpServers: {} });
    const [isTogglingOpenCodeMCP, setIsTogglingOpenCodeMCP] =
      React.useState(false);

    React.useEffect(() => {
      loadOpenCodeMCPStatus();
    }, []);

    const loadOpenCodeMCPStatus = async () => {
      console.log('[MCP] Loading OpenCode MCP status...');
      try {
        const mcpResult = await AgentConfigurationService.getAgentMCPStatus(
          SupportedAgent.OPENCODE,
        );
        console.log('[MCP] OpenCode MCP status result:', mcpResult);
        if (mcpResult.success && mcpResult.status) {
          setOpenCodeMCPStatus({
            hasPrincipleMD: mcpResult.status.hasMCP,
            mcpServers: {}, // We don't need detailed servers list for now
          });
          console.log('[MCP] OpenCode MCP status updated:', {
            hasPrincipleMD: mcpResult.status.hasMCP,
          });
        } else {
          console.log(
            '[MCP] Failed to get OpenCode MCP status:',
            mcpResult.error,
          );
        }
      } catch (error) {
        console.error('[MCP] Error loading OpenCode MCP status:', error);
      }
    };

    const handleToggleOpenCodeMCP = async () => {
      console.log(
        '[MCP] Toggle OpenCode MCP clicked, current status:',
        openCodeMCPStatus.hasPrincipleMD,
      );
      setIsTogglingOpenCodeMCP(true);
      try {
        if (openCodeMCPStatus.hasPrincipleMD) {
          console.log('[MCP] Removing MCP from OpenCode...');
          const result = await AgentConfigurationService.removeMCPFromAgent(
            SupportedAgent.OPENCODE,
          );
          console.log('[MCP] Remove result:', result);
          if (result.success) {
            await loadOpenCodeMCPStatus();
            await checkAgentStatus();
          }
        } else {
          console.log('[MCP] Adding MCP to OpenCode...');
          const result = await AgentConfigurationService.addMCPToAgent(
            SupportedAgent.OPENCODE,
          );
          console.log('[MCP] Add result:', result);
          if (result.success) {
            await loadOpenCodeMCPStatus();
            await checkAgentStatus();
          }
        }
      } catch (error) {
        console.error('[MCP] Error toggling OpenCode MCP:', error);
      } finally {
        setIsTogglingOpenCodeMCP(false);
      }
    };

    return (
      <div className="p-4">
        <div
          className="flex items-center justify-between p-4 rounded-lg border-2 transition-colors"
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: openCodeMCPStatus.hasPrincipleMD
              ? agentConfig.ui.color
              : 'transparent',
          }}
        >
          <div className="flex-1">
            <h4 className="font-medium text-white">Principle MD MCP Server</h4>
            <p className="text-xs text-slate-400 mt-1">
              {openCodeMCPStatus.hasPrincipleMD
                ? 'Enabled in ~/.config/openCode/openCode.json'
                : 'Not configured'}
            </p>
          </div>
          <button
            onClick={handleToggleOpenCodeMCP}
            disabled={isTogglingOpenCodeMCP}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isTogglingOpenCodeMCP ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: openCodeMCPStatus.hasPrincipleMD
                ? theme.colors.error
                : theme.colors.success,
              color: 'white',
            }}
          >
            {isTogglingOpenCodeMCP
              ? 'Processing...'
              : openCodeMCPStatus.hasPrincipleMD
                ? 'Disable'
                : 'Enable'}
          </button>
        </div>
      </div>
    );
  };

  // Droid-specific MCP content
  const DroidMCPContent = () => {
    const [droidMCPStatus, setDroidMCPStatus] = React.useState<{
      hasPrincipleMD: boolean;
      mcpServers: Record<string, any>;
    }>({ hasPrincipleMD: false, mcpServers: {} });
    const [isTogglingDroidMCP, setIsTogglingDroidMCP] =
      React.useState(false);

    React.useEffect(() => {
      loadDroidMCPStatus();
    }, []);

    const loadDroidMCPStatus = async () => {
      console.log('[MCP] Loading Droid MCP status...');
      try {
        const mcpResult = await AgentConfigurationService.getAgentMCPStatus(
          'droid' as SupportedAgent,
        );
        console.log('[MCP] Droid MCP result:', mcpResult);

        setDroidMCPStatus({
          hasPrincipleMD: mcpResult.status?.hasMCP || false,
          mcpServers: mcpResult.status?.servers || {},
        });
      } catch (error) {
        console.error('[MCP] Error loading Droid MCP status:', error);
      }
    };

    const handleToggleDroidMCP = async () => {
      setIsTogglingDroidMCP(true);
      try {
        if (droidMCPStatus.hasPrincipleMD) {
          console.log('[MCP] Removing MCP from Droid...');
          const result = await AgentConfigurationService.removeMCPFromAgent(
            'droid' as SupportedAgent,
          );
          console.log('[MCP] Remove result:', result);
          if (result.success) {
            await loadDroidMCPStatus();
            checkConfigFile();
          }
        } else {
          console.log('[MCP] Adding MCP to Droid...');
          const result = await AgentConfigurationService.addMCPToAgent(
            'droid' as SupportedAgent,
          );
          console.log('[MCP] Add result:', result);
          if (result.success) {
            await loadDroidMCPStatus();
            checkConfigFile();
          }
        }
      } catch (error) {
        console.error('[MCP] Error toggling Droid MCP:', error);
      } finally {
        setIsTogglingDroidMCP(false);
      }
    };

    return (
      <div className="p-4">
        <div
          className="flex items-center justify-between p-4 rounded-lg border-2 transition-colors"
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: droidMCPStatus.hasPrincipleMD
              ? agentConfig.ui.color
              : 'transparent',
          }}
        >
          <div className="flex-1">
            <h4 className="font-medium text-white">Principle MD MCP Server</h4>
            <p className="text-xs text-slate-400 mt-1">
              {droidMCPStatus.hasPrincipleMD
                ? 'Enabled in ~/.factory/mcp.json'
                : 'Not configured'}
            </p>
          </div>
          <button
            onClick={handleToggleDroidMCP}
            disabled={isTogglingDroidMCP}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isTogglingDroidMCP ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: droidMCPStatus.hasPrincipleMD
                ? theme.colors.error
                : theme.colors.success,
              color: 'white',
            }}
          >
            {isTogglingDroidMCP
              ? 'Processing...'
              : droidMCPStatus.hasPrincipleMD
                ? 'Disable'
                : 'Enable'}
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // LEFT PANEL
  // =========================================================================

  const leftPanel = (
    <div className="flex flex-col h-full">
      {renderHeader()}
      {renderEditModeWarning()}

      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'install' && renderInstallContent()}
        {viewMode === 'hooks' && renderHooksContent()}
        {viewMode === 'mcp' && renderMCPContent()}
      </div>
    </div>
  );

  // =========================================================================
  // RIGHT PANEL
  // =========================================================================

  const rightPanel = (
    <div className="flex flex-col h-full">
      {(() => {
        // For install view, show installation details
        if (viewMode === 'install') {
          return (
            <InstallationDetailsPanel
              theme={theme}
              agentConfig={agentConfig}
              agentStatus={agentStatus}
              agentType={agentType}
              configFilePath={configFilePath}
              hooksFilePath={hooksFilePath}
            />
          );
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
          return (
            <HeadlessFileEditorPanel
              filePath={filePath}
              editable={isEditMode}
              onSave={handleSaveConfig}
              onModifiedChange={setHasUnsavedChanges}
              onContentChange={setCurrentFileContent}
            />
          );
        }

        return (
          <FileNotFoundPanel
            theme={theme}
            fileTitle={fileTitle}
            fileDescription={fileDescription}
            filePath={filePath}
            onRefresh={async () => {
              checkAgentStatus();
            }}
          />
        );
      })()}
    </div>
  );

  // =========================================================================
  // SUB-COMPONENTS
  // =========================================================================

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  return (
    <AnimatedResizableLayout
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      defaultSize={50}
      minSize={20}
      theme={theme}
    />
  );
};
const InstallationDetailsPanel = ({
  theme,
  agentConfig,
  agentStatus,
  agentType,
  configFilePath,
  hooksFilePath,
}: {
  theme: Theme;
  agentConfig: AgentInfo;
  agentStatus: AgentSetupStatus;
  agentType: SupportedAgent;
  configFilePath: string;
  hooksFilePath: string;
}) => (
  <>
    <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
      <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
        Installation Details
      </h3>
      <div className="text-sm" style={{ color: theme.colors.textSecondary }}>
        {agentConfig.displayName} setup and configuration information
      </div>
    </div>

    <div className="flex-1 p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Installation Status */}
        <div>
          <h4
            className="text-sm font-medium mb-3"
            style={{ color: theme.colors.textSecondary }}
          >
            Installation Status
          </h4>
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: theme.colors.backgroundSecondary }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: agentStatus?.isInstalled
                    ? theme.colors.success
                    : theme.colors.muted,
                }}
              />
              <span style={{ color: theme.colors.text }}>
                {agentStatus?.isInstalled ? 'Installed' : 'Not Installed'}
              </span>
            </div>
          </div>
        </div>

        {/* Installation Instructions */}
        <div>
          <h4
            className="text-sm font-medium mb-3"
            style={{ color: theme.colors.textSecondary }}
          >
            Installation Instructions
          </h4>
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ backgroundColor: theme.colors.backgroundSecondary }}
          >
            {agentType === SupportedAgent.OPENCODE ? (
              <>
                <p className="text-sm" style={{ color: theme.colors.text }}>
                  {window.appName} provides a custom {agentConfig.displayName}{' '}
                  CLI with built-in hooks support.
                </p>
                <p className="text-sm" style={{ color: theme.colors.text }}>
                  Use the installation card on the left to manage your{' '}
                  {agentConfig.displayName} CLI installation.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: theme.colors.text }}>
                  1. Download {agentConfig.displayName} from the official
                  website
                </p>
                <p className="text-sm" style={{ color: theme.colors.text }}>
                  2. Install the application following the standard installation
                  process
                </p>
                <p className="text-sm" style={{ color: theme.colors.text }}>
                  3. Once installed, return here to configure hooks and MCP
                  servers
                </p>
              </>
            )}
          </div>
        </div>

        {/* Configuration Paths */}
        <div>
          <h4
            className="text-sm font-medium mb-3"
            style={{ color: theme.colors.textSecondary }}
          >
            Configuration Paths
          </h4>
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ backgroundColor: theme.colors.backgroundSecondary }}
          >
            <div>
              <p
                className="text-xs mb-1"
                style={{ color: theme.colors.textSecondary }}
              >
                Settings Path:
              </p>
              <code className="text-xs" style={{ color: theme.colors.success }}>
                {configFilePath}
              </code>
            </div>
            {hooksFilePath && (
              <div>
                <p
                  className="text-xs mb-1"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Hooks Path:
                </p>
                <code
                  className="text-xs"
                  style={{ color: theme.colors.success }}
                >
                  {hooksFilePath}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Download Link */}
        {!agentStatus?.isInstalled && agentType !== SupportedAgent.OPENCODE && (
          <div>
            <h4
              className="text-sm font-medium mb-3"
              style={{ color: theme.colors.textSecondary }}
            >
              Download
            </h4>
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: theme.colors.backgroundSecondary }}
            >
              <button
                onClick={() =>
                  window.open(agentConfig.ui.downloadUrl, '_blank')
                }
                className="w-full px-4 py-2 text-white rounded-md transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: agentConfig.ui.color }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open Download Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </>
);

const FileNotFoundPanel = ({
  theme,
  fileTitle,
  fileDescription,
  filePath,
  onRefresh,
}: {
  theme: Theme;
  fileTitle: string;
  fileDescription: string;
  filePath: string;
  onRefresh: () => void;
}) => (
  <>
    <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
      <h3 className="font-semibold mb-1">{fileTitle}</h3>
      <div className="text-sm text-slate-400">No configuration file found</div>
    </div>

    <div className="flex-1 p-6">
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-slate-300 mb-2">
            File Path:
          </div>
          <code
            className="block text-xs rounded p-3"
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.textSecondary,
            }}
          >
            {filePath}
          </code>
        </div>

        <div className="pt-4">
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${theme.colors.warning}20`,
              border: `1px solid ${theme.colors.warning}30`,
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ color: theme.colors.warning }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium">Configuration file not found</span>
            </div>
            <p className="text-sm text-slate-300 mt-2">{fileDescription}</p>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={onRefresh}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  </>
);
