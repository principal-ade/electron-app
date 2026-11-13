import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Trash2, AlertTriangle, FolderOpen } from 'lucide-react';
import { FileCityLogo } from '@principal-ai/logo-component';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';
import { SidebarNavigationSettings } from './SidebarNavigationSettings';
import {
  DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS,
  type UserPreferences,
} from '../../../../../shared/types/userPreferences.types';
import {
  AUTO_SYNC_INTERVAL_OPTIONS,
  formatAutoSyncInterval,
  normalizeAutoSyncSettings,
} from '../../../syncAll/autoSyncPrefs';

export const GeneralSettings: React.FC = () => {
  const { theme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  const [buildsDirectory, setBuildsDirectory] = useState<string | null>(null);
  const [
    buildTerminalCleanupDelayMinutes,
    setBuildTerminalCleanupDelayMinutes,
  ] = useState(DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS / 60_000);
  const [isSelectingBaseDirectory, setIsSelectingBaseDirectory] =
    useState(false);
  const [isSelectingBuildsDirectory, setIsSelectingBuildsDirectory] =
    useState(false);
  const [enableVimMode, setEnableVimMode] = useState<boolean>(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(false);
  const [autoSyncIntervalMinutes, setAutoSyncIntervalMinutes] =
    useState<number>(normalizeAutoSyncSettings(null).intervalMinutes);
  const [subsystemModelLayoutDirection, setSubsystemModelLayoutDirection] =
    useState<'horizontal' | 'vertical'>('vertical');
  const [openLocalhostTerminalLinksInApp, setOpenLocalhostTerminalLinksInApp] =
    useState(false);
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('ghostty');
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    AppVersionManagerService.getVersion().then(setCurrentVersion);
    AppVersionManagerService.isDevMode().then(setIsDevMode);

    let isMounted = true;

    const applyPreferences = (prefs: UserPreferences) => {
      if (!isMounted) return;

      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
      setBuildsDirectory(prefs.buildsDirectory || null);
      const savedCleanupDelayMs = prefs.buildTerminalCleanupDelayMs;
      const cleanupDelayMs =
        typeof savedCleanupDelayMs === 'number' &&
        Number.isFinite(savedCleanupDelayMs) &&
        savedCleanupDelayMs >= 0
          ? savedCleanupDelayMs
          : DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS;
      setBuildTerminalCleanupDelayMinutes(
        Math.max(0, Math.min(1440, Math.floor(cleanupDelayMs / 60_000))),
      );
      setEnableVimMode(prefs.enableVimMode ?? false);
      const autoSync = normalizeAutoSyncSettings(prefs);
      setAutoSyncEnabled(autoSync.enabled);
      setAutoSyncIntervalMinutes(autoSync.intervalMinutes);
      setSubsystemModelLayoutDirection(
        prefs.subsystemModelLayoutDirection === 'horizontal'
          ? 'horizontal'
          : 'vertical',
      );
      setOpenLocalhostTerminalLinksInApp(
        prefs.openLocalhostTerminalLinksInApp === true,
      );
      setTerminalImplementation(
        prefs.terminalImplementation === 'xterm' ? 'xterm' : 'ghostty',
      );
    };

    UserPreferencesService.getPreferences()
      .then(applyPreferences)
      .catch(() => {
        setEnableVimMode(false);
      });

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        applyPreferences(detail);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  const handleSelectBaseDirectory = async () => {
    setIsSelectingBaseDirectory(true);
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Base Default Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result || result.canceled || !result.filePaths?.[0]) {
        return;
      }

      const directory = result.filePaths[0];
      setBaseDefaultDirectory(directory);
      await UserPreferencesService.updatePreferences({
        baseDefaultDirectory: directory,
      });
    } catch (error) {
      console.error(
        '[GeneralSettings] Failed to select base directory:',
        error,
      );
    } finally {
      setIsSelectingBaseDirectory(false);
    }
  };

  const handleClearBaseDirectory = async () => {
    setBaseDefaultDirectory(null);
    await UserPreferencesService.updatePreferences({
      baseDefaultDirectory: undefined,
    });
  };

  const handleSelectBuildsDirectory = async () => {
    setIsSelectingBuildsDirectory(true);
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Builds Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result || result.canceled || !result.filePaths?.[0]) {
        return;
      }

      const directory = result.filePaths[0];
      setBuildsDirectory(directory);
      await UserPreferencesService.updatePreferences({
        buildsDirectory: directory,
      });
    } catch (error) {
      console.error(
        '[GeneralSettings] Failed to select builds directory:',
        error,
      );
    } finally {
      setIsSelectingBuildsDirectory(false);
    }
  };

  const handleClearBuildsDirectory = async () => {
    setBuildsDirectory(null);
    await UserPreferencesService.updatePreferences({
      buildsDirectory: undefined,
    });
  };

  const handleBuildTerminalCleanupDelayChange = async (value: string) => {
    if (value.trim() === '') return;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) return;
    setBuildTerminalCleanupDelayMinutes(minutes);
    await UserPreferencesService.updatePreferences({
      buildTerminalCleanupDelayMs: minutes * 60_000,
    });
  };

  const persistAutoSync = async (enabled: boolean, intervalMinutes: number) => {
    await UserPreferencesService.updatePreferences({
      repositoryAutoSync: { enabled, intervalMinutes },
    });
  };

  const handleAutoSyncEnabledChange = async (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    await persistAutoSync(enabled, autoSyncIntervalMinutes);
  };

  const handleAutoSyncIntervalChange = async (minutes: number) => {
    setAutoSyncIntervalMinutes(minutes);
    await persistAutoSync(autoSyncEnabled, minutes);
  };

  const handleClearAllData = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setIsClearing(true);
    try {
      const result = await AlexandriaService.clearAllData();
      alert(
        `Successfully cleared all data!\n\nRepositories removed: ${result.repositoriesRemoved}\nWorkspaces removed: ${result.workspacesRemoved}\n\nLocal files were NOT deleted.`,
      );
      setShowClearConfirm(false);
    } catch (error) {
      alert(
        `Failed to clear data: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
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
          About Principal ADE
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
            {/* ANIMATED-LOGO-TODO: was the animated sphere Logo; static for now. */}
            <FileCityLogo
              mark="P"
              width={48}
              height={48}
              primary={theme.colors.primary}
              color={theme.colors.text}
              background="transparent"
            />
            <div>
              <p
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: '0 0 4px 0',
                }}
              >
                Principal ADE
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
              margin: 0,
              color: theme.colors.textSecondary,
            }}
          >
            Frame.io for code collaboration
          </p>
        </div>
      </div>

      {/* Base Directory */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Base Directory
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
            Where Principal clones and organizes your projects, using the
            owner/repo layout.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <code
              data-testid="base-default-directory"
              style={{
                flex: '1 1 320px',
                minWidth: 0,
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: baseDefaultDirectory
                  ? theme.colors.text
                  : theme.colors.textSecondary,
                fontSize: '14px',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {baseDefaultDirectory || 'Not set'}
            </code>
            <button
              onClick={handleSelectBaseDirectory}
              disabled={isSelectingBaseDirectory}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: '#ffffff',
                cursor: isSelectingBaseDirectory ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSelectingBaseDirectory ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              <FolderOpen size={16} />
              {baseDefaultDirectory ? 'Change Folder…' : 'Choose Folder…'}
            </button>
            {baseDefaultDirectory && (
              <button
                onClick={handleClearBaseDirectory}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Clear
              </button>
            )}
          </div>
          {baseDefaultDirectory && (
            <p
              style={{
                fontSize: '13px',
                color: theme.colors.textSecondary,
                margin: '12px 0 0 0',
                fontFamily: 'monospace',
              }}
            >
              Example: {baseDefaultDirectory}/octocat/hello-world
            </p>
          )}
        </div>
      </div>

      {/* Builds Directory */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Builds Directory
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
            Where build configurations check out and run, using the owner/repo
            layout — separate from your working clones. Falls back to the base
            directory when unset.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <code
              data-testid="builds-directory"
              style={{
                flex: '1 1 320px',
                minWidth: 0,
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: buildsDirectory
                  ? theme.colors.text
                  : theme.colors.textSecondary,
                fontSize: '14px',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {buildsDirectory || 'Not set (uses base directory)'}
            </code>
            <button
              onClick={handleSelectBuildsDirectory}
              disabled={isSelectingBuildsDirectory}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: '#ffffff',
                cursor: isSelectingBuildsDirectory ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSelectingBuildsDirectory ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              <FolderOpen size={16} />
              {buildsDirectory ? 'Change Folder…' : 'Choose Folder…'}
            </button>
            {buildsDirectory && (
              <button
                onClick={handleClearBuildsDirectory}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Clear
              </button>
            )}
          </div>
          {(buildsDirectory || baseDefaultDirectory) && (
            <p
              style={{
                fontSize: '13px',
                color: theme.colors.textSecondary,
                margin: '12px 0 0 0',
                fontFamily: 'monospace',
              }}
            >
              Example: {(buildsDirectory || baseDefaultDirectory) as string}
              /octocat/hello-world
            </p>
          )}
        </div>
      </div>

      {/* Build Terminal Cleanup */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Build Terminal Cleanup
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
            Keep completed build terminals available for inspection, then close
            their idle shells. Set to 0 to close immediately.
          </p>
          <label
            htmlFor="build-terminal-cleanup-delay"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              color: theme.colors.text,
            }}
          >
            Close after
            <input
              id="build-terminal-cleanup-delay"
              data-testid="build-terminal-cleanup-delay"
              type="number"
              min={0}
              max={1440}
              step={1}
              value={buildTerminalCleanupDelayMinutes}
              onChange={(event) =>
                void handleBuildTerminalCleanupDelayChange(event.target.value)
              }
              style={{
                width: '88px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
              }}
            />
            minutes
          </label>
        </div>
      </div>

      {/* Clone Auto-Sync */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Clone Auto-Sync
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
            Periodically fast-forward registered clones that can be safely
            fast-forwarded — the same safe check as Sync all in Sky View. Runs
            while the app is open; progress shows in the titlebar.
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) =>
                void handleAutoSyncEnabledChange(e.target.checked)
              }
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
              }}
            />
            <span style={{ color: theme.colors.text }}>
              Automatically sync clones on an interval
            </span>
          </label>
          <label
            htmlFor="clone-auto-sync-interval"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '12px',
              fontSize: '14px',
              color: autoSyncEnabled
                ? theme.colors.text
                : theme.colors.textSecondary,
            }}
          >
            Every
            <select
              id="clone-auto-sync-interval"
              value={autoSyncIntervalMinutes}
              disabled={!autoSyncEnabled}
              onChange={(e) =>
                void handleAutoSyncIntervalChange(Number(e.target.value))
              }
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: autoSyncEnabled ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                opacity: autoSyncEnabled ? 1 : 0.6,
              }}
            >
              {AUTO_SYNC_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatAutoSyncInterval(minutes)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Terminal Renderer */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Terminal Renderer
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
            Choose the terminal engine. Ghostty runs Ghostty's VT engine via
            WebAssembly; XTerm uses xterm.js.
          </p>
          <select
            value={terminalImplementation}
            onChange={async (e) => {
              const value = e.target.value as 'xterm' | 'ghostty';
              setTerminalImplementation(value);
              await UserPreferencesService.updatePreferences({
                terminalImplementation: value,
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
            <option value="ghostty">Ghostty (default)</option>
            <option value="xterm">XTerm</option>
          </select>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              color: theme.colors.text,
            }}
          >
            <input
              type="checkbox"
              checked={openLocalhostTerminalLinksInApp}
              onChange={async (event) => {
                const enabled = event.target.checked;
                setOpenLocalhostTerminalLinksInApp(enabled);
                await UserPreferencesService.updatePreferences({
                  openLocalhostTerminalLinksInApp: enabled,
                });
              }}
              aria-describedby="terminal-localhost-links-description"
            />
            Open localhost terminal links in an app tab
          </label>
          <p
            id="terminal-localhost-links-description"
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              margin: '8px 0 0',
            }}
          >
            Opens HTTP links with an explicit localhost port in the main
            Principal window. Other links, or links without an available app tab
            host, open in your default browser. Applies immediately.
          </p>
        </div>
      </div>

      {/* Subsystem Diagram Layout */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Subsystem Diagrams
        </h4>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <label
            htmlFor="subsystem-model-layout-direction"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: theme.colors.text,
              marginBottom: '8px',
            }}
          >
            Default layout direction
          </label>
          <p
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              margin: '0 0 12px',
            }}
          >
            Sets the initial direction for diagrams that do not already have a
            saved layout.
          </p>
          <select
            id="subsystem-model-layout-direction"
            value={subsystemModelLayoutDirection}
            onChange={async (event) => {
              const value = event.target.value as 'horizontal' | 'vertical';
              setSubsystemModelLayoutDirection(value);
              await UserPreferencesService.updatePreferences({
                subsystemModelLayoutDirection: value,
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
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
      </div>

      {/* Vim Mode */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Vim Mode
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
            Enable vim key bindings in Monaco code editors
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={enableVimMode}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setEnableVimMode(enabled);
                await UserPreferencesService.updatePreferences({
                  enableVimMode: enabled,
                });
              }}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
              }}
            />
            <span style={{ color: theme.colors.text }}>
              Enable Vim mode for file preview and code editors
            </span>
          </label>
        </div>
      </div>

      <SidebarNavigationSettings />

      {/* Data Management */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Data Management
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
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: theme.colors.error + '20',
              }}
            >
              <AlertTriangle size={20} color={theme.colors.error} />
            </div>
            <div style={{ flex: 1 }}>
              <h5
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: theme.colors.text,
                }}
              >
                Clear All Alexandria Data
              </h5>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                  marginBottom: '16px',
                }}
              >
                Remove all registered repositories and workspaces from the
                Alexandria registry. This is useful before uninstalling the app.{' '}
                <strong>Local repository files will NOT be deleted</strong>,
                only the registry data.
              </p>
              {!showClearConfirm ? (
                <button
                  onClick={handleClearAllData}
                  disabled={isClearing}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.error}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.error,
                    cursor: isClearing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: isClearing ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isClearing) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.error + '10';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                >
                  <Trash2 size={16} />
                  Clear All Data
                </button>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: theme.colors.error + '10',
                    border: `1px solid ${theme.colors.error}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.error,
                      marginBottom: '12px',
                    }}
                  >
                    Are you absolutely sure?
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      marginBottom: '16px',
                    }}
                  >
                    This action will permanently remove all repository and
                    workspace data from the registry. This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleClearAllData}
                      disabled={isClearing}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: theme.colors.error,
                        color: theme.colors.background,
                        cursor: isClearing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: isClearing ? 0.6 : 1,
                      }}
                    >
                      {isClearing ? (
                        <>
                          <RefreshCw
                            size={14}
                            style={{
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                          Clearing...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Yes, Clear All Data
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      disabled={isClearing}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        cursor: isClearing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        opacity: isClearing ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
