import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AcpArtifactAssociation } from '../../shared/main-process-api-interfaces/AcpAPI';

jest.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}));

import { AcpArtifactStore } from './AcpArtifactStore';

function makeStore(): { store: AcpArtifactStore; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acp-artifacts-'));
  const filePath = path.join(dir, 'artifacts.json');
  return { store: new AcpArtifactStore(filePath), filePath };
}

const topic: AcpArtifactAssociation = {
  kind: 'topic',
  id: 'topic-1',
  title: 'Bridge topic',
};
const drawing: AcpArtifactAssociation = {
  kind: 'drawing',
  id: 'notes',
};

describe('AcpArtifactStore', () => {
  it('round-trips artifacts per agent session', () => {
    const { store } = makeStore();
    store.save('opencode', 'ses_1', [topic]);

    expect(store.load('opencode', 'ses_1')).toEqual([topic]);
    expect(store.load('opencode', 'ses_2')).toEqual([]);
    expect(store.load('claude', 'ses_1')).toEqual([]);
  });

  it('dedupes by kind and id and removes empty sessions', () => {
    const { store } = makeStore();
    store.save('opencode', 'ses_1', [
      topic,
      { ...topic, title: 'New title' },
      drawing,
    ]);

    expect(store.load('opencode', 'ses_1')).toEqual([
      { ...topic, title: 'New title' },
      drawing,
    ]);

    store.save('opencode', 'ses_1', []);
    expect(store.load('opencode', 'ses_1')).toEqual([]);
  });

  it('ignores malformed files and invalid artifacts', () => {
    const { store, filePath } = makeStore();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{not json');
    expect(store.load('opencode', 'ses_1')).toEqual([]);

    store.save('opencode', 'ses_1', [
      topic,
      { kind: 'topic', id: '' } as never,
      { kind: 'unknown', id: 'x' } as never,
    ]);
    expect(store.load('opencode', 'ses_1')).toEqual([topic]);
  });

  it('prunes old sessions beyond the cap', () => {
    const { store, filePath } = makeStore();
    for (let index = 0; index < 505; index += 1) {
      store.save('opencode', `ses_${index}`, [
        { kind: 'topic', id: `topic-${index}` },
      ]);
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      sessions: Record<string, unknown>;
    };
    expect(Object.keys(raw.sessions).length).toBeLessThanOrEqual(500);
  });
});
