import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, FolderOpen, Library, X } from 'lucide-react';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { TopicService } from '../main-process-api/TopicService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { WindowService } from '../main-process-api/WindowService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';

interface NewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Create a new topic.
 *
 * v1 flow: ask only for a title. Submit creates a `Topic` record AND a
 * sibling `Workspace` whose `topicIds` references it, then opens a new
 * Alexandria workspace window pointed at the workspace. Repository
 * membership stays derived — picking a starting repo is not part of the
 * UX for now.
 */
export const NewTopicModal: React.FC<NewTopicModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [formPath, setFormPath] = useState('');
  const [baseDirectory, setBaseDirectory] = useState<string | null>(null);
  const [pathManuallyEdited, setPathManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the modal closes.
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setFormPath('');
      setPathManuallyEdited(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Load the user's base default directory when the modal opens so we can
  // suggest a sensible clone path.
  useEffect(() => {
    if (!isOpen) return;
    UserPreferencesService.getPreferences().then((prefs) => {
      setBaseDirectory(prefs.baseDefaultDirectory || null);
    });
  }, [isOpen]);

  // Default the directory to the user's base directory until they pick
  // something else.
  useEffect(() => {
    if (pathManuallyEdited || !baseDirectory) return;
    setFormPath(baseDirectory);
  }, [baseDirectory, pathManuallyEdited]);

  const handleCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the topic (persisted via the canonical TopicManager +
      //    desktop-only sync sidecar).
      const topic = await TopicService.createTopic({ title: trimmed });

      // 2. Create a workspace whose only topic is this one. Multi-topic
      //    support extends `topicIds` later; v1 is always single-topic.
      const workspace = await WorkspaceService.createWorkspace({
        name: trimmed,
        topicIds: [topic.id],
        suggestedClonePath: formPath.trim() || undefined,
      });

      // 3. Open the new workspace window.
      await WindowService.openAlexandriaWorkspace({
        workspaceId: workspace.id,
      });

      onClose();
    } catch (err) {
      console.error('[NewTopicModal] Failed to create topic:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create topic',
      );
      setIsSubmitting(false);
    }
  }, [title, formPath, onClose]);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Topic Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result && !result.canceled && result.filePaths?.[0]) {
        setFormPath(result.filePaths[0]);
        setPathManuallyEdited(true);
      }
    } catch (err) {
      console.error('[NewTopicModal] Error selecting directory:', err);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isSubmitting) {
        handleCreate();
      } else if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [handleCreate, isSubmitting, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          fontFamily: theme.fonts.body,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Library size={22} color={theme.colors.primary} />
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              New topic
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
              color: theme.colors.textSecondary,
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Title input */}
        <label
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Title
        </label>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Auth & sessions"
          disabled={isSubmitting}
          style={{
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            color: theme.colors.text,
            fontSize: theme.fontSizes[2],
            outline: 'none',
            marginBottom: 18,
          }}
        />

        {/* Directory — where the topic's workspace will live on disk. */}
        <label
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Directory
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input
            type="text"
            value={formPath}
            onChange={(e) => {
              setFormPath(e.target.value);
              setPathManuallyEdited(true);
            }}
            placeholder={baseDirectory || '/path/to/topic'}
            disabled={isSubmitting}
            style={{
              flex: 1,
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.monospace,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleBrowseDirectory}
            disabled={isSubmitting}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 8,
              padding: '0 14px',
              color: theme.colors.text,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen size={14} />
            Browse…
          </button>
        </div>
        {error && (
          <div
            style={{
              color: theme.colors.error,
              fontSize: theme.fontSizes[1],
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 8,
              padding: '8px 14px',
              color: theme.colors.text,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting || !title.trim()}
            style={{
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              cursor:
                isSubmitting || !title.trim() ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              opacity: isSubmitting || !title.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={14} />
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
