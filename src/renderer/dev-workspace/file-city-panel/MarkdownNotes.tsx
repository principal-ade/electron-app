import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { MessageSquare, Send, Trash2, X } from 'lucide-react';

export interface MarkdownNote {
  id: string;
  /** themed-markdown anchor — same shape we send back via the API. */
  anchor: { exact: string; prefix?: string; suffix?: string };
  body: string;
  author?: string;
  /** ms epoch — projection from the persisted ISO string. */
  createdAt: number;
}

export type MarkdownNotesSelection =
  | { kind: 'thread'; noteId: string }
  | {
      kind: 'composer';
      anchor: { exact: string; prefix?: string; suffix?: string };
    };

const formatRelative = (ms: number): string => {
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const initials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
};

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

interface SelectionPillProps {
  /** Pixel rect of the current selection in the parent container's coords. */
  rect: { left: number; top: number; right: number; bottom: number };
  onClick: () => void;
}

/**
 * Floating "Add note" pill that hovers above (or just below) the active text
 * selection. Position is computed by the parent — this component just paints.
 */
export const MarkdownSelectionPill: React.FC<SelectionPillProps> = ({
  rect,
  onClick,
}) => {
  const { theme } = useTheme();
  // Anchor at the selection's end (right edge), nudged slightly above so the
  // pill doesn't overlap the highlighted text.
  const left = rect.right;
  const top = Math.max(0, rect.top - 36);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => {
        // Don't tear the live selection by stealing focus before the click.
        e.preventDefault();
      }}
      style={{
        // DOMRect coords are viewport-relative — position: fixed matches
        // them directly without container math.
        position: 'fixed',
        left,
        top,
        transform: 'translateX(-50%)',
        zIndex: 1955,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: theme.colors.primary,
        color: theme.colors.background,
        border: 'none',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        fontWeight: 600,
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.32)',
      }}
    >
      <MessageSquare size={12} />
      Add note
    </button>
  );
};

interface NotePanelProps {
  selection: MarkdownNotesSelection;
  notes: MarkdownNote[];
  style: React.CSSProperties;
  onClose: () => void;
  /** Submit composer with the pending anchor. */
  onSubmitNote: (
    anchor: { exact: string; prefix?: string; suffix?: string },
    body: string,
  ) => void;
  /** Reply to an existing thread; replies share the head's anchor. */
  onReplyNote: (noteId: string, body: string) => void;
  onDeleteNote: (id: string) => void;
}

export const MarkdownNotePanel: React.FC<NotePanelProps> = ({
  selection,
  notes,
  style,
  onClose,
  onSubmitNote,
  onReplyNote,
  onDeleteNote,
}) => {
  const { theme } = useTheme();
  const [reply, setReply] = React.useState('');

  const selectionKey =
    selection.kind === 'thread'
      ? `t-${selection.noteId}`
      : `c-${selection.anchor.exact}`;
  React.useEffect(() => {
    setReply('');
  }, [selectionKey]);

  // Thread = the selected note + any replies that anchor to the same exact
  // quote. Replies are stored as separate notes anchored to the same anchor;
  // we group them here for display.
  const threadNotes = React.useMemo(() => {
    if (selection.kind !== 'thread') return [];
    const head = notes.find((n) => n.id === selection.noteId);
    if (!head) return [];
    return notes.filter((n) => n.anchor.exact === head.anchor.exact);
  }, [notes, selection]);

  const headerQuote =
    selection.kind === 'composer'
      ? selection.anchor.exact
      : threadNotes[0]?.anchor.exact ?? '';

  return (
    <aside
      style={{
        ...style,
        background: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <MessageSquare size={14} color={theme.colors.primary} style={{ marginTop: 3 }} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {selection.kind === 'composer' ? 'New note' : 'Notes'}
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontStyle: 'italic',
              color: theme.colors.text,
              wordBreak: 'break-word',
              whiteSpace: 'normal',
              lineHeight: 1.3,
              marginTop: 2,
            }}
            title={headerQuote}
          >
            “{truncate(headerQuote, 140)}”
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={iconButton(theme.colors.textSecondary)}
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {selection.kind === 'composer' ? (
          <ComposerForm
            placeholder="Add a note about this passage…"
            submitLabel="Post note"
            onSubmit={(body) => onSubmitNote(selection.anchor, body)}
            onCancel={onClose}
          />
        ) : (
          <>
            {threadNotes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onDelete={() => onDeleteNote(n.id)}
              />
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = reply.trim();
                if (!trimmed || selection.kind !== 'thread') return;
                onReplyNote(selection.noteId, trimmed);
                setReply('');
              }}
              style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
            >
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply…"
                rows={2}
                style={textareaStyle(theme)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!reply.trim()}
                aria-label="Send reply"
                title="Send reply (⌘↵)"
                style={{
                  ...iconButton(theme.colors.primary),
                  opacity: reply.trim() ? 1 : 0.4,
                }}
              >
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
};

interface NoteCardProps {
  note: MarkdownNote;
  onDelete?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const { theme } = useTheme();
  const author = note.author ?? 'Anonymous';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Avatar name={author} theme={theme} size={22} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: theme.fontSizes[0],
          }}
        >
          <strong style={{ fontWeight: 600, color: theme.colors.text }}>
            {author}
          </strong>
          <span
            style={{
              color: theme.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatRelative(note.createdAt)}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete note"
              title="Delete note"
              style={{
                ...iconButton(theme.colors.textSecondary),
                marginLeft: 'auto',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {note.body}
        </div>
      </div>
    </div>
  );
};

interface ComposerFormProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

const ComposerForm: React.FC<ComposerFormProps> = ({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [body, setBody] = React.useState('');
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={textareaStyle(theme)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={ghostButton(theme)}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!body.trim()}
          style={{ ...primaryButton(theme), opacity: body.trim() ? 1 : 0.5 }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

interface AvatarProps {
  name: string;
  theme: ReturnType<typeof useTheme>['theme'];
  size: number;
}

const Avatar: React.FC<AvatarProps> = ({ name, theme, size }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      background: `color-mix(in srgb, ${theme.colors.primary} 25%, ${theme.colors.background})`,
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
      fontSize: Math.max(9, Math.round(size * 0.45)),
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    }}
  >
    {initials(name)}
  </span>
);

const iconButton = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color,
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
});

const textareaStyle = (
  theme: ReturnType<typeof useTheme>['theme'],
): React.CSSProperties => ({
  flex: 1,
  resize: 'vertical',
  background: theme.colors.background,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontFamily: theme.fonts.body,
  fontSize: theme.fontSizes[1],
  outline: 'none',
});

const ghostButton = (
  theme: ReturnType<typeof useTheme>['theme'],
): React.CSSProperties => ({
  padding: '6px 10px',
  background: 'transparent',
  color: theme.colors.textSecondary,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: theme.fonts.body,
  fontSize: theme.fontSizes[0],
});

const primaryButton = (
  theme: ReturnType<typeof useTheme>['theme'],
): React.CSSProperties => ({
  padding: '6px 12px',
  background: theme.colors.primary,
  color: theme.colors.background,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: theme.fonts.body,
  fontSize: theme.fontSizes[0],
  fontWeight: 600,
});
