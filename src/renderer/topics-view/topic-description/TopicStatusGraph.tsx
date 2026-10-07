/**
 * A small clickable state-transition map of a topic's "aliveness" lifecycle.
 * Nodes are the workflow states laid out from nascent (left) to retired
 * (right), with the two "alive but not moving" stalls — Paused and Waiting —
 * hanging off Working, and Abandoned as the off-ramp for things dropped before
 * they shipped. The arrows show the typical path; clicking any node sets that
 * state (it's a status picker, not a strict state machine).
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { STATES, stateColor, type TopicStatusState } from './topicStatusModel';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

// viewBox geometry. Nodes are positioned by center; the box is BOX_W × BOX_H.
const VIEW_W = 440;
const VIEW_H = 184;
const BOX_W = 92;
const BOX_H = 32;
const HALF_W = BOX_W / 2;
const HALF_H = BOX_H / 2;

const NODES: Record<TopicStatusState, { cx: number; cy: number }> = {
  'new-thought': { cx: 54, cy: 30 },
  working: { cx: 165, cy: 30 },
  'done-for-now': { cx: 280, cy: 30 },
  deprecated: { cx: 388, cy: 30 },
  paused: { cx: 112, cy: 98 },
  waiting: { cx: 218, cy: 98 },
  abandoned: { cx: 165, cy: 156 },
};

// Typical transitions. `bidi` draws an arrowhead at both ends (a reversible
// stall); the rest are one-directional along the aliveness path.
const EDGES: ReadonlyArray<{
  from: TopicStatusState;
  to: TopicStatusState;
  bidi?: boolean;
}> = [
  { from: 'new-thought', to: 'working' },
  { from: 'working', to: 'done-for-now' },
  { from: 'done-for-now', to: 'deprecated' },
  { from: 'working', to: 'paused', bidi: true },
  { from: 'working', to: 'waiting', bidi: true },
  { from: 'working', to: 'abandoned' },
];

const LABELS: Record<TopicStatusState, string> = Object.fromEntries(
  STATES.map((s) => [s.value, s.label]),
) as Record<TopicStatusState, string>;

/**
 * Point on a node's box boundary along the line toward (fromX, fromY), so an
 * edge meets the rectangle's edge instead of disappearing under it.
 */
function boundaryPoint(
  cx: number,
  cy: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  const dx = fromX - cx;
  const dy = fromY - cy;
  const scale = 1 / Math.max(Math.abs(dx) / HALF_W, Math.abs(dy) / HALF_H);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export interface TopicStatusGraphProps {
  value: TopicStatusState;
  onSelect: (state: TopicStatusState) => void;
  /** Theme passed in so the graph stays a pure presentational component. */
  theme: ThemeShape;
}

export const TopicStatusGraph: React.FC<TopicStatusGraphProps> = ({
  value,
  onSelect,
  theme,
}) => {
  const [hovered, setHovered] = React.useState<TopicStatusState | null>(null);
  const lineColor = theme.colors.border;
  const arrowId = 'topic-status-arrow';

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      role="group"
      aria-label="Topic status lifecycle"
      style={{ display: 'block', userSelect: 'none' }}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={lineColor} />
        </marker>
      </defs>

      {/* Edges first, so the node boxes paint on top of the line ends. */}
      {EDGES.map(({ from, to, bidi }) => {
        const a = NODES[from];
        const b = NODES[to];
        const p1 = boundaryPoint(a.cx, a.cy, b.cx, b.cy);
        const p2 = boundaryPoint(b.cx, b.cy, a.cx, a.cy);
        return (
          <line
            key={`${from}-${to}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={lineColor}
            strokeWidth={1.5}
            markerEnd={`url(#${arrowId})`}
            markerStart={bidi ? `url(#${arrowId})` : undefined}
          />
        );
      })}

      {STATES.map(({ value: state }) => {
        const { cx, cy } = NODES[state];
        const color = stateColor(state, theme);
        const selected = state === value;
        const isHovered = hovered === state;
        return (
          <g
            key={state}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={LABELS[state]}
            onClick={() => onSelect(state)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(state);
              }
            }}
            onMouseEnter={() => setHovered(state)}
            onMouseLeave={() => setHovered((h) => (h === state ? null : h))}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            <rect
              x={cx - HALF_W}
              y={cy - HALF_H}
              width={BOX_W}
              height={BOX_H}
              rx={8}
              fill={selected ? color : theme.colors.backgroundSecondary}
              stroke={color}
              strokeWidth={selected || isHovered ? 2 : 1}
              opacity={selected || isHovered ? 1 : 0.85}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={theme.fonts.body}
              fontSize={11}
              fontWeight={selected ? 600 : 400}
              fill={selected ? theme.colors.background : color}
            >
              {LABELS[state]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default TopicStatusGraph;
