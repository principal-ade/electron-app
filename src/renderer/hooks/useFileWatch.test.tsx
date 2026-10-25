/// <reference types="jest" />
import { act, renderHook } from '@testing-library/react';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { useFileWatch } from './useFileWatch';

jest.mock('../main-process-api/FileSystemService', () => ({
  FileSystemService: {
    watchFile: jest.fn(),
    stopWatchingFile: jest.fn(),
    onFileChange: jest.fn(),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  (FileSystemService.stopWatchingFile as jest.Mock).mockResolvedValue(true);
  (FileSystemService.onFileChange as jest.Mock).mockReturnValue(jest.fn());
});
test('unmounting before watch setup resolves never leaves a late subscription', async () => {
  let resolve!: (value: boolean) => void;
  (FileSystemService.watchFile as jest.Mock).mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  const { unmount } = renderHook(() => useFileWatch('/file.ts', jest.fn()));
  unmount();
  await act(async () => {
    resolve(true);
  });
  expect(FileSystemService.onFileChange).not.toHaveBeenCalled();
  expect(FileSystemService.stopWatchingFile).toHaveBeenCalledWith('/file.ts');
});
test('dirty callbacks skip reloads and cleanup releases the captured watch', async () => {
  (FileSystemService.watchFile as jest.Mock).mockResolvedValue(true);
  const reload = jest.fn();
  let dirty = true;
  const { unmount } = renderHook(() =>
    useFileWatch('/file.ts', reload, { skipReloadWhen: () => dirty }),
  );
  await act(async () => {});
  const changed = (FileSystemService.onFileChange as jest.Mock).mock
    .calls[0][0];
  changed({ path: '/file.ts' });
  expect(reload).not.toHaveBeenCalled();
  dirty = false;
  changed({ path: '/file.ts' });
  expect(reload).toHaveBeenCalledTimes(1);
  const unsubscribe = (FileSystemService.onFileChange as jest.Mock).mock
    .results[0].value;
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
