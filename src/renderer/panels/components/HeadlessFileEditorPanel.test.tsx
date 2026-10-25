/// <reference types="jest" />
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { editor, IRange } from 'monaco-editor';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import {
  HeadlessFileEditorPanel,
  type HeadlessFileEditorPanelHandle,
} from './HeadlessFileEditorPanel';
import { clearFileDraft, getFileDraft } from '../fileDrafts';
import { useFileWatch } from '../../hooks/useFileWatch';

jest.mock('@principal-ade/industry-themed-monaco-editor', () => ({
  ThemedMonacoWithProvider: jest.fn(() => null),
}));
jest.mock('../../hooks/useFileWatch', () => ({ useFileWatch: jest.fn() }));

const range: IRange = {
  startLineNumber: 302,
  startColumn: 1,
  endLineNumber: 304,
  endColumn: 2,
};
const nextRange: IRange = {
  ...range,
  startLineNumber: 102,
  endLineNumber: 104,
};

function createEditor() {
  const validateRange = jest.fn((value: IRange) => value);
  return {
    getModel: jest.fn(() => ({ validateRange })),
    setSelection: jest.fn(),
    revealRangeInCenter: jest.fn(),
    layout: jest.fn(),
    focus: jest.fn(),
    validateRange,
  };
}

function editorProps() {
  const calls = (ThemedMonacoWithProvider as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as React.ComponentProps<
    typeof ThemedMonacoWithProvider
  >;
}

function mountEditor(instance: ReturnType<typeof createEditor>) {
  const { onMount } = editorProps();
  if (!onMount) throw new Error('Expected an editor mount handler');
  act(() => {
    onMount(instance as unknown as editor.IStandaloneCodeEditor, {} as never);
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => clearFileDraft('/draft.ts'));

function editContent(content: string) {
  const { onChange } = editorProps();
  if (!onChange) throw new Error('Expected an editor change handler');
  act(() => {
    onChange(content, {} as never);
  });
}

async function saveEditor() {
  const { onSave, value } = editorProps();
  if (!onSave) throw new Error('Expected an editor save handler');
  await onSave(typeof value === 'string' ? value : '', {});
}

test('local drafts survive tab closes and warn before leaving the window', async () => {
  const contentLoader = jest.fn(async () => 'original');
  const props = {
    filePath: '/draft.ts',
    contentLoader,
    vimModeOverride: false,
    editable: true,
    preserveUnsavedChanges: true,
  };
  const first = render(<HeadlessFileEditorPanel {...props} />);
  await waitFor(() => expect(editorProps().value).toBe('original'));
  editContent('unsaved');
  const watchCalls = (useFileWatch as jest.Mock).mock.calls;
  expect(watchCalls[watchCalls.length - 1][2].skipReloadWhen()).toBe(true);
  first.unmount();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  render(<HeadlessFileEditorPanel {...props} />);
  await waitFor(() => expect(editorProps().value).toBe('unsaved'));
  expect(getFileDraft('/draft.ts')).toEqual({
    originalContent: 'original',
    content: 'unsaved',
  });
});

test('typing during a save is kept as a newer unsaved draft', async () => {
  const ref = React.createRef<HeadlessFileEditorPanelHandle>();
  let finish!: () => void;
  const onSave = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <HeadlessFileEditorPanel
      ref={ref}
      filePath="/draft.ts"
      contentLoader={async () => 'original'}
      vimModeOverride={false}
      editable
      preserveUnsavedChanges
      onSave={onSave}
    />,
  );
  await waitFor(() => expect(editorProps().value).toBe('original'));
  editContent('first edit');
  let saving: Promise<void> | undefined;
  act(() => {
    saving = saveEditor();
  });
  editContent('newer edit');
  await act(async () => {
    finish();
    await saving;
  });
  expect(onSave).toHaveBeenCalledWith('first edit');
  expect(editorProps().value).toBe('newer edit');
  expect(getFileDraft('/draft.ts')).toEqual({
    originalContent: 'first edit',
    content: 'newer edit',
  });
});

test('failed saves display the error and keep edits; successful saves clear the draft', async () => {
  const ref = React.createRef<HeadlessFileEditorPanelHandle>();
  const onSave = jest
    .fn()
    .mockRejectedValueOnce(new Error('Permission denied'))
    .mockResolvedValueOnce(undefined);
  render(
    <HeadlessFileEditorPanel
      ref={ref}
      filePath="/draft.ts"
      contentLoader={async () => 'original'}
      vimModeOverride={false}
      editable
      preserveUnsavedChanges
      onSave={onSave}
    />,
  );
  await waitFor(() => expect(editorProps().value).toBe('original'));
  editContent('edited');
  await act(async () => {
    await expect(saveEditor()).rejects.toThrow('Permission denied');
  });
  expect(screen.getByRole('alert').textContent).toBe('Permission denied');
  expect(getFileDraft('/draft.ts')?.content).toBe('edited');
  await act(async () => {
    await saveEditor();
  });
  expect(getFileDraft('/draft.ts')).toBeUndefined();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('explicit discard reloads the disk version and clears retained edits', async () => {
  const ref = React.createRef<HeadlessFileEditorPanelHandle>();
  const contentLoader = jest
    .fn()
    .mockResolvedValueOnce('original')
    .mockResolvedValueOnce('new disk contents');
  render(
    <HeadlessFileEditorPanel
      ref={ref}
      filePath="/draft.ts"
      contentLoader={contentLoader}
      vimModeOverride={false}
      editable
      preserveUnsavedChanges
    />,
  );
  await waitFor(() => expect(editorProps().value).toBe('original'));
  editContent('edited');
  await act(async () => {
    await ref.current?.discardChanges();
  });
  expect(editorProps().value).toBe('new disk contents');
  expect(getFileDraft('/draft.ts')).toBeUndefined();
});

test('a repeated request for the same span navigates without resetting the editor', async () => {
  const contentLoader = jest.fn(async () => 'file content');
  const props = {
    filePath: '/long.ts',
    contentLoader,
    vimModeOverride: false,
    range,
  };
  const { rerender } = render(
    <HeadlessFileEditorPanel {...props} rangeRevision={1} />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  mountEditor(instance);
  instance.revealRangeInCenter.mockClear();
  rerender(<HeadlessFileEditorPanel {...props} rangeRevision={2} />);
  expect(instance.revealRangeInCenter).toHaveBeenCalledWith(range);
  expect(contentLoader).toHaveBeenCalledTimes(1);
});

test('imperative return reselects and centers the latest span without reloading or losing edits', async () => {
  const ref = React.createRef<HeadlessFileEditorPanelHandle>();
  const contentLoader = jest.fn(async () => 'file content');
  const props = {
    filePath: '/long.ts',
    contentLoader,
    vimModeOverride: false,
    editable: true,
    ref,
  };
  const { rerender } = render(
    <HeadlessFileEditorPanel {...props} range={range} />,
  );
  act(() => {
    ref.current?.revealRange();
  });
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  mountEditor(instance);
  const { onChange } = editorProps();
  if (!onChange) throw new Error('Expected an editor change handler');
  act(() => {
    onChange('unsaved edits', {} as never);
  });
  rerender(<HeadlessFileEditorPanel {...props} range={nextRange} />);
  instance.setSelection.mockClear();
  instance.revealRangeInCenter.mockClear();
  act(() => {
    ref.current?.revealRange();
    ref.current?.revealRange();
  });
  expect(instance.setSelection).toHaveBeenCalledTimes(2);
  expect(instance.setSelection).toHaveBeenLastCalledWith(nextRange);
  expect(instance.revealRangeInCenter).toHaveBeenLastCalledWith(nextRange);
  expect(instance.focus).toHaveBeenCalledTimes(2);
  expect(contentLoader).toHaveBeenCalledTimes(1);
  expect(editorProps().value).toBe('unsaved edits');
});

test('waits for content and editor mount before selecting and centering the span', async () => {
  let resolve!: (value: string) => void;
  const contentLoader = jest.fn(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  render(
    <HeadlessFileEditorPanel
      filePath="/long.ts"
      contentLoader={contentLoader}
      vimModeOverride={false}
      range={range}
    />,
  );
  expect(screen.getByText('Loading file...')).toBeTruthy();
  expect(ThemedMonacoWithProvider).not.toHaveBeenCalled();
  await act(async () => {
    resolve('long file content');
  });
  const instance = createEditor();
  mountEditor(instance);
  expect(instance.layout).toHaveBeenCalled();
  expect(instance.validateRange).toHaveBeenCalledWith(range);
  expect(instance.setSelection).toHaveBeenCalledWith(range);
  expect(instance.revealRangeInCenter).toHaveBeenCalledWith(range);
  expect(instance.layout.mock.invocationCallOrder[0]).toBeLessThan(
    instance.revealRangeInCenter.mock.invocationCallOrder[0],
  );
});

test('navigates when the span changes without reloading the file', async () => {
  const contentLoader = jest.fn(async () => 'file content');
  const props = { filePath: '/long.ts', contentLoader, vimModeOverride: false };
  const { rerender } = render(
    <HeadlessFileEditorPanel {...props} range={range} />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  mountEditor(instance);
  instance.setSelection.mockClear();
  instance.revealRangeInCenter.mockClear();
  rerender(<HeadlessFileEditorPanel {...props} range={nextRange} />);
  expect(instance.setSelection).toHaveBeenCalledWith(nextRange);
  expect(instance.revealRangeInCenter).toHaveBeenCalledWith(nextRange);
  expect(contentLoader).toHaveBeenCalledTimes(1);
});

test('does not reset selection or scrolling on edits or equivalent range objects', async () => {
  const contentLoader = jest.fn(async () => 'file content');
  const props = {
    filePath: '/long.ts',
    contentLoader,
    vimModeOverride: false,
    editable: true,
  };
  const { rerender } = render(
    <HeadlessFileEditorPanel {...props} range={range} />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  mountEditor(instance);
  instance.setSelection.mockClear();
  instance.revealRangeInCenter.mockClear();
  rerender(<HeadlessFileEditorPanel {...props} range={{ ...range }} />);
  const { onChange } = editorProps();
  if (!onChange) throw new Error('Expected an editor change handler');
  act(() => {
    onChange('edited content', {} as never);
  });
  expect(instance.setSelection).not.toHaveBeenCalled();
  expect(instance.revealRangeInCenter).not.toHaveBeenCalled();
});

test('leaves the default editor position alone when no range is supplied', async () => {
  render(
    <HeadlessFileEditorPanel
      filePath="/long.ts"
      contentLoader={async () => 'file content'}
      vimModeOverride={false}
    />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  mountEditor(instance);
  expect(instance.getModel).not.toHaveBeenCalled();
  expect(instance.setSelection).not.toHaveBeenCalled();
  expect(instance.revealRangeInCenter).not.toHaveBeenCalled();
});

test('uses Monaco validation to clamp a span to the loaded file', async () => {
  render(
    <HeadlessFileEditorPanel
      filePath="/short.ts"
      contentLoader={async () => 'short'}
      vimModeOverride={false}
      range={range}
    />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const instance = createEditor();
  const clamped = {
    startLineNumber: 1,
    startColumn: 6,
    endLineNumber: 1,
    endColumn: 6,
  };
  instance.validateRange.mockReturnValue(clamped);
  mountEditor(instance);
  expect(instance.setSelection).toHaveBeenCalledWith(clamped);
  expect(instance.revealRangeInCenter).toHaveBeenCalledWith(clamped);
});

test('waits for the new editor when switching files with a different span', async () => {
  const contentLoader = jest.fn(async () => 'first file');
  const { rerender } = render(
    <HeadlessFileEditorPanel
      filePath="/first.ts"
      contentLoader={contentLoader}
      vimModeOverride={false}
      range={range}
    />,
  );
  await waitFor(() => expect(ThemedMonacoWithProvider).toHaveBeenCalled());
  const first = createEditor();
  mountEditor(first);
  let resolve!: (value: string) => void;
  const nextLoader = () =>
    new Promise<string>((done) => {
      resolve = done;
    });
  rerender(
    <HeadlessFileEditorPanel
      filePath="/second.ts"
      contentLoader={nextLoader}
      vimModeOverride={false}
      range={range}
    />,
  );
  first.setSelection.mockClear();
  rerender(
    <HeadlessFileEditorPanel
      filePath="/second.ts"
      contentLoader={nextLoader}
      vimModeOverride={false}
      range={nextRange}
    />,
  );
  expect(first.setSelection).not.toHaveBeenCalled();
  await act(async () => {
    resolve('second file');
  });
  const second = createEditor();
  mountEditor(second);
  expect(second.setSelection).toHaveBeenCalledWith(nextRange);
  expect(second.revealRangeInCenter).toHaveBeenCalledWith(nextRange);
});
