/**
 * SlidePane
 *
 * A horizontal carousel for a rail's swappable surfaces. A change in `viewKey`
 * animates as a slide: the outgoing pane slides off one edge while the incoming
 * pane slides in from the other. Only one pane is live at rest; during a
 * transition the previous pane is briefly snapshotted into a second layer and
 * dropped once its slide-out finishes.
 *
 * Direction is pluggable via `resolveDirection` — build one from an ordered
 * list of surfaces with `makeSlideDirection` so going "forward" enters from the
 * right and going "back" enters from the left.
 *
 * This is a shared component intended for reuse across surfaces (Home,
 * Topics, etc.).
 */

import React, { useEffect, useRef, useState } from 'react';

export const SLIDE_MS = 320;

export interface SlidePaneProps {
  /** The currently-active view key. Changing this triggers the slide animation. */
  viewKey: string;
  /**
   * Which way a given transition slides. Defaults to always entering from the
   * right; panes with an ordering pass `makeSlideDirection(order)` for the
   * back-and-forth carousel feel. Returns 1 to enter from the right, -1 left.
   */
  resolveDirection?: (from: string, to: string) => 1 | -1;
  children: React.ReactNode;
}

export const SlidePane: React.FC<SlidePaneProps> = ({
  viewKey,
  resolveDirection,
  children,
}) => {
  // Latest children for the active view, captured each commit so we can snapshot
  // the outgoing pane the instant the view changes.
  const liveChildren = useRef<React.ReactNode>(children);
  const [shownKey, setShownKey] = useState(viewKey);
  const [animId, setAnimId] = useState(0);
  const [enterDir, setEnterDir] = useState<0 | 1 | -1>(0);
  const [leaving, setLeaving] = useState<{
    id: number;
    dir: 1 | -1;
    node: React.ReactNode;
  } | null>(null);

  // Detect a view change during render so the entering layer mounts already
  // animating (no extra paint of the old view in the new slot).
  if (viewKey !== shownKey) {
    const dir = (resolveDirection ?? (() => 1 as const))(shownKey, viewKey);
    setLeaving({ id: animId, dir, node: liveChildren.current });
    setShownKey(viewKey);
    setAnimId((n) => n + 1);
    setEnterDir(dir);
  }

  useEffect(() => {
    liveChildren.current = children;
  });

  // Drop the outgoing layer once its slide-out has finished.
  useEffect(() => {
    if (!leaving) return;
    const id = leaving.id;
    const t = window.setTimeout(() => {
      setLeaving((cur) => (cur && cur.id === id ? null : cur));
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {leaving && (
        <div
          key={`leave-${leaving.id}`}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            animation: `${
              leaving.dir === 1 ? 'spSlideOutLeft' : 'spSlideOutRight'
            } ${SLIDE_MS}ms ease forwards`,
          }}
        >
          {leaving.node}
        </div>
      )}
      <div
        key={`shown-${animId}`}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          ...(enterDir === 0
            ? undefined
            : {
                animation: `${
                  enterDir === 1 ? 'spSlideInRight' : 'spSlideInLeft'
                } ${SLIDE_MS}ms ease forwards`,
              }),
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes spSlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spSlideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes spSlideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes spSlideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
      `}</style>
    </div>
  );
};
