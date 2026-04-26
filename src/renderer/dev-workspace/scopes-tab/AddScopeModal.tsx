import React from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ScopeManagerError,
  type AddToScopeInput,
  type ScopeRecord,
} from '../../services/scope-manager';

export interface AddScopeModalSubmitInput {
  scopeName: string;
  namespaceName?: string;
  description?: string;
  paths: string[];
}

export interface AddScopeModalProps {
  /** Live workspace scopes — drives autocomplete + the action label. */
  scopes: readonly ScopeRecord[];
  /**
   * Initial paths (one per line in the textarea). Use this to pre-fill the
   * form when the modal is opened from a file/directory selection.
   */
  initialPaths?: readonly string[];
  initialScopeName?: string;
  initialNamespaceName?: string;
  initialDescription?: string;
  onSubmit: (
    input: AddScopeModalSubmitInput | AddToScopeInput,
  ) => Promise<void> | void;
  onClose: () => void;
}

export const AddScopeModal: React.FC<AddScopeModalProps> = ({
  scopes,
  initialPaths,
  initialScopeName,
  initialNamespaceName,
  initialDescription,
  onSubmit,
  onClose,
}) => {
  const { theme } = useTheme();
  const [scopeName, setScopeName] = React.useState(initialScopeName ?? '');
  const [namespaceName, setNamespaceName] = React.useState(
    initialNamespaceName ?? '',
  );
  const [description, setDescription] = React.useState(
    initialDescription ?? '',
  );
  const [pathsText, setPathsText] = React.useState(
    initialPaths && initialPaths.length > 0 ? initialPaths.join('\n') : '',
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmedScope = scopeName.trim();
  const trimmedNamespace = namespaceName.trim();
  const parsedPaths = React.useMemo(
    () =>
      pathsText
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean),
    [pathsText],
  );

  const targetScope = scopes.find((s) => s.name === trimmedScope);
  const targetNamespace = trimmedNamespace
    ? targetScope?.namespaces.find((ns) => ns.name === trimmedNamespace)
    : null;

  // "Already added" only flags when *every* path the user is trying to add is
  // already in the chosen container.
  const alreadyClaimed = React.useMemo(() => {
    if (!targetScope || parsedPaths.length === 0) return false;
    const claimed = trimmedNamespace
      ? targetNamespace?.paths
      : targetScope.paths;
    if (!claimed) return false;
    return parsedPaths.every((p) => claimed.includes(p));
  }, [targetScope, targetNamespace, trimmedNamespace, parsedPaths]);

  let actionLabel = 'Add';
  if (!trimmedScope) actionLabel = 'Add';
  else if (alreadyClaimed) actionLabel = 'Already added';
  else if (!targetScope && !trimmedNamespace) actionLabel = 'Create scope';
  else if (!targetScope) actionLabel = 'Create scope + namespace';
  else if (!trimmedNamespace) actionLabel = 'Add to scope';
  else if (!targetNamespace) actionLabel = 'Create namespace';
  else actionLabel = 'Add path';

  const canSubmit =
    trimmedScope.length > 0 && !alreadyClaimed && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        scopeName: trimmedScope,
        namespaceName: trimmedNamespace || undefined,
        description: description.trim() || undefined,
        paths: parsedPaths,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof ScopeManagerError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to apply.';
      setError(message);
      setSubmitting(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    fontFamily: theme.fonts.body,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    background: theme.colors.background,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  };

  // Description is only meaningful when creating a new scope.
  const showDescription = !targetScope;
  // Namespace datalist (only meaningful for an existing scope).
  const namespaceOptions = targetScope?.namespaces.map((ns) => ns.name) ?? [];

  const modal = (
    <div onClick={onClose} style={overlayStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxHeight: 'min(80vh, 700px)',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          borderRadius: 8,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <div style={sectionLabelStyle}>Add to scope</div>
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                marginTop: 6,
              }}
            >
              Attach paths to a new or existing scope, optionally under a
              namespace.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabelStyle}>Scope</span>
            <input
              type="text"
              value={scopeName}
              autoFocus
              list="add-scope-modal-scopes"
              placeholder="e.g. principal-view.cli"
              onChange={(e) => setScopeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              style={inputStyle}
            />
            <datalist id="add-scope-modal-scopes">
              {scopes.map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
            {targetScope && (
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                }}
              >
                Adding to existing scope ({targetScope.namespaces.length}{' '}
                namespace{targetScope.namespaces.length === 1 ? '' : 's'},{' '}
                {targetScope.paths.length} path
                {targetScope.paths.length === 1 ? '' : 's'}).
              </span>
            )}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabelStyle}>Namespace (optional)</span>
            <input
              type="text"
              value={namespaceName}
              list="add-scope-modal-namespaces"
              placeholder="leave blank to add at scope level"
              onChange={(e) => setNamespaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              style={inputStyle}
            />
            {namespaceOptions.length > 0 && (
              <datalist id="add-scope-modal-namespaces">
                {namespaceOptions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}
          </label>

          {showDescription && (
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span style={sectionLabelStyle}>Description (optional)</span>
              <input
                type="text"
                value={description}
                placeholder="Short description"
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
                style={{ ...inputStyle, fontFamily: theme.fonts.body }}
              />
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabelStyle}>
              Paths (one per line)
            </span>
            <textarea
              value={pathsText}
              placeholder={'packages/cli/src\npackages/core/src/scopes'}
              onChange={(e) => setPathsText(e.target.value)}
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 64,
              }}
            />
          </label>

          {error && (
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.error,
                background: `${theme.colors.error}1a`,
                padding: '6px 10px',
                borderRadius: 4,
                border: `1px solid ${theme.colors.error}`,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              paddingTop: 4,
            }}
          >
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 4,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '8px 14px',
                background: canSubmit
                  ? theme.colors.primary
                  : theme.colors.backgroundSecondary,
                color: canSubmit ? '#ffffff' : theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 4,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {submitting ? 'Saving…' : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
