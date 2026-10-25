/// <reference types="jest" />
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { SourceFileTabContent } from './SourceFileTabContent';
import { MonacoFileTabContent } from './MonacoFileTabContent';
import { PierreFileView } from './PierreFileView';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { clearFileDraft, updateFileDraft } from './fileDrafts';

jest.mock('./MonacoFileTabContent', () => ({
  MonacoFileTabContent: jest.fn(() => null),
}));
jest.mock('./PierreFileView', () => ({ PierreFileView: jest.fn(() => null) }));
jest.mock('../main-process-api/FileSystemService', () => ({
  FileSystemService: {
    getFileStats: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));
const filePath = '/repo/source.ts';
const range = {
  startLineNumber: 302,
  startColumn: 1,
  endLineNumber: 304,
  endColumn: 2,
};
const props = { filePath, fileName: 'source.ts', range, rangeRevision: 1 };
function monacoProps() {
  const calls = (MonacoFileTabContent as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as React.ComponentProps<
    typeof MonacoFileTabContent
  >;
}
beforeEach(() => {
  jest.clearAllMocks();
  (FileSystemService.getFileStats as jest.Mock).mockResolvedValue({
    writable: true,
  });
  (FileSystemService.readFile as jest.Mock).mockResolvedValue({
    filePath,
    content: 'original',
  });
  (FileSystemService.writeFile as jest.Mock).mockResolvedValue({
    success: true,
    filePath,
  });
});
afterEach(() => clearFileDraft(filePath));

test('writable local source uses editable Monaco with range and draft protection', async () => {
  render(<SourceFileTabContent {...props} />);
  await waitFor(() => expect(MonacoFileTabContent).toHaveBeenCalled());
  expect(monacoProps()).toMatchObject({
    editable: true,
    preserveUnsavedChanges: true,
    range,
    rangeRevision: 1,
  });
  expect(PierreFileView).not.toHaveBeenCalled();
});

test.each([false, undefined])(
  'source without proven write access uses Pierre (%s)',
  async (writable) => {
    (FileSystemService.getFileStats as jest.Mock).mockResolvedValue({
      writable,
    });
    render(<SourceFileTabContent {...props} />);
    await waitFor(() => expect(PierreFileView).toHaveBeenCalled());
    expect((PierreFileView as jest.Mock).mock.calls[0][0]).toMatchObject({
      range,
      rangeRevision: 1,
    });
    expect(MonacoFileTabContent).not.toHaveBeenCalled();
  },
);

test('permission-check failures fail closed to the read-only viewer', async () => {
  (FileSystemService.getFileStats as jest.Mock).mockRejectedValue(
    new Error('unavailable'),
  );
  render(<SourceFileTabContent {...props} />);
  await waitFor(() => expect(PierreFileView).toHaveBeenCalled());
  expect(MonacoFileTabContent).not.toHaveBeenCalled();
});

test('explicit read-only sources stay read-only even on a writable filesystem', async () => {
  render(<SourceFileTabContent {...props} readOnly />);
  await waitFor(() =>
    expect(FileSystemService.getFileStats).toHaveBeenCalled(),
  );
  expect(PierreFileView).toHaveBeenCalled();
  expect(MonacoFileTabContent).not.toHaveBeenCalled();
});

test('updating the range does not recheck access or replace the file tab', async () => {
  const { rerender } = render(<SourceFileTabContent {...props} />);
  await waitFor(() => expect(MonacoFileTabContent).toHaveBeenCalled());
  rerender(<SourceFileTabContent {...props} rangeRevision={2} />);
  expect(monacoProps().rangeRevision).toBe(2);
  expect(FileSystemService.getFileStats).toHaveBeenCalledTimes(1);
});

test('save writes only after checking access and the original disk contents', async () => {
  render(<SourceFileTabContent {...props} />);
  await waitFor(() => expect(MonacoFileTabContent).toHaveBeenCalled());
  updateFileDraft(filePath, 'original', 'edited');
  await monacoProps().onSave?.('edited');
  expect(FileSystemService.writeFile).toHaveBeenCalledWith(filePath, 'edited');
});

test.each(['external change', 'lost permission', 'write failure'])(
  'save keeps drafts on %s',
  async (failure) => {
    render(<SourceFileTabContent {...props} />);
    await waitFor(() => expect(MonacoFileTabContent).toHaveBeenCalled());
    updateFileDraft(filePath, 'original', 'edited');
    if (failure === 'external change')
      (FileSystemService.readFile as jest.Mock).mockResolvedValue({
        content: 'external',
      });
    if (failure === 'lost permission')
      (FileSystemService.getFileStats as jest.Mock).mockResolvedValue({
        writable: false,
      });
    if (failure === 'write failure')
      (FileSystemService.writeFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'write failed',
      });
    await expect(monacoProps().onSave?.('edited')).rejects.toThrow();
    if (failure !== 'write failure')
      expect(FileSystemService.writeFile).not.toHaveBeenCalled();
  },
);
