jest.mock('@principal-ai/alexandria-core-library', () => ({
  AlexandriaOutpostManager: jest.fn().mockImplementation(() => ({
    getRepositoryByPath: jest.fn().mockResolvedValue({ path: '/clone' }),
    removeRepository: jest.fn().mockReturnValue(true),
  })),
}));
jest.mock('@principal-ai/alexandria-core-library/node', () => ({
  NodeFileSystemAdapter: jest.fn(),
  NodeGlobAdapter: jest.fn(),
}));
jest.mock('../utils/gitClientFactory', () => ({}));
jest.mock('../file-system-service', () => ({
  FileSystemService: {
    deleteDirectory: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../telemetry', () => ({}));
jest.mock('../terminal/closeRepositoryTerminals', () => ({
  closeRepositoryTerminals: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../terminal/sessionManagerSingleton', () => ({
  getSessionManagerInstance: jest.fn().mockReturnValue({}),
}));

import { AlexandriaOutpostManager } from '@principal-ai/alexandria-core-library';
import { FileSystemService } from '../file-system-service';
import { closeRepositoryTerminals } from '../terminal/closeRepositoryTerminals';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';

describe('clone deletion', () => {
  const service = AlexandriaRegistryService.getInstance();
  const outpost = jest.mocked(AlexandriaOutpostManager).mock.results[0].value;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes terminals before deleting files and removing the registration', async () => {
    expect(await service.removeRepository('/clone', true)).toBe(true);
    expect(closeRepositoryTerminals).toHaveBeenCalledWith({}, '/clone');
    expect(FileSystemService.deleteDirectory).toHaveBeenCalledWith('/clone');
    const closeOrder = jest.mocked(closeRepositoryTerminals).mock
      .invocationCallOrder[0];
    const deleteOrder = jest.mocked(FileSystemService.deleteDirectory).mock
      .invocationCallOrder[0];
    const removeOrder = outpost.removeRepository.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(deleteOrder);
    expect(deleteOrder).toBeLessThan(removeOrder);
  });

  it('does not touch terminals or files when only unregistering', async () => {
    expect(await service.removeRepository('/clone', false)).toBe(true);
    expect(closeRepositoryTerminals).not.toHaveBeenCalled();
    expect(FileSystemService.deleteDirectory).not.toHaveBeenCalled();
    expect(outpost.removeRepository).toHaveBeenCalledWith('/clone');
  });

  it('keeps files and registration if terminal shutdown fails', async () => {
    jest
      .mocked(closeRepositoryTerminals)
      .mockRejectedValueOnce(new Error('terminal timeout'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.removeRepository('/clone', true)).toBe(false);
    expect(FileSystemService.deleteDirectory).not.toHaveBeenCalled();
    expect(outpost.removeRepository).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('keeps registration if file deletion fails', async () => {
    jest
      .mocked(FileSystemService.deleteDirectory)
      .mockRejectedValueOnce(new Error('file error'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.removeRepository('/clone', true)).toBe(false);
    expect(outpost.removeRepository).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
