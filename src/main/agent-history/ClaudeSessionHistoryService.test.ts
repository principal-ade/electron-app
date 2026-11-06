import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ClaudeSessionHistoryService } from './ClaudeSessionHistoryService';

describe('ClaudeSessionHistoryService', () => {
  let root: string;
  let directory: string;
  const sessionId = '11111111-aaaa-bbbb-cccc-000000000001';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-history-'));
    directory = '/Users/tester/Projects/example';
    const projectStorage = path.join(
      root,
      'projects',
      '-Users-tester-Projects-example',
    );
    await fs.mkdir(projectStorage, { recursive: true });
    const rows = [
      {
        type: 'user',
        isMeta: true,
        cwd: directory,
        sessionId,
        timestamp: '2026-08-01T09:59:00.000Z',
        message: { role: 'user', content: 'metadata' },
      },
      {
        type: 'user',
        isMeta: false,
        cwd: directory,
        sessionId,
        timestamp: '2026-08-01T10:00:00.000Z',
        message: {
          role: 'user',
          content: 'Please fix the login flow and keep the redirect behavior.',
        },
      },
      {
        type: 'assistant',
        cwd: directory,
        sessionId,
        timestamp: '2026-08-01T10:01:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Done.' }],
        },
      },
    ];
    await fs.writeFile(
      path.join(projectStorage, `${sessionId}.jsonl`),
      rows.map((row) => JSON.stringify(row)).join('\n'),
    );
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('lists sessions from local Claude JSONL transcripts', async () => {
    const service = new ClaudeSessionHistoryService(root);

    await expect(service.list()).resolves.toMatchObject([
      {
        id: sessionId,
        title: 'Please fix the login flow and keep the redirect behavior.',
        directory,
      },
    ]);
  });

  it('searches transcript contents and validates resume targets', async () => {
    const service = new ClaudeSessionHistoryService(root);

    await expect(service.search('redirect behavior')).resolves.toMatchObject([
      { id: sessionId, directory },
    ]);
    await expect(service.search('not present')).resolves.toEqual([]);
    await expect(service.resume(directory, sessionId)).resolves.toMatchObject({
      id: sessionId,
      directory,
    });
    await expect(
      service.resume(directory, '11111111-aaaa-bbbb-cccc-000000000002'),
    ).rejects.toThrow('Claude Code session was not found');
  });

  it('returns an empty list when Claude Code history has not been created', async () => {
    const service = new ClaudeSessionHistoryService(path.join(root, 'missing'));
    await expect(service.list()).resolves.toEqual([]);
  });
});
