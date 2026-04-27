import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FileTree,
  useFileTree,
  useFileTreeSelector,
} from '@pierre/trees/react';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';
import { Plus } from 'lucide-react';
import { useScopeManagerOptional } from '../scope-manager-provider';
import { useFolderExpansionWriter } from '../folder-expansion-provider';
import { ScopesTab, AddScopeModal } from '../scopes-tab';

interface FilesPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
}

export interface FilesPanelProps {
  context: FilesPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

type ActiveTab = 'files' | 'scopes';
type AuditMode = 'off' | 'uncovered' | 'covered';

const TAB_DEFINITIONS: { id: ActiveTab; label: string; accent: string }[] = [
  { id: 'files', label: 'File tree', accent: '#3b82f6' },
  { id: 'scopes', label: 'Scopes', accent: '#a855f7' },
];

const AUDIT_DEFINITIONS: { mode: AuditMode; label: string; accent: string }[] = [
  { mode: 'off', label: 'Off', accent: '#475569' },
  { mode: 'uncovered', label: 'Uncovered', accent: '#dc2626' },
  { mode: 'covered', label: 'Covered', accent: '#16a34a' },
];

export const FilesPanel: React.FC<FilesPanelProps> = ({ context, events }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('files');
  const scopeCtx = useScopeManagerOptional();

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 40,
          borderBottom: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
        }}
      >
        {TAB_DEFINITIONS.map((tab) => {
          const active = activeTab === tab.id;
          const disabled = tab.id === 'scopes' && !scopeCtx;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              title={
                disabled
                  ? 'Scopes tab requires a ScopeManagerProvider'
                  : undefined
              }
              style={{
                flex: 1,
                padding: '0 12px',
                background: active
                  ? theme.colors.background
                  : 'transparent',
                color: active
                  ? theme.colors.text
                  : disabled
                    ? theme.colors.textSecondary
                    : theme.colors.textSecondary,
                border: 'none',
                borderBottom: `2px solid ${active ? tab.accent : 'transparent'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'files' ? (
        <FileTreeTab context={context} events={events} />
      ) : (
        <ScopesTab />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// File tree tab
// ---------------------------------------------------------------------------

const FileTreeTab: React.FC<{
  context: FilesPanelContext;
  events: PanelEventEmitter;
}> = ({ context, events }) => {
  const { theme } = useTheme();
  const scopeCtx = useScopeManagerOptional();
  const tree = context.fileTree?.data ?? null;
  const rootPath = tree?.metadata?.id ?? '';
  const repoPath = context.currentScope?.repository?.path ?? '';

  const allPaths = React.useMemo<string[]>(() => {
    if (!tree) return [];
    return tree.allFiles.map((f) => f.path).sort();
  }, [tree]);

  // Compute coverage from the active ScopeManager workspace. A path is
  // "covered" if any scope.paths or namespace.paths matches it (exact or
  // ancestor directory). Scope/namespace paths are repo-relative; the file
  // tree's paths include the rootPath prefix, so we strip it before comparing.
  const claimedPaths = React.useMemo<string[]>(() => {
    const scopes = scopeCtx?.workspace.scopes ?? [];
    const set = new Set<string>();
    for (const scope of scopes) {
      for (const p of scope.paths) set.add(p);
      for (const ns of scope.namespaces) for (const p of ns.paths) set.add(p);
    }
    return Array.from(set);
  }, [scopeCtx?.workspace.scopes]);

  const isCovered = React.useCallback(
    (treePath: string) => {
      if (claimedPaths.length === 0) return false;
      const candidate = stripRoot(treePath, rootPath);
      for (const claimed of claimedPaths) {
        if (candidate === claimed || candidate.startsWith(claimed + '/')) {
          return true;
        }
      }
      return false;
    },
    [claimedPaths, rootPath],
  );

  const { coveredPaths, uncoveredPaths } = React.useMemo(() => {
    const covered: string[] = [];
    const uncovered: string[] = [];
    for (const p of allPaths) {
      (isCovered(p) ? covered : uncovered).push(p);
    }
    return { coveredPaths: covered, uncoveredPaths: uncovered };
  }, [allPaths, isCovered]);

  const [auditMode, setAuditMode] = React.useState<AuditMode>('off');

  // Force audit off when there are no scopes — the filter is meaningless.
  const effectiveAuditMode: AuditMode =
    claimedPaths.length === 0 ? 'off' : auditMode;

  const filteredPaths = React.useMemo<string[]>(() => {
    if (effectiveAuditMode === 'uncovered') return uncoveredPaths;
    if (effectiveAuditMode === 'covered') return coveredPaths;
    return allPaths;
  }, [effectiveAuditMode, allPaths, coveredPaths, uncoveredPaths]);

  const initialExpandedPaths = React.useMemo<string[]>(
    () => (rootPath ? [rootPath] : []),
    [rootPath],
  );

  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);

  const modelRef = React.useRef<ReturnType<typeof useFileTree>['model'] | null>(
    null,
  );
  const { model } = useFileTree({
    paths: filteredPaths,
    search: true,
    initialExpandedPaths,
    onSelectionChange: (selected) => {
      const next = selected[0] ?? null;
      setSelectedPath(next);
      if (!next) return;
      const item = modelRef.current?.getItem(next);
      if (item && item.isDirectory()) return;
      events.emit({
        type: 'file:open',
        source: 'files-panel',
        timestamp: Date.now(),
        payload: { path: stripRoot(next, rootPath) },
      });
    },
  });
  modelRef.current = model;

  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(filteredPaths, { initialExpandedPaths });
  }, [model, filteredPaths, initialExpandedPaths]);

  // Every directory path implied by `filteredPaths` (each unique prefix of
  // a file path). The model only exposes per-path lookups, so we keep this
  // list to drive the expansion selector below.
  const allDirectories = React.useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const p of filteredPaths) {
      let cur = p;
      while (true) {
        const slash = cur.lastIndexOf('/');
        if (slash < 0) break;
        cur = cur.slice(0, slash);
        set.add(cur);
      }
    }
    return Array.from(set);
  }, [filteredPaths]);

  // Sync the model's expansion state into the folder-expansion provider so
  // the city panel can render umbrella tiles for collapsed folders. The
  // equality callback short-circuits no-op renders.
  const expandedFolders = useFileTreeSelector(
    model,
    React.useCallback(
      (m) => {
        const expanded = new Set<string>();
        for (const dir of allDirectories) {
          const item = m.getItem(dir);
          if (!item || !item.isDirectory()) continue;
          // The trees lib doesn't expose a type predicate; runtime check
          // ensures isDirectory() before using directory-only methods.
          const directory = item as { isExpanded(): boolean };
          if (directory.isExpanded()) expanded.add(dir);
        }
        return expanded;
      },
      [allDirectories],
    ),
    React.useCallback(
      (prev: Set<string>, next: Set<string>) => {
        if (prev.size !== next.size) return false;
        for (const k of prev) if (!next.has(k)) return false;
        return true;
      },
      [],
    ),
  );

  const folderWriter = useFolderExpansionWriter();
  React.useEffect(() => {
    folderWriter?.setExpandedFolders(expandedFolders);
  }, [folderWriter, expandedFolders]);
  React.useEffect(() => {
    if (!folderWriter) return;
    folderWriter.registerToggleHandler((folderPath) => {
      const item = modelRef.current?.getItem(folderPath);
      if (!item || !item.isDirectory()) return;
      (item as { toggle(): void }).toggle();
    });
    return () => folderWriter.registerToggleHandler(null);
  }, [folderWriter]);

  if (!tree) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
        }}
      >
        No file tree available
      </div>
    );
  }

  const showAuditFilter = claimedPaths.length > 0;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SelectionHeader
        selectedPath={selectedPath}
        rootPath={rootPath}
      />


      {showAuditFilter && (
        <div
          style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Audit filter
          </div>
          <div
            style={{
              display: 'flex',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 4,
              overflow: 'hidden',
              fontSize: 12,
            }}
          >
            {AUDIT_DEFINITIONS.map(({ mode, label, accent }, i) => {
              const count =
                mode === 'off'
                  ? allPaths.length
                  : mode === 'uncovered'
                    ? uncoveredPaths.length
                    : coveredPaths.length;
              const active = effectiveAuditMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setAuditMode(mode)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    background: active ? accent : 'transparent',
                    border: 'none',
                    borderLeft:
                      i === 0 ? 'none' : `1px solid ${theme.colors.border}`,
                    color: active ? '#ffffff' : theme.colors.text,
                    fontWeight: active ? 500 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: active ? '#fef3c7' : theme.colors.textSecondary,
                      fontWeight: 400,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <FileTreeDragHost rootPath={rootPath} repoPath={repoPath}>
        <FileTree
          model={model}
          style={
            {
              flex: 1,
              minHeight: 0,
              paddingTop: 8,
              '--trees-bg-override': 'transparent',
              '--trees-search-bg-override': theme.colors.backgroundSecondary,
              '--trees-theme-list-active-selection-bg': `color-mix(in oklab, ${theme.colors.accent} 28%, transparent)`,
              '--trees-theme-list-hover-bg': `color-mix(in oklab, ${theme.colors.accent} 14%, transparent)`,
            } as React.CSSProperties
          }
        />
      </FileTreeDragHost>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Selection header — shows the currently selected path and surfaces the
// "+ Add to scope" entry point that opens AddScopeModal pre-filled with that
// path. Only visible when a ScopeManagerProvider is mounted.
// ---------------------------------------------------------------------------

const SelectionHeader: React.FC<{
  selectedPath: string | null;
  rootPath: string;
}> = ({ selectedPath, rootPath }) => {
  const { theme } = useTheme();
  const scopeCtx = useScopeManagerOptional();
  const [showAddModal, setShowAddModal] = React.useState(false);

  const strippedPath = selectedPath ? stripRoot(selectedPath, rootPath) : null;
  const canAdd = !!scopeCtx && !!strippedPath;

  const scopes = scopeCtx?.workspace.scopes ?? [];

  const coveringScopes = React.useMemo(() => {
    if (!scopeCtx || !strippedPath) return [];
    return scopeCtx.workspace.scopes.filter((s) =>
      s.paths.some(
        (p) => strippedPath === p || strippedPath.startsWith(p + '/'),
      ),
    );
  }, [scopeCtx, strippedPath]);

  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.colors.border}`,
        fontSize: theme.fontSizes[0],
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      Selection
      <div
        style={{
          marginTop: 4,
          fontFamily: 'monospace',
          fontSize: theme.fontSizes[0],
          color: theme.colors.text,
          textTransform: 'none',
          letterSpacing: 0,
          wordBreak: 'break-all',
          minHeight: 14,
        }}
      >
        {strippedPath ?? '(no selection)'}
      </div>

      {canAdd && coveringScopes.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          In scope:{' '}
          {coveringScopes.map((s, i) => (
            <React.Fragment key={s.name}>
              {i > 0 && ', '}
              <code style={{ color: theme.colors.text }}>{s.name}</code>
            </React.Fragment>
          ))}
        </div>
      )}

      {canAdd && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            marginTop: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: theme.colors.primary,
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
          Add to scope
        </button>
      )}

      {showAddModal && scopeCtx && strippedPath && (
        <AddScopeModal
          scopes={scopes}
          initialPaths={[strippedPath]}
          onSubmit={(input) =>
            scopeCtx.manager.addToScope({
              scopeName: input.scopeName,
              namespaceName: input.namespaceName,
              description: input.description,
              paths: input.paths,
            })
          }
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

function stripRoot(path: string, root: string): string {
  if (root && path.startsWith(root + '/')) return path.slice(root.length + 1);
  return path;
}

function shellQuote(s: string): string {
  if (/^[\w@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Pierre's <file-tree-container> renders into an open shadow root, so styles
// and event targets from the light DOM don't reach the rows. We inject a
// stylesheet into the shadow root to mark file rows draggable, and use a
// capturing dragstart listener with composedPath() to read the row's
// data-item-path before the event retargets to the host.
const FileTreeDragHost: React.FC<
  React.PropsWithChildren<{ rootPath: string; repoPath: string }>
> = ({ rootPath, repoPath, children }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef({ rootPath, repoPath });
  rootRef.current = { rootPath, repoPath };

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const injectedRoots = new WeakSet<ShadowRoot>();
    const injectStyles = () => {
      const containers = host.querySelectorAll('file-tree-container');
      containers.forEach((el) => {
        const sr = (el as HTMLElement & { shadowRoot: ShadowRoot | null })
          .shadowRoot;
        if (!sr || injectedRoots.has(sr)) return;
        const style = document.createElement('style');
        style.textContent = `[data-type="item"] { -webkit-user-drag: element; cursor: grab; }`;
        sr.appendChild(style);
        injectedRoots.add(sr);
      });
    };

    injectStyles();
    const mo = new MutationObserver(injectStyles);
    mo.observe(host, { childList: true, subtree: true });

    const onDragStart = (e: DragEvent) => {
      const path = e.composedPath();
      let row: HTMLElement | null = null;
      for (const node of path) {
        if (
          node instanceof HTMLElement &&
          node.getAttribute?.('data-type') === 'item'
        ) {
          row = node;
          break;
        }
      }
      if (!row) return;
      const treePath = row.getAttribute('data-item-path');
      if (!treePath || !e.dataTransfer) return;
      const { rootPath: rp, repoPath: rep } = rootRef.current;
      const relative = stripRoot(treePath, rp);
      const absolute = rep ? `${rep}/${relative}` : relative;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', shellQuote(absolute));
    };

    host.addEventListener('dragstart', onDragStart, true);
    return () => {
      mo.disconnect();
      host.removeEventListener('dragstart', onDragStart, true);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
};
