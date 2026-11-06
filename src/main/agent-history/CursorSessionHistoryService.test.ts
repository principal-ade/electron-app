import {
  getSession,
  isDatabaseNotFoundError,
  listSessionSummaries,
  searchSessions,
} from 'cursor-history';
import { CursorSessionHistoryService } from './CursorSessionHistoryService';

jest.mock('cursor-history', () => ({
  getSession: jest.fn(),
  isDatabaseNotFoundError: jest.fn(
    (error: unknown) =>
      error instanceof Error && error.name === 'DatabaseNotFoundError',
  ),
  listSessionSummaries: jest.fn(),
  searchSessions: jest.fn(),
}));

const resolvedSummary = (overrides: Record<string, unknown> = {}) => ({
  id: 'cursor-session-1234',
  index: 0,
  indexScope: 'global',
  workspace: '/work/example',
  canonicalWorkspacePath: '/work/example',
  timestamp: '2026-08-01T10:00:00.000Z',
  title: 'Update package scripts',
  preview: 'Update package scripts',
  messageCount: 4,
  resolvedSource: 'store-transcript',
  resolutionState: 'complete',
  metadata: { lastModified: '2026-08-01T10:05:00.000Z' },
  ...overrides,
});

describe('CursorSessionHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists resolved Cursor sessions and marks IDE Composer chats non-resumable', async () => {
    jest.mocked(listSessionSummaries).mockResolvedValue({
      data: [
        resolvedSummary(),
        resolvedSummary({
          id: 'cursor-composer-1234',
          title: 'Old Composer conversation',
          resolvedSource: 'composer',
        }),
        { id: 'ambiguous', resolutionState: 'ambiguous' },
      ] as never,
      pagination: { total: 3, limit: 100, offset: 0, hasMore: false },
    });
    const service = new CursorSessionHistoryService();

    await expect(service.list()).resolves.toEqual([
      {
        id: 'cursor-composer-1234',
        title: 'Old Composer conversation',
        directory: '/work/example',
        createdAt: Date.parse('2026-08-01T10:00:00.000Z'),
        updatedAt: Date.parse('2026-08-01T10:05:00.000Z'),
        resumable: false,
      },
      {
        id: 'cursor-session-1234',
        title: 'Update package scripts',
        directory: '/work/example',
        createdAt: Date.parse('2026-08-01T10:00:00.000Z'),
        updatedAt: Date.parse('2026-08-01T10:05:00.000Z'),
        resumable: true,
      },
    ]);
    expect(listSessionSummaries).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      sqliteDriver: 'node:sqlite',
    });
  });

  it('searches Cursor content and resumes only supported CLI sessions', async () => {
    jest.mocked(searchSessions).mockResolvedValue([
      {
        match: 'Needle in a Cursor conversation',
        session: {
          id: 'cursor-session-1234',
          workspace: '/work/example',
          canonicalWorkspacePath: '/work/example',
          timestamp: '2026-08-01T10:00:00.000Z',
          resolvedSource: 'store-transcript',
          metadata: { lastModified: '2026-08-01T10:05:00.000Z' },
          messages: [],
        },
      },
    ] as never);
    jest.mocked(getSession).mockResolvedValue({
      id: 'cursor-session-1234',
      workspace: '/work/example',
      canonicalWorkspacePath: '/work/example',
      timestamp: '2026-08-01T10:00:00.000Z',
      resolvedSource: 'store-transcript',
      messages: [],
      messageCount: 0,
    } as never);
    const service = new CursorSessionHistoryService();

    await expect(service.search('needle')).resolves.toMatchObject([
      {
        id: 'cursor-session-1234',
        title: 'Needle in a Cursor conversation',
        resumable: true,
      },
    ]);
    await expect(
      service.resume('/work/example', 'cursor-session-1234'),
    ).resolves.toBeUndefined();
    await expect(service.resume('/work/example', 'invalid;id')).rejects.toThrow(
      'Invalid Cursor session ID',
    );
    expect(searchSessions).toHaveBeenCalledWith('needle', {
      limit: 100,
      context: 0,
      sqliteDriver: 'node:sqlite',
    });
  });

  it('treats an uninstalled Cursor database as an empty history', async () => {
    const missing = Object.assign(new Error('missing'), {
      name: 'DatabaseNotFoundError',
    });
    jest.mocked(listSessionSummaries).mockRejectedValue(missing);
    jest.mocked(isDatabaseNotFoundError).mockReturnValue(true);
    const service = new CursorSessionHistoryService();

    await expect(service.list()).resolves.toEqual([]);
  });
});
