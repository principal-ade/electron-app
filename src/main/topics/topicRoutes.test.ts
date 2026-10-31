/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { TopicRegistryService } from '../stores/TopicRegistryService';
import { TopicAPIEvent } from '../../shared/main-process-api-interfaces/TopicAPI';
import { broadcastTopicEvent } from './tipc/topicRouter';
import { registerTopicRoutes } from './topicRoutes';
import {
  topicRevision,
  TopicNotFoundError,
  TopicUpdateConflictError,
} from './topicRevision';

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
      patch: jest.fn(),
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

describe.each([
  ['post', '/api/topics/:id/description/append', { text: 'New findings' }],
  [
    'post',
    '/api/topics/:id/description/section',
    { heading: 'Status', body: 'Done' },
  ],
  ['post', '/api/topics/:id/subsystem-models', { modelId: 'model-1' }],
  ['delete', '/api/topics/:id/subsystem-models/:modelId', {}],
])('read-modify-write conflict safety for %s %s', (method, path, body) => {
  const existing = {
    id: 'topic-owner',
    title: 'Original',
    description: 'Original brief',
    createdAt: '2026-10-31T00:00:00.000Z',
    updatedAt: '2026-10-31T00:00:00.000Z',
  };
  function handler(updateTopic: jest.Mock) {
    const app = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    registerTopicRoutes(
      app as unknown as Application,
      {
        getTopic: jest.fn().mockResolvedValue(existing),
        updateTopic,
      } as unknown as TopicRegistryService,
    );
    const registrations = method === 'post' ? app.post : app.delete;
    return registrations.mock.calls.find(([route]) => route === path)[1] as (
      req: Request,
      res: Response,
    ) => Promise<void>;
  }
  const req = () =>
    ({
      params: { id: existing.id, modelId: 'model-1' },
      body,
    }) as unknown as Request;

  test('guards the computed update against its original revision', async () => {
    const updateTopic = jest.fn().mockResolvedValue(existing);
    await handler(updateTopic)(req(), response() as unknown as Response);
    expect(updateTopic).toHaveBeenCalledWith(
      existing.id,
      expect.any(Object),
      topicRevision(existing),
    );
    expect(broadcastTopicEvent).toHaveBeenCalledWith(
      TopicAPIEvent.TOPIC_UPDATED,
      existing,
    );
  });

  test('returns a conflict rather than broadcasting stale content', async () => {
    const res = response();
    const updateTopic = jest
      .fn()
      .mockRejectedValue(new TopicUpdateConflictError(existing));
    await handler(updateTopic)(req(), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(broadcastTopicEvent).not.toHaveBeenCalled();
  });
});

test('creates and broadcasts a topic with all five reference types', async () => {
  const body = {
    title: '  All references  ',
    description: '## Goal\nExercise the reference rail.',
    repos: ['pkg:github/principal-ade/electron-app'],
    subsystemModels: [{ modelId: 'sg-123-abc', trailIds: ['flow-a'] }],
    references: [
      { kind: 'c4-sketch', sketchId: 'c4s-123-abc' },
      { kind: 'drawing', drawingId: 'drawing-123' },
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

describe('topic updates', () => {
  const existing = {
    id: 'topic-owner',
    title: 'Original',
    description: 'Original brief',
    createdAt: '2026-10-31T00:00:00.000Z',
    updatedAt: '2026-10-31T00:00:00.000Z',
  };
  function handlers(updateTopic = jest.fn().mockResolvedValue(existing)) {
    const patch = jest.fn();
    const get = jest.fn();
    registerTopicRoutes(
      {
        post: jest.fn(),
        get,
        patch,
        delete: jest.fn(),
      } as unknown as Application,
      {
        updateTopic,
        getTopic: jest.fn().mockResolvedValue(existing),
      } as unknown as TopicRegistryService,
    );
    return {
      updateTopic,
      patch: patch.mock.calls.find(
        ([path]) => path === '/api/topics/:id',
      )[1] as (req: Request, res: Response) => Promise<void>,
      get: get.mock.calls.find(([path]) => path === '/api/topics/:id')[1] as (
        req: Request,
        res: Response,
      ) => Promise<void>,
    };
  }
  const request = (body: unknown) =>
    ({ params: { id: existing.id }, body }) as unknown as Request;
  const revision = topicRevision(existing);

  test('reads an opaque revision alongside the topic', async () => {
    const res = response();
    await handlers().get(request(undefined), res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      topic: existing,
      revision,
    });
  });

  test('patches all editable fields, canonicalizes references, and broadcasts', async () => {
    const { patch, updateTopic } = handlers();
    const res = response();
    await patch(
      request({
        expectedRevision: revision,
        title: '  Updated  ',
        description: '## Reorganized\nCurrent',
        repos: ['pkg:github/owner/repo'],
        subsystemModels: [{ modelId: ' model-1 ', trailIds: ['flow'] }],
        references: [
          { kind: 'topic', topicId: ' related ' },
          { kind: 'topic', topicId: 'related' },
          { kind: 'drawing', drawingId: 'drawing-1' },
          { kind: 'c4-sketch', sketchId: 'sketch-1' },
        ],
      }),
      res as unknown as Response,
    );
    expect(updateTopic).toHaveBeenCalledWith(
      existing.id,
      {
        title: 'Updated',
        description: '## Reorganized\nCurrent',
        repos: ['pkg:github/owner/repo'],
        subsystemModels: [{ modelId: 'model-1', trailIds: ['flow'] }],
        references: [
          { kind: 'topic', topicId: 'related' },
          { kind: 'drawing', drawingId: 'drawing-1' },
          { kind: 'c4-sketch', sketchId: 'sketch-1' },
        ],
      },
      revision,
    );
    expect(broadcastTopicEvent).toHaveBeenCalledWith(
      TopicAPIEvent.TOPIC_UPDATED,
      existing,
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      topic: existing,
      revision,
    });
  });

  test.each([
    { description: '' },
    { repos: [], subsystemModels: [], references: [] },
    { title: 'New title' },
  ])(
    'preserves omission and supports explicit clearing: %p',
    async (updates) => {
      const { patch, updateTopic } = handlers();
      await patch(
        request({ expectedRevision: revision, ...updates }),
        response() as unknown as Response,
      );
      expect(updateTopic).toHaveBeenCalledWith(existing.id, updates, revision);
    },
  );

  test.each([
    null,
    [],
    'text',
    {},
    { title: 'No revision', expectedRevision: undefined },
    { expectedRevision: 'bad', title: 'Title' },
    { expectedRevision: revision },
    { title: '' },
    { title: 42 },
    { description: null },
    { repos: 'repo' },
    { repos: [42] },
    { subsystemModels: [{}] },
    { references: [{ kind: 'drawing', drawingId: '../bad' }] },
    { id: 'new-id' },
    { createdAt: 'changed' },
    { assets: [] },
    { visibility: 'public' },
  ])('rejects invalid updates without writing: %p', async (invalid) => {
    const { patch, updateTopic } = handlers();
    const body =
      invalid && typeof invalid === 'object' && !Array.isArray(invalid)
        ? { expectedRevision: revision, ...invalid }
        : invalid;
    const res = response();
    await patch(request(body), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateTopic).not.toHaveBeenCalled();
    expect(broadcastTopicEvent).not.toHaveBeenCalled();
  });

  test.each([
    [new TopicNotFoundError(), 404],
    [new TopicUpdateConflictError(existing), 409],
    [new Error('Disk unavailable'), 500],
  ])(
    'reports mutation failures without broadcasting: %p',
    async (error, status) => {
      const log = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const { patch } = handlers(jest.fn().mockRejectedValue(error));
        const res = response();
        await patch(
          request({ expectedRevision: revision, title: 'New' }),
          res as unknown as Response,
        );
        expect(res.status).toHaveBeenCalledWith(status);
        expect(broadcastTopicEvent).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    },
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
          { kind: 'drawing', drawingId: ' shared-id ' },
          { kind: 'topic', topicId: 'shared-id' },
          { kind: 'drawing', drawingId: 'shared-id' },
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
      { kind: 'drawing', drawingId: 'shared-id' },
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
  [{ kind: 'drawing', sketchId: 'd1' }],
  [{ kind: 'drawing', drawingId: '' }],
  [{ kind: 'drawing', drawingId: '../secrets' }],
  [{ kind: 'drawing', drawingId: 'a/b' }],
  [{ kind: 'drawing', drawingId: 'a\\b' }],
  [{ kind: 'drawing', drawingId: '..' }],
  [{ kind: 'drawing', drawingId: 'a b' }],
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
