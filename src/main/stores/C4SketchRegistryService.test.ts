/** @jest-environment node */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { C4SketchRegistryService } from './C4SketchRegistryService';

const sketch = () => ({
  id: 'c4s-123-abc',
  title: 'Architecture',
  repoKeys: [],
  createdAt: '2026-10-28T00:00:00Z',
  updatedAt: '2026-10-28T00:00:00Z',
  notes: 'An authored hypothesis.',
  model: {
    view: 'container',
    system: { id: 'system:app', label: 'App' },
    nodes: [
      {
        id: 'container:host',
        label: 'Host',
        kind: 'container',
        containerKind: 'application',
        state: 'proposed',
      },
      {
        id: 'component:store',
        label: 'Store',
        kind: 'component',
        container: 'container:host',
        state: 'proposed',
      },
    ],
    edges: [
      {
        id: 'edge:call',
        source: 'container:host',
        target: 'component:store',
        label: 'Calls',
      },
    ],
  },
});

describe('C4SketchRegistryService', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'c4-sketch-registry-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads sketches without changing the stored authored graph', async () => {
    const content = JSON.stringify(sketch());
    const file = join(directory, 'c4s-123-abc.json');
    await writeFile(file, content);
    const loaded = await new C4SketchRegistryService(directory).getSketch(
      'c4s-123-abc',
    );
    expect(loaded).toMatchObject({
      title: 'Architecture',
      notes: 'An authored hypothesis.',
    });
    expect(loaded?.model.edges[0]).toMatchObject({ mechanisms: [], count: 1 });
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('returns null for missing, corrupt, and mismatched sketch files', async () => {
    const service = new C4SketchRegistryService(directory);
    expect(await service.getSketch('c4s-123-abc')).toBeNull();
    await writeFile(join(directory, 'c4s-123-abc.json'), '{');
    expect(await service.getSketch('c4s-123-abc')).toBeNull();
    await writeFile(
      join(directory, 'c4s-123-abc.json'),
      JSON.stringify({ ...sketch(), id: 'c4s-other-id' }),
    );
    expect(await service.getSketch('c4s-123-abc')).toBeNull();
  });

  it.each([
    '../secret',
    '../../c4s-123-abc',
    'c4s-123-abc/../../secret',
    '',
    '/tmp/secret',
  ])('rejects unsafe or invalid ids: %s', async (id) => {
    expect(
      await new C4SketchRegistryService(directory).getSketch(id),
    ).toBeNull();
  });

  it.each([
    (value: ReturnType<typeof sketch>) => {
      value.model.nodes[0].state = 'accepted';
    },
    (value: ReturnType<typeof sketch>) => {
      value.model.edges[0].target = 'missing';
    },
    (value: ReturnType<typeof sketch>) => {
      value.model.nodes[1].container = 'missing';
    },
    (value: ReturnType<typeof sketch>) => {
      value.model.nodes.push(value.model.nodes[0]);
    },
    (value: ReturnType<typeof sketch>) => {
      value.model.edges.push(value.model.edges[0]);
    },
  ])(
    'rejects invalid graphs and non-sketch element states (%#)',
    async (mutate) => {
      const value = sketch();
      mutate(value);
      await writeFile(
        join(directory, 'c4s-123-abc.json'),
        JSON.stringify(value),
      );
      expect(
        await new C4SketchRegistryService(directory).getSketch(value.id),
      ).toBeNull();
    },
  );

  it('propagates I/O errors rather than misreporting an unreadable sketch as missing', async () => {
    const read = jest
      .spyOn(require('node:fs').promises, 'readFile')
      .mockRejectedValueOnce(
        Object.assign(new Error('Denied'), { code: 'EACCES' }),
      );
    try {
      await expect(
        new C4SketchRegistryService(directory).getSketch('c4s-123-abc'),
      ).rejects.toThrow('Denied');
    } finally {
      read.mockRestore();
    }
  });
});
