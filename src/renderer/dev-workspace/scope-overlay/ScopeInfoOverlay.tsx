import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { HighlightLayer } from '@principal-ai/file-city-react';
import type {
  EventRecord,
  NamespaceRecord,
  ScopeRecord,
} from '../../services/scope-manager';
import { useScopeManagerOptional } from '../scope-manager-provider';
import { useScopeOverlaySelectionOptional } from './ScopeOverlaySelectionContext';

const SEVERITY_BG: Record<string, string> = {
  ERROR: '#7f1d1d',
  WARN: '#78350f',
  INFO: '#1e3a8a',
};

const SEVERITY_FG = '#fde68a';

const DEFAULT_NAMESPACE_COLOR = '#a855f7';

interface ResolvedSelection {
  scope: ScopeRecord;
  ns: NamespaceRecord | null;
  ev: EventRecord | null;
}

export interface ScopeInfoOverlayProps {
  /**
   * The HighlightLayer[] currently being passed to FileCity3D. When provided,
   * a collapsed debug block is rendered at the bottom of the overlay so you
   * can sanity-check what's getting drawn.
   */
  debugLayers?: readonly HighlightLayer[];
}

/**
 * Right-aligned overlay anchored above FileCity3D. Shows the currently
 * selected scope/namespace/event from ScopeOverlaySelectionContext.
 *
 * Resolves the selection against the live ScopeManager workspace so the panel
 * reflects mutations (e.g. a path added to a namespace) without round-tripping
 * through anything else.
 */
export const ScopeInfoOverlay: React.FC<ScopeInfoOverlayProps> = ({
  debugLayers,
}) => {
  const scopeCtx = useScopeManagerOptional();
  const overlay = useScopeOverlaySelectionOptional();

  const resolved = React.useMemo<ResolvedSelection | null>(() => {
    if (!scopeCtx || !overlay?.selection) return null;
    const scope = scopeCtx.workspace.scopes.find(
      (s) => s.name === overlay.selection!.scopeName,
    );
    if (!scope) return null;
    const ns = overlay.selection.namespaceName
      ? scope.namespaces.find(
          (n) => n.name === overlay.selection!.namespaceName,
        ) ?? null
      : null;
    const ev =
      ns && overlay.selection.eventName
        ? ns.events.find((e) => e.name === overlay.selection!.eventName) ?? null
        : null;
    return { scope, ns, ev };
  }, [scopeCtx, overlay?.selection]);

  if (!resolved) return null;
  return <ResolvedOverlay resolved={resolved} debugLayers={debugLayers} />;
};

const ResolvedOverlay: React.FC<{
  resolved: ResolvedSelection;
  debugLayers?: readonly HighlightLayer[];
}> = ({ resolved, debugLayers }) => {
  const { theme } = useTheme();
  const { scope, ns, ev } = resolved;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 360,
    maxHeight: 'calc(100% - 32px)',
    overflowY: 'auto',
    background: `${theme.colors.backgroundSecondary}f5`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 8,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    zIndex: 10,
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const codeBlockStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme.colors.text,
    background: theme.colors.background,
    padding: '4px 6px',
    borderRadius: 4,
    wordBreak: 'break-all',
  };

  // Event leaf selected
  if (ns && ev) {
    return (
      <div style={overlayStyle}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={sectionLabelStyle}>Event</div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, marginTop: 6 }}>
            {ns.name}.{ev.name}
          </div>
          {ev.severity && (
            <div
              style={{
                display: 'inline-block',
                fontSize: 10,
                marginTop: 8,
                padding: '2px 6px',
                borderRadius: 3,
                background: SEVERITY_BG[ev.severity] ?? theme.colors.border,
                color: SEVERITY_FG,
              }}
            >
              {ev.severity}
            </div>
          )}
          {ev.description && (
            <div
              style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              {ev.description}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={sectionLabelStyle}>Owning namespace</div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: ns.color ?? DEFAULT_NAMESPACE_COLOR,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
              {ns.name}
            </span>
          </div>
        </div>
        <DebugLayersBlock layers={debugLayers} theme={theme} />
      </div>
    );
  }

  // Namespace selected
  if (ns) {
    return (
      <div style={overlayStyle}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={sectionLabelStyle}>Namespace</div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: ns.color ?? DEFAULT_NAMESPACE_COLOR,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 14 }}>
              {ns.name}
            </span>
          </div>
          {ns.description && (
            <div
              style={{
                fontSize: 11,
                color: theme.colors.textSecondary,
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              {ns.description}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: theme.colors.textSecondary,
              marginTop: 8,
            }}
          >
            in <span style={{ fontFamily: 'monospace' }}>{scope.name}</span>
          </div>
        </div>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={sectionLabelStyle}>Claimed paths ({ns.paths.length})</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 6,
            }}
          >
            {ns.paths.map((p) => (
              <code key={p} style={codeBlockStyle}>
                {p}
              </code>
            ))}
            {ns.paths.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                No paths claimed.
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={sectionLabelStyle}>Events ({ns.events.length})</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 6,
            }}
          >
            {ns.events.map((e) => (
              <div
                key={e.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  background: theme.colors.background,
                  borderRadius: 4,
                }}
              >
                {e.severity && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 2,
                      background:
                        SEVERITY_BG[e.severity] ?? theme.colors.border,
                      color: SEVERITY_FG,
                      flexShrink: 0,
                    }}
                  >
                    {e.severity}
                  </span>
                )}
                <code style={{ fontSize: 11, color: theme.colors.text }}>
                  {ns.name}.{e.name}
                </code>
              </div>
            ))}
            {ns.events.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                No events declared.
              </div>
            )}
          </div>
        </div>
        <DebugLayersBlock layers={debugLayers} theme={theme} />
      </div>
    );
  }

  // Scope summary
  const totalEvents = scope.namespaces.reduce(
    (n, x) => n + x.events.length,
    0,
  );

  return (
    <div style={overlayStyle}>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={sectionLabelStyle}>Scope</div>
        <div style={{ fontFamily: 'monospace', fontSize: 14, marginTop: 6 }}>
          {scope.name}
        </div>
        {scope.description && (
          <div
            style={{
              fontSize: 11,
              color: theme.colors.textSecondary,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {scope.description}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 12,
            fontSize: 11,
            color: theme.colors.textSecondary,
          }}
        >
          <div>
            <div>{scope.paths.length}</div>
            <div style={sectionLabelStyle}>scope paths</div>
          </div>
          <div>
            <div>{scope.namespaces.length}</div>
            <div style={sectionLabelStyle}>namespaces</div>
          </div>
          <div>
            <div>{totalEvents}</div>
            <div style={sectionLabelStyle}>events</div>
          </div>
        </div>
      </div>
      {scope.paths.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={sectionLabelStyle}>
            Scope-level paths ({scope.paths.length})
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 6,
            }}
          >
            {scope.paths.map((p) => (
              <code key={p} style={codeBlockStyle}>
                {p}
              </code>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        <div style={sectionLabelStyle}>Namespaces</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 8,
          }}
        >
          {scope.namespaces.map((n) => (
            <div
              key={n.name}
              style={{
                padding: 8,
                background: theme.colors.background,
                borderRadius: 6,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: n.color ?? DEFAULT_NAMESPACE_COLOR,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {n.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: theme.colors.textSecondary,
                    marginLeft: 'auto',
                  }}
                >
                  {n.events.length} event{n.events.length === 1 ? '' : 's'}
                </span>
              </div>
              {n.paths.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {n.paths.join(' · ')}
                </div>
              )}
            </div>
          ))}
          {scope.namespaces.length === 0 && (
            <div
              style={{
                fontSize: 11,
                color: theme.colors.textSecondary,
                fontStyle: 'italic',
              }}
            >
              No namespaces yet.
            </div>
          )}
        </div>
      </div>
      <DebugLayersBlock layers={debugLayers} theme={theme} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Debug: dump the active HighlightLayer[] so we can sanity-check what's being
// passed to FileCity3D when paths/colors aren't lining up visually.
// ---------------------------------------------------------------------------

interface ThemeShape {
  colors: {
    background: string;
    border: string;
    text: string;
    textSecondary: string;
  };
}

const DebugLayersBlock: React.FC<{
  layers: readonly HighlightLayer[] | undefined;
  theme: ThemeShape;
}> = ({ layers, theme }) => {
  const [open, setOpen] = React.useState(false);
  if (!layers) return null;

  const totalItems = layers.reduce((n, l) => n + l.items.length, 0);

  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: `1px dashed ${theme.colors.border}`,
        background: theme.colors.background,
        fontSize: 11,
        color: theme.colors.textSecondary,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: theme.colors.textSecondary,
          fontFamily: 'monospace',
          fontSize: 11,
          textAlign: 'left',
        }}
      >
        <span style={{ width: 10, display: 'inline-block' }}>
          {open ? '▾' : '▸'}
        </span>
        <span>
          debug: highlightLayers ({layers.length} layer
          {layers.length === 1 ? '' : 's'}, {totalItems} item
          {totalItems === 1 ? '' : 's'})
        </span>
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {layers.length === 0 && (
            <div style={{ fontStyle: 'italic' }}>
              No layers passed to FileCity3D.
            </div>
          )}
          {layers.map((layer) => (
            <div
              key={layer.id}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 4,
                padding: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'monospace',
                  color: theme.colors.text,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: layer.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ wordBreak: 'break-all' }}>{layer.id}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: theme.colors.textSecondary,
                  }}
                >
                  prio {layer.priority}
                  {layer.enabled ? '' : ' · off'}
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {layer.items.map((item, i) => (
                  <code
                    key={`${layer.id}-${i}`}
                    style={{
                      fontSize: 10,
                      color: theme.colors.text,
                      background: theme.colors.background,
                      padding: '2px 4px',
                      borderRadius: 2,
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.type === 'directory' ? '📁 ' : '📄 '}
                    {item.path}
                    {item.renderStrategy
                      ? `  · ${item.renderStrategy}`
                      : ''}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
