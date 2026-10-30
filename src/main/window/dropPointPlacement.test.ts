/** @jest-environment node */

import { placeWindowAtDropPoint } from './dropPointPlacement';

describe('placeWindowAtDropPoint', () => {
  const workArea = { x: 0, y: 25, width: 1920, height: 1055 };
  const size = { width: 1100, height: 800 };

  it('centers the titlebar under the drop point', () => {
    const rect = placeWindowAtDropPoint({ x: 960, y: 200 }, size, workArea);
    expect(rect).toEqual({ x: 410, y: 182, width: 1100, height: 800 });
  });

  it('clamps to the work area near the edges', () => {
    expect(placeWindowAtDropPoint({ x: 10, y: 5 }, size, workArea)).toEqual({
      x: 0,
      y: 25,
      width: 1100,
      height: 800,
    });
    expect(
      placeWindowAtDropPoint({ x: 1915, y: 1075 }, size, workArea),
    ).toEqual({ x: 820, y: 280, width: 1100, height: 800 });
  });

  it('honors a secondary display offset', () => {
    const second = { x: 1920, y: 0, width: 1440, height: 900 };
    expect(placeWindowAtDropPoint({ x: 2000, y: 60 }, size, second)).toEqual({
      x: 1920,
      y: 42,
      width: 1100,
      height: 800,
    });
  });

  it('shrinks a window larger than the display', () => {
    const small = { x: 0, y: 0, width: 1024, height: 700 };
    expect(placeWindowAtDropPoint({ x: 500, y: 300 }, size, small)).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 700,
    });
  });
});
