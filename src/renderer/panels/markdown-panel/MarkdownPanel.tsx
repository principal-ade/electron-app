import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { DocumentView } from 'themed-markdown';
import type { AnnotationSelection } from 'themed-markdown';
import 'themed-markdown/dist/index.css';
import type {
  PanelActions,
  PanelComponentProps,
} from '@principal-ade/panel-framework-core';
import type {
  DocumentNote,
  TextQuoteAnchor,
} from '../../../shared/types/document-notes.types';
import { DocumentNotesService } from '../../main-process-api/DocumentNotesService';
import { useFileWatch } from '../../hooks/useFileWatch';
import { MarkdownSelectionPill } from '../../dev-workspace/file-city-panel/MarkdownNotes';
import { NotePopover } from './NotePopover';

export interface MarkdownPanelActions extends PanelActions {
  readFile: (path: string) => Promise<string>;
}

/**
 * Strip `prefix` from `absPath` if it's a directory prefix; otherwise
 * return `absPath` unchanged. Used to convert an absolute file path into
 * a path relative to its repo root.
 */
const relativizeIfPrefix = (absPath: string, prefix: string): string => {
  if (!prefix) return absPath;
  if (absPath === prefix) return '';
  const withSep = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return absPath.startsWith(withSep) ? absPath.slice(withSep.length) : absPath;
};

/**
 * An anchor is "safe" if its `exact` text fits inside a single block-level
 * element. Anchors that span paragraphs / headings / code blocks crash
 * themed-markdown's annotation wrapper because the highlight range needs
 * to insert sibling spans across DOM parents. Detected by a blank line
 * (paragraph break) inside the exact text.
 */
const isSafeAnchor = (anchor: TextQuoteAnchor): boolean =>
  !/\n\s*\n/.test(anchor.exact);

export interface ContentChangeInfo {
  path: string;
  previousContent: string;
  newContent: string;
  charDiff: number;
  timestamp: number;
}

export interface MarkdownPanelProps
  extends PanelComponentProps<MarkdownPanelActions> {
  filePath?: string | null;
  /**
   * Absolute path of the repository the file belongs to. Used to key notes
   * per-repo; if omitted, notes fall into the repo-agnostic bucket keyed by
   * the absolute file path.
   */
  repositoryPath?: string;
  width?: number;
  onContentChange?: (change: ContentChangeInfo) => void;
}

export const MarkdownPanel: React.FC<MarkdownPanelProps> = ({
  actions,
  events,
  filePath: filePathProp,
  repositoryPath: repositoryPathProp,
  width,
  onContentChange,
}) => {
  const { theme } = useTheme();
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.0);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const previousContentRef = useRef<{ path: string; content: string } | null>(null);

  // The panel owns its file load. We re-read whenever `filePath` changes
  // or the file watcher reports a change on disk.
  const [fileState, setFileState] = useState<{
    path: string;
    content: string;
    loading: boolean;
    error: Error | null;
  } | null>(null);

  const loadFile = useCallback(async () => {
    if (!filePathProp) {
      setFileState(null);
      return;
    }
    setFileState((prev) => ({
      path: filePathProp,
      content: prev?.path === filePathProp ? prev.content : '',
      loading: true,
      error: null,
    }));
    try {
      const content = await actions.readFile(filePathProp);
      setFileState({ path: filePathProp, content, loading: false, error: null });
    } catch (err) {
      console.error('[MarkdownPanel] Failed to load file:', err);
      setFileState({
        path: filePathProp,
        content: '',
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [filePathProp, actions]);

  useEffect(() => {
    void loadFile();
  }, [loadFile]);

  // Reload when the file changes on disk.
  useFileWatch(filePathProp ?? null, loadFile, {
    enabled: !!filePathProp,
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = events.on('markdown-panel:set-preferences', (event) => {
      const payload = event.payload as { fontSizeScale?: number };
      if (payload.fontSizeScale !== undefined) {
        setFontSizeScale(payload.fontSizeScale);
      }
    });
    return unsubscribe;
  }, [events]);

  useEffect(() => {
    events.emit({
      type: 'markdown-panel:request-preferences',
      source: 'markdown-panel',
      timestamp: Date.now(),
      payload: {},
    });
  }, [events]);

  const currentFilePath = fileState?.path ?? '';
  const markdownContent = fileState?.content ?? '';
  const isMarkdown = !!currentFilePath.match(/\.(md|mdx|markdown)$/i);

  useEffect(() => {
    const prev = previousContentRef.current;

    if (!markdownContent || !currentFilePath) {
      return;
    }

    if (prev && prev.path === currentFilePath && prev.content !== markdownContent) {
      const changeInfo: ContentChangeInfo = {
        path: currentFilePath,
        previousContent: prev.content,
        newContent: markdownContent,
        charDiff: markdownContent.length - prev.content.length,
        timestamp: Date.now(),
      };

      if (onContentChange) {
        onContentChange(changeInfo);
      }

      events.emit({
        type: 'markdown-panel:content-changed',
        source: 'markdown-panel',
        timestamp: Date.now(),
        payload: changeInfo,
      });
    }

    previousContentRef.current = { path: currentFilePath, content: markdownContent };
  }, [markdownContent, currentFilePath, onContentChange, events]);

  // Notes wiring -----------------------------------------------------------
  // Key under which notes for the current document are stored. With a
  // repositoryPath we relativize so notes follow the repo; without one we
  // land in the repo-agnostic bucket keyed by the absolute path.
  const noteKey = useMemo<{
    repositoryPath: string | undefined;
    relativeFilePath: string;
  } | null>(() => {
    if (!currentFilePath) return null;
    if (repositoryPathProp) {
      return {
        repositoryPath: repositoryPathProp,
        relativeFilePath: relativizeIfPrefix(currentFilePath, repositoryPathProp),
      };
    }
    return { repositoryPath: undefined, relativeFilePath: currentFilePath };
  }, [currentFilePath, repositoryPathProp]);

  const [notes, setNotes] = useState<DocumentNote[]>([]);
  const [notesVersion, setNotesVersion] = useState(0);
  const [pendingSelection, setPendingSelection] =
    useState<AnnotationSelection | null>(null);
  const [draft, setDraft] = useState<{
    anchor: AnnotationSelection['anchor'];
    rect: DOMRect;
  } | null>(null);
  const [editing, setEditing] = useState<{
    note: DocumentNote;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    if (!noteKey) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    DocumentNotesService.list(noteKey.repositoryPath, noteKey.relativeFilePath)
      .then((result) => {
        if (!cancelled) setNotes(result);
      })
      .catch((err) => {
        console.error('[MarkdownPanel] failed to load notes', err);
        if (!cancelled) setNotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [noteKey?.repositoryPath, noteKey?.relativeFilePath, notesVersion]);

  // File change closes any open popover so we don't apply edits to the wrong doc.
  useEffect(() => {
    setPendingSelection(null);
    setDraft(null);
    setEditing(null);
  }, [noteKey?.repositoryPath, noteKey?.relativeFilePath]);

  const handleSelectionChange = useCallback(
    (selection: AnnotationSelection | null) => {
      // Ignore null selection notifications. The native selection collapses
      // for many reasons that shouldn't dismiss the pill: clicking the pill
      // itself, the textarea inside an open popover stealing focus, or the
      // synthetic-highlight re-render. The pill is dismissed by explicit
      // actions (Add note, Copy timer, Escape) or by replacing the
      // selection with a fresh one.
      if (draft || editing) return;
      if (!selection) return;
      if (!isSafeAnchor(selection.anchor)) {
        console.warn(
          '[MarkdownPanel] selection crosses block boundaries; cannot annotate. Pick text inside a single paragraph or heading.',
        );
        return;
      }
      setPendingSelection(selection);
    },
    [draft, editing],
  );

  // Escape clears the pill when no popover is open (popovers own their own
  // Escape handling).
  useEffect(() => {
    if (!pendingSelection || draft || editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingSelection(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingSelection, draft, editing]);

  const handleStartDraftFromPill = useCallback(() => {
    if (!pendingSelection) return;
    setEditing(null);
    setDraft({
      anchor: pendingSelection.anchor,
      rect: pendingSelection.rect,
    });
    setPendingSelection(null);
  }, [pendingSelection]);

  const [copied, setCopied] = useState(false);

  const handleCopySelection = useCallback(async () => {
    const text = pendingSelection?.anchor.exact;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error('[MarkdownPanel] copy failed', err);
    }
  }, [pendingSelection]);

  // After flashing "Copied", dismiss the pill + highlight. The user has
  // gotten what they wanted; leaving the selection up just gets in the way.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setPendingSelection(null);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Painting the synthetic highlight collapses the native browser selection,
  // so Cmd/Ctrl+C falls through to an empty selection by default. Intercept
  // it while the pill is showing and route through the same copy path the
  // button uses so we get the same "Copied" flash + dismissal.
  useEffect(() => {
    if (!pendingSelection || draft || editing) return;
    const handler = (e: KeyboardEvent) => {
      const isCopy = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c';
      if (!isCopy) return;
      const target = e.target as HTMLElement | null;
      // Don't override copy when the focus is inside an editable field —
      // the user might be copying from an input or textarea.
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      void handleCopySelection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingSelection, draft, editing, handleCopySelection]);

  const handleAnnotationClick = useCallback(
    (id: string, event: MouseEvent) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      const target = event.target as HTMLElement | null;
      const rect =
        target?.getBoundingClientRect() ??
        new DOMRect(event.clientX, event.clientY, 0, 0);
      setPendingSelection(null);
      setDraft(null);
      setEditing({ note, rect });
    },
    [notes],
  );

  const handleSaveDraft = useCallback(
    async (body: string) => {
      if (!noteKey || !draft) return;
      await DocumentNotesService.create(
        noteKey.repositoryPath,
        noteKey.relativeFilePath,
        { anchor: draft.anchor, body },
      );
      setDraft(null);
      setNotesVersion((v) => v + 1);
    },
    [noteKey, draft],
  );

  const handleSaveEdit = useCallback(
    async (body: string) => {
      if (!noteKey || !editing) return;
      await DocumentNotesService.update(
        noteKey.repositoryPath,
        noteKey.relativeFilePath,
        editing.note.id,
        body,
      );
      setEditing(null);
      setNotesVersion((v) => v + 1);
    },
    [noteKey, editing],
  );

  // The native browser selection isn't a reliable visual cue here: themed-
  // markdown re-renders on selection changes and the highlight flickers /
  // disappears. We synthesize a transient annotation both for the pending
  // pill state and the open-draft state so DocumentView paints the
  // anchored range using its own annotation styling.
  const DRAFT_ANNOTATION_ID = '__draft__';
  const PENDING_ANNOTATION_ID = '__pending__';
  const annotationsForView = useMemo(() => {
    const safeNotes = notes.filter((n) => {
      if (isSafeAnchor(n.anchor)) return true;
      console.warn(
        '[MarkdownPanel] hiding cross-block annotation',
        n.id,
        '— delete and re-create within a single paragraph.',
      );
      return false;
    });
    if (draft) {
      return [
        ...safeNotes,
        {
          id: DRAFT_ANNOTATION_ID,
          anchor: draft.anchor,
          metadata: { body: '', createdAt: '', updatedAt: '' },
        },
      ];
    }
    if (pendingSelection) {
      return [
        ...safeNotes,
        {
          id: PENDING_ANNOTATION_ID,
          anchor: pendingSelection.anchor,
          metadata: { body: '', createdAt: '', updatedAt: '' },
        },
      ];
    }
    return safeNotes;
  }, [notes, draft, pendingSelection]);

  const activeAnnotationId = draft
    ? DRAFT_ANNOTATION_ID
    : pendingSelection
      ? PENDING_ANNOTATION_ID
      : (editing?.note.id ?? null);

  const handleDeleteEdit = useCallback(async () => {
    if (!noteKey || !editing) return;
    await DocumentNotesService.delete(
      noteKey.repositoryPath,
      noteKey.relativeFilePath,
      editing.note.id,
    );
    setEditing(null);
    setNotesVersion((v) => v + 1);
  }, [noteKey, editing]);
  // -----------------------------------------------------------------------

  const handleFontSizeIncrease = () => {
    setFontSizeScale((prev) => {
      const newScale = Math.min(prev + 0.1, 3.0);
      events.emit({
        type: 'markdown-panel:font-scale-change',
        source: 'markdown-panel',
        timestamp: Date.now(),
        payload: { fontSizeScale: newScale },
      });
      return newScale;
    });
  };

  const handleFontSizeDecrease = () => {
    setFontSizeScale((prev) => {
      const newScale = Math.max(prev - 0.1, 0.5);
      events.emit({
        type: 'markdown-panel:font-scale-change',
        source: 'markdown-panel',
        timestamp: Date.now(),
        payload: { fontSizeScale: newScale },
      });
      return newScale;
    });
  };

  if (fileState?.loading && !fileState.content) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: theme.colors.textSecondary }}>
            Loading {fileState.path || 'file'}...
          </p>
        </div>
      </div>
    );
  }

  if (fileState?.error) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center', color: theme.colors.error }}>
          <p>Error loading markdown file</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            {fileState.error.message}
          </p>
        </div>
      </div>
    );
  }

  if (!fileState || !isMarkdown) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
        }}
      >
        <p style={{ color: theme.colors.textSecondary }}>
          Select a markdown file to preview
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <DocumentView
        content={markdownContent}
        theme={theme}
        fontSizeScale={fontSizeScale}
        onCheckboxChange={() => {}}
        slideIdPrefix="markdown-panel"
        maxWidth="100%"
        width={width}
        annotations={annotationsForView}
        activeAnnotationId={activeAnnotationId}
        onSelectionChange={handleSelectionChange}
        onAnnotationClick={handleAnnotationClick}
      />

      {!draft && !editing && pendingSelection && (
        <MarkdownSelectionPill
          rect={{
            left: pendingSelection.rect.left,
            top: pendingSelection.rect.top,
            right: pendingSelection.rect.right,
            bottom: pendingSelection.rect.bottom,
          }}
          onClick={handleStartDraftFromPill}
          onCopy={handleCopySelection}
          copied={copied}
        />
      )}

      {draft && (
        <NotePopover
          rect={draft.rect}
          onSave={handleSaveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {editing && (
        <NotePopover
          rect={editing.rect}
          initialBody={editing.note.metadata.body}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 6px',
            backgroundColor: theme.colors.backgroundLight,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            zIndex: 10,
          }}
        >
          <button
            onClick={handleFontSizeDecrease}
            title="Decrease Font Size"
            style={{
              background: 'none',
              border: `1px solid ${theme.colors.border}`,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: theme.colors.textSecondary,
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
          >
            <Minus size={14} />
          </button>

          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              userSelect: 'none',
              minWidth: '38px',
              textAlign: 'center',
              fontFamily: theme.fonts.body,
            }}
          >
            {Math.round(fontSizeScale * 100)}%
          </span>

          <button
            onClick={handleFontSizeIncrease}
            title="Increase Font Size"
            style={{
              background: 'none',
              border: `1px solid ${theme.colors.border}`,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: theme.colors.textSecondary,
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
