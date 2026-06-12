import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PenTool, Plus, Trash2, Clock, Search, X } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExcalidrawWrapper } from '@industry-theme/excalidraw-panels';
// Excalidraw's own styles. The published panel package emits its CSS as a
// separate asset that isn't auto-injected, so we load it from the app's own
// (version-matched) @excalidraw/excalidraw copy.
import '@excalidraw/excalidraw/index.css';
import { FileSystemService } from '../../../main-process-api/FileSystemService';

/**
 * DrawingsView — a global Excalidraw drawings browser + editor for the
 * principal window, laid out like the Skills view (master list on the left,
 * canvas on the right).
 *
 * Storage is intentionally repo-free for now: drawings are `.excalidraw`
 * (JSON) files under a single global directory (`~/.alexandria/drawings`).
 * No topic association yet.
 *
 * NOTE: we drive the library's lower-level `ExcalidrawWrapper` directly and
 * own the list/CRUD here rather than using the package's `ExcalidrawPanel` /
 * `DrawingsListPanel`. Those panels infinite-render because
 * `useExcalidrawStorage` returns an unmemoized object that they feed into a
 * `useEffect(() => load(), [load])` — a host can't stabilize a value created
 * inside the panel. `ExcalidrawWrapper` has no such hook and is loop-free.
 */

/** Sub-path under the home directory where drawings live. */
const DRAWINGS_SUBDIR = '.alexandria/drawings';

/** A drawing on disk, as shown in the list. */
interface DrawingItem {
  /** File name without extension. */
  id: string;
  /** Human name from appState.name, falling back to the id. */
  name: string;
  /** Absolute path to the `.excalidraw` file. */
  path: string;
  lastModified?: Date;
}

/** What's loaded into the editor. `id: null` is an unsaved new drawing. */
interface ActiveDrawing {
  id: string | null;
  name: string;
  /** Parsed `.excalidraw` contents, or null for a blank new canvas. */
  initialData: unknown | null;
}

type WrapperData = React.ComponentProps<typeof ExcalidrawWrapper>['initialData'];

export const DrawingsView: React.FC = () => {
  const { theme } = useTheme();

  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [active, setActive] = useState<ActiveDrawing | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Resolve the global drawings root once.
  useEffect(() => {
    let cancelled = false;
    FileSystemService.getHomePath()
      .then((home) => {
        if (!cancelled) setHomeDir(home);
      })
      .catch((err) =>
        console.error('[DrawingsView] Failed to resolve home path:', err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const drawingsDir = useMemo(
    () => (homeDir ? `${homeDir}/${DRAWINGS_SUBDIR}` : null),
    [homeDir],
  );

  const diagramPath = useCallback(
    (id: string) => `${drawingsDir}/${id}.excalidraw`,
    [drawingsDir],
  );

  // Scan the drawings directory and read each file's display name.
  const rescan = useCallback(async () => {
    if (!drawingsDir) return;
    setListLoading(true);
    try {
      const names = await FileSystemService.readDirectory(drawingsDir);
      const files = names.filter((n) => n.endsWith('.excalidraw'));
      const items = await Promise.all(
        files.map(async (fileName): Promise<DrawingItem> => {
          const id = fileName.replace(/\.excalidraw$/, '');
          const path = `${drawingsDir}/${fileName}`;
          let name = id;
          let lastModified: Date | undefined;
          try {
            const res = await FileSystemService.readFile(path);
            if (res?.content) {
              const parsed = JSON.parse(res.content);
              if (parsed?.appState?.name) name = parsed.appState.name;
            }
          } catch {
            // unreadable/corrupt file — fall back to the id as the name
          }
          try {
            const stats = await FileSystemService.getFileStats(path);
            if (stats?.lastModified) lastModified = new Date(stats.lastModified);
          } catch {
            // best-effort mtime
          }
          return { id, name, path, lastModified };
        }),
      );
      items.sort(
        (a, b) =>
          (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
      );
      setDrawings(items);
    } catch (err) {
      console.error('[DrawingsView] Failed to scan drawings:', err);
      setDrawings([]);
    } finally {
      setListLoading(false);
    }
  }, [drawingsDir]);

  useEffect(() => {
    if (drawingsDir) rescan();
  }, [drawingsDir, rescan]);

  // Open an existing drawing in the editor.
  const handleOpen = useCallback(
    async (item: DrawingItem) => {
      try {
        const res = await FileSystemService.readFile(item.path);
        const data = res?.content ? JSON.parse(res.content) : null;
        setActive({ id: item.id, name: item.name, initialData: data });
      } catch (err) {
        console.error('[DrawingsView] Failed to open drawing:', err);
      }
    },
    [],
  );

  // Start a fresh, unsaved drawing.
  const handleNew = useCallback(() => {
    setActive({ id: null, name: 'Untitled Diagram', initialData: null });
  }, []);

  // Next "Draft #N" number for unnamed new drawings.
  const getNextDraftNumber = useCallback(async (): Promise<number> => {
    const nums = drawings
      .map((d) => /^Draft #(\d+)$/.exec(d.name)?.[1])
      .filter(Boolean)
      .map((n) => parseInt(n as string, 10));
    return nums.length ? Math.max(...nums) + 1 : 1;
  }, [drawings]);

  // Persist a drawing (create or update). Returns its id.
  const handleSave = useCallback(
    async (name: string, data: unknown, existingId?: string): Promise<string> => {
      if (!drawingsDir) throw new Error('Drawings directory not ready');
      const id = existingId || (crypto.randomUUID?.() ?? `${Date.now()}`);
      const payload = {
        ...(data as Record<string, unknown>),
        appState: {
          ...((data as { appState?: Record<string, unknown> })?.appState ?? {}),
          name,
        },
      };
      const res = await FileSystemService.writeFile(
        diagramPath(id),
        JSON.stringify(payload, null, 2),
      );
      if (!res || !res.success) {
        throw new Error(res?.error || `Failed to save drawing: ${id}`);
      }
      // Reflect the (possibly new) name/id without forcing the editor to reload.
      setActive((prev) =>
        prev ? { ...prev, id, name } : prev,
      );
      rescan();
      return id;
    },
    [drawingsDir, diagramPath, rescan],
  );

  // Delete a drawing.
  const handleDelete = useCallback(
    async (item: DrawingItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Delete "${item.name}"?`)) return;
      try {
        await FileSystemService.deleteFile(item.path);
        setActive((prev) => (prev?.id === item.id ? null : prev));
        rescan();
      } catch (err) {
        console.error('[DrawingsView] Failed to delete drawing:', err);
      }
    },
    [rescan],
  );

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filtered = filterText
    ? drawings.filter((d) =>
        d.name.toLowerCase().includes(filterText.toLowerCase()),
      )
    : drawings;

  if (!homeDir) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
        }}
      >
        Loading drawings…
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Master–detail body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* List */}
        <div
          style={{
            width: '320px',
            flexShrink: 0,
            borderRight: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            backgroundColor: theme.colors.background,
            fontFamily: theme.fonts.body,
          }}
        >
          {/* List header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: theme.colors.backgroundLight,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: 1,
              }}
            >
              <PenTool size={16} color={theme.colors.primary} />
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.text,
                }}
              >
                Drawings ({drawings.length})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setShowSearch((s) => !s)}
                title="Search"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: showSearch
                    ? `${theme.colors.primary}20`
                    : 'transparent',
                  color: showSearch
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <Search size={16} />
              </button>
              <button
                onClick={handleNew}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                <Plus size={14} />
                New
              </button>
            </div>
            {showSearch && (
              <div style={{ width: '100%', marginTop: '8px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Filter drawings…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts.body,
                    outline: 'none',
                  }}
                />
                {filterText && (
                  <button
                    onClick={() => setFilterText('')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px', minHeight: 0 }}>
            {listLoading ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[0],
                }}
              >
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '32px 20px',
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                <PenTool size={40} style={{ opacity: 0.3 }} />
                <div style={{ fontWeight: theme.fontWeights.medium }}>
                  {filterText ? 'No matching drawings' : 'No drawings yet'}
                </div>
                {!filterText && (
                  <button
                    onClick={handleNew}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    <Plus size={16} />
                    Create Drawing
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filtered.map((item) => {
                  const selected = active?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpen(item)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${
                          selected ? theme.colors.primary : theme.colors.border
                        }`,
                        backgroundColor: selected
                          ? `${theme.colors.primary}15`
                          : theme.colors.backgroundSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0,
                          }}
                        >
                          <PenTool size={14} color={theme.colors.primary} />
                          <span
                            style={{
                              fontSize: theme.fontSizes[1],
                              fontWeight: theme.fontWeights.medium,
                              color: theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDelete(item, e)}
                          title="Delete drawing"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {item.lastModified && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                          }}
                        >
                          <Clock size={10} />
                          <span>{formatDate(item.lastModified)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {active ? (
            <ExcalidrawWrapper
              key={active.id ?? 'new'}
              diagramId={active.id ?? undefined}
              diagramName={active.name}
              initialData={(active.initialData as WrapperData) ?? undefined}
              onSave={handleSave}
              onDiagramCreated={(id) =>
                setActive((prev) => (prev ? { ...prev, id } : prev))
              }
              onDiagramNameChange={(name) =>
                setActive((prev) => (prev ? { ...prev, name } : prev))
              }
              getNextDraftNumber={getNextDraftNumber}
              showSaveButton
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <PenTool size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontWeight: theme.fontWeights.medium }}>
                No drawing open
              </div>
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  opacity: 0.7,
                  maxWidth: '320px',
                }}
              >
                Select a drawing from the list, or click “New” to create one.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
