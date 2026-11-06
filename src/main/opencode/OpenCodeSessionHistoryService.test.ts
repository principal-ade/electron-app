import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { OpenCodeSessionHistoryService } from './OpenCodeSessionHistoryService';

describe('OpenCodeSessionHistoryService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-history-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('lists the current project sessions through the OpenCode CLI', async () => {
    const run = jest.fn().mockResolvedValue(
      JSON.stringify([
        {
          id: 'ses_abc123',
          title: 'Fix session search',
          directory,
          created: 100,
          updated: 200,
        },
        { id: '../not-a-session', title: 'Ignore invalid IDs' },
      ]),
    );
    const service = new OpenCodeSessionHistoryService(run);

    await expect(service.list(directory)).resolves.toEqual([
      {
        id: 'ses_abc123',
        title: 'Fix session search',
        directory,
        createdAt: 100,
        updatedAt: 200,
      },
    ]);
    expect(run).toHaveBeenCalledWith(
      ['session', 'list', '--format', 'json', '--max-count', '100'],
      directory,
    );
  });

  it('combines and sorts sessions from multiple registered projects', async () => {
    const secondDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'opencode-history-project-'),
    );
    const run = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            id: 'ses_project1',
            title: 'Older project session',
            directory,
            updated: 100,
          },
        ]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            id: 'ses_project2',
            title: 'Newer project session',
            directory: secondDirectory,
            updated: 200,
          },
        ]),
      );
    const service = new OpenCodeSessionHistoryService(run);

    try {
      await expect(
        service.listProjects([
          directory,
          path.join(directory, 'deleted-clone'),
          secondDirectory,
          directory,
        ]),
      ).resolves.toMatchObject([
        { id: 'ses_project2', directory: secondDirectory },
        { id: 'ses_project1', directory },
      ]);
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      await fs.rm(secondDirectory, { recursive: true, force: true });
    }
  });

  it('searches sanitized transcript exports and short-circuits title matches', async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([
          { id: 'ses_title1', title: 'Needle in title', directory },
          { id: 'ses_body01', title: 'Investigate login', directory },
        ]),
      )
      .mockResolvedValueOnce('{"messages":[{"text":"needle in transcript"}]}');
    const service = new OpenCodeSessionHistoryService(run);

    await expect(service.search(directory, 'needle')).resolves.toMatchObject([
      { id: 'ses_title1', title: 'Needle in title' },
      { id: 'ses_body01', title: 'Investigate login' },
    ]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(
      ['session', 'export', '--sanitize', 'ses_body01'],
      directory,
    );
  });

  it('returns a resume target only for a session in the selected project', async () => {
    const run = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify([
          { id: 'ses_resume1', title: 'Continue work', directory },
        ]),
      );
    const service = new OpenCodeSessionHistoryService(run);

    await expect(
      service.getResumeTarget(directory, 'ses_resume1'),
    ).resolves.toEqual({
      cwd: directory,
      title: 'Continue work',
      executable: 'opencode',
      args: ['--session', 'ses_resume1'],
    });
    await expect(
      service.getResumeTarget(directory, 'ses_unknown1'),
    ).rejects.toThrow('OpenCode session was not found in this project');
    await expect(
      service.getResumeTarget(directory, '$(rm -rf /)'),
    ).rejects.toThrow('Invalid OpenCode session ID');
  });

  it('rejects non-absolute and missing project directories', async () => {
    const service = new OpenCodeSessionHistoryService(jest.fn());
    await expect(service.list('relative/path')).rejects.toThrow(
      'Project directory must be an absolute path',
    );
    await expect(service.list(path.join(directory, 'missing'))).rejects.toThrow(
      'Project directory does not exist',
    );
  });
});
