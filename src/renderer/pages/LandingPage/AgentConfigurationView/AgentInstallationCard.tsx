import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Download,
  CheckCircle,
  AlertCircle,
  Loader,
  Trash2,
  Bell,
  BellOff,
} from 'lucide-react';
import { AgentInstallationService } from '../../../main-process-api/AgentInstallationService';
import { AgentAutoUpdateService } from '../../../main-process-api/AgentAutoUpdateService';
import { AgentInfo, SupportedAgent } from "@principal-ai/agent-monitoring";

interface AgentInstallationCardProps {
  agentType: SupportedAgent;
  agentConfig: AgentInfo;
  onInstallComplete?: () => void;
}

export const AgentInstallationCard: React.FC<AgentInstallationCardProps> = ({
  agentType,
  agentConfig,
  onInstallComplete,
}) => {
  const { theme } = useTheme();
  const [installStatus, setInstallStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<any>(null);
  const [availableVersions, setAvailableVersions] = useState<any[]>([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    checkInstallation();
    setupEventListeners();
    checkAutoUpdateStatus();

    // Listen for update notifications
    const unsubscribeUpdate = AgentAutoUpdateService.onUpdateAvailable((update) => {
      if (update && update.agentType === agentType && update.hasUpdate) {
        setUpdateAvailable(update.hasUpdate);
        setLatestVersion(update.latestVersion);
      }
    });

    return () => {
      // Cleanup event listeners
      unsubscribeUpdate();
    };
  }, []);

  const setupEventListeners = () => {
    const unsubscribeProgress = AgentInstallationService.onInstallProgress(
      agentType,
      (progress) => {
        setInstallProgress(progress);
      },
    );

    const unsubscribeComplete = AgentInstallationService.onInstallComplete(
      agentType,
      (status) => {
        setInstallStatus(status);
        setIsInstalling(false);
        // Show success message with PATH info
        setInstallProgress({
          stage: 'completed',
          progress: 100,
          message:
            'Installation complete! Run this in your terminal: source ~/.zshrc',
        });
        setTimeout(() => setInstallProgress(null), 5000);
        if (onInstallComplete) {
          onInstallComplete();
        }
      },
    );

    const unsubscribeError = AgentInstallationService.onInstallError(agentType, (error) => {
      setError(error);
      setIsInstalling(false);
      setInstallProgress(null);
    });

    const unsubscribeUninstall = AgentInstallationService.onUninstallComplete(agentType, () => {
      setIsInstalling(false);
      checkInstallation();
      if (onInstallComplete) {
        onInstallComplete();
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
      unsubscribeUninstall();
    };
  };

  const checkAutoUpdateStatus = async () => {
    try {
      const prefs = await AgentAutoUpdateService.getUpdatePreferences();
      setAutoUpdateEnabled(prefs.enabled);
      
      // Check for stored update info
      const storedUpdate = await AgentAutoUpdateService.getStoredUpdateInfo(agentType);
      if (storedUpdate?.hasUpdate) {
        setUpdateAvailable(true);
        setLatestVersion(storedUpdate.latestVersion);
      }
    } catch (err) {
      console.error('Failed to check auto-update status:', err);
    }
  };

  const toggleAutoUpdate = async () => {
    try {
      const newValue = !autoUpdateEnabled;
      await AgentAutoUpdateService.saveUpdatePreferences({ enabled: newValue });
      setAutoUpdateEnabled(newValue);
      
      if (newValue) {
        // Trigger an immediate check when enabling
        const result = await AgentAutoUpdateService.checkForUpdate(agentType);
        if (result?.hasUpdate) {
          setUpdateAvailable(true);
          setLatestVersion(result.latestVersion);
        }
      }
    } catch (err) {
      console.error('Failed to toggle auto-update:', err);
    }
  };

  const checkInstallation = async () => {
    try {
      setIsChecking(true);
      setError(null);

      const status = await AgentInstallationService.checkInstallation(agentType);
      setInstallStatus(status);
      if (status.installed && status.isOurVersion) {
        const updateCheck = await AgentInstallationService.checkForUpdates(agentType);
        if (updateCheck) {
          setUpdateAvailable(updateCheck.hasUpdate);
        }
      }

      const versions = await AgentInstallationService.getAvailableVersions(agentType);
      setAvailableVersions(versions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check installation',
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleInstall = async (version?: string) => {
    try {
      setIsInstalling(true);
      setError(null);
      await AgentInstallationService.install(agentType, version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setIsInstalling(false);
    }
  };

  const handleUninstall = async () => {
    const message = `Are you sure you want to uninstall ${window.appName}'s ${agentConfig.displayName} CLI?

This will remove:
• The principal-${agentConfig.displayName} command
• Installation files in ~/.a24z/${agentConfig.name}/
• Configuration in ~/.${agentConfig.displayName}/ (only if no other ${agentConfig.displayName} CLI is installed)

Your PATH will be preserved for future installations.`;

    if (!confirm(message)) {
      return;
    }

    try {
      setIsInstalling(true);
      setError(null);
      setInstallProgress({
        stage: 'installing',
        progress: 50,
        message: 'Uninstalling Gemini CLI...',
      });
      await AgentInstallationService.uninstall(agentType);
      //await checkInstallation();
      setInstallProgress({
        stage: 'completed',
        progress: 100,
        message: 'Uninstalled successfully',
      });
      setTimeout(() => setInstallProgress(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uninstallation failed');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setIsInstalling(true);
      setError(null);
      await AgentInstallationService.update(agentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setIsInstalling(false);
    }
  };

  if (isChecking) {
    return (
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <Loader className="animate-spin" size={20} />
        <span style={{ color: theme.colors.text }}>
          Checking Gemini CLI installation...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h3
          style={{
            margin: '0 0 8px 0',
            color: theme.colors.text || '#e2e8f0',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          {agentConfig.displayName} CLI Installation
        </h3>
        <p
          style={{
            margin: 0,
            color: theme.colors.textSecondary || '#94a3b8',
            fontSize: '14px',
          }}
        >
          {window.appName}'s custom {agentConfig.displayName} CLI for enhanced development workflows
        </p>
      </div>

      {/* Status */}
      {installStatus && (
        <div
          style={{
            backgroundColor:
              installStatus.installed && installStatus.isOurVersion
                ? `${theme.colors.success || '#10b981'}10`
                : `${theme.colors.warning || '#f59e0b'}10`,
            border: `1px solid ${
              installStatus.installed && installStatus.isOurVersion
                ? theme.colors.success || '#10b981'
                : theme.colors.warning || '#f59e0b'
            }`,
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {installStatus.installed && installStatus.isOurVersion ? (
              <CheckCircle
                size={20}
                color={theme.colors.success || '#10b981'}
              />
            ) : (
              <AlertCircle
                size={20}
                color={theme.colors.warning || '#f59e0b'}
              />
            )}
            <div style={{ flex: 1 }}>
              <p
                style={{ margin: 0, fontWeight: 500, color: theme.colors.text }}
              >
                {installStatus.installed
                  ? installStatus.isOurVersion
                    ? `Gemini CLI v${installStatus.version} installed`
                    : 'Different version of Gemini CLI detected'
                  : 'Gemini CLI not installed'}
              </p>
              {installStatus.installPath && (
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Path: {installStatus.installPath}
                </p>
              )}
              {updateAvailable && (
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: theme.colors.primary,
                    fontWeight: 500,
                  }}
                >
                  🎉 Update available! Version {latestVersion} is ready to install
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Installation Progress */}
      {isInstalling && installProgress && (
        <div
          style={{
            backgroundColor: `${theme.colors.primary}10`,
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <Loader
              className="animate-spin"
              size={20}
              color={theme.colors.primary}
            />
            <span style={{ color: theme.colors.text, fontWeight: 500 }}>
              {installProgress.message}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: theme.colors.background,
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${installProgress.progress}%`,
                height: '100%',
                backgroundColor: theme.colors.primary,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            backgroundColor: `${theme.colors.error}10`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <p style={{ margin: 0, color: theme.colors.error }}>{error}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {!installStatus?.installed || !installStatus?.isOurVersion ? (
          <button
            onClick={() => handleInstall()}
            disabled={isInstalling}
            style={{
              padding: '10px 20px',
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isInstalling ? 'not-allowed' : 'pointer',
              opacity: isInstalling ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Download size={16} />
            Install Latest Version
          </button>
        ) : (
          <>
            {updateAvailable && (
              <button
                onClick={handleUpdate}
                disabled={isInstalling}
                style={{
                  padding: '10px 20px',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isInstalling ? 'not-allowed' : 'pointer',
                  opacity: isInstalling ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <Download size={16} />
                Update to v{latestVersion}
              </button>
            )}
            <button
              onClick={handleUninstall}
              disabled={isInstalling}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: theme.colors.error,
                border: `1px solid ${theme.colors.error}`,
                borderRadius: '6px',
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                opacity: isInstalling ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <Trash2 size={16} />
              Uninstall
            </button>
          </>
        )}

        <button
          onClick={checkInstallation}
          disabled={isInstalling || isChecking}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            cursor: isInstalling || isChecking ? 'not-allowed' : 'pointer',
            opacity: isInstalling || isChecking ? 0.6 : 1,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Refresh Status
        </button>

        {/* Auto-update toggle - only show when installed */}
        {installStatus?.installed && installStatus?.isOurVersion && (
          <button
            onClick={toggleAutoUpdate}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: autoUpdateEnabled ? theme.colors.success : theme.colors.textSecondary,
              border: `1px solid ${autoUpdateEnabled ? theme.colors.success : theme.colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              marginLeft: 'auto',
            }}
            title={autoUpdateEnabled ? 'Auto-update is enabled' : 'Auto-update is disabled'}
          >
            {autoUpdateEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            {autoUpdateEnabled ? 'Auto-update On' : 'Auto-update Off'}
          </button>
        )}
      </div>

      {/* Version List (collapsed by default) */}
      {availableVersions.length > 0 && (
        <details style={{ marginTop: '20px' }}>
          <summary
            style={{
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              userSelect: 'none',
            }}
          >
            Other available versions ({availableVersions.length})
          </summary>
          <div
            style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}
          >
            {availableVersions.slice(0, 5).map((version) => (
              <div
                key={version.version}
                style={{
                  padding: '8px 12px',
                  backgroundColor: theme.colors.background,
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ color: theme.colors.text, fontSize: '14px' }}>
                    v{version.version}
                  </span>
                  <span
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: '12px',
                      marginLeft: '8px',
                    }}
                  >
                    {new Date(version.releaseDate).toLocaleDateString()}
                  </span>
                </div>
                {(!installStatus?.installed ||
                  version.version !== installStatus.version) && (
                  <button
                    onClick={() => handleInstall(version.version)}
                    disabled={isInstalling}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'transparent',
                      color: theme.colors.primary,
                      border: `1px solid ${theme.colors.primary}`,
                      borderRadius: '4px',
                      cursor: isInstalling ? 'not-allowed' : 'pointer',
                      opacity: isInstalling ? 0.6 : 1,
                      fontSize: '12px',
                    }}
                  >
                    Install
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
