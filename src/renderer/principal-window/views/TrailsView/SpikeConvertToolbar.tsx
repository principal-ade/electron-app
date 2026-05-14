/**
 * Spike toolbar for the Recent → preview pane that drives the OpenCode
 * convert pipeline: detect (is opencode installed/authed) → ping (run a
 * trivial prompt) → convert (fork the selected investigation trail into
 * an informative trail). Streams progress entries while converting.
 *
 * Lifted out of TrailsView purely to keep that file under the
 * max-lines lint cap — all state still lives in TrailsView so the
 * toolbar stays a dumb view.
 */

import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Loader2, Share2, Sparkles } from 'lucide-react';
import type {
  ConvertProgressEntry,
  ConvertTrailResult,
  OpenCodeDetectResult,
  OpenCodeRunPromptResult,
} from '../../../../shared/main-process-api-interfaces/OpenCodeConvertAPI';

export interface SpikeConvertToolbarProps {
  detecting: boolean;
  running: boolean;
  converting: boolean;
  detectResult: OpenCodeDetectResult | null;
  runResult: OpenCodeRunPromptResult | null;
  convertResult: ConvertTrailResult | null;
  progress: ConvertProgressEntry[];
  onDetect: () => void;
  onRun: () => void;
  onConvert: () => void;
  /**
   * Build a markdown brief telling an agent how to fetch the selected
   * trail from the local Principal MCP Bridge. Returns `null` when the
   * preview payload isn't ready yet (button stays disabled).
   */
  buildAgentBrief: () => string | null;
}

export const SpikeConvertToolbar: React.FC<SpikeConvertToolbarProps> = ({
  detecting,
  running,
  converting,
  detectResult,
  runResult,
  convertResult,
  progress,
  onDetect,
  onRun,
  onConvert,
  buildAgentBrief,
}) => {
  const { theme } = useTheme();
  const [shareCopied, setShareCopied] = useState(false);
  const onShareClick = async () => {
    const brief = buildAgentBrief();
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
    } catch (err) {
      console.error('[SpikeConvertToolbar] clipboard write failed:', err);
    }
  };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onDetect}
          disabled={detecting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: detecting ? 'wait' : 'pointer',
            opacity: detecting ? 0.7 : 1,
          }}
        >
          {detecting ? (
            <Loader2
              size={14}
              style={{ animation: 'trails-spin 1s linear infinite' }}
            />
          ) : (
            <Sparkles size={14} />
          )}
          {detecting ? 'Detecting…' : 'Detect'}
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: running ? 'wait' : 'pointer',
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? (
            <Loader2
              size={14}
              style={{ animation: 'trails-spin 1s linear infinite' }}
            />
          ) : (
            <Sparkles size={14} />
          )}
          {running ? 'Running…' : 'Ping'}
        </button>
        <button
          type="button"
          onClick={onShareClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: 'pointer',
          }}
        >
          {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
          {shareCopied ? 'Copied' : 'Share with Agent'}
        </button>
        <button
          type="button"
          onClick={onConvert}
          disabled={converting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.accent}`,
            borderRadius: 8,
            backgroundColor: theme.colors.accent,
            color: theme.colors.background,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: converting ? 'wait' : 'pointer',
            opacity: converting ? 0.7 : 1,
          }}
        >
          {converting ? (
            <Loader2
              size={14}
              style={{ animation: 'trails-spin 1s linear infinite' }}
            />
          ) : (
            <Sparkles size={14} />
          )}
          {converting ? 'Converting…' : 'Convert'}
        </button>
      </div>
      {(detectResult || runResult || convertResult) && (
        <div
          style={{
            maxWidth: 380,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            lineHeight: 1.35,
            textAlign: 'right',
            wordBreak: 'break-word',
          }}
        >
          {convertResult ? (
            convertResult.ok && convertResult.newTrailId ? (
              <>
                <div>
                  <strong>Forked to informative:</strong>{' '}
                  {convertResult.newTrailId}
                </div>
                {convertResult.derivedFrom && (
                  <div style={{ marginTop: 4, opacity: 0.7 }}>
                    derivedFrom: {convertResult.derivedFrom}
                  </div>
                )}
                <div style={{ marginTop: 4, opacity: 0.6 }}>
                  {Math.round(convertResult.durationMs / 100) / 10}s
                </div>
              </>
            ) : (
              <>
                Convert error: {convertResult.error} ·{' '}
                {Math.round(convertResult.durationMs / 100) / 10}s
              </>
            )
          ) : runResult ? (
            <>
              {runResult.ok
                ? `Agent: ${runResult.text || '(empty)'}`
                : `Run error: ${runResult.error}`}
              {' · '}
              {Math.round(runResult.durationMs / 100) / 10}s
            </>
          ) : detectResult ? (
            <>
              {detectResult.installed
                ? detectResult.authed
                  ? `OpenCode ready (${detectResult.providers?.join(', ') || 'authed'})`
                  : 'OpenCode installed — not authed'
                : 'OpenCode not installed'}
              {detectResult.version ? ` · v${detectResult.version}` : ''}
              {detectResult.error ? ` · ${detectResult.error}` : ''}
            </>
          ) : null}
        </div>
      )}
      {progress.length > 0 && (
        <div
          style={{
            width: 380,
            maxHeight: 220,
            overflowY: 'auto',
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            lineHeight: 1.35,
          }}
        >
          {progress.slice(-20).map((entry, i) => (
            <div
              key={`${entry.time}-${i}`}
              style={{
                display: 'flex',
                gap: 8,
                color:
                  entry.kind === 'error'
                    ? theme.colors.error
                    : entry.kind === 'info'
                      ? theme.colors.textSecondary
                      : theme.colors.text,
                borderBottom:
                  i < Math.min(20, progress.length) - 1
                    ? `1px solid ${theme.colors.border}`
                    : 'none',
                padding: '3px 0',
              }}
            >
              <span
                style={{
                  opacity: 0.6,
                  minWidth: 36,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {new Date(entry.time).toISOString().slice(14, 19)}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{entry.label}</span>
                {entry.detail && (
                  <span
                    style={{
                      marginLeft: 6,
                      opacity: 0.7,
                      wordBreak: 'break-all',
                    }}
                  >
                    {entry.detail}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpikeConvertToolbar;
