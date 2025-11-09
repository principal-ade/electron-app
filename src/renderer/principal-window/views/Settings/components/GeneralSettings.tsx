import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Palette, RefreshCw } from 'lucide-react';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { ThemeService } from '../../../../services/ThemeService';
import type { EditorId } from '../../../../../shared/types/editor.types';
import { EDITOR_LABELS } from '../../../../../shared/types/editor.types';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';
import {
  predefinedThemes,
  getThemeNames,
} from '../../../../themes/predefinedThemes';
import AppIcon from '../../../../../../assets/icons/icon-48x48.png';

export const GeneralSettings: React.FC = () => {
  const { theme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [defaultEditor, setDefaultEditor] = useState<EditorId>('vscode');
  const [enableVimMode, setEnableVimMode] = useState<boolean>(false);
  const [enableGitWatchingOnStartup, setEnableGitWatchingOnStartup] =
    useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('default');
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);
  const [showThemeButton, setShowThemeButton] = useState(true);
  const [showCustomizeButton, setShowCustomizeButton] = useState(true);
  const [showOpenInIDE, setShowOpenInIDE] = useState(false);
  const [showGitSyncPanel, setShowGitSyncPanel] = useState(false);
  const [showTerminalDebugButton, setShowTerminalDebugButton] = useState(false);
  const [showTerminalRecordingButton, setShowTerminalRecordingButton] =
    useState(false);
  const [showTerminalShowAllButton, setShowTerminalShowAllButton] =
    useState(true);
  const [showReposButton, setShowReposButton] = useState(false);
  const [showMonitorButton, setShowMonitorButton] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [showTerminalButton, setShowTerminalButton] = useState(false);

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
      setShowThemeButton(prefs.titlebarButtons?.theme ?? true);
      setShowCustomizeButton(prefs.titlebarButtons?.customize ?? true);
      setShowOpenInIDE(prefs.titlebarButtons?.openInIDE ?? false);
      setShowGitSyncPanel(prefs.showGitSyncPanel ?? false);
      setShowTerminalDebugButton(prefs.showTerminalDebugButton ?? false);
      setShowTerminalRecordingButton(
        prefs.showTerminalRecordingButton ?? false,
      );
      setShowTerminalShowAllButton(prefs.showTerminalShowAllButton ?? true);
      setShowReposButton(prefs.showReposButton ?? false);
      setShowMonitorButton(prefs.showMonitorButton ?? false);
      setShowSearchButton(prefs.showSearchButton ?? false);
      setShowTerminalButton(prefs.showTerminalButton ?? false);
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

    const currentTheme = ThemeService.getCurrentThemeName();
    setSelectedTheme(currentTheme);
    setPendingTheme(null);

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);


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
                alt="Principal ADE"
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
                      openInIDE: showOpenInIDE,
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
                      openInIDE: showOpenInIDE,
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
              <span>Show "Open in IDE" button (repo manager)</span>
              <input
                type="checkbox"
                checked={showOpenInIDE}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setShowOpenInIDE(enabled);
                  await UserPreferencesService.updatePreferences({
                    titlebarButtons: {
                      theme: showThemeButton,
                      customize: showCustomizeButton,
                      openInIDE: enabled,
                    },
                  });
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </label>
          </div>
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
                htmlFor="showGitSyncPanel"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Git Sync Panel
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Git Sync diagnostic panel will be visible in
                the Feed view. When disabled (default), the panel is hidden to
                reduce clutter.
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
                id="showGitSyncPanel"
                type="checkbox"
                checked={showGitSyncPanel}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowGitSyncPanel(newValue);
                  await UserPreferencesService.updatePreferences({
                    showGitSyncPanel: newValue,
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
                  backgroundColor: showGitSyncPanel
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
                    left: showGitSyncPanel ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                htmlFor="showTerminalDebugButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Terminal Debug Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, a debug button will appear in the terminal panel
                header for troubleshooting terminal sessions. When disabled
                (default), the button is hidden to reduce clutter.
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
                id="showTerminalDebugButton"
                type="checkbox"
                checked={showTerminalDebugButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowTerminalDebugButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showTerminalDebugButton: newValue,
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
                  backgroundColor: showTerminalDebugButton
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
                    left: showTerminalDebugButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                htmlFor="showTerminalRecordingButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Terminal Recording Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, a recording button will appear in the terminal
                panel header for capturing terminal output. When disabled
                (default), the button is hidden to reduce clutter.
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
                id="showTerminalRecordingButton"
                type="checkbox"
                checked={showTerminalRecordingButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowTerminalRecordingButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showTerminalRecordingButton: newValue,
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
                  backgroundColor: showTerminalRecordingButton
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
                    left: showTerminalRecordingButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                htmlFor="showTerminalShowAllButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show "All Terminals" Toggle Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled (default), a button will appear in the terminal
                panel header to toggle between showing all repository terminals
                or just the current repository's terminals.
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
                id="showTerminalShowAllButton"
                type="checkbox"
                checked={showTerminalShowAllButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowTerminalShowAllButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showTerminalShowAllButton: newValue,
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
                  backgroundColor: showTerminalShowAllButton
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
                    left: showTerminalShowAllButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                htmlFor="showReposButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Repos Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Repos button will appear in the side
                navigation. When disabled (default), the button is hidden as
                this view is deprecated.
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
                id="showReposButton"
                type="checkbox"
                checked={showReposButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowReposButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showReposButton: newValue,
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
                  backgroundColor: showReposButton
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
                    left: showReposButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                htmlFor="showTerminalButton"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  display: 'block',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                Show Terminal Button
              </label>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                When enabled, the Terminal button will appear in the side
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
                id="showTerminalButton"
                type="checkbox"
                checked={showTerminalButton}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setShowTerminalButton(newValue);
                  await UserPreferencesService.updatePreferences({
                    showTerminalButton: newValue,
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
                  backgroundColor: showTerminalButton
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
                    left: showTerminalButton ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
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
                    backgroundColor: 'white',
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
                    backgroundColor: 'white',
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
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                  }}
                />
              </span>
            </label>
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
                    await ThemeService.applyTheme(pendingTheme, true);
                    setSelectedTheme(pendingTheme);
                    setPendingTheme(null);
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
                  cursor: isApplyingTheme ? 'not-allowed' : 'pointer',
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
              {predefinedThemes[pendingTheme || selectedTheme]?.description ||
                'Standard theme'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
