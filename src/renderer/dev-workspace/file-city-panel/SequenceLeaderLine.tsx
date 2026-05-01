import React from 'react';
import * as THREE from 'three';
import { useTheme } from '@principal-ade/industry-theme';
import type { CityBuilding } from '@principal-ai/file-city-react';

/**
 * Mirror of `OnCameraFrame` from `@principal-ai/file-city-react`'s internals;
 * not re-exported from the package's public surface.
 */
export type OnCameraFrame = (
  camera: THREE.Camera,
  size: { width: number; height: number },
) => void;

export interface SequenceLeaderLineHandle {
  /** Pass this through to `<FileCityExplorer onCameraFrame={...}>`. */
  onCameraFrame: OnCameraFrame;
}

export interface SequenceLeaderLineProps {
  /** Container the SVG sits inside; used to convert client-rect coords to local. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Building the line points to. `null` hides the line. */
  building: CityBuilding | null;
  /**
   * `FileCity3D` re-centers the city around the world origin, so building
   * positions need this offset subtracted before projecting through the
   * camera. Compute as `(bounds.minX + bounds.maxX) / 2` etc.
   */
  cityCenter: { x: number; z: number } | null;
  /** Element the line lands on (e.g. the detail overlay root). `null` hides the line. */
  targetRef: React.RefObject<HTMLElement | null>;
}

/**
 * Single leader-line from the selected sequence-diagram node to the
 * matching building in the 3D city. SVG attrs are written imperatively
 * inside `onCameraFrame` so we don't trigger React reconciliation 60×/sec.
 *
 * Mirrors the pattern from
 * `web-ade/file-city/.../LeaderLineSnippetOverlay3D.stories.tsx`.
 */
export const SequenceLeaderLine = React.forwardRef<
  SequenceLeaderLineHandle,
  SequenceLeaderLineProps
>(function SequenceLeaderLine(
  { containerRef, building, cityCenter, targetRef },
  ref,
) {
  const { theme } = useTheme();
  const color = theme.colors.primary ?? '#22d3ee';

  const pathRef = React.useRef<SVGPathElement | null>(null);
  const buildingMarkerRef = React.useRef<SVGRectElement | null>(null);
  const nodeMarkerRef = React.useRef<SVGCircleElement | null>(null);
  const projectScratch = React.useRef(new THREE.Vector3());

  // Latest building selection — read from inside the per-frame callback
  // without needing to re-bind `onCameraFrame`.
  const buildingRef = React.useRef(building);
  const cityCenterRef = React.useRef(cityCenter);
  React.useEffect(() => {
    buildingRef.current = building;
  }, [building]);
  React.useEffect(() => {
    cityCenterRef.current = cityCenter;
  }, [cityCenter]);

  const hideAll = React.useCallback(() => {
    pathRef.current?.setAttribute('opacity', '0');
    buildingMarkerRef.current?.setAttribute('opacity', '0');
    nodeMarkerRef.current?.setAttribute('opacity', '0');
  }, []);

  // Hide markers as soon as the selection clears — without a camera frame
  // we'd otherwise leave the previous frame's geometry on screen.
  React.useEffect(() => {
    if (!building) hideAll();
  }, [building, hideAll]);

  const onCameraFrame = React.useCallback<OnCameraFrame>(
    (camera, size) => {
      const target = buildingRef.current;
      const center = cityCenterRef.current;
      const container = containerRef.current;
      const nodeEl = targetRef.current;
      if (!target || !center || !nodeEl || !container || size.width === 0) {
        hideAll();
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();

      // The 3D canvas may be inset within the container — FileCityExplorer
      // pushes it down by a focus-header height. Find it and offset the
      // projected canvas-local coords into container-local coords.
      const canvasEl = container.querySelector('canvas');
      if (!canvasEl) {
        hideAll();
        return;
      }
      const canvasRect = canvasEl.getBoundingClientRect();
      const canvasLeft = canvasRect.left - containerRect.left;
      const canvasTop = canvasRect.top - containerRect.top;

      // Anchor at the building's footprint center on the y=0 ground plane
      // — matches the prototype. Using `position.y` would project the
      // building's vertical center, which under a tilted camera lands
      // above the visible footprint. FileCity3D re-centers the city
      // around the world origin, so subtract the city center first.
      const v = projectScratch.current;
      v.set(
        target.position.x - center.x,
        0,
        target.position.z - center.z,
      ).project(camera);
      const behindCamera = v.z > 1;
      if (behindCamera) {
        hideAll();
        return;
      }
      const sx = canvasLeft + (v.x * 0.5 + 0.5) * size.width;
      const sy = canvasTop + (v.y * -0.5 + 0.5) * size.height;

      // Aim at the overlay's header band — the line meets the panel near
      // the title rather than at a vertical midpoint that reads as "this
      // specific line in the snippet". `HEADER_BAND_OFFSET` lands the
      // anchor on the header row so the marker sits next to the title.
      const HEADER_BAND_OFFSET = 22;
      const nodeCenterX =
        nodeRect.left + nodeRect.width / 2 - containerRect.left;
      const aimRight = nodeCenterX < sx;
      const bx = aimRight
        ? nodeRect.right - containerRect.left
        : nodeRect.left - containerRect.left;
      const by = nodeRect.top - containerRect.top + HEADER_BAND_OFFSET;

      // Cubic bezier with horizontal tangents — same shape as the prototype.
      const dxRaw = (bx - sx) * 0.5;
      const dxAbs = Math.max(80, Math.abs(dxRaw));
      const dx = dxRaw < 0 ? -dxAbs : dxAbs;
      const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${bx - dx} ${by}, ${bx} ${by}`;

      const pathEl = pathRef.current;
      const buildingEl = buildingMarkerRef.current;
      const nodeMarkerEl = nodeMarkerRef.current;
      if (pathEl) {
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('stroke', color);
        pathEl.setAttribute('opacity', '0.85');
      }
      if (buildingEl) {
        buildingEl.setAttribute('x', String(sx - 3.5));
        buildingEl.setAttribute('y', String(sy - 3.5));
        buildingEl.setAttribute('fill', color);
        buildingEl.setAttribute('opacity', '1');
      }
      if (nodeMarkerEl) {
        nodeMarkerEl.setAttribute('cx', String(bx));
        nodeMarkerEl.setAttribute('cy', String(by));
        nodeMarkerEl.setAttribute('fill', color);
        nodeMarkerEl.setAttribute('opacity', '1');
      }
    },
    [containerRef, targetRef, hideAll, color],
  );

  React.useImperativeHandle(
    ref,
    () => ({ onCameraFrame }),
    [onCameraFrame],
  );

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 2000,
      }}
    >
      <path
        ref={pathRef}
        fill="none"
        strokeWidth={1.75}
        strokeDasharray="5 4"
        opacity={0}
      />
      <rect
        ref={buildingMarkerRef}
        width={7}
        height={7}
        stroke="#0f1419"
        strokeWidth={1.25}
        opacity={0}
      />
      <circle
        ref={nodeMarkerRef}
        r={3.5}
        opacity={0}
      />
    </svg>
  );
});
