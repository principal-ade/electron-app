import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';

interface NotePopoverProps {
  /**
   * The selection rect or anchor rect to position the popover next to.
   * Popover renders below the rect; flips above if there isn't room.
   */
  rect: DOMRect;
  /** Pre-fill the textarea (for editing an existing note). */
  initialBody?: string;
  /** Called when the user submits a non-empty body. */
  onSave: (body: string) => Promise<void> | void;
  /** Optional delete handler — when provided, the popover renders a Delete button. */
  onDelete?: () => Promise<void> | void;
  /** Called to dismiss without saving (Cancel button, Esc, click outside). */
  onCancel: () => void;
}

const POPOVER_WIDTH = 320;
const POPOVER_OFFSET = 8;

export const NotePopover: React.FC<NotePopoverProps> = ({
  rect,
  initialBody,
  onSave,
  onDelete,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [body, setBody] = useState(initialBody ?? '');
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(
      textareaRef.current.value.length,
      textareaRef.current.value.length,
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onCancel]);

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSave(trimmed);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  // Flip above the rect if there isn't room below.
  const wouldOverflowBelow =
    rect.bottom + POPOVER_OFFSET + 200 > window.innerHeight;
  const top = wouldOverflowBelow
    ? Math.max(8, rect.top - POPOVER_OFFSET - 200)
    : rect.bottom + POPOVER_OFFSET;
  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - POPOVER_WIDTH - 8,
  );

  // Render into document.body via a portal so the popover lives outside
  // DocumentView's subtree. DocumentView mutates its DOM imperatively to
  // attach annotation highlights, which can race with React's reconciliation
  // of sibling overlays and produce "insertBefore: not a child" errors.
  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: POPOVER_WIDTH,
        backgroundColor: theme.colors.backgroundLight,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 6,
        padding: 8,
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: theme.fonts.body,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note…"
        rows={4}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void handleSave();
          }
        }}
        style={{
          width: '100%',
          resize: 'vertical',
          minHeight: 72,
          padding: 6,
          fontFamily: theme.fonts.body,
          fontSize: 13,
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 4,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            style={{
              ...buttonStyle(theme),
              color: theme.colors.error,
              borderColor: theme.colors.error,
            }}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={buttonStyle(theme)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || body.trim().length === 0}
            style={{
              ...buttonStyle(theme),
              color: theme.colors.background,
              backgroundColor: theme.colors.accent ?? theme.colors.text,
              borderColor: 'transparent',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

function buttonStyle(theme: ReturnType<typeof useTheme>['theme']): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 4,
    cursor: 'pointer',
  };
}
