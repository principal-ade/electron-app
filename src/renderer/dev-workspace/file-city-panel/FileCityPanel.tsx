import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { CityData } from '@principal-ai/file-city-react';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';

import type { Annotation } from 'themed-markdown';

import { FileCityExplorer } from './FileCityExplorer';
import {
  buildCityDataFromContext,
  stripRootPath,
} from './buildCityDataFromContext';
import { FileOverlay } from './FileOverlay';
import { SequenceDiagramOverlay } from './SequenceDiagramOverlay';
import { SequenceEventDetailOverlay } from './SequenceEventDetailOverlay';
import {
  SequenceFilesOverlay,
  type SequenceStep,
} from './SequenceFilesOverlay';
import { SequenceMarkdownOverlay } from './SequenceMarkdownOverlay';
import {
  SequenceLeaderLine,
  type SequenceLeaderLineHandle,
} from './SequenceLeaderLine';
import { useSequenceDiagram } from './useSequenceDiagram';
import {
  MarkdownNotePanel,
  type MarkdownNote,
  type MarkdownNotesSelection,
} from './MarkdownNotes';
import { SequenceNotesService } from '../../services/SequenceNotesService';
import type {
  MarkdownNoteScope,
  SequenceNote,
} from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const DRAFT_MARKDOWN_ANNOTATION_ID = '__draft-md__';

const sameMarkdownScope = (
  a: MarkdownNoteScope,
  b: MarkdownNoteScope,
): boolean => {
  if (a.kind === 'summary' && b.kind === 'summary') return true;
  if (a.kind === 'description' && b.kind === 'description')
    return a.eventId === b.eventId;
  return false;
};

const toMarkdownUiNote = (n: SequenceNote): MarkdownNote | null => {
  if (n.kind !== 'markdown') return null;
  return {
    id: n.id,
    anchor: {
      exact: n.anchor.exact,
      prefix: n.anchor.prefix,
      suffix: n.anchor.suffix,
    },
    body: n.body,
    author: n.author,
    createdAt: new Date(n.createdAt).getTime(),
  };
};

const MEDIA_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i;
const isOverlayable = (path: string): boolean => {
  if (MEDIA_RE.test(path)) return false;
  if (path.endsWith('.md') || path.endsWith('.mdx')) return false;
  return true;
};

interface FileCityPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  repository?: {
    path?: string | null;
    name?: string | null;
    owner?: string | null;
  } | null;
}

export interface FileCityPanelProps {
  context: FileCityPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

export const FileCityPanel: React.FC<FileCityPanelProps> = ({
  context,
  events,
}) => {
  const tree = context.fileTree?.data ?? null;
  const repositoryPath = context.repository?.path ?? null;
  const repoOwner = context.repository?.owner ?? null;
  const repoName = context.repository?.name ?? null;
  const repoLabel =
    repoOwner && repoName
      ? `${repoOwner}/${repoName}`
      : (repoName ?? null);

  const [cityData, setCityData] = React.useState<CityData | null>(null);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [overlayFile, setOverlayFile] = React.useState<{
    filePath: string;
    fileName: string;
  } | null>(null);

  const {
    payload: sequencePayload,
    selectedEventId: sequenceSelectedEventId,
    setSelectedEventId: setSequenceSelectedEventId,
    clear: clearSequence,
  } = useSequenceDiagram(repositoryPath);

  const selectedEventIndex = React.useMemo(() => {
    if (!sequencePayload || !sequenceSelectedEventId) return -1;
    return sequencePayload.events.findIndex(
      (e) => e.id === sequenceSelectedEventId,
    );
  }, [sequencePayload, sequenceSelectedEventId]);

  const selectedSequenceEvent = React.useMemo(() => {
    if (!sequencePayload || selectedEventIndex < 0) return null;
    return sequencePayload.events[selectedEventIndex] ?? null;
  }, [sequencePayload, selectedEventIndex]);

  const sequenceSelection = React.useMemo(() => {
    if (!selectedSequenceEvent?.sourcePath) return null;
    return { sourcePath: selectedSequenceEvent.sourcePath };
  }, [selectedSequenceEvent]);

  const sequenceSourcePaths = React.useMemo<string[] | null>(() => {
    if (!sequencePayload) return null;
    const paths = new Set<string>();
    for (const ev of sequencePayload.events) {
      if (ev.sourcePath) paths.add(ev.sourcePath);
    }
    return paths.size > 0 ? Array.from(paths) : null;
  }, [sequencePayload]);

  const selectedEventAbsolutePath = React.useMemo(() => {
    const sourcePath = selectedSequenceEvent?.sourcePath;
    if (!sourcePath) return null;
    if (sourcePath.startsWith('/')) return sourcePath;
    if (!repositoryPath) return sourcePath;
    return `${repositoryPath}/${sourcePath}`;
  }, [selectedSequenceEvent, repositoryPath]);

  const sequenceSteps = React.useMemo<SequenceStep[]>(() => {
    if (!sequencePayload) return [];
    // Count notes per event id — snippet notes scope by eventId; markdown
    // notes count when their scope is a description anchored to the event.
    const noteCounts = new Map<string, number>();
    for (const note of sequencePayload.notes ?? []) {
      const eventId =
        note.kind === 'snippet'
          ? note.scope.eventId
          : note.scope.kind === 'description'
            ? note.scope.eventId
            : null;
      if (!eventId) continue;
      noteCounts.set(eventId, (noteCounts.get(eventId) ?? 0) + 1);
    }
    const out: SequenceStep[] = [];
    sequencePayload.events.forEach((ev, idx) => {
      if (!ev.sourcePath) return;
      const absolutePath = ev.sourcePath.startsWith('/')
        ? ev.sourcePath
        : repositoryPath
          ? `${repositoryPath}/${ev.sourcePath}`
          : null;
      out.push({
        eventId: ev.id,
        stepIndex: idx + 1,
        eventLabel: ev.label ?? ev.name,
        relativePath: ev.sourcePath,
        absolutePath,
        noteCount: noteCounts.get(ev.id) ?? 0,
      });
    });
    return out;
  }, [sequencePayload, repositoryPath]);

  const selectedBuilding = React.useMemo(() => {
    const sourcePath = selectedSequenceEvent?.sourcePath;
    if (!sourcePath || !cityData) return null;
    return (
      cityData.buildings.find((b) => b.path === sourcePath) ??
      cityData.buildings.find((b) => b.path.endsWith(`/${sourcePath}`)) ??
      null
    );
  }, [selectedSequenceEvent, cityData]);

  const cityCenter = React.useMemo(() => {
    if (!cityData) return null;
    return {
      x: (cityData.bounds.minX + cityData.bounds.maxX) / 2,
      z: (cityData.bounds.minZ + cityData.bounds.maxZ) / 2,
    };
  }, [cityData]);

  // Drawer height is lifted up here so the left-edge markdown overlay and
  // right-edge detail drawer can anchor their `bottomOffset` to the same
  // value the user is dragging.
  const [drawerHeightPct, setDrawerHeightPct] = React.useState(50);
  const drawerBottomOffset = `${drawerHeightPct}%`;

  // Left-edge markdown panel: per-event description wins; payload summary
  // is the fallback so the overlay always has a "what is this" panel.
  const markdownOverlayProps = React.useMemo(() => {
    const eventDescription = selectedSequenceEvent?.description?.trim();
    if (selectedSequenceEvent && eventDescription) {
      return {
        eyebrow: 'Change notes',
        title: selectedSequenceEvent.label ?? selectedSequenceEvent.name,
        markdown: eventDescription,
        slideIdPrefix: `sequence-explainer-${selectedSequenceEvent.id}`,
      };
    }
    const payloadSummary = sequencePayload?.summary?.trim();
    if (sequencePayload && payloadSummary) {
      return {
        eyebrow: 'Overview',
        title: sequencePayload.title ?? 'Sequence',
        markdown: payloadSummary,
        slideIdPrefix: 'sequence-summary',
      };
    }
    return null;
  }, [selectedSequenceEvent, sequencePayload]);

  const panelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const leaderLineRef = React.useRef<SequenceLeaderLineHandle | null>(null);
  const detailOverlayRef = React.useRef<HTMLDivElement | null>(null);
  const markdownOverlayContainerRef = React.useRef<HTMLDivElement | null>(
    null,
  );

  // Active markdown scope — derived from whether an event is selected. Notes
  // filter by this so the right set surfaces in summary vs description mode.
  const markdownScope = React.useMemo<MarkdownNoteScope | null>(() => {
    if (!markdownOverlayProps) return null;
    if (selectedSequenceEvent) {
      return { kind: 'description', eventId: selectedSequenceEvent.id };
    }
    return { kind: 'summary' };
  }, [markdownOverlayProps, selectedSequenceEvent]);

  const markdownNotes = React.useMemo<MarkdownNote[]>(() => {
    if (!sequencePayload?.notes || !markdownScope) return [];
    return sequencePayload.notes
      .filter(
        (n): n is SequenceNote & { kind: 'markdown' } =>
          n.kind === 'markdown' && sameMarkdownScope(n.scope, markdownScope),
      )
      .map(toMarkdownUiNote)
      .filter((n): n is MarkdownNote => n != null);
  }, [sequencePayload?.notes, markdownScope]);

  const [markdownNotesSelection, setMarkdownNotesSelection] =
    React.useState<MarkdownNotesSelection | null>(null);

  // Reset the selection when the markdown scope changes — switching events
  // mid-thread or mid-composition would leave a stale panel up otherwise.
  const scopeKey = markdownScope
    ? markdownScope.kind === 'description'
      ? `d-${markdownScope.eventId}`
      : 's'
    : '-';
  React.useEffect(() => {
    setMarkdownNotesSelection(null);
  }, [scopeKey]);

  const markdownComposerOpen = markdownNotesSelection?.kind === 'composer';

  // Build the annotations array for the markdown body. One annotation per
  // saved note (count = replies-on-same-anchor); plus a draft annotation
  // while a composer is in progress so the highlight stays visible.
  const markdownAnnotations = React.useMemo<Annotation[]>(() => {
    const result: Annotation[] = [];
    const counts = new Map<string, number>();
    for (const n of markdownNotes) {
      counts.set(n.anchor.exact, (counts.get(n.anchor.exact) ?? 0) + 1);
    }
    const seenAnchors = new Set<string>();
    for (const n of markdownNotes) {
      if (seenAnchors.has(n.anchor.exact)) continue;
      seenAnchors.add(n.anchor.exact);
      result.push({
        id: n.id,
        anchor: {
          exact: n.anchor.exact,
          prefix: n.anchor.prefix,
          suffix: n.anchor.suffix,
        },
        count: counts.get(n.anchor.exact),
      });
    }
    if (markdownNotesSelection?.kind === 'composer') {
      result.push({
        id: DRAFT_MARKDOWN_ANNOTATION_ID,
        anchor: {
          exact: markdownNotesSelection.anchor.exact,
          prefix: markdownNotesSelection.anchor.prefix,
          suffix: markdownNotesSelection.anchor.suffix,
        },
      });
    }
    return result;
  }, [markdownNotes, markdownNotesSelection]);

  const activeMarkdownAnnotationId = React.useMemo<string | null>(() => {
    if (!markdownNotesSelection) return null;
    if (markdownNotesSelection.kind === 'composer') {
      return DRAFT_MARKDOWN_ANNOTATION_ID;
    }
    // For threads we mark the first note in the thread as active — themed-
    // markdown highlights its anchor's range.
    const head = markdownNotes.find(
      (n) => n.id === markdownNotesSelection.noteId,
    );
    if (!head) return null;
    const anchorMatch = markdownNotes.find(
      (n) => n.anchor.exact === head.anchor.exact,
    );
    return anchorMatch?.id ?? head.id;
  }, [markdownNotesSelection, markdownNotes]);

  const handleMarkdownAnnotationClick = React.useCallback(
    (annotationId: string) => {
      if (annotationId === DRAFT_MARKDOWN_ANNOTATION_ID) return;
      setMarkdownNotesSelection((prev) => {
        if (prev?.kind === 'thread' && prev.noteId === annotationId) {
          return null;
        }
        return { kind: 'thread', noteId: annotationId };
      });
    },
    [],
  );

  const handleCreateMarkdownNoteForSelection = React.useCallback(
    (anchor: { exact: string; prefix?: string; suffix?: string }) => {
      setMarkdownNotesSelection({ kind: 'composer', anchor });
    },
    [],
  );

  const handleSubmitMarkdownNote = React.useCallback(
    async (
      anchor: { exact: string; prefix?: string; suffix?: string },
      body: string,
    ) => {
      if (!sequencePayload?.id || !markdownScope) return;
      const note = await SequenceNotesService.create(sequencePayload.id, {
        kind: 'markdown',
        scope: markdownScope,
        anchor: {
          kind: 'text-quote',
          exact: anchor.exact,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
        },
        body,
        author: 'You',
      });
      if (note) {
        setMarkdownNotesSelection({ kind: 'thread', noteId: note.id });
      }
    },
    [sequencePayload?.id, markdownScope],
  );

  const handleReplyMarkdownNote = React.useCallback(
    async (noteId: string, body: string) => {
      if (!sequencePayload?.id || !markdownScope) return;
      const head = markdownNotes.find((n) => n.id === noteId);
      if (!head) return;
      await SequenceNotesService.create(sequencePayload.id, {
        kind: 'markdown',
        scope: markdownScope,
        anchor: {
          kind: 'text-quote',
          exact: head.anchor.exact,
          prefix: head.anchor.prefix,
          suffix: head.anchor.suffix,
        },
        body,
        author: 'You',
      });
    },
    [sequencePayload?.id, markdownScope, markdownNotes],
  );

  const handleDeleteMarkdownNote = React.useCallback(
    async (id: string) => {
      if (!sequencePayload?.id) return;
      await SequenceNotesService.remove(sequencePayload.id, id);
    },
    [sequencePayload?.id],
  );

  // Track the markdown overlay's right edge so the notes panel can dock
  // immediately to its right and follow the user's resize handle.
  const [markdownOverlayWidth, setMarkdownOverlayWidth] = React.useState<
    number | null
  >(null);
  React.useEffect(() => {
    const el = markdownOverlayContainerRef.current;
    if (!el || !markdownOverlayProps) {
      setMarkdownOverlayWidth(null);
      return;
    }
    const update = () => setMarkdownOverlayWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [markdownOverlayProps]);

  const MARKDOWN_NOTES_PANEL_WIDTH = 320;
  const MARKDOWN_NOTES_PANEL_GAP = 12;
  const markdownNotesPanelStyle = React.useMemo<
    React.CSSProperties | null
  >(() => {
    if (!markdownOverlayWidth) return null;
    return {
      position: 'absolute',
      top: 72,
      bottom: `calc(${drawerBottomOffset} + 16px)`,
      left: 16 + markdownOverlayWidth + MARKDOWN_NOTES_PANEL_GAP,
      width: MARKDOWN_NOTES_PANEL_WIDTH,
      // Above the markdown overlay (z 1900) — same level as snippet notes
      // panel — so dragging the markdown overlay wider doesn't bury the
      // notes panel under it.
      zIndex: 1950,
    };
  }, [markdownOverlayWidth, drawerBottomOffset]);

  React.useEffect(() => {
    if (!tree) {
      setCityData(null);
      return;
    }
    let cancelled = false;
    setIsBuilding(true);
    buildCityDataFromContext({ fileTree: tree, repositoryPath })
      .then((next) => {
        if (!cancelled) setCityData(next);
      })
      .finally(() => {
        if (!cancelled) setIsBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tree, repositoryPath]);

  const rootPath = tree?.metadata?.id ?? '';

  if (!cityData) {
    return <Placeholder building={isBuilding} />;
  }

  return (
    <div
      ref={panelContainerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <FileCityExplorer
        cityData={cityData}
        packageRoot=""
        repoLabel={repoLabel}
        repositoryPath={repositoryPath}
        sequenceSelection={sequenceSelection}
        sequenceSourcePaths={sequenceSourcePaths}
        hideFolderPanels={!!sequencePayload}
        onCameraFrame={(camera, size) => {
          leaderLineRef.current?.onCameraFrame(camera, size);
        }}
        onFileOpen={(cityPath) => {
          const relativePath = stripRootPath(cityPath, rootPath);
          if (isOverlayable(relativePath)) {
            const absolutePath = relativePath.startsWith('/')
              ? relativePath
              : repositoryPath
                ? `${repositoryPath}/${relativePath}`
                : relativePath;
            const fileName = absolutePath.split('/').pop() || relativePath;
            setOverlayFile({ filePath: absolutePath, fileName });
            return;
          }
          events.emit({
            type: 'file:open',
            source: 'file-city-panel',
            timestamp: Date.now(),
            payload: { path: relativePath },
          });
        }}
      />
      {sequencePayload && (
        <SequenceDiagramOverlay
          payload={sequencePayload}
          selectedEventId={sequenceSelectedEventId}
          onNodeClick={setSequenceSelectedEventId}
          onClose={clearSequence}
          heightPct={drawerHeightPct}
          onHeightChange={setDrawerHeightPct}
        />
      )}
      <SequenceLeaderLine
        ref={leaderLineRef}
        containerRef={panelContainerRef}
        building={selectedSequenceEvent ? selectedBuilding : null}
        cityCenter={cityCenter}
        targetRef={detailOverlayRef}
      />

      {markdownOverlayProps && (
        <SequenceMarkdownOverlay
          {...markdownOverlayProps}
          containerRef={markdownOverlayContainerRef}
          annotations={markdownAnnotations}
          activeAnnotationId={activeMarkdownAnnotationId}
          onAnnotationClick={handleMarkdownAnnotationClick}
          onCreateNoteForSelection={handleCreateMarkdownNoteForSelection}
          composerOpen={markdownComposerOpen}
          bottomOffset={drawerBottomOffset}
          position={
            sequencePayload && sequencePayload.events.length > 0
              ? {
                  // -1 (nothing selected, summary view) renders as `0 / N`,
                  // signalling the sequence hasn't started yet.
                  index: Math.max(0, selectedEventIndex + 1),
                  total: sequencePayload.events.length,
                }
              : undefined
          }
          onPrev={
            sequencePayload && selectedEventIndex >= 0
              ? () =>
                  setSequenceSelectedEventId(
                    selectedEventIndex > 0
                      ? sequencePayload.events[selectedEventIndex - 1].id
                      : null,
                  )
              : undefined
          }
          onNext={
            sequencePayload &&
            sequencePayload.events.length > 0 &&
            selectedEventIndex < sequencePayload.events.length - 1
              ? () =>
                  setSequenceSelectedEventId(
                    sequencePayload.events[Math.max(0, selectedEventIndex + 1)]
                      .id,
                  )
              : undefined
          }
        />
      )}
      {markdownNotesSelection && markdownNotesPanelStyle && (
        <MarkdownNotePanel
          selection={markdownNotesSelection}
          notes={markdownNotes}
          style={markdownNotesPanelStyle}
          onClose={() => setMarkdownNotesSelection(null)}
          onSubmitNote={handleSubmitMarkdownNote}
          onReplyNote={handleReplyMarkdownNote}
          onDeleteNote={handleDeleteMarkdownNote}
        />
      )}
      {sequencePayload && (
        <SequenceFilesOverlay
          steps={sequenceSteps}
          totalEvents={sequencePayload.events.length}
          bottomOffset={drawerBottomOffset}
          onSelectStep={(step) => setSequenceSelectedEventId(step.eventId)}
          onOpenFile={(step) => {
            if (!step.absolutePath) return;
            events.emit({
              type: 'file:open',
              source: 'file-overlay',
              timestamp: Date.now(),
              payload: { path: step.absolutePath },
            });
          }}
        />
      )}
      {selectedSequenceEvent && sequencePayload && (
        <SequenceEventDetailOverlay
          ref={detailOverlayRef}
          event={selectedSequenceEvent}
          absolutePath={selectedEventAbsolutePath}
          bottomOffset={drawerBottomOffset}
          payloadId={sequencePayload.id}
          payloadNotes={sequencePayload.notes}
          onClose={() => setSequenceSelectedEventId(null)}
          onOpenInTab={
            selectedEventAbsolutePath
              ? () => {
                  events.emit({
                    type: 'file:open',
                    source: 'file-overlay',
                    timestamp: Date.now(),
                    payload: { path: selectedEventAbsolutePath },
                  });
                }
              : undefined
          }
        />
      )}
      {overlayFile && (
        <FileOverlay
          filePath={overlayFile.filePath}
          fileName={overlayFile.fileName}
          onClose={() => setOverlayFile(null)}
          onOpenInTab={() => {
            // Emit with a non-`file-city-panel` source so the framework opens a
            // regular file-editor tab instead of routing to `pierre-file`.
            events.emit({
              type: 'file:open',
              source: 'file-overlay',
              timestamp: Date.now(),
              payload: { path: overlayFile.filePath },
            });
            setOverlayFile(null);
          }}
        />
      )}
    </div>
  );
};

const Placeholder: React.FC<{ building: boolean }> = ({ building }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: theme.colors.background,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      {building ? 'Building city…' : 'No file tree available'}
    </div>
  );
};
