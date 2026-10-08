import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SubsystemModelRegistryService } from './SubsystemModelRegistryService';

describe('SubsystemModelRegistryService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'subsystem-model-registry-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('lists models most recently edited first', async () => {
    await writeFile(
      join(directory, '_index.json'),
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'sg-100-old',
            title: 'Older model',
            updatedAt: '2025-01-01T00:00:00.000Z',
            componentCount: 1,
            edgeCount: 0,
          },
          {
            id: 'sg-101-new',
            title: 'Newest model',
            updatedAt: '2025-02-01T00:00:00.000Z',
            componentCount: 2,
            edgeCount: 1,
          },
        ],
      }),
    );

    const service = new SubsystemModelRegistryService(directory);
    const models = await service.listModels();

    expect(models.map((model) => model.id)).toEqual([
      'sg-101-new',
      'sg-100-old',
    ]);
  });
});
