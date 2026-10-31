/** @jest-environment node */
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { registerRepository } from './registerRepository';

function entry(path: string): AlexandriaEntry {
  return { path, name: 'repo' } as unknown as AlexandriaEntry;
}

describe('registerRepository', () => {
  it('registers a new path, broadcasts it and tells monitoring', async () => {
    const created = entry('/repos/new');
    const registry = {
      getRepositoryByPath: jest.fn(async () => null),
      registerRepository: jest.fn(async () => created),
    };
    const broadcastAdded = jest.fn();
    const registerWithMonitoring = jest.fn(async () => {});

    const result = await registerRepository('/repos/new', 'git@x:y/z.git', {
      registry,
      broadcastAdded,
      registerWithMonitoring,
    });

    expect(result).toEqual({ entry: created, created: true });
    expect(registry.registerRepository).toHaveBeenCalledWith(
      '/repos/new',
      'git@x:y/z.git',
    );
    expect(broadcastAdded).toHaveBeenCalledWith(created);
    expect(registerWithMonitoring).toHaveBeenCalledWith(created);
  });

  it('returns an existing entry without side effects', async () => {
    const existing = entry('/repos/old');
    const registry = {
      getRepositoryByPath: jest.fn(async () => existing),
      registerRepository: jest.fn(),
    };
    const broadcastAdded = jest.fn();
    const registerWithMonitoring = jest.fn(async () => {});

    const result = await registerRepository('/repos/old', undefined, {
      registry,
      broadcastAdded,
      registerWithMonitoring,
    });

    expect(result).toEqual({ entry: existing, created: false });
    expect(registry.registerRepository).not.toHaveBeenCalled();
    expect(broadcastAdded).not.toHaveBeenCalled();
    expect(registerWithMonitoring).not.toHaveBeenCalled();
  });

  it('still succeeds when the broadcast throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const created = entry('/repos/new');
    const registry = {
      getRepositoryByPath: jest.fn(async () => null),
      registerRepository: jest.fn(async () => created),
    };
    const registerWithMonitoring = jest.fn(async () => {});

    const result = await registerRepository('/repos/new', undefined, {
      registry,
      broadcastAdded: () => {
        throw new Error('no windows');
      },
      registerWithMonitoring,
    });

    expect(result.created).toBe(true);
    expect(registerWithMonitoring).toHaveBeenCalledWith(created);
    jest.restoreAllMocks();
  });
});
