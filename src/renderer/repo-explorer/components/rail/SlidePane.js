'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
// ---------------------------------------------------------------------------
// SlidePane — a horizontal carousel for a rail's swappable surfaces. A change in
// `viewKey` animates as a slide: the outgoing pane slides off one edge while the
// incoming pane slides in from the other. Only one pane is live at rest; during
// a transition the previous pane is briefly snapshotted into a second layer and
// dropped once its slide-out finishes.
//
// Extracted from the owner/repo explorer so the signed-in home rail can reuse
// the exact same nav mechanic. Direction is pluggable via `resolveDirection` —
// build one from an ordered list of surfaces with `makeSlideDirection` so going
// "forward" enters from the right and going "back" enters from the left.
// ---------------------------------------------------------------------------
export const SLIDE_MS = 320;
/**
 * Build a direction resolver from a left-to-right ordering of surfaces. A
 * transition to a later surface slides the new pane in from the right (returns
 * 1); going back reverses it (returns -1).
 */
export function makeSlideDirection(order) {
    return (from, to) => {
        const a = order.indexOf(from);
        const b = order.indexOf(to);
        return b >= a ? 1 : -1;
    };
}
export const SlidePane = ({ viewKey, resolveDirection, children }) => {
    // Latest children for the active view, captured each commit so we can snapshot
    // the outgoing pane the instant the view changes.
    const liveChildren = useRef(children);
    const [shownKey, setShownKey] = useState(viewKey);
    const [animId, setAnimId] = useState(0);
    const [enterDir, setEnterDir] = useState(0);
    const [leaving, setLeaving] = useState(null);
    // Detect a view change during render so the entering layer mounts already
    // animating (no extra paint of the old view in the new slot).
    if (viewKey !== shownKey) {
        const dir = (resolveDirection ?? (() => 1))(shownKey, viewKey);
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
        if (!leaving)
            return;
        const id = leaving.id;
        const t = window.setTimeout(() => {
            setLeaving((cur) => (cur && cur.id === id ? null : cur));
        }, SLIDE_MS);
        return () => window.clearTimeout(t);
    }, [leaving]);
    return (_jsxs("div", { className: "relative flex-1 min-h-0 overflow-hidden", children: [leaving && (_jsx("div", { className: "absolute inset-0 flex flex-col", style: {
                    animation: `${leaving.dir === 1 ? 'rpSlideOutLeft' : 'rpSlideOutRight'} ${SLIDE_MS}ms ease forwards`,
                }, children: leaving.node }, `leave-${leaving.id}`)), _jsx("div", { className: "absolute inset-0 flex flex-col", style: enterDir === 0
                    ? undefined
                    : {
                        animation: `${enterDir === 1 ? 'rpSlideInRight' : 'rpSlideInLeft'} ${SLIDE_MS}ms ease forwards`,
                    }, children: children }, `shown-${animId}`), _jsx("style", { children: `
        @keyframes rpSlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes rpSlideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes rpSlideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes rpSlideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
      ` })] }));
};
