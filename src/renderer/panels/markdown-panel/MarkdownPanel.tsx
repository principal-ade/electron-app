import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { DocumentView } from 'themed-markdown';
import type { AnnotationSelection } from 'themed-markdown';
import type { RepositoryInfo } from '@principal-ade/markdown-utils';
import 'themed-markdown/dist/index.css';
import type {
  PanelActions,
  ActiveFileContext,
  PanelComponentProps,
} from '@principal-ade/panel-framework-core';
import type {
  DocumentNote,
  TextQuoteAnchor,
} from '../../../shared/types/document-notes.types';
import { DocumentNotesService } from '../../main-process-api/DocumentNotesService';
import { NotePopover } from './NotePopover';

export interface MarkdownPanelActions extends PanelActions {
  readFile: (path: string) => Promise<string>;
}

export interface MarkdownPanelContext extends ActiveFileContext {}

const getBasePath = (filePath: string): string => {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
};

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
  extends PanelComponentProps<MarkdownPanelActions, MarkdownPanelContext> {
  filePath?: string | null;
  /**
   * Absolute path of the repository the file belongs to. Used to key notes
   * per-repo when the panel is loading via `filePath` (the slice path
   * derives this from the active-file source instead).
   */
  repositoryPath?: string;
  width?: number;
  onContentChange?: (change: ContentChangeInfo) => void;
}

export const MarkdownPanel: React.FC<MarkdownPanelProps> = ({
  context,
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

  const [propBasedContent, setPropBasedContent] = useState<{
    path: string;
    content: string;
    loading: boolean;
    error: Error | null;
  } | null>(null);

  useEffect(() => {
    if (!filePathProp) {
      setPropBasedContent(null);
      return;
    }

    if (propBasedContent?.path === filePathProp && !propBasedContent.loading) {
      return;
    }

    const loadContent = async () => {
      console.log('[MarkdownPanel] Loading file from prop:', filePathProp);
      setPropBasedContent({ path: filePathProp, content: '', loading: true, error: null });

      try {
        const content = await actions.readFile(filePathProp);
        setPropBasedContent({ path: filePathProp, content, loading: false, error: null });
      } catch (err) {
        console.error('[MarkdownPanel] Failed to load file:', err);
        setPropBasedContent({
          path: filePathProp,
          content: '',
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    };

    loadContent();
  }, [filePathProp, actions]);

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

  const { activeFile: activeFileSlice } = context;

  const usePropBasedContent = filePathProp && propBasedContent?.path === filePathProp;

  const activeFile = usePropBasedContent
    ? {
        data: {
          path: propBasedContent.path,
          content: propBasedContent.content,
          type: 'markdown' as const,
        },
        loading: propBasedContent.loading,
        error: propBasedContent.error,
      }
    : activeFileSlice;

  const isMarkdown =
    activeFile?.data?.type === 'markdown' ||
    activeFile?.data?.path?.match(/\.(md|mdx|markdown)$/i);

  const markdownContent = activeFile?.data?.content || '';
  const currentFilePath = activeFile?.data?.path || '';

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

      console.log('[MarkdownPanel] Content changed:', {
        path: currentFilePath,
        charDiff: changeInfo.charDiff,
      });
    }

    previousContentRef.current = { path: currentFilePath, content: markdownContent };
  }, [markdownContent, currentFilePath, onContentChange, events]);

  const repositoryInfo: RepositoryInfo | undefined = useMemo(() => {
    if (usePropBasedContent || !activeFileSlice?.data) return undefined;

    const source = 'source' in activeFileSlice.data ? activeFileSlice.data.source : undefined;
    if (!source) return undefined;

    const branch =
      source.locationType === 'branch'
        ? source.location
        : source.metadata?.currentBranch || 'main';

    return {
      owner: source.owner,
      repo: source.name,
      branch,
      basePath: getBasePath(activeFileSlice?.data?.path || ''),
    };
  }, [usePropBasedContent, activeFileSlice?.data]);

  // Notes wiring -----------------------------------------------------------
  // Key under which notes for the current document are stored. Local repos
  // get a real repositoryPath; remote sources and prop-based loads land in
  // the repo-agnostic bucket keyed by the absolute path.
  const noteKey = useMemo<{
    repositoryPath: string | undefined;
    relativeFilePath: string;
  } | null>(() => {
    if (usePropBasedContent && propBasedContent) {
      if (repositoryPathProp) {
        return {
          repositoryPath: repositoryPathProp,
          relativeFilePath: relativizeIfPrefix(
            propBasedContent.path,
            repositoryPathProp,
          ),
        };
      }
      return {
        repositoryPath: undefined,
        relativeFilePath: propBasedContent.path,
      };
    }
    if (!currentFilePath) return null;
    const source =
      activeFileSlice?.data && 'source' in activeFileSlice.data
        ? activeFileSlice.data.source
        : undefined;
    if (source?.type === 'local' && source.location) {
      return {
        repositoryPath: source.location,
        relativeFilePath: relativizeIfPrefix(currentFilePath, source.location),
      };
    }
    return { repositoryPath: undefined, relativeFilePath: currentFilePath };
  }, [
    usePropBasedContent,
    propBasedContent,
    repositoryPathProp,
    currentFilePath,
    activeFileSlice?.data,
  ]);

  const [notes, setNotes] = useState<DocumentNote[]>([]);
  const [notesVersion, setNotesVersion] = useState(0);
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
    setDraft(null);
    setEditing(null);
  }, [noteKey?.repositoryPath, noteKey?.relativeFilePath]);

  const handleSelectionChange = useCallback(
    (selection: AnnotationSelection | null) => {
      // Ignore selection-clear notifications. The textarea inside the draft
      // popover steals focus on first keystroke, which clears the document
      // selection and would otherwise dismiss the popover mid-typing.
      // Dismissal is owned by the popover (Cancel / Esc / outside-click).
      if (!selection) return;
      if (!isSafeAnchor(selection.anchor)) {
        console.warn(
          '[MarkdownPanel] selection crosses block boundaries; cannot annotate. Pick text inside a single paragraph or heading.',
        );
        return;
      }
      setEditing(null);
      setDraft({ anchor: selection.anchor, rect: selection.rect });
    },
    [],
  );

  const handleAnnotationClick = useCallback(
    (id: string, event: MouseEvent) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      const target = event.target as HTMLElement | null;
      const rect =
        target?.getBoundingClientRect() ??
        new DOMRect(event.clientX, event.clientY, 0, 0);
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

  // While the popover is open the document's text selection is lost (the
  // textarea steals focus). We synthesize a transient annotation for the
  // draft so DocumentView highlights the anchored text using its own
  // annotation styling.
  const DRAFT_ANNOTATION_ID = '__draft__';
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
    if (!draft) return safeNotes;
    return [
      ...safeNotes,
      {
        id: DRAFT_ANNOTATION_ID,
        anchor: draft.anchor,
        metadata: { body: '', createdAt: '', updatedAt: '' },
      },
    ];
  }, [notes, draft]);

  const activeAnnotationId = draft
    ? DRAFT_ANNOTATION_ID
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

  if (activeFile?.loading) {
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
            Loading {activeFile.data?.path || 'file'}...
          </p>
        </div>
      </div>
    );
  }

  if (activeFile?.error) {
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
            {activeFile.error.message}
          </p>
        </div>
      </div>
    );
  }

  if (!activeFile?.data || !isMarkdown) {
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
        repositoryInfo={repositoryInfo}
        width={width}
        annotations={annotationsForView}
        activeAnnotationId={activeAnnotationId}
        onSelectionChange={handleSelectionChange}
        onAnnotationClick={handleAnnotationClick}
      />

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
