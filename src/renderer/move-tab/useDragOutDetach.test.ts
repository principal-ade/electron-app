import { isDragReleaseOutsideWindow } from './useDragOutDetach';

describe('isDragReleaseOutsideWindow', () => {
  const base = { x: 100, y: 100, leftWindow: false, width: 1000, height: 800 };

  it('detaches when the drag left the window', () => {
    expect(isDragReleaseOutsideWindow({ ...base, leftWindow: true })).toBe(
      true,
    );
  });

  it('keeps an in-window release (reorder)', () => {
    expect(isDragReleaseOutsideWindow(base)).toBe(false);
    expect(isDragReleaseOutsideWindow({ ...base, x: 0, y: 0 })).toBe(false);
    expect(isDragReleaseOutsideWindow({ ...base, x: 1000, y: 800 })).toBe(
      false,
    );
  });

  it('detects clearly out-of-bounds releases as a fallback', () => {
    expect(isDragReleaseOutsideWindow({ ...base, x: -5 })).toBe(true);
    expect(isDragReleaseOutsideWindow({ ...base, y: -5 })).toBe(true);
    expect(isDragReleaseOutsideWindow({ ...base, x: 1005 })).toBe(true);
    expect(isDragReleaseOutsideWindow({ ...base, y: 805 })).toBe(true);
  });

  it('ignores non-finite coordinates', () => {
    expect(
      isDragReleaseOutsideWindow({ ...base, x: NaN, y: undefined as never }),
    ).toBe(false);
  });
});
