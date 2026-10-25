import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, LocateFixed } from 'lucide-react';
import {
  HeadlessFileEditorPanel,
  type HeadlessFileEditorPanelHandle,
} from './components/HeadlessFileEditorPanel';
import { getFileDraft, subscribeFileDrafts } from './fileDrafts';
import { GitService, type GitRemote } from '../main-process-api/GitService';
import { RepositoryAvatar } from '../components/repository-maps/RepositoryAvatar';

interface FileRepository {
  filePath: string;
  name: string;
  owner?: string;
  avatarUrl?: string;
  relativePath: string;
}

function ownerAvatarUrl(remote?: GitRemote): string | undefined {
  if (!remote?.owner) return undefined;
  try {
    const url = new URL(remote.url.replace(/^git@([^:]+):/, 'ssh://git@$1/'));
    if (url.hostname === 'github.com')
      return `https://github.com/${encodeURIComponent(remote.owner)}.png?size=40`;
  } catch {
    // Local and unrecognized remotes use the repository icon.
  }
  return undefined;
}

export type MonacoFileTabContentProps = React.ComponentPropsWithoutRef<
  typeof HeadlessFileEditorPanel
> & {
  fileName: string;
};

/** Monaco source tab for writable local files and standalone editor previews. */
export const MonacoFileTabContent: React.FC<MonacoFileTabContentProps> = ({
  fileName,
  options,
  ...editorProps
}) => {
  const { theme } = useTheme();
  const editorRef = React.useRef<HeadlessFileEditorPanelHandle>(null);
  const [repository, setRepository] = React.useState<FileRepository | null>(
    null,
  );
  const filePath = editorProps.filePath;
  const identity = repository?.filePath === filePath ? repository : null;
  React.useEffect(() => {
    let active = true;
    GitService.getRepositoryInfo(filePath)
      .then((info) => {
        if (!active || !info?.isRepository) return;
        const root = info.root.replace(/\\/g, '/').replace(/\/+$/, '');
        const prefix = `${root}/`;
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith(prefix)) return;
        const remote =
          info.remotes?.find((entry) => entry.name === 'origin') ??
          info.remotes?.[0];
        setRepository({
          filePath,
          name: remote?.repo || root.split('/').pop() || fileName,
          owner: remote?.owner,
          avatarUrl: ownerAvatarUrl(remote),
          relativePath: normalizedPath.slice(prefix.length),
        });
      })
      .catch(() => {
        // A missing repository must not prevent opening the file.
      });
    return () => {
      active = false;
    };
  }, [filePath, fileName]);
  const draft = React.useSyncExternalStore(
    subscribeFileDrafts,
    () => getFileDraft(editorProps.filePath),
    () => undefined,
  );
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[1],
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {identity && (
            <span
              title={
                identity.owner
                  ? `${identity.owner}/${identity.name}`
                  : identity.name
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <RepositoryAvatar
                type="owner"
                size={20}
                customAvatarUrl={identity.avatarUrl}
                fallbackIcon={<FolderGit2 size={14} aria-hidden="true" />}
              />
              <span
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {identity.name}
                <span
                  aria-hidden="true"
                  style={{ color: theme.colors.textSecondary }}
                >
                  /
                </span>
              </span>
            </span>
          )}
          <span
            title={filePath}
            style={{ minWidth: 0, overflowWrap: 'anywhere' }}
          >
            {identity?.relativePath ?? (filePath || fileName)}
          </span>
        </div>
        {editorProps.editable && editorProps.onSave && (
          <>
            {draft && (
              <span title="Unsaved edits are kept if you close this tab">
                Unsaved
              </span>
            )}
            <span
              title="Save file with Cmd/Ctrl+S"
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[0],
              }}
            >
              Cmd/Ctrl+S to save
            </span>
            {editorProps.preserveUnsavedChanges && draft && (
              <button
                type="button"
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  background: 'transparent',
                  color: theme.colors.text,
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (
                    window.confirm(
                      'Discard unsaved changes and reload this file from disk?',
                    )
                  ) {
                    void editorRef.current?.discardChanges();
                  }
                }}
              >
                Discard
              </button>
            )}
          </>
        )}
        {editorProps.range && (
          <button
            type="button"
            aria-label="Return to span"
            title={`Return to span (lines ${editorProps.range.startLineNumber}–${editorProps.range.endLineNumber})`}
            onClick={() => editorRef.current?.revealRange()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 4,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 4,
              background: 'transparent',
              color: theme.colors.text,
              cursor: 'pointer',
            }}
          >
            <LocateFixed size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <HeadlessFileEditorPanel
          {...editorProps}
          ref={editorRef}
          options={{ ...options, padding: { top: 12, ...options?.padding } }}
        />
      </div>
    </div>
  );
};
