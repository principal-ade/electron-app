/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { TopicRegistryService } from '../stores/TopicRegistryService';
import { TopicAPIEvent } from '../../shared/main-process-api-interfaces/TopicAPI';
import { broadcastTopicEvent } from './tipc/topicRouter';
import { registerTopicRoutes } from './topicRoutes';

jest.mock('./tipc/topicRouter', () => ({ broadcastTopicEvent: jest.fn() }));
jest.mock('../window/modernWindowManager', () => ({
  focusedOrMainWindow: jest.fn(),
}));
jest.mock('./validateTopicLinks', () => ({ validateTopicLinks: jest.fn() }));

function createHandler(createTopic: jest.Mock) {
  const post = jest.fn();
  registerTopicRoutes(
    {
      post,
      get: jest.fn(),
      delete: jest.fn(),
    } as unknown as Application,
    { createTopic } as unknown as TopicRegistryService,
  );
  const registration = post.mock.calls.find(([path]) => path === '/api/topics');
  if (!registration) throw new Error('Topic creation handler not registered');
  return registration[1] as (req: Request, res: Response) => Promise<void>;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

test('creates and broadcasts a topic with all four reference types', async () => {
  const body = {
    title: '  All references  ',
    description: '## Goal\nExercise the reference rail.',
    repos: ['pkg:github/principal-ade/electron-app'],
    subsystemModels: [{ modelId: 'sg-123-abc', trailIds: ['flow-a'] }],
    references: [
      { kind: 'c4-sketch', sketchId: 'c4s-123-abc' },
      { kind: 'topic', topicId: 'topic-related' },
    ],
  };
  const created = { ...body, title: 'All references', id: 'topic-owner' };
  const createTopic = jest.fn().mockResolvedValue(created);
  const res = response();
  await createHandler(createTopic)(
    { body } as Request,
    res as unknown as Response,
  );
  expect(createTopic).toHaveBeenCalledWith({
    ...body,
    title: 'All references',
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ success: true, topic: created });
  expect(broadcastTopicEvent).toHaveBeenCalledWith(
    TopicAPIEvent.TOPIC_ADDED,
    created,
  );
});

test('trims and deduplicates references while keeping kinds distinct and removing extra fields', async () => {
  const createTopic = jest.fn().mockResolvedValue({ id: 'topic-owner' });
  const res = response();
  await createHandler(createTopic)(
    {
      body: {
        title: 'References',
        references: [
          {
            kind: 'topic',
            topicId: ' shared-id ',
            title: 'Do not copy',
            url: 'https://storage.invalid',
          },
          { kind: 'c4-sketch', sketchId: 'shared-id' },
          { kind: 'topic', topicId: 'shared-id' },
        ],
      },
    } as Request,
    res as unknown as Response,
  );
  expect(createTopic).toHaveBeenCalledWith({
    title: 'References',
    references: [
      { kind: 'topic', topicId: 'shared-id' },
      { kind: 'c4-sketch', sketchId: 'shared-id' },
    ],
  });
});

test.each([{}, { references: [] }])(
  'keeps references optional, including explicit empty arrays: %p',
  async (extra) => {
    const createTopic = jest.fn().mockResolvedValue({ id: 'topic-owner' });
    const res = response();
    await createHandler(createTopic)(
      { body: { title: 'Plain', ...extra } } as Request,
      res as unknown as Response,
    );
    expect(createTopic).toHaveBeenCalledWith({ title: 'Plain', ...extra });
    expect(res.status).toHaveBeenCalledWith(201);
  },
);

test.each([
  null,
  'topic-a',
  {},
  [null],
  [[]],
  ['topic-a'],
  [{}],
  [{ kind: 'model', modelId: 'sg-1-abc' }],
  [{ kind: 'topic', topicId: '' }],
  [{ kind: 'topic', topicId: '   ' }],
  [{ kind: 'topic', topicId: 42 }],
  [{ kind: 'topic', sketchId: 'c4s-1-abc' }],
  [{ kind: 'c4-sketch', sketchId: null }],
  [{ kind: 'c4-sketch', sketchId: [] }],
  [{ kind: 'c4-sketch', sketchId: ' ' }],
  [{ kind: 'topic', topicId: 'valid' }, { kind: 'c4-sketch' }],
])(
  'rejects malformed references without writing or broadcasting: %p',
  async (references) => {
    const createTopic = jest.fn();
    const res = response();
    await createHandler(createTopic)(
      { body: { title: 'Invalid', references } } as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('references must be an array'),
    });
    expect(createTopic).not.toHaveBeenCalled();
    expect(broadcastTopicEvent).not.toHaveBeenCalled();
  },
);

test('keeps the existing title and repository validation', async () => {
  const createTopic = jest.fn();
  for (const body of [
    { title: '' },
    { title: 'Invalid repos', repos: 'not-an-array' },
  ]) {
    const res = response();
    await createHandler(createTopic)(
      { body } as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(createTopic).not.toHaveBeenCalled();
});

test('reports write failures without broadcasting a created topic', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const createTopic = jest
      .fn()
      .mockRejectedValue(new Error('Disk unavailable'));
    const res = response();
    await createHandler(createTopic)(
      { body: { title: 'Failure', references: [] } } as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(broadcastTopicEvent).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
