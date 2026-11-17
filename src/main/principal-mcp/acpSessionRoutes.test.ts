/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import {
  registerAcpSessionRoutes,
  type AcpSessionRouteDependencies,
} from './acpSessionRoutes';

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function setup(overrides: Partial<AcpSessionRouteDependencies> = {}): {
  openHandler: (req: Request, res: Response) => Promise<void>;
  promptHandler: (req: Request, res: Response) => Promise<void>;
  sessionsHandler: (req: Request, res: Response) => Promise<void>;
  toolCallsHandler: (req: Request, res: Response) => Promise<void>;
  artifactsHandler: (req: Request, res: Response) => Promise<void>;
  deps: AcpSessionRouteDependencies;
} {
  const post = jest.fn();
  const get = jest.fn();
  const deps: AcpSessionRouteDependencies = {
    getRepositoryDirectories: jest.fn(async () => ['/repos/acme']),
    listActiveSessions: jest.fn(() => [
      {
        sessionId: 'ses_1',
        agentId: 'opencode',
        agentName: 'OpenCode',
        directory: '/repos/acme/app',
        isPrompting: false,
        toolCallCount: 1,
        lastActivityAt: 123,
      },
      {
        sessionId: 'ses_outside',
        agentId: 'opencode',
        agentName: 'OpenCode',
        directory: '/private',
        isPrompting: false,
        toolCallCount: 0,
      },
    ]),
    getToolCallsForSession: jest.fn(() => [
      {
        toolCallId: 'call_1',
        title: 'Reading package.json',
        name: 'read_file',
        kind: 'read',
        status: 'completed',
        locations: [{ path: '/repos/acme/app/package.json', line: 1 }],
        highlightPaths: ['app/package.json'],
        processing: 'highlighted',
        updatedAt: 123,
      },
    ]),
    startSession: jest.fn(async () => ({
      agentName: 'OpenCode',
      alreadyRunning: false,
    })),
    getActiveSessionInfo: jest.fn(() => ({
      sessionKey: 'acp-/repos/acme/app',
      agentName: 'OpenCode',
      hasSession: true,
      isPrompting: false,
    })),
    prompt: jest.fn(async () => ({
      stopReason: 'end_turn',
      sessionUpdates: { agent_message_chunk: 2, tool_call: 1 },
    })),
    associateArtifact: jest.fn(() => true),
    ...overrides,
  };
  registerAcpSessionRoutes({ get, post } as unknown as Application, deps);
  const findHandler = (
    routePath: string,
  ): ((req: Request, res: Response) => Promise<void>) =>
    post.mock.calls.find(
      ([registeredPath]) => registeredPath === routePath,
    )?.[1] as (req: Request, res: Response) => Promise<void>;
  return {
    openHandler: findHandler('/api/acp/sessions/open'),
    promptHandler: findHandler('/api/acp/prompt'),
    sessionsHandler: get.mock.calls.find(
      ([registeredPath]) => registeredPath === '/api/acp/sessions',
    )?.[1] as (req: Request, res: Response) => Promise<void>,
    toolCallsHandler: get.mock.calls.find(
      ([registeredPath]) =>
        registeredPath === '/api/acp/sessions/:sessionId/tool-calls',
    )?.[1] as (req: Request, res: Response) => Promise<void>,
    artifactsHandler: findHandler('/api/acp/sessions/:sessionId/artifacts'),
    deps,
  };
}

const validRequest = {
  headers: {},
  body: {
    directory: '/repos/acme/app',
    text: 'Create a small test change.',
  },
} as unknown as Request;

test('prompts a connected ACP session and returns update counts only', async () => {
  const { promptHandler, deps } = setup();
  const res = response();

  await promptHandler(validRequest, res);

  expect(deps.prompt).toHaveBeenCalledWith(
    'acp-/repos/acme/app',
    'Create a small test change.',
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    agent: 'OpenCode',
    stopReason: 'end_turn',
    sessionUpdates: { agent_message_chunk: 2, tool_call: 1 },
  });
});

test('rejects browser-origin requests', async () => {
  const { promptHandler, deps } = setup();
  const res = response();

  await promptHandler(
    {
      headers: { origin: 'https://example.test' },
      body: validRequest.body,
    } as unknown as Request,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(403);
  expect(deps.prompt).not.toHaveBeenCalled();
});

test('rejects directories outside registered repositories', async () => {
  const { promptHandler, deps } = setup();
  const res = response();

  await promptHandler(
    {
      headers: {},
      body: { directory: '/private', text: 'Do something.' },
    } as unknown as Request,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(400);
  expect(deps.getActiveSessionInfo).not.toHaveBeenCalled();
  expect(deps.prompt).not.toHaveBeenCalled();
});

test('requires a unique active ACP session with a started session', async () => {
  const noSession = setup({
    getActiveSessionInfo: jest.fn(() => ({
      sessionKey: 'acp-/repos/acme/app',
      agentName: 'OpenCode',
      hasSession: false,
      isPrompting: false,
    })),
  });
  const noSessionResponse = response();
  await noSession.promptHandler(validRequest, noSessionResponse);
  expect(noSessionResponse.status).toHaveBeenCalledWith(409);
  expect(noSession.deps.prompt).not.toHaveBeenCalled();

  const noConnection = setup({
    getActiveSessionInfo: jest.fn(() => null),
  });
  const noConnectionResponse = response();
  await noConnection.promptHandler(validRequest, noConnectionResponse);
  expect(noConnectionResponse.status).toHaveBeenCalledWith(404);
  expect(noConnection.deps.prompt).not.toHaveBeenCalled();

  const prompting = setup({
    getActiveSessionInfo: jest.fn(() => ({
      sessionKey: 'acp-/repos/acme/app',
      agentName: 'OpenCode',
      hasSession: true,
      isPrompting: true,
    })),
  });
  const promptingResponse = response();
  await prompting.promptHandler(validRequest, promptingResponse);
  expect(promptingResponse.status).toHaveBeenCalledWith(409);
  expect(prompting.deps.prompt).not.toHaveBeenCalled();
});

test('rejects malformed and oversized prompts', async () => {
  const { promptHandler, deps } = setup();
  const badBodies = [
    { directory: '/repos/acme/app', text: '   ' },
    {
      directory: '/repos/acme/app',
      text: 'x'.repeat(20_001),
    },
    {
      directory: '/repos/acme/app',
      text: 'hello',
      autoApprove: true,
    },
  ];

  for (const body of badBodies) {
    const res = response();
    await promptHandler({ headers: {}, body } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(deps.prompt).not.toHaveBeenCalled();
});

test('opens an ACP session through the Principal renderer', async () => {
  const { openHandler, deps } = setup();
  const res = response();

  await openHandler(
    {
      headers: {},
      body: { directory: '/repos/acme/app' },
    } as unknown as Request,
    res,
  );

  expect(deps.startSession).toHaveBeenCalledWith('/repos/acme/app');
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    opened: true,
    alreadyRunning: false,
    agent: 'OpenCode',
  });
});

test('lists only active ACP sessions in registered repositories', async () => {
  const { sessionsHandler } = setup();
  const res = response();

  await sessionsHandler({ headers: {}, query: {} } as unknown as Request, res);

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    sessions: [
      expect.objectContaining({
        sessionId: 'ses_1',
        directory: '/repos/acme/app',
      }),
    ],
  });
});

test('returns bounded tool-call summaries without raw input or output', async () => {
  const { toolCallsHandler, deps } = setup();
  const res = response();

  await toolCallsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      query: { limit: '1' },
    } as unknown as Request,
    res,
  );

  expect(deps.getToolCallsForSession).toHaveBeenCalledWith(
    'ses_1',
    '/repos/acme/app',
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    session: expect.objectContaining({ sessionId: 'ses_1' }),
    toolCalls: [
      expect.objectContaining({
        toolCallId: 'call_1',
        processing: 'highlighted',
        highlightPaths: ['app/package.json'],
        locations: [{ path: 'app/package.json', line: 1 }],
      }),
    ],
    count: 1,
    limit: 1,
  });
  const payload = (res.json as jest.Mock).mock.calls[0][0];
  expect(payload.toolCalls[0]).not.toHaveProperty('rawInput');
  expect(payload.toolCalls[0]).not.toHaveProperty('rawOutput');
});

test('rejects browser-origin ACP inspection requests', async () => {
  const { sessionsHandler, toolCallsHandler, deps } = setup();
  const listResponse = response();
  const callsResponse = response();

  await sessionsHandler(
    {
      headers: { origin: 'https://example.test' },
      query: {},
    } as unknown as Request,
    listResponse,
  );
  await toolCallsHandler(
    {
      headers: { origin: 'https://example.test' },
      params: { sessionId: 'ses_1' },
      query: {},
    } as unknown as Request,
    callsResponse,
  );

  expect(listResponse.status).toHaveBeenCalledWith(403);
  expect(callsResponse.status).toHaveBeenCalledWith(403);
  expect(deps.getToolCallsForSession).not.toHaveBeenCalled();
});

test('validates ACP open requests before dispatching', async () => {
  const { openHandler, deps } = setup();
  const outsideRepo = response();
  await openHandler(
    {
      headers: {},
      body: { directory: '/private' },
    } as unknown as Request,
    outsideRepo,
  );
  expect(outsideRepo.status).toHaveBeenCalledWith(400);
  expect(deps.startSession).not.toHaveBeenCalled();

  const malformed = response();
  await openHandler(
    {
      headers: {},
      body: { directory: '/repos/acme/app', agent: 'claude' },
    } as unknown as Request,
    malformed,
  );
  expect(malformed.status).toHaveBeenCalledWith(400);
  expect(deps.startSession).not.toHaveBeenCalled();
});

test('associates an artifact with an active ACP session', async () => {
  const { artifactsHandler, deps } = setup();
  const res = response();

  await artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      body: { kind: 'subsystem-model', id: 'sm_123', title: 'ACP bridge' },
    } as unknown as Request,
    res,
  );

  expect(deps.associateArtifact).toHaveBeenCalledWith(
    'ses_1',
    { kind: 'subsystem-model', id: 'sm_123', title: 'ACP bridge' },
    '/repos/acme/app',
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    artifact: { kind: 'subsystem-model', id: 'sm_123', title: 'ACP bridge' },
  });
});

test('associates a drawing with an active ACP session', async () => {
  const { artifactsHandler, deps } = setup();
  const res = response();

  await artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      body: { kind: 'drawing', id: 'launch-plan', title: 'Launch plan' },
    } as unknown as Request,
    res,
  );

  expect(deps.associateArtifact).toHaveBeenCalledWith(
    'ses_1',
    { kind: 'drawing', id: 'launch-plan', title: 'Launch plan' },
    '/repos/acme/app',
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    artifact: { kind: 'drawing', id: 'launch-plan', title: 'Launch plan' },
  });
});

test('omits a blank title when associating an artifact', async () => {
  const { artifactsHandler, deps } = setup();
  const res = response();

  await artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      body: { kind: 'topic', id: 'topic-123', title: '   ' },
    } as unknown as Request,
    res,
  );

  expect(deps.associateArtifact).toHaveBeenCalledWith(
    'ses_1',
    { kind: 'topic', id: 'topic-123' },
    '/repos/acme/app',
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    artifact: { kind: 'topic', id: 'topic-123' },
  });
});

test('rejects malformed artifact association requests', async () => {
  const { artifactsHandler, deps } = setup();
  const badBodies = [
    { kind: 'file', id: 'abc' },
    { kind: 'topic' },
    { kind: 'topic', id: '' },
    { kind: 'topic', id: 'x'.repeat(201) },
    { kind: 'topic', id: 'abc', title: 'x'.repeat(301) },
    { kind: 'topic', id: 'abc', title: 5 },
    { kind: 'topic', id: 'abc', directory: 'relative/path' },
    { kind: 'topic', id: 'abc', extra: true },
  ];

  for (const body of badBodies) {
    const res = response();
    await artifactsHandler(
      {
        headers: {},
        params: { sessionId: 'ses_1' },
        body,
      } as unknown as Request,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(deps.associateArtifact).not.toHaveBeenCalled();
});

test('rejects browser-origin artifact association requests', async () => {
  const { artifactsHandler, deps } = setup();
  const res = response();

  await artifactsHandler(
    {
      headers: { origin: 'https://example.test' },
      params: { sessionId: 'ses_1' },
      body: { kind: 'topic', id: 'topic-123' },
    } as unknown as Request,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(403);
  expect(deps.associateArtifact).not.toHaveBeenCalled();
});

test('returns 404 when no active session matches the association', async () => {
  const noSessions = setup({ listActiveSessions: jest.fn(() => []) });
  const noSessionsResponse = response();
  await noSessions.artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_missing' },
      body: { kind: 'topic', id: 'topic-123' },
    } as unknown as Request,
    noSessionsResponse,
  );
  expect(noSessionsResponse.status).toHaveBeenCalledWith(404);
  expect(noSessions.deps.associateArtifact).not.toHaveBeenCalled();

  const rejected = setup({ associateArtifact: jest.fn(() => false) });
  const rejectedResponse = response();
  await rejected.artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      body: { kind: 'topic', id: 'topic-123' },
    } as unknown as Request,
    rejectedResponse,
  );
  expect(rejectedResponse.status).toHaveBeenCalledWith(404);
});

test('returns 409 when the session id is ambiguous', async () => {
  const { artifactsHandler, deps } = setup({
    listActiveSessions: jest.fn(() => [
      {
        sessionId: 'ses_1',
        agentId: 'opencode',
        agentName: 'OpenCode',
        directory: '/repos/acme/app',
        isPrompting: false,
        toolCallCount: 0,
      },
      {
        sessionId: 'ses_1',
        agentId: 'opencode',
        agentName: 'OpenCode',
        directory: '/repos/acme/other',
        isPrompting: false,
        toolCallCount: 0,
      },
    ]),
  });
  const res = response();

  await artifactsHandler(
    {
      headers: {},
      params: { sessionId: 'ses_1' },
      body: { kind: 'topic', id: 'topic-123' },
    } as unknown as Request,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(409);
  expect(deps.associateArtifact).not.toHaveBeenCalled();
});
