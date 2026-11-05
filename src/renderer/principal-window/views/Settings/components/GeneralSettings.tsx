import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Trash2, AlertTriangle, FolderOpen } from 'lucide-react';
import { FileCityLogo } from '@principal-ai/logo-component';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';

export const GeneralSettings: React.FC = () => {
  const { theme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  const [buildsDirectory, setBuildsDirectory] = useState<string | null>(null);
  const [isSelectingBaseDirectory, setIsSelectingBaseDirectory] =
    useState(false);
  const [isSelectingBuildsDirectory, setIsSelectingBuildsDirectory] =
    useState(false);
  const [enableVimMode, setEnableVimMode] = useState<boolean>(false);
  const [subsystemModelLayoutDirection, setSubsystemModelLayoutDirection] =
    useState<'horizontal' | 'vertical'>('vertical');
  const [openLocalhostTerminalLinksInApp, setOpenLocalhostTerminalLinksInApp] =
    useState(false);
  const [showMonitorButton, setShowMonitorButton] = useState(false);
  const [showOnboardingButton, setShowOnboardingButton] = useState(false);
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
      setEnableVimMode(prefs.enableVimMode ?? false);
      setSubsystemModelLayoutDirection(
        prefs.subsystemModelLayoutDirection === 'horizontal'
          ? 'horizontal'
          : 'vertical',
      );
      setOpenLocalhostTerminalLinksInApp(
        prefs.openLocalhostTerminalLinksInApp === true,
      );
      setShowMonitorButton(prefs.showMonitorButton ?? false);
      setShowOnboardingButton(prefs.showOnboardingButton ?? false);
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

      {/* Panel Visibility */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Panel Visibility
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
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                htmlFor="showMonitorButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Monitor Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Monitor button will appear in the side
                navigation. When disabled (default), the button is hidden.
              </p>
            </div>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px',
                flexShrink: 0,
              }}
            >
              <input
                id="showMonitorButton"
                type="checkbox"
                checked={showMonitorButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowMonitorButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showMonitorButton: newValue,
                  });
                }}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: showMonitorButton
                    ? theme.colors.primary
                    : theme.colors.border,
                  transition: '0.3s',
                  borderRadius: '24px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: showMonitorButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: theme.colors.background,
                    transition: '0.3s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Tutorials Button Toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: `1px solid ${theme.colors.border}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                htmlFor="showOnboardingButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Tutorials Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Tutorials button will appear in the side
                navigation. When disabled (default), the button is hidden.
              </p>
            </div>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px',
                flexShrink: 0,
              }}
            >
              <input
                id="showOnboardingButton"
                type="checkbox"
                checked={showOnboardingButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowOnboardingButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showOnboardingButton: newValue,
                  });
                }}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: showOnboardingButton
                    ? theme.colors.primary
                    : theme.colors.border,
                  transition: '0.3s',
                  borderRadius: '24px',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: showOnboardingButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: theme.colors.background,
                    transition: '0.3s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>
        </div>
      </div>

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
