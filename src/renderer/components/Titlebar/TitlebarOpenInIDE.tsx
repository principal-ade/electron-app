import React, { useCallback, useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ShellService } from '../../main-process-api/ShellService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { Repository } from '../../../shared/types/repository.types';
import type { EditorId } from '../../../shared/types/editor.types';
import { EDITOR_LABELS } from '../../../shared/types/editor.types';

interface TitlebarOpenInIDEProps {
  repository?: Repository;
}

export const TitlebarOpenInIDE: React.FC<TitlebarOpenInIDEProps> = ({
  repository
}) => {
  const { theme } = useTheme();
  const [defaultEditor, setDefaultEditor] = useState<EditorId>('vscode');

  // Load the user's preferred editor
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs.defaultEditor) {
          setDefaultEditor(prefs.defaultEditor);
        }
      } catch (error) {
        console.error('Failed to load editor preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  const getRepositoryPath = useCallback(() => {
    if (!repository) return null;

    // Check if repository has localClones and use the first one
    if (repository.localClones && repository.localClones.length > 0) {
      return repository.localClones[0].path;
    }

    // Fallback to local_path if it exists
    if ('local_path' in repository && repository.local_path) {
      return repository.local_path;
    }

    return null;
  }, [repository]);

  const handleOpenInDefaultIDE = useCallback(async () => {
    const repoPath = getRepositoryPath();
    if (!repoPath) return;

    try {
      const result = await ShellService.openInEditor({
        editor: defaultEditor,
        dir: repoPath,
      });
      if (!result.success) {
        console.error('Failed to open in IDE:', result.error);
      }
    } catch (error) {
      console.error('Error opening in IDE:', error);
    }
  }, [getRepositoryPath, defaultEditor]);

  if (!repository) {
    return null;
  }

  const editorName = EDITOR_LABELS[defaultEditor] || 'IDE';

  return (
    <button
      onClick={handleOpenInDefaultIDE}
      style={{
        WebkitAppRegion: 'no-drag' as any,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: 'transparent',
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: '32px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
      title={`Open repository in ${editorName}`}
    >
      <span>Open in {editorName}</span>
    </button>
  );
};