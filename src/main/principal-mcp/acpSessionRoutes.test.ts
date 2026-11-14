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
  deps: AcpSessionRouteDependencies;
} {
  const post = jest.fn();
  const deps: AcpSessionRouteDependencies = {
    getRepositoryDirectories: jest.fn(async () => ['/repos/acme']),
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
    ...overrides,
  };
  registerAcpSessionRoutes({ post } as unknown as Application, deps);
  const findHandler = (
    routePath: string,
  ): ((req: Request, res: Response) => Promise<void>) =>
    post.mock.calls.find(
      ([registeredPath]) => registeredPath === routePath,
    )?.[1] as (req: Request, res: Response) => Promise<void>;
  return {
    openHandler: findHandler('/api/acp/sessions/open'),
    promptHandler: findHandler('/api/acp/prompt'),
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
