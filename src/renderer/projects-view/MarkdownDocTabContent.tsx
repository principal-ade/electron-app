/**
 * Tab content for a markdown document opened into a tabbed-terminal framework
 * (Inbox / Projects feed) from the Principal MCP Bridge.
 *
 * The principal-window frameworks don't carry a panel `context`/`actions` the
 * way the dev-workspace / alexandria-workspace layouts do, so this wrapper
 * supplies the minimal surface `MarkdownPanel` actually needs: an `actions`
 * with `readFile`, and a minimal `context`. `MarkdownPanel` reads nothing else
 * off `context`, so a lightweight scope stub is sufficient.
 *
 * Sibling: `SharedTrailTabContent`, `LocalTrailTabContent`.
 */

import React, { useMemo } from 'react';
import type {
  PanelContextValue,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { MarkdownPanel } from '../panels/markdown-panel';
import type { MarkdownPanelActions } from '../panels/markdown-panel';
import { FileSystemService } from '../main-process-api/FileSystemService';

interface MarkdownDocTabContentProps {
  /** Absolute path of the document to render. */
  filePath: string;
  /** Host repo the document belongs to (context for the panel). */
  repositoryPath?: string;
  /** Panel event bus, threaded through from the hosting framework. */
  events: PanelEventEmitter;
}

export const MarkdownDocTabContent: React.FC<MarkdownDocTabContentProps> = ({
  filePath,
  repositoryPath,
  events,
}) => {
  const actions = useMemo<MarkdownPanelActions>(
    () => ({
      readFile: async (path: string): Promise<string> => {
        const result = await FileSystemService.readFile(path);
        return result?.content ?? '';
      },
    }),
    [],
  );

  const context = useMemo<PanelContextValue>(
    () => ({
      currentScope: {
        type: 'repository',
        repository: repositoryPath
          ? {
              name: repositoryPath.split('/').pop() ?? repositoryPath,
              path: repositoryPath,
            }
          : undefined,
      },
      refresh: async () => {},
    }),
    [repositoryPath],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MarkdownPanel
        context={context}
        actions={actions}
        events={events}
        filePath={filePath}
        repositoryPath={repositoryPath}
      />
    </div>
  );
};
