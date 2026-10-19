import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Trash2 } from 'lucide-react';
import { TopicService } from '../main-process-api/TopicService';
import { ConfirmDialog } from '../repo-explorer/components/ConfirmDialog';

/** Shared delete action for both local topic-tab headers. */
export const TopicDeleteHeaderButton: React.FC<{
  topicId: string;
  title?: string;
}> = ({ topicId, title }) => {
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const deleting = React.useRef(false);

  const deleteTopic = async () => {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setError(null);
    try {
      const removed = await TopicService.deleteTopic(topicId);
      if (!removed) {
        setError('This topic could not be deleted. It may already be missing.');
        return;
      }
      // TOPIC_REMOVED closes every copy of the tab, not just this one.
      setOpen(false);
    } catch {
      setError('Could not delete the topic. Please try again.');
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title="Delete topic"
        aria-label="Delete topic"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          flexShrink: 0,
          padding: 0,
          borderRadius: 6,
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
          color: theme.colors.error,
          cursor: 'pointer',
        }}
      >
        <Trash2 size={16} />
      </button>
      {open && (
        <ConfirmDialog
          title="Delete topic"
          message={
            <>
              Delete <strong>“{title || 'Untitled topic'}”</strong>? This
              permanently removes the topic, its attached images, and its
              session links. Repositories, subsystem models, and sessions are
              not deleted. This cannot be undone.
              {error && (
                <p role="alert" style={{ color: theme.colors.error }}>
                  {error}
                </p>
              )}
            </>
          }
          confirmLabel="Delete topic"
          destructive
          busy={busy}
          onConfirm={() => void deleteTopic()}
          onCancel={() => {
            if (!deleting.current) setOpen(false);
          }}
        />
      )}
    </>
  );
};
