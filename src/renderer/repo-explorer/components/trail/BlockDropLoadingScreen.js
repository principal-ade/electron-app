'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileCityBlockDrop } from './FileCityBlockDrop';
/**
 * Full-bleed loading screen: `FileCityBlockDrop` dropping blocks to
 * reveal a codebase avatar, looping so it reads as continuous loading.
 * Drop-in replacement for `TrailLoadingScreen` — same opaque
 * theme-background frame + pulsing caption, different animation.
 */
/**
 * Resolution = grid density. A codebase avatar sampled at 12×12 is only
 * 144 "pixels"; 36×36 is ~1,296 and reads clearly. More cells means more
 * pieces, so to keep the fill from slowing down as resolution climbs we
 * hold the fill duration roughly constant by scaling `pieceDelayMs` down
 * as the piece count grows.
 */
const TARGET_FILL_MS = 3600;
const DROP_DURATION_MS = 340;
const DEFAULT_RESOLUTION = 36;
/** Our brand mark — the same block-grid logo shipped as the PWA icon.
 *  It's already a grid of colored blocks, so dropping it in cell-by-cell
 *  reads as the logo assembling itself. Same-origin, so (unlike GitHub
 *  avatars) it never trips the sampling canvas's CORS check. */
const LOGO_SRC = '/icon-512x512.png';
/** Rough piece count for a res×res grid. Tetrominoes cover ~4 cells (a
 *  few leftovers/singletons push the effective divisor down); scatter
 *  uses the exact group size. */
function estPieceCount(res, groupingMode, scatterGroupSize) {
    const cells = res * res;
    return groupingMode === 'scatter'
        ? Math.ceil(cells / Math.max(1, scatterGroupSize))
        : Math.ceil(cells / 3.4);
}
/** Loading tuning for a given resolution, with `pieceDelayMs` auto-scaled
 *  so higher resolution stays just as snappy. */
function tuneForResolution(res, groupingMode = 'tetromino', scatterGroupSize = 4) {
    const pieces = estPieceCount(res, groupingMode, scatterGroupSize);
    const pieceDelayMs = Math.max(6, Math.min(90, Math.round((TARGET_FILL_MS - DROP_DURATION_MS) / pieces)));
    return {
        cols: res,
        rows: res,
        cellSize: 40,
        padding: 16,
        pieceDelayMs,
        dropDurationMs: DROP_DURATION_MS,
        dropDistance: 260,
        groupingMode,
        scatterGroupSize,
    };
}
/** Loop cadence: hold the finished avatar for a beat, then re-drop.
 *  Constant because fill duration is held constant across resolutions. */
const LOOP_MS = TARGET_FILL_MS + 1100;
/** The codebase avatar URL — the GitHub owner avatar, the same shape the
 *  repo page already uses elsewhere. */
export function ownerAvatarUrl(owner) {
    return `https://github.com/${owner}.png?size=128`;
}
/** A self-looping block drop, so it reads as continuous loading rather
 *  than a one-shot reveal. Re-drops the whole grid on a fixed cadence. */
function LoopingBlockDrop({ loopMs = LOOP_MS, ...props }) {
    const [key, setKey] = useState(0);
    const loopRef = useRef(loopMs);
    loopRef.current = loopMs;
    useEffect(() => {
        const id = window.setInterval(() => setKey(k => k + 1), loopRef.current);
        return () => window.clearInterval(id);
    }, []);
    return _jsx(FileCityBlockDrop, { ...props, resetKey: key });
}
export function BlockDropLoadingScreen({ message, imageSrc = LOGO_SRC, resolution = DEFAULT_RESOLUTION, }) {
    const { theme } = useTheme();
    const tuning = tuneForResolution(resolution);
    return (_jsxs("div", { className: "w-full h-full flex items-center justify-center overflow-hidden", style: { background: theme.colors.background }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 20,
                }, children: [message && (_jsx("div", { style: {
                            fontFamily: theme.fonts?.body,
                            fontSize: theme.fontSizes?.[4] ?? '1.5rem',
                            fontWeight: 600,
                            letterSpacing: '0.01em',
                            color: theme.colors.textMuted,
                            animation: 'blockDropLoadPulse 2s ease-in-out infinite',
                        }, children: message })), _jsx("div", { style: {
                            width: 'min(70vmin, 520px)',
                            height: 'min(70vmin, 520px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }, children: _jsx(LoopingBlockDrop, { ...tuning, imageSrc: imageSrc }) })] }), _jsx("style", { children: `
        @keyframes blockDropLoadPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      ` })] }));
}
