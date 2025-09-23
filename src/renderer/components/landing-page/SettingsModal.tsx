import React, { useMemo, useState } from 'react';
import {
  X,
  RefreshCw,
  Info,
  Settings as SettingsIcon,
  Database,
  TestTube,
  Globe,
  Code,
  Sparkles,
  Terminal,
  CheckCircle,
  AlertCircle,
  Container,
  Bot,
  Cpu,
  Palette,
  FolderOpen,
} from 'lucide-react';

import { useTheme } from 'themed-markdown';

import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { EditorId } from '../../../shared/types/editor.types';
import { EDITOR_LABELS } from '../../../shared/types/editor.types';
import { AppVersionManagerService } from '../../main-process-api/AppVersionManagerService';
import { DockerService } from '../../main-process-api/DockerService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import {
  AgentConfigurationService,
  AgentInstallationStatus,
} from '../../main-process-api/AgentConfigurationService';
import { SystemService } from '../../main-process-api/SystemService';
import { AgentConfigurationView } from '../../pages/LandingPage/AgentConfigurationView';
import { TerminalConfigurationView } from '../../components/configuration/TerminalConfigurationView';
import { IDEConfigurationView } from '../../components/configuration/IDEConfigurationView';
import { predefinedThemes, getThemeNames } from '../../themes/predefinedThemes';
import { ThemeService } from '../../services/ThemeService';
import { WindowService } from '../../main-process-api/WindowService';
import AppIcon from '../../../../assets/icons/icon-48x48.png';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [defaultEditor, setDefaultEditor] = useState<EditorId>('vscode');
  const [defaultCloneDirectory, setDefaultCloneDirectory] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('default');
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);
  const [useCustomMarkdownTheme, setUseCustomMarkdownTheme] = useState(false);
  const [markdownThemeChoice, setMarkdownThemeChoice] = useState<
    'app' | 'github' | 'custom'
  >('app');
  const [customThemeJson, setCustomThemeJson] = useState<string>('');
  const [customThemeError, setCustomThemeError] = useState<string | null>(null);
  const [showCustomThemeEditor, setShowCustomThemeEditor] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    'general' | 'ai-assistants' | 'developer-tools' | 'updates' | 'developer'
  >('general');
  const [agentStatus, setAgentStatus] =
    useState<AgentInstallationStatus | null>(null);
  const [activeAgentView, setActiveAgentView] = useState<
    'claude' | 'cline' | 'opencode' | null
  >(null);
  const [activeToolsView, setActiveToolsView] = useState<
    'terminal' | 'ide' | null
  >(null);
  const [agentViewLayout, setAgentViewLayout] = useState<'simple' | 'detailed'>(
    'simple',
  );
  const [cliToolStatuses, setCliToolStatuses] = useState<
    Record<string, boolean>
  >({});
  const [checkingCliTools, setCheckingCliTools] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<{
    installed: boolean;
    running: boolean;
    version?: string;
    hasKnipImage?: boolean;
  } | null>(null);
  const [checkingDocker, setCheckingDocker] = useState(false);
  const editorOptions = useMemo(
    () => Object.entries(EDITOR_LABELS) as Array<[EditorId, string]>,
    [],
  );

  // Function to check CLI tool availability
  const checkCliTools = async () => {
    setCheckingCliTools(true);
    const statuses: Record<string, boolean> = {};

    try {
      // Check gh CLI
      const ghCheck = await window.mainProcess?.github?.checkAuthStatus();
      statuses['gh'] = ghCheck?.isAuthenticated || false;

      // Check git
      try {
        const gitVersion = await SystemService.executeCommand({
          command: 'git',
          args: ['--version'],
        });
        statuses['git'] = gitVersion.success;
      } catch {
        statuses['git'] = false;
      }
    } catch (error) {
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
          hasKnipImage: hasKnipImage,
        });
      } else {
        setDockerStatus({
          installed: false,
          running: false,
        });
      }
    } catch (error) {
      console.error('Error checking Docker status:', error);
      setDockerStatus({
        installed: false,
        running: false,
      });
    }
    setCheckingDocker(false);
  };

  // Check agent status
  const checkAgentStatus = React.useCallback(async () => {
    try {
      const status = await AgentConfigurationService.checkAgentInstallations();
      setAgentStatus(status);
    } catch (error) {
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
          const editor = (prefs.defaultEditor ?? 'vscode') as EditorId;
          setDefaultEditor(editor);

          // Load default clone directory
          setDefaultCloneDirectory(prefs.defaultCloneDirectory || '');

          // Load markdown theme preferences
          setUseCustomMarkdownTheme(prefs.useCustomMarkdownTheme ?? false);
          if (prefs.useCustomMarkdownTheme && prefs.customMarkdownTheme) {
            // Check if it's the GitHub theme by comparing key properties
            const isGitHubTheme =
              prefs.customMarkdownTheme.colors?.text === '#24292e' &&
              prefs.customMarkdownTheme.colors?.background === '#ffffff' &&
              prefs.customMarkdownTheme.colors?.primary === '#0366d6';

            if (isGitHubTheme) {
              setMarkdownThemeChoice('github');
            } else {
              setMarkdownThemeChoice('custom');
              // Load the custom theme JSON for display
              setCustomThemeJson(
                JSON.stringify(prefs.customMarkdownTheme, null, 2),
              );
            }
          } else {
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
    }
  }, [isOpen, activeCategory, checkAgentStatus]);

  // Set up persistent update listeners when modal opens
  React.useEffect(() => {
    if (!isOpen) return;

    const handleUpdateAvailable = (info: any) => {
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

    const handleUpdateNotAvailable = (info: any) => {
      console.log('[SettingsModal] No update available:', info);
      setUpdateAvailable(false);
      setAvailableVersion(null);
      setUpdateStatus('You have the latest version');
      setLastCheck(new Date());
      setIsChecking(false);
    };

    const handleUpdateError = (err: any) => {
      console.error('[SettingsModal] Update error:', err);
      let errorMessage = err.message || err.toString();

      // Parse common error types for better user feedback
      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('no such file')
      ) {
        errorMessage =
          'Update file not found. The update server may be temporarily unavailable.';
      } else if (
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connect')
      ) {
        errorMessage =
          'Cannot connect to update server. Please check your internet connection.';
      } else if (errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Update server timeout. Please try again later.';
      } else if (
        errorMessage.includes('403') ||
        errorMessage.includes('Forbidden')
      ) {
        errorMessage =
          'Access denied. The update may not be available for your platform.';
      } else if (
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found')
      ) {
        errorMessage =
          'Update not found. There may be no update available for your version.';
      } else if (
        errorMessage.includes('CERT') ||
        errorMessage.includes('certificate')
      ) {
        errorMessage =
          'Certificate error. Please check your system date/time or proxy settings.';
      } else if (
        errorMessage.includes('sha512') ||
        errorMessage.includes('checksum')
      ) {
        errorMessage =
          'Update verification failed. The update file may be corrupted or the server configuration may be incorrect. Please try again later.';
      }

      // Check if this is a download error
      if (isDownloading) {
        setDownloadError(errorMessage);
        setIsDownloading(false);
        setUpdateStatus('Download failed');
      } else {
        setUpdateAvailable(false);
        setAvailableVersion(null);
        setUpdateStatus(`Error: ${errorMessage}`);
      }
      setIsChecking(false);
    };

    const handleUpdateDownloadProgress = (progress: any) => {
      console.log('[SettingsModal] Download progress:', progress);
      setDownloadProgress(progress.percent || 0);
    };

    const handleUpdateDownloaded = (info: any) => {
      console.log('[SettingsModal] Update downloaded:', info);
      setIsDownloaded(true);
      setIsDownloading(false);
      setDownloadProgress(100);
      setUpdateStatus('Update downloaded successfully');
    };

    const removeUpdateAvailable = AppVersionManagerService.onUpdateAvailable(
      handleUpdateAvailable,
    );
    const removeUpdateNotAvailable =
      AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable);
    const removeUpdateError =
      AppVersionManagerService.onUpdateError(handleUpdateError);
    const removeUpdateDownloadProgress =
      AppVersionManagerService.onUpdateDownloadProgress(
        handleUpdateDownloadProgress,
      );
    const removeUpdateDownloaded = AppVersionManagerService.onUpdateDownloaded(
      handleUpdateDownloaded,
    );

    const handleUpdateCheckComplete = () => {
      setIsChecking(false);
    };

    const removeUpdateCheckComplete =
      AppVersionManagerService.onUpdateCheckComplete(handleUpdateCheckComplete);

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
  return !isOpen ? null : (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
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
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={20} color={theme.colors.text} />
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
                Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={20} color={theme.colors.text} />
            </button>
          </div>

          {/* Main Content Area */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar */}
            <div
              style={{
                width: '240px',
                borderRight: `1px solid ${theme.colors.border}`,
                padding: '20px',
                flexShrink: 0,
                backgroundColor: theme.colors.backgroundSecondary,
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <button
                  onClick={() => {
                    setActiveCategory('general');
                    setActiveAgentView(null);
                    setActiveToolsView(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor:
                      activeCategory === 'general'
                        ? theme.colors.primary + '20'
                        : 'transparent',
                    color:
                      activeCategory === 'general'
                        ? theme.colors.primary
                        : theme.colors.text,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: activeCategory === 'general' ? 600 : 500,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (activeCategory !== 'general') {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCategory !== 'general') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Globe size={18} />
                  General
                </button>

                <button
                  onClick={() => {
                    setActiveCategory('ai-assistants');
                    setActiveAgentView(null);
                    setActiveToolsView(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor:
                      activeCategory === 'ai-assistants'
                        ? theme.colors.primary + '20'
                        : 'transparent',
                    color:
                      activeCategory === 'ai-assistants'
                        ? theme.colors.primary
                        : theme.colors.text,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: activeCategory === 'ai-assistants' ? 600 : 500,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (activeCategory !== 'ai-assistants') {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCategory !== 'ai-assistants') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Bot size={18} />
                  AI Assistants
                </button>

                <button
                  onClick={() => {
                    setActiveCategory('updates');
                    setActiveAgentView(null);
                    setActiveToolsView(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor:
                      activeCategory === 'updates'
                        ? theme.colors.primary + '20'
                        : 'transparent',
                    color:
                      activeCategory === 'updates'
                        ? theme.colors.primary
                        : theme.colors.text,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: activeCategory === 'updates' ? 600 : 500,
                    textAlign: 'left',
                    width: '100%',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (activeCategory !== 'updates') {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCategory !== 'updates') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <RefreshCw size={18} />
                  Updates
                  {updateAvailable && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.warning,
                        boxShadow: `0 0 8px ${theme.colors.warning}80`,
                      }}
                    />
                  )}
                </button>

              </div>
            </div>

            {/* Content Area */}
            <div
              style={{
                flex: 1,
                padding: '32px',
                overflowY: 'auto',
              }}
            >
              {/* General Settings */}
              {activeCategory === 'general' && (
                <div style={{ maxWidth: '800px' }}>
                  <h3
                    style={{
                      fontSize: '24px',
                      fontWeight: 600,
                      marginBottom: '32px',
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <Globe size={24} />
                    General Settings
                  </h3>

                  {/* About Section */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '16px',
                        color: theme.colors.text,
                      }}
                    >
                      About Principal AI
                    </h4>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '16px',
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={AppIcon}
                            alt="Principal AI"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: '18px',
                              fontWeight: 600,
                              margin: '0 0 4px 0',
                            }}
                          >
                            Principal AI
                          </p>
                          <p
                            style={{
                              fontSize: '14px',
                              color: theme.colors.textSecondary,
                              margin: 0,
                            }}
                          >
                            Version {currentVersion}{' '}
                            {isDevMode && (
                              <span style={{ color: theme.colors.warning }}>
                                (Dev Mode)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p
                        style={{
                          fontSize: '14px',
                          lineHeight: 1.6,
                          margin: '0 0 12px 0',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        A powerful tool for creating and presenting markdown
                        slides, with integrated AI assistance and code analysis
                        capabilities.
                      </p>
                      <a
                        href="https://principle-md.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: theme.colors.primary,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        Visit our website →
                      </a>
                    </div>
                  </div>

                  {/* Editor Preference */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '16px',
                        color: theme.colors.text,
                      }}
                    >
                      Default Code Editor
                    </h4>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                          marginBottom: '12px',
                        }}
                      >
                        Choose your preferred editor for opening local
                        repositories
                      </p>
                      <select
                        id="default-editor"
                        value={defaultEditor}
                        onChange={async (e) => {
                          const value = e.target.value as EditorId;
                          setDefaultEditor(value);
                          await UserPreferencesService.updatePreferences({
                            defaultEditor: value,
                          });
                        }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          cursor: 'pointer',
                          fontSize: '14px',
                          minWidth: '200px',
                        }}
                      >
                        {editorOptions.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Default Clone Directory */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '16px',
                        color: theme.colors.text,
                      }}
                    >
                      Default Clone Directory
                    </h4>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                          marginBottom: '12px',
                        }}
                      >
                        Choose the default directory where Git repositories will be cloned when using "Paste Link" from the landing page
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="e.g., /Users/username/Developer"
                          value={defaultCloneDirectory || ''}
                          onChange={(e) => setDefaultCloneDirectory(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text,
                            fontSize: '14px',
                          }}
                        />
                        <button
                          onClick={async () => {
                            try {
                              const result = await FileSystemService.selectDirectory({
                                title: 'Select Default Clone Directory',
                                buttonLabel: 'Select Directory',
                                properties: ['openDirectory', 'createDirectory'],
                              });

                              if (!result || result.canceled || !result.filePaths?.[0]) {
                                return;
                              }

                              const selectedPath = result.filePaths[0];
                              setDefaultCloneDirectory(selectedPath);
                              await UserPreferencesService.updatePreferences({
                                defaultCloneDirectory: selectedPath,
                              });
                            } catch (error) {
                              console.error('Error selecting directory:', error);
                            }
                          }}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text,
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.background;
                          }}
                        >
                          <FolderOpen size={16} />
                          Browse
                        </button>
                        <button
                          onClick={async () => {
                            await UserPreferencesService.updatePreferences({
                              defaultCloneDirectory: defaultCloneDirectory || undefined,
                            });
                          }}
                          disabled={!defaultCloneDirectory?.trim()}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: theme.colors.primary,
                            color: 'white',
                            cursor: defaultCloneDirectory?.trim() ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 500,
                            opacity: defaultCloneDirectory?.trim() ? 1 : 0.5,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (defaultCloneDirectory?.trim()) {
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          Save
                        </button>
                      </div>
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: theme.colors.backgroundLight,
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>Note:</strong> If no directory is set, you'll be prompted to choose one each time you clone a repository. Setting a default directory provides a smoother cloning experience.
                      </div>
                    </div>
                  </div>

                  {/* Theme Selection */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '16px',
                        color: theme.colors.text,
                      }}
                    >
                      Interface Theme
                    </h4>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                          marginBottom: '12px',
                        }}
                      >
                        Choose your preferred color theme for the application
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                        }}
                      >
                        <select
                          id="selected-theme"
                          value={pendingTheme || selectedTheme}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPendingTheme(value);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text,
                            cursor: 'pointer',
                            fontSize: '14px',
                            minWidth: '200px',
                            flex: 1,
                          }}
                        >
                          {getThemeNames().map((name) => {
                            const themeInfo = predefinedThemes[name];
                            return (
                              <option key={name} value={name}>
                                {themeInfo.name}
                              </option>
                            );
                          })}
                        </select>

                        {pendingTheme && pendingTheme !== selectedTheme && (
                          <button
                            onClick={async () => {
                              setIsApplyingTheme(true);
                              try {
                                // Apply the theme using ThemeService
                                await ThemeService.applyTheme(
                                  pendingTheme,
                                  true,
                                );
                                setSelectedTheme(pendingTheme);
                                setPendingTheme(null);

                                // Show success feedback
                                setTimeout(() => {
                                  setIsApplyingTheme(false);
                                }, 500);
                              } catch (error) {
                                console.error('Failed to apply theme:', error);
                                setIsApplyingTheme(false);
                              }
                            }}
                            disabled={isApplyingTheme}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: theme.colors.primary,
                              color: theme.colors.background,
                              cursor: isApplyingTheme
                                ? 'not-allowed'
                                : 'pointer',
                              fontSize: '14px',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              opacity: isApplyingTheme ? 0.6 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            {isApplyingTheme ? (
                              <>
                                <RefreshCw
                                  size={14}
                                  style={{
                                    animation: 'spin 1s linear infinite',
                                  }}
                                />
                                Applying...
                              </>
                            ) : (
                              <>
                                <Palette size={14} />
                                Apply Theme
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: theme.colors.backgroundLight,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <Palette size={16} color={theme.colors.primary} />
                        <span
                          style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {predefinedThemes[pendingTheme || selectedTheme]
                            ?.description || 'Standard theme'}
                        </span>
                      </div>
                      {pendingTheme && pendingTheme !== selectedTheme && (
                        <p
                          style={{
                            fontSize: '12px',
                            color: theme.colors.info,
                            marginTop: '12px',
                            fontStyle: 'italic',
                          }}
                        >
                          Click "Apply Theme" to switch to{' '}
                          {predefinedThemes[pendingTheme]?.name} immediately
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Markdown Theme Settings */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '16px',
                        color: theme.colors.text,
                      }}
                    >
                      Markdown Rendering Theme
                    </h4>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <p
                        style={{
                          fontSize: '14px',
                          color: theme.colors.textSecondary,
                          marginBottom: '16px',
                        }}
                      >
                        Choose how markdown documents are styled
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        {/* Theme choice radio buttons */}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="markdownTheme"
                            value="app"
                            checked={markdownThemeChoice === 'app'}
                            onChange={(e) => {
                              setMarkdownThemeChoice('app');
                              setUseCustomMarkdownTheme(false);
                              UserPreferencesService.updatePreferences({
                                useCustomMarkdownTheme: false,
                              });
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: '14px',
                              color: theme.colors.text,
                            }}
                          >
                            Use application theme
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: theme.colors.textMuted,
                              marginLeft: '4px',
                            }}
                          >
                            (Follows interface theme)
                          </span>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="markdownTheme"
                            value="github"
                            checked={markdownThemeChoice === 'github'}
                            onChange={(e) => {
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
                                  success: '#28a745',
                                },
                              };
                              UserPreferencesService.updatePreferences({
                                useCustomMarkdownTheme: true,
                                customMarkdownTheme: githubTheme,
                              });
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: '14px',
                              color: theme.colors.text,
                            }}
                          >
                            GitHub style
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: theme.colors.textMuted,
                              marginLeft: '4px',
                            }}
                          >
                            (Classic GitHub markdown)
                          </span>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="markdownTheme"
                            value="custom"
                            checked={markdownThemeChoice === 'custom'}
                            onChange={(e) => {
                              setMarkdownThemeChoice('custom');
                              setShowCustomThemeEditor(true);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              fontSize: '14px',
                              color: theme.colors.text,
                            }}
                          >
                            Custom theme
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: theme.colors.textMuted,
                              marginLeft: '4px',
                            }}
                          >
                            (Paste JSON)
                          </span>
                        </label>
                      </div>

                      {/* Custom Theme Editor */}
                      {(showCustomThemeEditor ||
                        markdownThemeChoice === 'custom') && (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '16px',
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px',
                            }}
                          >
                            <h5
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                margin: 0,
                                color: theme.colors.text,
                              }}
                            >
                              Custom Theme JSON
                            </h5>
                            <button
                              onClick={() => {
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
                                    success: '#1f883d',
                                  },
                                };
                                setCustomThemeJson(
                                  JSON.stringify(exampleTheme, null, 2),
                                );
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                backgroundColor:
                                  theme.colors.backgroundSecondary,
                                color: theme.colors.primary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Load Example
                            </button>
                          </div>

                          <textarea
                            value={customThemeJson}
                            onChange={(e) => {
                              setCustomThemeJson(e.target.value);
                              setCustomThemeError(null);
                            }}
                            placeholder='Paste your theme JSON here. Example:
{
  "colors": {
    "text": "#1a1a1a",
    "background": "#ffffff",
    "primary": "#0969da",
    ...
  }
}'
                            style={{
                              width: '100%',
                              height: '200px',
                              padding: '12px',
                              backgroundColor: theme.colors.background,
                              color: theme.colors.text,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              fontFamily: theme.fonts.monospace,
                              fontSize: '12px',
                              resize: 'vertical',
                            }}
                          />

                          {customThemeError && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                backgroundColor: `${theme.colors.error}20`,
                                color: theme.colors.error,
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            >
                              {customThemeError}
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              marginTop: '12px',
                            }}
                          >
                            <button
                              onClick={() => {
                                try {
                                  // Validate and save the custom theme
                                  const parsedTheme =
                                    JSON.parse(customThemeJson);

                                  // Basic validation
                                  if (!parsedTheme.colors) {
                                    throw new Error(
                                      'Theme must have a "colors" property',
                                    );
                                  }

                                  // Save the custom theme
                                  setUseCustomMarkdownTheme(true);
                                  UserPreferencesService.updatePreferences({
                                    useCustomMarkdownTheme: true,
                                    customMarkdownTheme: parsedTheme,
                                  });

                                  setCustomThemeError(null);
                                  setShowCustomThemeEditor(false);
                                } catch (err) {
                                  setCustomThemeError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Invalid JSON format',
                                  );
                                }
                              }}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              Apply Custom Theme
                            </button>

                            <button
                              onClick={() => {
                                setShowCustomThemeEditor(false);
                                if (
                                  markdownThemeChoice === 'custom' &&
                                  !customThemeJson
                                ) {
                                  setMarkdownThemeChoice('app');
                                }
                              }}
                              style={{
                                padding: '8px 16px',
                                backgroundColor:
                                  theme.colors.backgroundSecondary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: '16px',
                          padding: '12px',
                          backgroundColor: theme.colors.backgroundLight,
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>Note:</strong> This setting affects how markdown
                        content is displayed in the editor and preview. It does
                        not affect the application interface theme.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Assistants Settings */}
              {activeCategory === 'ai-assistants' && (
                <div style={{ maxWidth: '100%', height: '100%' }}>
                  {!activeAgentView ? (
                    <div style={{ maxWidth: '800px' }}>
                      <h3
                        style={{
                          fontSize: '24px',
                          fontWeight: 600,
                          marginBottom: '32px',
                          color: theme.colors.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <Bot size={24} />
                        AI Assistants Configuration
                      </h3>

                      {/* AI Assistants Section */}
                      <div style={{ marginBottom: '32px' }}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Claude */}
                          <div
                            style={{
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '12px',
                              padding: '20px',
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background:
                                      'linear-gradient(135deg, #D4500F20, #D4500F40)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Bot size={20} color="#D4500F" />
                                </div>
                                <div>
                                  <h5
                                    style={{
                                      fontSize: '16px',
                                      fontWeight: 600,
                                      margin: '0 0 4px 0',
                                    }}
                                  >
                                    Claude
                                  </h5>
                                  <p
                                    style={{
                                      fontSize: '13px',
                                      color: theme.colors.textSecondary,
                                      margin: 0,
                                    }}
                                  >
                                    Anthropic's AI assistant
                                  </p>
                                  {agentStatus?.claude?.isInstalled && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      <CheckCircle
                                        size={12}
                                        color={theme.colors.success}
                                      />
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: theme.colors.success,
                                        }}
                                      >
                                        Installed
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveAgentView('claude');
                                  setAgentViewLayout('simple');
                                }}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.background,
                                  color: theme.colors.text,
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                }}
                              >
                                Configure
                              </button>
                            </div>
                          </div>

                          {/* Cline */}
                          <div
                            style={{
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '12px',
                              padding: '20px',
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background:
                                      'linear-gradient(135deg, #8B5CF620, #8B5CF640)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Bot size={20} color="#8B5CF6" />
                                </div>
                                <div>
                                  <h5
                                    style={{
                                      fontSize: '16px',
                                      fontWeight: 600,
                                      margin: '0 0 4px 0',
                                    }}
                                  >
                                    Cline
                                  </h5>
                                  <p
                                    style={{
                                      fontSize: '13px',
                                      color: theme.colors.textSecondary,
                                      margin: 0,
                                    }}
                                  >
                                    VS Code AI assistant
                                  </p>
                                  {agentStatus?.cline?.isInstalled && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      <CheckCircle
                                        size={12}
                                        color={theme.colors.success}
                                      />
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: theme.colors.success,
                                        }}
                                      >
                                        Installed
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveAgentView('cline');
                                  setAgentViewLayout('simple');
                                }}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.background,
                                  color: theme.colors.text,
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                }}
                              >
                                Configure
                              </button>
                            </div>
                          </div>

                          {/* OpenCode */}
                          <div
                            style={{
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '12px',
                              padding: '20px',
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background:
                                      'linear-gradient(135deg, #10b98120, #10b98140)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Bot size={20} color="#10b981" />
                                </div>
                                <div>
                                  <h5
                                    style={{
                                      fontSize: '16px',
                                      fontWeight: 600,
                                      margin: '0 0 4px 0',
                                    }}
                                  >
                                    OpenCode
                                  </h5>
                                  <p
                                    style={{
                                      fontSize: '13px',
                                      color: theme.colors.textSecondary,
                                      margin: 0,
                                    }}
                                  >
                                    Open-source AI assistant
                                  </p>
                                  {agentStatus?.opencode?.isInstalled && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      <CheckCircle
                                        size={12}
                                        color={theme.colors.success}
                                      />
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: theme.colors.success,
                                        }}
                                      >
                                        Installed
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveAgentView('opencode');
                                  setAgentViewLayout('simple');
                                }}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.background,
                                  color: theme.colors.text,
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                }}
                              >
                                Configure
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '100%', overflow: 'auto' }}>
                      <div
                        style={{
                          padding: '20px 0',
                          borderBottom: `1px solid ${theme.colors.border}`,
                          marginBottom: '20px',
                        }}
                      >
                        <button
                          onClick={() => setActiveAgentView(null)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.text,
                            cursor: 'pointer',
                            fontSize: '14px',
                            marginBottom: '16px',
                          }}
                        >
                          ← Back to AI Assistants
                        </button>
                      </div>
                      {activeAgentView === 'claude' && agentStatus && (
                        <AgentConfigurationView
                          agentType={SupportedAgent.CLAUDE}
                          agentStatus={agentStatus.claude}
                          checkAgentStatus={checkAgentStatus}
                          viewLayout={agentViewLayout}
                          onShowDetails={() => setAgentViewLayout('detailed')}
                          onBackToSetup={() => setAgentViewLayout('simple')}
                        />
                      )}
                      {activeAgentView === 'cline' && agentStatus && (
                        <AgentConfigurationView
                          agentType={SupportedAgent.CLINE}
                          agentStatus={agentStatus.cline}
                          checkAgentStatus={checkAgentStatus}
                          viewLayout={agentViewLayout}
                          onShowDetails={() => setAgentViewLayout('detailed')}
                          onBackToSetup={() => setAgentViewLayout('simple')}
                        />
                      )}
                      {activeAgentView === 'opencode' && agentStatus && (
                        <AgentConfigurationView
                          agentType={SupportedAgent.OPENCODE}
                          agentStatus={agentStatus.opencode}
                          checkAgentStatus={checkAgentStatus}
                          viewLayout={agentViewLayout}
                          onShowDetails={() => setAgentViewLayout('detailed')}
                          onBackToSetup={() => setAgentViewLayout('simple')}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* Updates Settings */}
              {activeCategory === 'updates' && (
                <div style={{ maxWidth: '800px' }}>
                  <h3
                    style={{
                      fontSize: '24px',
                      fontWeight: 600,
                      marginBottom: '32px',
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <RefreshCw size={24} />
                    Application Updates
                  </h3>

                  {/* Current Version */}
                  <div style={{ marginBottom: '32px' }}>
                    <div
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              margin: '0 0 8px 0',
                            }}
                          >
                            Current Version
                          </h4>
                          <p
                            style={{
                              fontSize: '24px',
                              fontWeight: 700,
                              color: theme.colors.primary,
                              margin: 0,
                            }}
                          >
                            v{currentVersion}
                          </p>
                          {lastCheck && (
                            <p
                              style={{
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                                marginTop: '8px',
                              }}
                            >
                              Last checked: {lastCheck.toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={checkForUpdates}
                          disabled={isChecking}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            backgroundColor: isChecking
                              ? theme.colors.backgroundTertiary
                              : updateAvailable
                                ? theme.colors.warning
                                : theme.colors.primary,
                            color: isChecking
                              ? theme.colors.textSecondary
                              : '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isChecking ? 'not-allowed' : 'pointer',
                            opacity: isChecking ? 0.5 : 1,
                            transition: 'all 0.2s',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                          onMouseEnter={(e) => {
                            if (!isChecking) {
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <RefreshCw
                            size={16}
                            className={isChecking ? 'animate-spin' : ''}
                          />
                          {isChecking
                            ? 'Checking...'
                            : updateAvailable
                              ? `Update to v${availableVersion}`
                              : 'Check for Updates'}
                        </button>
                      </div>

                      {updateStatus && (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: updateStatus.includes('available')
                              ? `${theme.colors.warning}15`
                              : updateStatus.includes('Error')
                                ? `${theme.colors.error}15`
                                : `${theme.colors.success}15`,
                            borderRadius: '8px',
                            border: `1px solid ${
                              updateStatus.includes('available')
                                ? theme.colors.warning + '30'
                                : updateStatus.includes('Error')
                                  ? theme.colors.error + '30'
                                  : theme.colors.success + '30'
                            }`,
                          }}
                        >
                          <p
                            style={{
                              fontSize: '14px',
                              margin: 0,
                              color: updateStatus.includes('available')
                                ? theme.colors.warning
                                : updateStatus.includes('Error')
                                  ? theme.colors.error
                                  : theme.colors.success,
                            }}
                          >
                            {updateStatus}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Update Available Section */}
                  {updateAvailable && availableVersion && (
                    <div
                      style={{
                        backgroundColor: `${theme.colors.warning}10`,
                        border: `2px solid ${theme.colors.warning}`,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '32px',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          margin: '0 0 16px 0',
                          color: theme.colors.warning,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <Sparkles size={20} />
                        New Version Available!
                      </h4>

                      <div style={{ marginBottom: '20px' }}>
                        <p
                          style={{
                            fontSize: '14px',
                            margin: '0 0 8px 0',
                            color: theme.colors.text,
                          }}
                        >
                          <strong>Current:</strong> v{currentVersion} →{' '}
                          <strong>Available:</strong> v{availableVersion}
                        </p>
                      </div>

                      {isDevMode ? (
                        <div>
                          <div
                            style={{
                              padding: '12px',
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '8px',
                              marginBottom: '12px',
                            }}
                          >
                            <p
                              style={{
                                fontSize: '13px',
                                margin: 0,
                                color: theme.colors.textSecondary,
                              }}
                            >
                              <Info
                                size={14}
                                style={{
                                  display: 'inline',
                                  marginRight: '6px',
                                  verticalAlign: 'text-bottom',
                                }}
                              />
                              Development mode: Updates are detected but not
                              automatically downloaded.
                            </p>
                          </div>
                          <button
                            style={{
                              padding: '10px 20px',
                              backgroundColor: theme.colors.warning,
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 600,
                            }}
                            onClick={() => {
                              setIsDownloading(true);
                              setDownloadError(null);
                              setDownloadProgress(0);
                              setUpdateStatus(
                                "Test downloading update (won't auto-install)...",
                              );
                              AppVersionManagerService.testDownloadUpdate();
                            }}
                            disabled={isDownloading || !updateAvailable}
                          >
                            Test Download (No Auto-Install)
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              style={{
                                padding: '10px 20px',
                                backgroundColor: isDownloaded
                                  ? theme.colors.success
                                  : isDownloading
                                    ? theme.colors.backgroundTertiary
                                    : theme.colors.warning,
                                color: isDownloading
                                  ? theme.colors.textSecondary
                                  : '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: isDownloading
                                  ? 'not-allowed'
                                  : 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                opacity: isDownloading ? 0.7 : 1,
                                transition: 'all 0.2s',
                              }}
                              onClick={
                                isDownloaded ? installUpdate : downloadUpdate
                              }
                              disabled={isDownloading}
                            >
                              {isDownloading
                                ? `Downloading... ${Math.round(downloadProgress)}%`
                                : isDownloaded
                                  ? 'Install & Restart'
                                  : 'Download Update'}
                            </button>
                            <span
                              style={{
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                              }}
                            >
                              {isDownloaded
                                ? 'Ready to install'
                                : 'The app will restart after installation'}
                            </span>
                          </div>

                          {isDownloading && (
                            <div
                              style={{
                                width: '100%',
                                height: '4px',
                                backgroundColor:
                                  theme.colors.backgroundTertiary,
                                borderRadius: '2px',
                                overflow: 'hidden',
                                marginTop: '12px',
                              }}
                            >
                              <div
                                style={{
                                  width: `${downloadProgress}%`,
                                  height: '100%',
                                  backgroundColor: theme.colors.primary,
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          )}

                          {downloadError && (
                            <div
                              style={{
                                marginTop: '12px',
                                padding: '12px',
                                backgroundColor: `${theme.colors.error}15`,
                                border: `1px solid ${theme.colors.error}30`,
                                borderRadius: '8px',
                              }}
                            >
                              <p
                                style={{
                                  fontSize: '13px',
                                  margin: 0,
                                  color: theme.colors.error,
                                }}
                              >
                                {downloadError}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auto-update info */}
                  <div
                    style={{
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '12px',
                      padding: '20px',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 12px 0',
                      }}
                    >
                      Automatic Updates
                    </h4>
                    <p
                      style={{
                        fontSize: '14px',
                        margin: 0,
                        color: theme.colors.textSecondary,
                        lineHeight: 1.6,
                      }}
                    >
                      The application checks for updates on startup and every
                      hour while running. Updates are downloaded automatically
                      and you'll be prompted to restart when ready.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
};
