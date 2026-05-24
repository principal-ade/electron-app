import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  snapshotCheckpoints,
  subscribeCheckpoints,
  type Checkpoint,
} from '../loadCheckpoints';
import { makeSectionLabelStyle } from './styles';

const PHASE_LABEL: Record<Checkpoint['phase'], string> = {
  'repo.path.set': 'Repository path set',
  'ipc.cache_get.start': 'IPC: cache get →',
  'ipc.cache_get.end': 'IPC: cache get ←',
  'ipc.refresh.start': 'IPC: refresh →',
  'ipc.refresh.end': 'IPC: refresh ←',
  'cache_sync.fresh_received': 'Cache sync: fresh tree received',
  'build_city.start': 'buildCityDataFromContext start',
  'build_city.end': 'buildCityDataFromContext end',
  'panel.first_render': 'Panel rendered city (first paint)',
};

const formatMs = (ms: number): string => {
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

const formatAbsTime = (wallMs: number): string => {
  const d = new Date(wallMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const fff = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${fff}`;
};

export const LoadCheckpointsModal: React.FC<{
  repoPath: string | null;
  repoLabel: string | null;
  onClose: () => void;
}> = ({ repoPath, repoLabel, onClose }) => {
  const { theme } = useTheme();
  const sectionLabelStyle = makeSectionLabelStyle(theme);

  // Re-render on every push so the timeline stays live while open.
  const [, setTick] = React.useState(0);
  React.useEffect(() => subscribeCheckpoints(() => setTick((n) => n + 1)), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const points = snapshotCheckpoints(repoPath);
  const t0 = points[0]?.perfMs ?? 0;

  const handleCopy = React.useCallback(() => {
    const payload = points.map((c) => ({
      phase: c.phase,
      tFromStartMs: +(c.perfMs - t0).toFixed(2),
      wallTime: new Date(c.wallMs).toISOString(),
      detail: c.detail ?? null,
    }));
    void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  }, [points, t0]);

  const sectionDivider = `1px solid ${theme.colors.backgroundSecondary}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620,
          maxHeight: 'min(82vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.background,
          color: theme.colors.text,
          borderRadius: theme.radii[4],
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows[4],
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: sectionDivider,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: theme.space[3],
          }}
        >
          <div>
            <div style={sectionLabelStyle}>File City load checkpoints</div>
            <div
              style={{
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textMuted,
                marginTop: 6,
                wordBreak: 'break-all',
              }}
            >
              {repoLabel ?? repoPath ?? '(no repository)'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: theme.space[2], alignItems: 'center' }}>
            <button
              onClick={handleCopy}
              disabled={points.length === 0}
              style={{
                padding: '6px 10px',
                background: 'transparent',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                cursor: points.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: theme.fontSizes[0],
              }}
            >
              Copy JSON
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textTertiary,
                fontSize: theme.fontSizes[3],
                cursor: 'pointer',
                lineHeight: 1,
                padding: 0,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '12px 18px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {points.length === 0 ? (
            <div
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes[1],
                padding: theme.space[4],
                textAlign: 'center',
              }}
            >
              No checkpoints yet for this repository.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
              }}
            >
              <thead>
                <tr style={{ color: theme.colors.textTertiary, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium }}>#</th>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium }}>Phase</th>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium, textAlign: 'right' }}>t+</th>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium, textAlign: 'right' }}>Δ prev</th>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium }}>Wall</th>
                  <th style={{ padding: '6px 8px', fontWeight: theme.fontWeights.medium }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {points.map((c, i) => {
                  const tFromStart = c.perfMs - t0;
                  const delta = i === 0 ? 0 : c.perfMs - points[i - 1].perfMs;
                  return (
                    <tr
                      key={`${c.phase}-${c.perfMs}`}
                      style={{
                        borderTop: i === 0 ? 'none' : sectionDivider,
                        color: theme.colors.text,
                      }}
                    >
                      <td style={{ padding: '6px 8px', color: theme.colors.textTertiary }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px' }}>{PHASE_LABEL[c.phase]}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatMs(tFromStart)}</td>
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          color: delta > 1000 ? theme.colors.warning : theme.colors.textMuted,
                        }}
                      >
                        {i === 0 ? '—' : `+${formatMs(delta)}`}
                      </td>
                      <td style={{ padding: '6px 8px', color: theme.colors.textMuted }}>
                        {formatAbsTime(c.wallMs)}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          color: theme.colors.textMuted,
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={c.detail ? JSON.stringify(c.detail) : ''}
                      >
                        {c.detail ? JSON.stringify(c.detail) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
