import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { Logo } from '@principal-ai/logo-component';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import type { EditorId } from '../../../../../shared/types/editor.types';
import { EDITOR_LABELS } from '../../../../../shared/types/editor.types';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';
import { USER_PREFERENCE_DEFAULTS } from '../../../../../shared/types/userPreferences.types';

export const GeneralSettings: React.FC = () => {
  const { theme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [defaultEditor, setDefaultEditor] = useState<EditorId>('vscode');
  const [enableVimMode, setEnableVimMode] = useState<boolean>(false);
  const [enableGitWatchingOnStartup, setEnableGitWatchingOnStartup] =
    useState<boolean>(false);
  const [showThemeButton, setShowThemeButton] = useState(false);
  const [showCustomizeButton, setShowCustomizeButton] = useState(false);
  const [showPullMailbox, setShowPullMailbox] = useState(false);
  const [showCreateRepoButton, setShowCreateRepoButton] = useState(false);
  const [showMonitorButton, setShowMonitorButton] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [showProcessesButton, setShowProcessesButton] = useState(false);
  const [showOnboardingButton, setShowOnboardingButton] = useState(false);
  const [presenceAutoConnect, setPresenceAutoConnect] = useState(
    USER_PREFERENCE_DEFAULTS.presenceAutoConnect,
  );
  const [showAlexandriaHookDebug, setShowAlexandriaHookDebug] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const editorOptions = useMemo(
    () => Object.entries(EDITOR_LABELS) as Array<[EditorId, string]>,
    [],
  );

  useEffect(() => {
    AppVersionManagerService.getVersion().then(setCurrentVersion);
    AppVersionManagerService.isDevMode().then(setIsDevMode);

    let isMounted = true;

    const applyPreferences = (prefs: UserPreferences) => {
      if (!isMounted) return;

      const editor = (prefs.defaultEditor ?? 'vscode') as EditorId;
      setDefaultEditor(editor);
      setEnableVimMode(prefs.enableVimMode ?? false);
      setEnableGitWatchingOnStartup(prefs.enableGitWatchingOnStartup ?? false);
      setShowThemeButton(prefs.titlebarButtons?.theme ?? false);
      setShowCustomizeButton(prefs.titlebarButtons?.customize ?? false);
      setShowPullMailbox(prefs.titlebarButtons?.pullMailbox ?? false);
      setShowCreateRepoButton(
        prefs.titlebarButtons?.createRepository ?? false,
      );
      setShowMonitorButton(prefs.showMonitorButton ?? false);
      setShowSearchButton(prefs.showSearchButton ?? false);
      setShowProcessesButton(prefs.showProcessesButton ?? false);
      setShowOnboardingButton(prefs.showOnboardingButton ?? false);
      setPresenceAutoConnect(
        prefs.presenceAutoConnect ?? USER_PREFERENCE_DEFAULTS.presenceAutoConnect,
      );
      setShowAlexandriaHookDebug(
        prefs.alexandriaWorkspace?.titlebar?.hookDebug ?? false,
      );
    };

    UserPreferencesService.getPreferences()
      .then(applyPreferences)
      .catch(() => {
        setDefaultEditor('vscode');
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
      alert(`Failed to clear data: ${error instanceof Error ? error.message : String(error)}`);
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
            <Logo
              width={48}
              height={48}
              color={theme.colors.primary}
              particleColor={theme.colors.text}
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
              margin: '0 0 12px 0',
              color: theme.colors.textSecondary,
            }}
          >
            A powerful tool for creating and presenting markdown slides, with
            integrated AI assistance and code analysis capabilities.
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
            Choose your preferred editor for opening local repositories
          </p>
          <select
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

      {/* Titlebar Button Visibility */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Titlebar Buttons
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
              margin: '0 0 16px 0',
            }}
          >
            Choose which buttons appear in the titlebar
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '14px',
                color: theme.colors.text,
              }}
            >
              <span>Show theme selector button</span>
              <input
                type="checkbox"
                checked={showThemeButton}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setShowThemeButton(enabled);
                  await UserPreferencesService.updatePreferences({
                    titlebarButtons: {
                      theme: enabled,
                      customize: showCustomizeButton,
                      pullMailbox: showPullMailbox,
                    },
                  });
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '14px',
                color: theme.colors.text,
              }}
            >
              <span>Show theme customization button</span>
              <input
                type="checkbox"
                checked={showCustomizeButton}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setShowCustomizeButton(enabled);
                  await UserPreferencesService.updatePreferences({
                    titlebarButtons: {
                      theme: showThemeButton,
                      customize: enabled,
                      pullMailbox: showPullMailbox,
                    },
                  });
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '14px',
                color: theme.colors.text,
              }}
            >
              <span>Show pull mailbox (notifications)</span>
              <input
                type="checkbox"
                checked={showPullMailbox}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setShowPullMailbox(enabled);
                  await UserPreferencesService.updatePreferences({
                    titlebarButtons: {
                      theme: showThemeButton,
                      customize: showCustomizeButton,
                      pullMailbox: enabled,
                    },
                  });
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '14px',
                color: theme.colors.text,
              }}
            >
              <span>Show create-repository button</span>
              <input
                type="checkbox"
                checked={showCreateRepoButton}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setShowCreateRepoButton(enabled);
                  await UserPreferencesService.updatePreferences({
                    titlebarButtons: {
                      createRepository: enabled,
                    },
                  });
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Alexandria Workspace */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Alexandria Workspace
        </h4>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              fontSize: '14px',
              color: theme.colors.text,
            }}
          >
            <span>Show Hook Debug segment in titlebar</span>
            <input
              type="checkbox"
              checked={showAlexandriaHookDebug}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setShowAlexandriaHookDebug(enabled);
                await UserPreferencesService.updatePreferences({
                  alexandriaWorkspace: {
                    titlebar: { hookDebug: enabled },
                  },
                });
              }}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
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
          {/* Presence Auto-Connect */}
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
                htmlFor="presenceAutoConnect"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Auto-Connect to Presence on Startup
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled (default), automatically connects to the presence
                server on app startup if you're authenticated with GitHub. You
                can manually control your connection in the Auth view.
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
                id="presenceAutoConnect"
                type="checkbox"
                checked={presenceAutoConnect}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setPresenceAutoConnect(newValue);
                  await UserPreferencesService.updatePreferences({
                    presenceAutoConnect: newValue,
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
                  backgroundColor: presenceAutoConnect
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
                    left: presenceAutoConnect ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: theme.colors.background,
                    transition: '0.3s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>
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
                htmlFor="showSearchButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Search Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Search button will appear in the side
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
                id="showSearchButton"
                type="checkbox"
                checked={showSearchButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowSearchButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showSearchButton: newValue,
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
                  backgroundColor: showSearchButton
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
                    left: showSearchButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: theme.colors.background,
                    transition: '0.3s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
          </div>
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
                htmlFor="showProcessesButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Processes Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Processes button will appear in the side
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
                id="showProcessesButton"
                type="checkbox"
                checked={showProcessesButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowProcessesButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showProcessesButton: newValue,
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
                  backgroundColor: showProcessesButton
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
                    left: showProcessesButton ? '27px' : '3px',
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

      {/* Git Watching on Startup */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Repository Monitoring
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
                htmlFor="enableGitWatchingOnStartup"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Enable Git Watching on Startup
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, all repositories will be monitored for changes on
                app startup. When disabled (recommended), git watching will only
                be enabled when you open a repository window, reducing resource
                usage.
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
                id="enableGitWatchingOnStartup"
                type="checkbox"
                checked={enableGitWatchingOnStartup}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setEnableGitWatchingOnStartup(newValue);
                  await UserPreferencesService.updatePreferences({
                    enableGitWatchingOnStartup: newValue,
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
                  backgroundColor: enableGitWatchingOnStartup
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
                    left: enableGitWatchingOnStartup ? '27px' : '3px',
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
                Alexandria registry. This is useful before uninstalling the
                app. <strong>Local repository files will NOT be deleted</strong>
                , only the registry data.
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
