import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Palette, FolderOpen, RefreshCw } from 'lucide-react';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { ThemeService } from '../../../../services/ThemeService';
import type { EditorId } from '../../../../../shared/types/editor.types';
import { EDITOR_LABELS } from '../../../../../shared/types/editor.types';
import { predefinedThemes, getThemeNames } from '../../../../themes/predefinedThemes';
import AppIcon from '../../../../../../assets/icons/icon-48x48.png';

export const GeneralSettings: React.FC = () => {
  const { theme } = useTheme();
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [defaultEditor, setDefaultEditor] = useState<EditorId>('vscode');
  const [defaultCloneDirectory, setDefaultCloneDirectory] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('default');
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);

  const editorOptions = useMemo(
    () => Object.entries(EDITOR_LABELS) as Array<[EditorId, string]>,
    [],
  );

  useEffect(() => {
    AppVersionManagerService.getVersion().then(setCurrentVersion);
    AppVersionManagerService.isDevMode().then(setIsDevMode);

    UserPreferencesService.getPreferences()
      .then((prefs) => {
        const editor = (prefs.defaultEditor ?? 'vscode') as EditorId;
        setDefaultEditor(editor);
        setDefaultCloneDirectory(prefs.defaultCloneDirectory || '');
      })
      .catch(() => {
        setDefaultEditor('vscode');
      });

    const currentTheme = ThemeService.getCurrentThemeName();
    setSelectedTheme(currentTheme);
    setPendingTheme(null);
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
            Choose the default directory where Git repositories will be cloned
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
              {predefinedThemes[pendingTheme || selectedTheme]?.description || 'Standard theme'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};