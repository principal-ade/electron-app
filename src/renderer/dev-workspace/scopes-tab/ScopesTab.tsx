import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useScopeManager } from '../scope-manager-provider';
import { useScopeOverlaySelectionOptional } from '../scope-overlay';
import {
  buildScopeTreePaths,
  parseScopeTreePath,
} from './scopeTreePaths';

/**
 * Scope-tree tab inside FilesPanel. Renders the current scope/namespace/event
 * hierarchy from the active ScopeManager. Authoring (Add scope) is path-driven
 * and lives on the File tree tab — selecting a file there is what produces a
 * meaningful scope path.
 */
export const ScopesTab: React.FC = () => {
  const { theme } = useTheme();
  const { workspace } = useScopeManager();
  const overlay = useScopeOverlaySelectionOptional();
  const selection = overlay?.selection ?? null;
  const setSelection = overlay?.setSelection;

  // @pierre/trees' Builder rejects consecutive duplicate paths; overlapping
  // scope/namespace configs can produce the same encoded path twice, so dedupe
  // before resetPaths can crash on it.
  const paths = React.useMemo(
    () => Array.from(new Set(buildScopeTreePaths(workspace.scopes))),
    [workspace.scopes],
  );

  const { model } = useFileTree({
    paths,
    search: paths.length > 0,
    initialExpandedPaths: [],
    onSelectionChange: (selected) => {
      const next = selected[0] ?? null;
      setSelection?.(next ? parseScopeTreePath(next) : null);
    },
  });

  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(paths);
  }, [model, paths]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Scopes / namespaces / events
        <div
          style={{
            marginTop: 6,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            textTransform: 'none',
            letterSpacing: 0,
            lineHeight: 1.4,
          }}
        >
          Authoring happens from the File tree tab — select a file there and
          add it to a scope.
        </div>
      </div>

      {selection?.scopeName && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          <div style={{ fontFamily: 'monospace', color: theme.colors.text }}>
            {selection.scopeName}
            {selection.namespaceName && ` / ${selection.namespaceName}`}
            {selection.eventName && ` / ${selection.eventName}`}
          </div>
        </div>
      )}

      {workspace.scopes.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            lineHeight: 1.4,
          }}
        >
          No scopes yet.
          <br />
          Select a file in the File tree tab and click{' '}
          <strong>Add to scope</strong>.
        </div>
      ) : (
        <FileTree
          model={model}
          style={
            {
              flex: 1,
              minHeight: 0,
            } as React.CSSProperties
          }
        />
      )}
    </div>
  );
};
