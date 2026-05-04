import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { MessageSquare, Send, Trash2, X } from 'lucide-react';

export interface ComposerRange extends SnippetUiRange {
  startLineText: string;
  endLineText: string;
}

export type NotesSelection =
  | { kind: 'thread'; threadKey: string }
  | { kind: 'composer'; ranges: ComposerRange[] };

export interface SnippetUiRange {
  startLine: number;
  endLine: number;
}

export interface SnippetNote {
  id: string;
  /**
   * Stable key identifying the thread this note belongs to. Notes with the
   * same threadKey are rendered together; replies share the head's threadKey.
   */
  threadKey: string;
  /** Disjoint ranges this note is anchored to. Each gets its own indicator pill. */
  ranges: SnippetUiRange[];
  body: string;
  author?: string;
  createdAt: number;
}

export const computeThreadKey = (ranges: SnippetUiRange[]): string =>
  ranges
    .map((r) => `${r.startLine}-${r.endLine}`)
    .slice()
    .sort()
    .join(',');

export const formatRangeLabel = (range: SnippetUiRange): string =>
  range.startLine === range.endLine
    ? `Line ${range.startLine}`
    : `Lines ${range.startLine}–${range.endLine}`;

export const formatRangesLabel = (ranges: SnippetUiRange[]): string => {
  if (ranges.length === 0) return '';
  if (ranges.length === 1) return formatRangeLabel(ranges[0]);
  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);
  return sorted.map(formatRangeLabel).join(' · ');
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

interface IndicatorProps {
  /** Notes belonging to this pill's thread (shared threadKey). */
  notes: SnippetNote[];
  /** Range this pill is anchored to (one note has one pill per range). */
  range: SnippetUiRange;
  active?: boolean;
  /** While a composer is open we dim and disable existing pills. */
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Compact, inline pill rendered by Pierre under an annotated line. Signals
 * "there's a note here" without showing the full thread — the actual UI
 * lives in `<SnippetNotePanel>` to the side.
 */
export const SnippetNoteIndicator: React.FC<IndicatorProps> = ({
  notes,
  range,
  active,
  disabled,
  onClick,
}) => {
  const { theme } = useTheme();
  if (notes.length === 0) return null;
  const head = notes[0];
  const author = head.author ?? 'Anonymous';
  const tint = active ? 22 : 10;
  const opacity = disabled ? 0.45 : 1;
  const cursor = disabled ? 'default' : 'pointer';
  const rangeLabel =
    range.startLine === range.endLine
      ? null
      : `${range.startLine}–${range.endLine}`;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        margin: '3px 8px',
        padding: '3px 8px',
        background: `color-mix(in srgb, ${theme.colors.primary} ${tint}%, ${theme.colors.background})`,
        border: `1px solid color-mix(in srgb, ${theme.colors.primary} ${active ? 60 : 35}%, ${theme.colors.border})`,
        borderRadius: 999,
        cursor,
        opacity,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        lineHeight: 1.2,
      }}
    >
      <MessageSquare size={12} color={theme.colors.primary} />
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {notes.length}
      </span>
      <span
        style={{
          color: theme.colors.textSecondary,
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {author}
      </span>
      {rangeLabel && (
        <span
          style={{
            color: theme.colors.textSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rangeLabel}
        </span>
      )}
    </button>
  );
};

interface NotePanelProps {
  /** Selection state — drives whether the panel renders thread or composer. */
  selection: NotesSelection;
  /** All notes for the snippet (panel filters by threadKey for thread mode). */
  notes: SnippetNote[];
  /** Position the panel relative to its absolutely-positioned ancestor. */
  style: React.CSSProperties;
  onClose: () => void;
  /** Submit composer with the current ranges. */
  onSubmitNote: (ranges: ComposerRange[], body: string) => void;
  /** Reply to an existing thread; replies share the head's ranges. */
  onReplyNote: (threadKey: string, body: string) => void;
  onDeleteNote: (id: string) => void;
  /** Remove one range chip from the composer. */
  onRemoveComposerRange: (range: SnippetUiRange) => void;
}

export const SnippetNotePanel: React.FC<NotePanelProps> = ({
  selection,
  notes,
  style,
  onClose,
  onSubmitNote,
  onReplyNote,
  onDeleteNote,
  onRemoveComposerRange,
}) => {
  const { theme } = useTheme();
  const [reply, setReply] = React.useState('');

  const selectionKey =
    selection.kind === 'thread'
      ? `t-${selection.threadKey}`
      : `c-${selection.ranges.map((r) => `${r.startLine}-${r.endLine}`).join(',')}`;
  React.useEffect(() => {
    setReply('');
  }, [selectionKey]);

  const threadNotes = React.useMemo(() => {
    if (selection.kind !== 'thread') return [];
    return notes.filter((n) => n.threadKey === selection.threadKey);
  }, [notes, selection]);

  const headerLabel =
    selection.kind === 'composer'
      ? formatRangesLabel(selection.ranges)
      : threadNotes[0]
        ? formatRangesLabel(threadNotes[0].ranges)
        : '';

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
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <MessageSquare size={14} color={theme.colors.primary} />
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
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={headerLabel}
          >
            {headerLabel}
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

      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {selection.kind === 'composer' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selection.ranges.map((r) => (
                <RangeChip
                  key={`${r.startLine}-${r.endLine}`}
                  range={r}
                  onRemove={() => onRemoveComposerRange(r)}
                />
              ))}
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                }}
              >
                Drag the gutter to add another range.
              </span>
            </div>
            <ComposerForm
              placeholder={
                selection.ranges.length > 1
                  ? 'Add a note about these lines…'
                  : 'Add a note about this line…'
              }
              submitLabel="Post note"
              onSubmit={(body) => onSubmitNote(selection.ranges, body)}
              onCancel={onClose}
            />
          </>
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
                if (!trimmed) return;
                onReplyNote(selection.threadKey, trimmed);
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
  note: SnippetNote;
  onDelete?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const { theme } = useTheme();
  const author = note.author ?? 'Anonymous';
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
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

interface RangeChipProps {
  range: SnippetUiRange;
  onRemove: () => void;
}

const RangeChip: React.FC<RangeChipProps> = ({ range, onRemove }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px 4px 10px',
        borderRadius: 6,
        border: `1px solid color-mix(in srgb, ${theme.colors.primary} 40%, ${theme.colors.border})`,
        background: `color-mix(in srgb, ${theme.colors.primary} 8%, ${theme.colors.background})`,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        color: theme.colors.text,
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {formatRangeLabel(range)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove range"
        title="Remove range"
        style={{
          ...iconButton(theme.colors.textSecondary),
          marginLeft: 'auto',
        }}
      >
        <X size={12} />
      </button>
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
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
          style={{
            ...primaryButton(theme),
            opacity: body.trim() ? 1 : 0.5,
          }}
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
