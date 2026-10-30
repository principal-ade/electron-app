/**
 * Placement for a window opened by dragging a tab out of its source window.
 *
 * The user released the drag at a screen point; the new window should appear
 * there so the gesture reads as "I put the tab here", not "a window appeared
 * somewhere". The titlebar lands under the cursor (like a browser's tab
 * drag-out) and the window is clamped to the display's work area so it never
 * opens half off-screen.
 */

export interface ScreenRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Vertical distance from the cursor to the top edge: mid-titlebar. */
const TITLEBAR_GRAB_OFFSET = 18;

export function placeWindowAtDropPoint(
  point: ScreenPoint,
  size: { width: number; height: number },
  workArea: ScreenRectangle,
): ScreenRectangle {
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = Math.round(
    Math.min(Math.max(point.x - width / 2, workArea.x), maxX),
  );
  const y = Math.round(
    Math.min(Math.max(point.y - TITLEBAR_GRAB_OFFSET, workArea.y), maxY),
  );
  return { x, y, width, height };
}
