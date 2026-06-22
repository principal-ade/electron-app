import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import {
  buildFrontmatter,
  fmString,
  getFrontmatterError,
  parseFrontmatter,
  repairFrontmatter,
  splitFrontmatter,
} from '../panels/markdown-panel/frontmatter';

/**
 * Minimal file I/O the wrapped editor needs. The real `actions` object carries
 * more, which we pass through untouched.
 */
interface FileActions {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

interface MdxEditorWithFrontmatterProps<A extends FileActions> {
  filePath?: string | null;
  /** The host's panel actions. We pass through everything except read/write. */
  actions: A;
  /**
   * Renders the third-party MDX editor with the supplied actions. We hand it a
   * wrapped `actions` whose `readFile` returns the document *body only* (front
   * matter stripped) and whose `writeFile` re-attaches the front matter — so the
   * editor never parses YAML and can't crash on malformed front matter.
   */
  renderEditor: (actions: A) => React.ReactNode;
}

/**
 * Wraps the third-party MDX editor so YAML front matter is edited separately,
 * never by the editor itself.
 *
 * The editor parses any leading `---` front matter with js-yaml and renders the
 * result in a `useMemo`; a malformed block (e.g. a folded scalar whose
 * continuation lines are indented less than its first line) throws
 * `bad indentation of a mapping entry` and takes down the whole panel. Rather
 * than try to keep the YAML valid, we keep it *away* from the editor: the body
 * is edited rich-text as usual, while the raw front matter is exposed in a small
 * dedicated editor above it. The front matter is preserved byte-for-byte until
 * the user chooses to change it.
 */
export function MdxEditorWithFrontmatter<A extends FileActions>({
  filePath,
  actions,
  renderEditor,
}: MdxEditorWithFrontmatterProps<A>) {
  const { theme } = useTheme();

  // The verbatim front matter block (incl. fences) and body, per path, so the
  // wrapped read/write can split on the way in and re-join on the way out.
  const fmByPath = useRef(new Map<string, string>());
  const bodyByPath = useRef(new Map<string, string>());

  const [fmAvailable, setFmAvailable] = useState(false);
  const [inner, setInner] = useState(''); // YAML between the fences (editable)
  const [savedInner, setSavedInner] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const wrappedRead = useCallback(
    async (path: string): Promise<string> => {
      const raw = await actions.readFile(path);
      const { raw: block, body } = splitFrontmatter(raw);
      fmByPath.current.set(path, block);
      bodyByPath.current.set(path, body);
      return body;
    },
    [actions],
  );

  const wrappedWrite = useCallback(
    async (path: string, content: string): Promise<void> => {
      bodyByPath.current.set(path, content);
      const block = fmByPath.current.get(path) ?? '';
      await actions.writeFile(path, block + content);
    },
    [actions],
  );

  const wrappedActions = useMemo(
    () =>
      ({
        ...actions,
        readFile: wrappedRead,
        writeFile: wrappedWrite,
      }) as A,
    [actions, wrappedRead, wrappedWrite],
  );

  // Load the front matter for the dedicated editor whenever the file changes.
  useEffect(() => {
    if (!filePath) {
      setFmAvailable(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await actions.readFile(filePath);
        if (cancelled) return;
        const { raw: block, inner: fm, body } = splitFrontmatter(raw);
        fmByPath.current.set(filePath, block);
        bodyByPath.current.set(filePath, body);
        setInner(fm);
        setSavedInner(fm);
        setSaveError(null);
        setFmAvailable(true);
        // Draw attention to front matter the editor would have choked on.
        setExpanded(block ? getFrontmatterError(raw) !== null : false);
      } catch {
        // Couldn't pre-read (missing file, permissions, …). Hide the front
        // matter editor and let the MDX editor surface its own error.
        if (!cancelled) setFmAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, actions]);

  const liveError = useMemo(() => {
    const block = buildFrontmatter(inner);
    return block ? getFrontmatterError(block) : null;
  }, [inner]);

  // The collapsible header shows the document's title (from the front matter,
  // falling back to the file name) so the raw YAML can tuck underneath it.
  const title = useMemo(() => {
    const { data } = parseFrontmatter(buildFrontmatter(inner));
    const fromFm = fmString(data.title) ?? fmString(data.name);
    if (fromFm) return fromFm;
    if (filePath) return filePath.split('/').pop() || 'Untitled';
    return 'Untitled';
  }, [inner, filePath]);

  const dirty = inner !== savedInner;

  const handleSave = useCallback(async () => {
    if (!filePath) return;
    setSaving(true);
    setSaveError(null);
    try {
      const block = buildFrontmatter(inner);
      let body = bodyByPath.current.get(filePath);
      if (body === undefined) {
        body = splitFrontmatter(await actions.readFile(filePath)).body;
      }
      await actions.writeFile(filePath, block + body);
      fmByPath.current.set(filePath, block);
      bodyByPath.current.set(filePath, body);
      setSavedInner(inner);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [filePath, inner, actions]);

  const handleAutoFix = useCallback(() => {
    if (!inner.trim()) return;
    const repaired = repairFrontmatter(`---\n${inner}\n---\n`);
    setInner(splitFrontmatter(repaired).inner);
  }, [inner]);

  const editor = renderEditor(wrappedActions);

  if (!fmAvailable) {
    return <>{editor}</>;
  }

  const border = `1px solid ${theme.colors.border}`;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ borderBottom: border, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            width: '100%',
            padding: '0.4rem 0.75rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.textSecondary,
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span
            style={{
              fontWeight: 600,
              color: theme.colors.text,
              minWidth: 0,
              flexShrink: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              flexShrink: 0,
              color: liveError
                ? theme.colors.error
                : theme.colors.textSecondary,
            }}
          >
            {liveError ? 'invalid front matter' : 'front matter'}
          </span>
          {dirty && (
            <span
              title="Unsaved changes"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: theme.colors.primary,
              }}
            />
          )}
        </button>

        {expanded && (
          <div style={{ padding: '0 0.75rem 0.6rem' }}>
            <textarea
              value={inner}
              onChange={(e) => setInner(e.target.value)}
              spellCheck={false}
              rows={Math.min(12, Math.max(4, inner.split('\n').length + 1))}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                padding: '0.5rem',
                color: theme.colors.text,
                background: theme.colors.background,
                border: `1px solid ${liveError ? theme.colors.error : theme.colors.border}`,
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
            {liveError && (
              <div
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.72rem',
                  color: theme.colors.error,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {liveError}
              </div>
            )}
            {saveError && (
              <div
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.72rem',
                  color: theme.colors.error,
                }}
              >
                Couldn’t save: {saveError}
              </div>
            )}
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: theme.colors.background,
                  background: theme.colors.primary,
                  border: 'none',
                  borderRadius: 6,
                  cursor: !dirty || saving ? 'default' : 'pointer',
                  opacity: !dirty || saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save front matter'}
              </button>
              {liveError && (
                <button
                  type="button"
                  onClick={handleAutoFix}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.78rem',
                    color: theme.colors.text,
                    background: 'transparent',
                    border,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Wrench size={13} />
                  Auto-fix
                </button>
              )}
              {dirty && !saving && (
                <button
                  type="button"
                  onClick={() => setInner(savedInner)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.78rem',
                    color: theme.colors.textSecondary,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Revert
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {editor}
      </div>
    </div>
  );
}
