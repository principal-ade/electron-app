import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  clampFontScale,
  getDefaultFontScale,
  setDefaultFontScale,
  stepFontScale,
  useDefaultFontScale,
  useFontScaleShortcuts,
} from './markdownFontScale';

const visibleRect = () => [{} as DOMRect] as unknown as DOMRectList;
const hiddenRect = () => [] as unknown as DOMRectList;

const Surface: React.FC<{
  visible?: boolean;
  onAction: (action: string) => void;
  testId: string;
}> = ({ visible = true, onAction, testId }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  useFontScaleShortcuts(ref, {
    increase: () => onAction('increase'),
    decrease: () => onAction('decrease'),
    reset: () => onAction('reset'),
  });
  React.useLayoutEffect(() => {
    if (ref.current) {
      ref.current.getClientRects = visible ? visibleRect : hiddenRect;
    }
  });
  return (
    <div ref={ref} data-testid={testId}>
      <button type="button">focusable</button>
    </div>
  );
};

const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.body, { key, metaKey: true, ...init });

beforeEach(() => {
  window.localStorage.clear();
  setDefaultFontScale(1);
});

describe('scale helpers', () => {
  test('clamps and steps without float drift', () => {
    expect(clampFontScale(10)).toBe(FONT_SCALE_MAX);
    expect(clampFontScale(0.1)).toBe(FONT_SCALE_MIN);
    expect(clampFontScale(Number.NaN)).toBe(1);
    expect(stepFontScale(1, 1)).toBe(1.1);
    expect(stepFontScale(1.1, 1)).toBe(1.2);
    expect(stepFontScale(0.5, -1)).toBe(0.5);
  });
});

describe('default store', () => {
  test('persists and notifies subscribers', () => {
    const { result } = renderHook(() => useDefaultFontScale());
    expect(result.current).toBe(1);
    act(() => setDefaultFontScale(1.3));
    expect(result.current).toBe(1.3);
    expect(getDefaultFontScale()).toBe(1.3);
    expect(window.localStorage.getItem('markdown-font-scale:default')).toBe(
      '1.3',
    );
  });
});

describe('useFontScaleShortcuts', () => {
  test('maps Cmd =/+/-/_/0 on the sole visible surface', () => {
    const onAction = jest.fn();
    render(<Surface testId="a" onAction={onAction} />);
    press('=');
    press('+');
    press('-');
    press('_');
    press('0');
    expect(onAction.mock.calls.map((c) => c[0])).toEqual([
      'increase',
      'increase',
      'decrease',
      'decrease',
      'reset',
    ]);
    // Ctrl works too; plain keys and Alt-modified keys do not.
    press('=', { metaKey: false, ctrlKey: true });
    expect(onAction).toHaveBeenCalledTimes(6);
    press('=', { metaKey: false });
    press('=', { altKey: true });
    expect(onAction).toHaveBeenCalledTimes(6);
  });

  test('prevents default when handled', () => {
    render(<Surface testId="a" onAction={jest.fn()} />);
    const event = new KeyboardEvent('keydown', {
      key: '=',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('ignores hidden surfaces and editable targets', () => {
    const onAction = jest.fn();
    const { rerender } = render(
      <Surface testId="a" visible={false} onAction={onAction} />,
    );
    press('=');
    expect(onAction).not.toHaveBeenCalled();

    rerender(<Surface testId="a" onAction={onAction} />);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: '=', metaKey: true });
    expect(onAction).not.toHaveBeenCalled();
    textarea.remove();
    press('=');
    expect(onAction).toHaveBeenCalledWith('increase');
  });

  test('with several visible surfaces, prefers focus then hover', () => {
    const a = jest.fn();
    const b = jest.fn();
    const { getByTestId } = render(
      <>
        <Surface testId="a" onAction={a} />
        <Surface testId="b" onAction={b} />
      </>,
    );
    // Ambiguous: nothing focused or hovered.
    press('=');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();

    fireEvent.pointerEnter(getByTestId('b'));
    press('=');
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();

    getByTestId('a').querySelector('button')?.focus();
    press('=');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  test('unregisters on unmount', () => {
    const onAction = jest.fn();
    const { unmount } = render(<Surface testId="a" onAction={onAction} />);
    unmount();
    press('=');
    expect(onAction).not.toHaveBeenCalled();
  });
});
